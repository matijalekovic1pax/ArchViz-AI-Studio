/**
 * API Gateway Client
 *
 * All vendor API calls go through the Cloudflare Worker gateway.
 * The gateway adds API keys server-side — no secrets in the client.
 */

import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import type {
  FeedbackActivityItem,
  FeedbackDocumentAttachment,
  FeedbackImageAnnotation,
  FeedbackProjectSnapshot,
  FeedbackReportCategory,
  FeedbackReportDetail,
  FeedbackReportPriority,
  FeedbackReportStatus,
  FeedbackReportSummary,
  GenerationMode,
} from '../types';

const DEFAULT_GATEWAY_URL = import.meta.env.PROD
  ? 'https://archviz-api-gateway.matija-lekovic.workers.dev'
  : 'http://localhost:8787';
const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || DEFAULT_GATEWAY_URL;
const VIDEO_GENERATE_TIMEOUT_MS = 240_000;
const OPENAI_TEXT_TIMEOUT_MS = 180_000;
const OPENAI_IMAGE_TIMEOUT_MS = 10 * 60_000;
const GEMINI_PRO_IMAGE_TIMEOUT_MS = 10 * 60_000;
const LOG_EVENT_TIMEOUT_MS = 15_000;
const LOG_STRING_PREVIEW_CHARS = 1200;
const LOG_PROMPT_MAX_CHARS = 80_000;
const LOG_JSON_MAX_DEPTH = 6;
const LOG_JSON_MAX_ARRAY_ITEMS = 80;
const LOG_JSON_MAX_OBJECT_KEYS = 100;
const OPENAI_IMAGE_MODEL = 'gpt-image-2';
const OPENAI_IMAGE_MAX_OUTPUTS = 10;
const IMAGE_EDIT_TIMEOUT_MS = 10 * 60_000;
const OPENAI_IMAGE_ALLOWED_SIZES = ['1024x1024', '1024x1536', '1536x1024', 'auto'] as const;
const OPENAI_IMAGE_MAX_EDGE = 3840;
const OPENAI_IMAGE_MIN_PIXELS = 655_360;
const OPENAI_IMAGE_MAX_PIXELS = 8_294_400;
const OPENAI_IMAGE_SIZE_MULTIPLE = 16;

const JWT_SESSION_KEY = 'archviz_jwt';

let _jwt: string | null = null;
let _jwtExpiresAt: number = 0;
let _onSessionExpired: (() => void) | null = null;
let _activeGenerationTraceId: string | null = null;

const asGatewayErrorDetails = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const readPositiveSeconds = (value: unknown): number | undefined => {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numeric) && numeric >= 0 ? Math.ceil(numeric) : undefined;
};

const parseRetryAfterSeconds = (value: string | null, now = Date.now()): number | undefined => {
  if (!value) return undefined;
  const normalizedValue = value.trim();
  if (!normalizedValue) return undefined;
  const deltaSeconds = readPositiveSeconds(normalizedValue);
  if (deltaSeconds !== undefined) return deltaSeconds;
  const retryAt = Date.parse(normalizedValue);
  return Number.isFinite(retryAt) ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : undefined;
};

const getGatewayErrorMessage = (details: unknown, fallback: string): string => {
  const record = asGatewayErrorDetails(details);
  const error = record?.error;
  if (typeof error === 'string' && error.trim()) return error.trim();
  const nestedError = asGatewayErrorDetails(error);
  if (typeof nestedError?.message === 'string' && nestedError.message.trim()) {
    return nestedError.message.trim();
  }
  if (typeof record?.message === 'string' && record.message.trim()) return record.message.trim();
  return fallback;
};

export class GatewayApiError extends Error {
  public readonly code?: string;
  public readonly requestId?: string;
  public readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    public status: number,
    public provider?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'GatewayApiError';
    const detailRecord = asGatewayErrorDetails(details);
    this.code = typeof detailRecord?.code === 'string' ? detailRecord.code : undefined;
    this.requestId = typeof detailRecord?.requestId === 'string' ? detailRecord.requestId : undefined;
    this.retryAfterSeconds = readPositiveSeconds(detailRecord?.retryAfterSeconds);
  }
}

export type ImageEditGatewayErrorKind =
  | 'gateway-concurrency-limit'
  | 'gateway-rate-limit'
  | 'upstream-rate-limit'
  | 'invalid-request'
  | 'payload-too-large'
  | 'authorization'
  | 'upstream-unavailable'
  | 'unknown';

export interface ImageEditGatewayErrorInfo {
  kind: ImageEditGatewayErrorKind;
  status: number;
  message: string;
  code?: string;
  requestId?: string;
  retryAfterSeconds?: number;
}

/**
 * Preserve the distinction between our image-edit guard and OpenAI failures.
 * Both can return HTTP 429, but only guard responses carry one of our stable
 * `image_edit_*` codes. Callers must not infer the source from status alone.
 */
export const getImageEditGatewayErrorInfo = (error: unknown): ImageEditGatewayErrorInfo | null => {
  if (!(error instanceof GatewayApiError) || error.provider !== 'openai-image-edit') return null;

  let kind: ImageEditGatewayErrorKind = 'unknown';
  if (error.code === 'image_edit_concurrency_limited') {
    kind = 'gateway-concurrency-limit';
  } else if (error.code === 'image_edit_rate_limited') {
    kind = 'gateway-rate-limit';
  } else if (error.status === 429) {
    kind = 'upstream-rate-limit';
  } else if (error.status === 413) {
    kind = 'payload-too-large';
  } else if (error.status === 400 || error.status === 409 || error.status === 422) {
    kind = 'invalid-request';
  } else if (error.status === 401 || error.status === 403) {
    kind = 'authorization';
  } else if (error.status === 500 || error.status === 502 || error.status === 503 || error.status === 504) {
    kind = 'upstream-unavailable';
  }

  return {
    kind,
    status: error.status,
    message: error.message,
    ...(error.code ? { code: error.code } : {}),
    ...(error.requestId ? { requestId: error.requestId } : {}),
    ...(error.retryAfterSeconds !== undefined ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
  };
};

export interface GatewaySessionDiagnostics {
  gatewayUrl: string;
  hasConfiguredGatewayUrl: boolean;
  hasStoredSession: boolean;
  authenticated: boolean;
  expiresAt: number | null;
  expiresInMs: number | null;
}

// ─── Token Management ────────────────────────────────────────────────────────

export function setGatewayToken(token: string, expiresIn: number): void {
  _jwt = token;
  _jwtExpiresAt = Date.now() + expiresIn * 1000;
  try {
    sessionStorage.setItem(JWT_SESSION_KEY, JSON.stringify({ token, expiresAt: _jwtExpiresAt }));
  } catch {}
}

export function getGatewayToken(): string | null {
  if (!_jwt) {
    try {
      const stored = sessionStorage.getItem(JWT_SESSION_KEY);
      if (stored) {
        const { token, expiresAt } = JSON.parse(stored);
        if (Date.now() < expiresAt) {
          _jwt = token;
          _jwtExpiresAt = expiresAt;
        } else {
          sessionStorage.removeItem(JWT_SESSION_KEY);
        }
      }
    } catch {}
  }
  if (_jwt && Date.now() < _jwtExpiresAt) return _jwt;
  _jwt = null;
  return null;
}

export function clearGatewayToken(): void {
  _jwt = null;
  _jwtExpiresAt = 0;
  try { sessionStorage.removeItem(JWT_SESSION_KEY); } catch {}
}

export function isGatewayAuthenticated(): boolean {
  return getGatewayToken() !== null;
}

export function getGatewaySessionDiagnostics(): GatewaySessionDiagnostics {
  const token = getGatewayToken();
  let expiresAt: number | null = null;
  try {
    const stored = sessionStorage.getItem(JWT_SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.expiresAt === 'number') {
        expiresAt = parsed.expiresAt;
      }
    }
  } catch {}

  const effectiveExpiresAt = _jwtExpiresAt || expiresAt;
  const expiresInMs = effectiveExpiresAt ? Math.max(0, effectiveExpiresAt - Date.now()) : null;

  return {
    gatewayUrl: GATEWAY_URL,
    hasConfiguredGatewayUrl: Boolean(import.meta.env.VITE_API_GATEWAY_URL),
    hasStoredSession: Boolean(token),
    authenticated: Boolean(token),
    expiresAt: effectiveExpiresAt || null,
    expiresInMs,
  };
}

/** Register a callback invoked when a 401 or token expiry is detected. */
export function setOnSessionExpired(callback: (() => void) | null): void {
  _onSessionExpired = callback;
}

// ─── Application Request / Generation Logging ───────────────────────────────

export function createGatewayTraceId(prefix = 'trace'): string {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomPart}`;
}

export function setActiveGenerationTraceId(traceId: string | null): void {
  _activeGenerationTraceId = traceId;
}

export function getActiveGenerationTraceId(): string | null {
  return _activeGenerationTraceId;
}

const estimateDataUrlBytes = (payload: string): number => {
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
};

const summarizeDataUrlForLog = (value: string) => {
  const match = value.match(/^data:([^;,]+)(?:;[^,]*)?,(.*)$/s);
  const payload = match?.[2] || '';
  const isBase64 = /;base64,/i.test(value.slice(0, 128));
  return {
    kind: 'data-url',
    mimeType: match?.[1] || null,
    chars: value.length,
    bytesApprox: isBase64 ? estimateDataUrlBytes(payload) : payload.length,
  };
};

const summarizeStringForLog = (value: string, maxLength = LOG_STRING_PREVIEW_CHARS) => {
  if (value.startsWith('data:')) return summarizeDataUrlForLog(value);
  if (value.length <= maxLength) return value;
  return {
    kind: 'string',
    chars: value.length,
    preview: value.slice(0, maxLength),
    truncated: true,
  };
};

const summarizeValueForLog = (value: unknown, depth = 0, fieldName = ''): unknown => {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (/base64|b64_json|bytesBase64Encoded/i.test(fieldName)) {
      return {
        kind: 'redacted-binary',
        chars: value.length,
        bytesApprox: estimateDataUrlBytes(value),
      };
    }
    return summarizeStringForLog(value);
  }
  if (typeof value !== 'object') return String(value).slice(0, 500);
  if (depth >= LOG_JSON_MAX_DEPTH) return '[MaxDepth]';

  if (Array.isArray(value)) {
    const items = value.slice(0, LOG_JSON_MAX_ARRAY_ITEMS).map((item) => summarizeValueForLog(item, depth + 1, fieldName));
    if (value.length > LOG_JSON_MAX_ARRAY_ITEMS) {
      items.push({ truncatedItems: value.length - LOG_JSON_MAX_ARRAY_ITEMS });
    }
    return items;
  }

  const entries = Object.entries(value as Record<string, unknown>).slice(0, LOG_JSON_MAX_OBJECT_KEYS);
  const output: Record<string, unknown> = {};
  entries.forEach(([key, item]) => {
    output[key.slice(0, 120)] = summarizeValueForLog(item, depth + 1, key);
  });
  const keyCount = Object.keys(value as Record<string, unknown>).length;
  if (keyCount > LOG_JSON_MAX_OBJECT_KEYS) {
    output.__truncatedKeys = keyCount - LOG_JSON_MAX_OBJECT_KEYS;
  }
  return output;
};

const getPartText = (part: any): string[] => {
  if (!part || typeof part !== 'object') return [];
  if (typeof part.text === 'string') return [part.text];
  return [];
};

const extractPromptFromGatewayBody = (body: unknown): string | null => {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, any>;
  if (typeof record.prompt === 'string') return record.prompt.slice(0, LOG_PROMPT_MAX_CHARS);
  if (typeof record.negativePrompt === 'string' && !record.prompt) return record.negativePrompt.slice(0, LOG_PROMPT_MAX_CHARS);

  const contentPrompts: string[] = [];
  const contents = Array.isArray(record.contents) ? record.contents : [];
  contents.forEach((content) => {
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    parts.forEach((part: any) => contentPrompts.push(...getPartText(part)));
  });

  const batchRequests = Array.isArray(record.requests) ? record.requests : [];
  batchRequests.forEach((request) => {
    const requestContents = Array.isArray(request?.contents) ? request.contents : [];
    requestContents.forEach((content: any) => {
      const parts = Array.isArray(content?.parts) ? content.parts : [];
      parts.forEach((part: any) => contentPrompts.push(...getPartText(part)));
    });
  });

  const joined = contentPrompts.map((item) => item.trim()).filter(Boolean).join('\n\n');
  return joined ? joined.slice(0, LOG_PROMPT_MAX_CHARS) : null;
};

const summarizeGatewayBodyForLog = (body: BodyInit | null | undefined) => {
  if (!body) return { summary: {}, prompt: null as string | null };
  if (typeof body === 'string') {
    const summary: Record<string, unknown> = {
      bodyType: 'json-string',
      chars: body.length,
    };
    try {
      const parsed = JSON.parse(body);
      summary.body = summarizeValueForLog(parsed);
      return {
        summary,
        prompt: extractPromptFromGatewayBody(parsed),
      };
    } catch {
      summary.body = summarizeStringForLog(body);
      return { summary, prompt: null };
    }
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const fields: Array<Record<string, unknown>> = [];
    body.forEach((value, key) => {
      if (typeof File !== 'undefined' && value instanceof File) {
        fields.push({ key, kind: 'file', name: value.name, type: value.type, size: value.size });
      } else if (value instanceof Blob) {
        fields.push({ key, kind: 'blob', type: value.type, size: value.size });
      } else {
        fields.push({ key, value: summarizeStringForLog(String(value), 300) });
      }
    });
    return { summary: { bodyType: 'form-data', fields }, prompt: null };
  }
  return { summary: { bodyType: Object.prototype.toString.call(body) }, prompt: null };
};

const getGatewayLogRouteInfo = (path: string) => {
  if (path.startsWith('/api/gemini/')) {
    const match = path.match(/^\/api\/gemini\/models\/([^:]+):([^?]+)/);
    return { provider: 'gemini', model: match?.[1], action: match?.[2] || 'request' };
  }
  if (path.startsWith('/api/image-edits')) return { provider: 'openai', model: 'gpt-image-2', action: 'image-edit' };
  if (path.startsWith('/api/openai/responses')) return { provider: 'openai', action: 'responses' };
  if (path.startsWith('/api/openai/')) return { provider: 'openai', model: 'gpt-image-2', action: 'images' };
  if (path.startsWith('/api/veo/')) return { provider: 'veo', action: path.split('/').pop() || 'request' };
  if (path.startsWith('/api/kling/')) return { provider: 'kling', action: path.split('/').pop() || 'request' };
  if (path.startsWith('/api/convert/')) return { provider: 'convertapi', action: path.split('/').pop() || 'request' };
  if (path.startsWith('/api/ilovepdf/')) return { provider: 'ilovepdf', action: path.replace('/api/ilovepdf/', '') };
  if (path.startsWith('/api/fetch-url')) return { provider: 'url-fetch', action: 'fetch-url' };
  if (path.startsWith('/api/feedback/')) return { provider: 'feedback', action: 'feedback-api' };
  return { provider: 'gateway', action: 'request' };
};

const summarizeResponseForLog = async (
  resp: Response,
  options: { skipBody?: boolean } = {}
): Promise<Record<string, unknown>> => {
  const contentType = resp.headers.get('Content-Type') || '';
  const contentLength = resp.headers.get('Content-Length');
  const summary: Record<string, unknown> = {
    contentType,
    contentLength,
  };

  if (options.skipBody) {
    return { ...summary, bodySkipped: 'image-generation-response' };
  }

  if (!contentType.toLowerCase().includes('application/json')) {
    return summary;
  }

  const length = contentLength ? Number(contentLength) : 0;
  if (Number.isFinite(length) && length > 2_000_000) {
    return { ...summary, bodySkipped: 'response-too-large' };
  }

  try {
    const data = await resp.json();
    summary.body = summarizeValueForLog(data);
  } catch {
    summary.bodySkipped = 'unreadable-json';
  }
  return summary;
};

export interface AppLogEventPayload {
  traceId?: string;
  eventType: string;
  mode?: string | null;
  provider?: string | null;
  model?: string | null;
  action?: string | null;
  method?: string | null;
  path?: string | null;
  status?: 'started' | 'running' | 'completed' | 'failed' | 'cancelled';
  statusCode?: number | null;
  durationMs?: number | null;
  prompt?: string | null;
  inputSummary?: Record<string, any>;
  outputSummary?: Record<string, any>;
  requestSummary?: Record<string, any>;
  responseSummary?: Record<string, any>;
  errorMessage?: string | null;
  metadata?: Record<string, any>;
  session?: boolean;
  sessionEvent?: boolean;
}

export async function submitAppLogEvent(payload: AppLogEventPayload, tokenOverride?: string | null): Promise<void> {
  const token = tokenOverride ?? getGatewayToken();
  if (!token) return;
  const resp = await fetchWithTimeout(`${GATEWAY_URL}/api/logs/events`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    timeoutMs: LOG_EVENT_TIMEOUT_MS,
  });
  if (!resp.ok) {
    throw new Error(`Application log write failed (${resp.status})`);
  }
}

export function queueAppLogEvent(payload: AppLogEventPayload, tokenOverride?: string | null): void {
  void submitAppLogEvent(payload, tokenOverride).catch((error) => {
    if (import.meta.env.DEV) {
      console.warn('[logs] failed to write application log', error);
    }
  });
}

const queueGatewayRequestLog = (
  payload: Omit<AppLogEventPayload, 'eventType'>,
  token: string,
  response?: Response,
): void => {
  void (async () => {
    const provider = String(payload.provider || '').toLowerCase();
    const model = String(payload.model || '').toLowerCase();
    const shouldSkipLargeResponseBody =
      provider === 'openai' ||
      (provider === 'gemini' && model.includes('image'));
    const responseSummary = response
      ? await summarizeResponseForLog(response, { skipBody: shouldSkipLargeResponseBody })
      : payload.responseSummary;
    await submitAppLogEvent({
      ...payload,
      eventType: payload.errorMessage ? 'gateway_request_failed' : 'gateway_request',
      responseSummary: responseSummary as Record<string, any> | undefined,
    }, token);
  })().catch((error) => {
    if (import.meta.env.DEV) {
      console.warn('[logs] failed to write gateway request log', error);
    }
  });
};

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface GatewayAuthResult {
  token: string;
  expiresIn: number;
  user: {
    email: string;
    name: string;
    picture: string;
    domain: string;
  };
}

/** Exchange a Google ID token for a gateway JWT */
export async function verifyAuth(idToken: string): Promise<GatewayAuthResult> {
  const resp = await fetchWithTimeout(`${GATEWAY_URL}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    timeoutMs: 15_000,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Auth failed' }));
    throw new Error(err.error || `Auth failed (${resp.status})`);
  }
  const result: GatewayAuthResult = await resp.json();
  setGatewayToken(result.token, result.expiresIn);
  return result;
}

// ─── Generic Request Helper ──────────────────────────────────────────────────

async function gatewayFetch(
  path: string,
  init: RequestInit & {
    timeoutMs?: number;
    requestLogSummary?: Record<string, unknown>;
    requestLogPrompt?: string | null;
  } = {},
): Promise<Response> {
  const token = getGatewayToken();
  if (!token) throw new Error('Not authenticated. Please sign in.');

  const { timeoutMs, requestLogSummary, requestLogPrompt, ...restInit } = init;
  const method = restInit.method || 'GET';
  const traceId = _activeGenerationTraceId || createGatewayTraceId('req');
  const shouldLogRequest = !path.startsWith('/api/logs/');
  const routeInfo = getGatewayLogRouteInfo(path);
  const { summary: requestSummary, prompt } = shouldLogRequest
    ? requestLogSummary
      ? { summary: requestLogSummary, prompt: requestLogPrompt || null }
      : summarizeGatewayBodyForLog(restInit.body)
    : { summary: {}, prompt: null };
  const startedAt = Date.now();
  const headers = new Headers(restInit.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-Archviz-Trace-Id', traceId);
  if (!headers.has('Content-Type') && restInit.body && typeof restInit.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  let resp: Response;
  try {
    resp = await fetchWithTimeout(`${GATEWAY_URL}${path}`, {
      ...restInit,
      headers,
      timeoutMs: timeoutMs ?? 30_000,
    });
  } catch (error) {
    if (shouldLogRequest) {
      queueGatewayRequestLog({
        traceId,
        provider: routeInfo.provider,
        model: routeInfo.model,
        action: routeInfo.action,
        method,
        path,
        durationMs: Date.now() - startedAt,
        prompt,
        requestSummary: requestSummary as Record<string, any>,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          source: 'client',
          gatewayUrl: GATEWAY_URL,
        },
      }, token);
    }
    throw error;
  }

  if (shouldLogRequest) {
    queueGatewayRequestLog({
      traceId,
      provider: routeInfo.provider,
      model: routeInfo.model,
      action: routeInfo.action,
      method,
      path,
      statusCode: resp.status,
      durationMs: Date.now() - startedAt,
      prompt,
      requestSummary: requestSummary as Record<string, any>,
      metadata: {
        source: 'client',
        gatewayUrl: GATEWAY_URL,
      },
    }, token, resp.clone());
  }

  if (resp.status === 401) {
    // Only treat 401 as a real session expiry when it comes from the gateway's
    // own auth middleware. Vendor passthroughs (ConvertAPI, iLovePDF, etc.) can
    // surface 401s for non-session reasons (bad/expired vendor secret, exhausted
    // quota) and must not log the user out.
    const isGatewayAuthRejection = await resp
      .clone()
      .json()
      .then((data) => data?.error === 'Unauthorized')
      .catch(() => false);

    if (isGatewayAuthRejection) {
      clearGatewayToken();
      _onSessionExpired?.();
      throw new Error('Session expired. Please sign in again.');
    }
  }

  return resp;
}

async function gatewayPost<T = any>(
  path: string,
  body: any,
  options?: { timeoutMs?: number },
): Promise<T> {
  const resp = await gatewayFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: options?.timeoutMs,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `Request failed (${resp.status})` }));
    throw new Error(err.error || `Request failed (${resp.status})`);
  }
  return resp.json();
}

async function gatewayGet<T = any>(
  path: string,
  options?: { timeoutMs?: number },
): Promise<T> {
  const resp = await gatewayFetch(path, { timeoutMs: options?.timeoutMs });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `Request failed (${resp.status})` }));
    throw new Error(err.error || `Request failed (${resp.status})`);
  }
  return resp.json();
}

// ─── Gemini API (passthrough proxy) ──────────────────────────────────────────

/** Make a raw Gemini API call. The gateway adds the API key. */
export async function geminiRequest(
  model: string,
  action: string,
  body: any,
  options?: { signal?: AbortSignal }
): Promise<any> {
  const timeoutMs = model.includes('image') ? GEMINI_PRO_IMAGE_TIMEOUT_MS : 120_000;
  const resp = await gatewayFetch(`/api/gemini/models/${model}:${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: options?.signal,
    timeoutMs,
  });
  if (!resp.ok) {
    const errText = await resp.text();
    let msg = `Gemini API error (${resp.status})`;
    try { msg = JSON.parse(errText).error?.message || msg; } catch {}
    throw new Error(msg);
  }
  return resp.json();
}

/** Make a streaming Gemini API call. Returns the raw Response for SSE processing. */
export async function geminiStreamRequest(
  model: string,
  body: any,
  options?: { signal?: AbortSignal }
): Promise<Response> {
  const timeoutMs = model.includes('image') ? GEMINI_PRO_IMAGE_TIMEOUT_MS : 120_000;
  const resp = await gatewayFetch(`/api/gemini/models/${model}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: options?.signal,
    timeoutMs,
  });
  if (!resp.ok) {
    const errText = await resp.text();
    let msg = `Gemini stream error (${resp.status})`;
    try { msg = JSON.parse(errText).error?.message || msg; } catch {}
    throw new Error(msg);
  }
  return resp;
}

/** Poll a Gemini long-running operation (used by Veo via Gemini API) */
export async function geminiGetOperation(operationName: string): Promise<any> {
  const resp = await gatewayFetch(`/api/gemini/${operationName}`, { timeoutMs: 15_000 });
  if (!resp.ok) throw new Error(`Operation poll failed (${resp.status})`);
  return resp.json();
}

// ─── OpenAI Text API ────────────────────────────────────────────────────────

export interface OpenAITextRequest {
  model: string;
  input: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface OpenAITextResponse {
  text: string;
  model?: string;
  usage?: unknown;
  raw?: unknown;
}

export async function openAITextRequest(
  body: OpenAITextRequest,
  options?: { signal?: AbortSignal }
): Promise<OpenAITextResponse> {
  const resp = await gatewayFetch('/api/openai/responses', {
    method: 'POST',
    body: JSON.stringify(body),
    signal: options?.signal,
    timeoutMs: OPENAI_TEXT_TIMEOUT_MS,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `OpenAI text API error (${resp.status})` }));
    throw new GatewayApiError(err.error || `OpenAI text API error (${resp.status})`, resp.status, 'openai', err);
  }
  return resp.json();
}

// ─── OpenAI Image API ───────────────────────────────────────────────────────

const parseOpenAIAspectRatio = (aspectRatio: unknown): number => {
  if (typeof aspectRatio !== 'string') return 16 / 9;
  const [widthRaw, heightRaw] = aspectRatio.split(':').map(Number);
  if (!Number.isFinite(widthRaw) || !Number.isFinite(heightRaw) || widthRaw <= 0 || heightRaw <= 0) {
    return 16 / 9;
  }
  return Math.min(3, Math.max(1 / 3, widthRaw / heightRaw));
};

const normalizeOpenAISize = (aspectRatio: unknown, imageSize: unknown): string => {
  if (OPENAI_IMAGE_ALLOWED_SIZES.includes(imageSize as any)) return imageSize as string;

  const ratio = parseOpenAIAspectRatio(aspectRatio);
  if (ratio > 1.05) return '1536x1024';
  if (ratio < 0.95) return '1024x1536';
  return '1024x1024';
};

const normalizeOpenAISizeOverride = (size: unknown): string | null => {
  if (OPENAI_IMAGE_ALLOWED_SIZES.includes(size as any)) return size as string;
  if (typeof size !== 'string') return null;

  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  if (width % OPENAI_IMAGE_SIZE_MULTIPLE !== 0 || height % OPENAI_IMAGE_SIZE_MULTIPLE !== 0) return null;
  if (Math.max(width, height) > OPENAI_IMAGE_MAX_EDGE) return null;
  if (Math.max(width, height) / Math.max(1, Math.min(width, height)) > 3) return null;

  const pixels = width * height;
  if (pixels < OPENAI_IMAGE_MIN_PIXELS || pixels > OPENAI_IMAGE_MAX_PIXELS) return null;

  return `${width}x${height}`;
};

const normalizeOpenAIQuality = (imageSize: unknown): string => {
  if (imageSize === '4K') return 'high';
  if (imageSize === '1K') return 'low';
  return 'medium';
};

const getOpenAIImageOptions = (generationConfig: any = {}) => {
  const imageConfig = generationConfig.imageConfig || generationConfig.responseFormat?.image || {};
  const background = generationConfig.openAI?.background || imageConfig.background;
  const normalizedBackground = background === 'transparent' || background === 'opaque' || background === 'auto'
    ? background
    : 'auto';
  return {
    size: normalizeOpenAISizeOverride(generationConfig.openAI?.size) ||
      normalizeOpenAISize(imageConfig.aspectRatio || '16:9', imageConfig.imageSize || '2K'),
    quality: normalizeOpenAIQuality(imageConfig.imageSize || '2K'),
    outputFormat: 'png',
    // GPT Image 2 currently does not support transparent backgrounds.
    background: normalizedBackground === 'transparent' ? 'opaque' : normalizedBackground,
  };
};

const normalizeOpenAIImageMimeType = (mimeType: unknown): string =>
  typeof mimeType === 'string' && /^image\/(png|jpe?g|webp)$/i.test(mimeType)
    ? mimeType.toLowerCase().replace('image/jpg', 'image/jpeg')
    : 'image/png';

const getOpenAIImageExtension = (mimeType: string): string =>
  mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] || 'png';

const openAIImageToBlob = async (image: any): Promise<{ blob: Blob; mimeType: string } | null> => {
  if (!image || typeof image.base64 !== 'string') return null;
  const mimeType = normalizeOpenAIImageMimeType(image.mimeType);
  const response = await fetch(`data:${mimeType};base64,${image.base64}`);
  return { blob: await response.blob(), mimeType };
};

const appendOpenAIImageToForm = async (
  form: FormData,
  fieldName: string,
  image: any,
  filenamePrefix: string,
  index: number,
): Promise<void> => {
  const result = await openAIImageToBlob(image);
  if (!result) return;
  form.append(fieldName, result.blob, `${filenamePrefix}-${index + 1}.${getOpenAIImageExtension(result.mimeType)}`);
};

const buildOpenAIImageFormData = async (body: any): Promise<FormData> => {
  const form = new FormData();
  const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
  const numberOfImages = Math.max(1, Math.min(
    OPENAI_IMAGE_MAX_OUTPUTS,
    Math.floor(Number.isFinite(Number(body?.numberOfImages)) ? Number(body.numberOfImages) : 1)
  ));
  const { size, quality, outputFormat, background } = getOpenAIImageOptions(body?.generationConfig);

  form.append('model', body?.model === OPENAI_IMAGE_MODEL ? body.model : OPENAI_IMAGE_MODEL);
  form.append('prompt', prompt);
  form.append('n', String(numberOfImages));
  form.append('size', size);
  form.append('quality', quality);
  form.append('output_format', outputFormat);
  if (background !== 'auto') form.append('background', background);

  const images = Array.isArray(body?.images) ? body.images : [];
  for (let index = 0; index < images.length; index += 1) {
    await appendOpenAIImageToForm(form, 'image[]', images[index], 'input', index);
  }
  if (body?.maskImage) {
    await appendOpenAIImageToForm(form, 'mask', body.maskImage, 'mask', 0);
  }

  return form;
};

export async function openAIImageRequest(
  body: any,
  options?: { signal?: AbortSignal }
): Promise<any> {
  const hasInputImages = Array.isArray(body?.images) && body.images.length > 0;
  const requestBody = hasInputImages
    ? await buildOpenAIImageFormData(body)
    : JSON.stringify(body);
  const resp = await gatewayFetch('/api/openai/images', {
    method: 'POST',
    body: requestBody,
    signal: options?.signal,
    timeoutMs: OPENAI_IMAGE_TIMEOUT_MS,
  });
  if (!resp.ok) {
    const errText = await resp.text();
    let msg = `OpenAI image API error (${resp.status})`;
    let details: unknown = errText;
    try {
      const parsed = JSON.parse(errText);
      details = parsed;
      msg = parsed.error?.message || parsed.error || msg;
    } catch {}
    throw new GatewayApiError(msg, resp.status, 'openai-image', details);
  }
  return resp.json();
}

export type ImageEditOperation =
  | 'replace_material'
  | 'recolor'
  | 'add_people'
  | 'remove_people'
  | 'remove_object'
  | 'custom';

export interface GatewayImageEditPng {
  base64: string;
  mimeType: 'image/png';
  width: number;
  height: number;
}

export interface GatewayImageEditReference {
  base64: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  width?: number;
  height?: number;
}

export interface GatewayImageEditRequest {
  sourceImage: GatewayImageEditPng;
  selectionMask: GatewayImageEditPng;
  selectionStats?: {
    selectedPixels?: number;
    selectedRatio?: number;
    userSelectedPixels?: number;
    userSelectedRatio?: number;
    providerEditablePixels?: number;
    providerEditableRatio?: number;
  };
  /** Exact user-authored instruction. This remains the authoritative request. */
  prompt: string;
  /** Optional pre-generation clarification produced from the source and mask. */
  optimizedPrompt?: string;
  operation: ImageEditOperation;
  targetLabel?: string;
  colorHex?: string;
  materialDescription?: string;
  originalGenerationPrompt?: string;
  quality?: 'draft' | 'standard' | 'final';
  variants?: number;
  outputFormat?: 'png';
  referenceImages?: GatewayImageEditReference[];
  /** True when sourceImage is a context crop that will be inverse-mapped client-side. */
  localizedPatch?: boolean;
}

export interface GatewayImageEditVersion {
  id: string;
  imageUrl: string;
  rawImageUrl?: string;
  parentImageId?: string | null;
  operation: ImageEditOperation;
  prompt: string;
  provider: 'openai';
  model: string;
  metadata?: Record<string, unknown>;
}

export interface GatewayImageEditResponse {
  editId: string;
  status: 'completed';
  versions: GatewayImageEditVersion[];
  usage?: unknown;
}

export async function imageEditRequest(
  body: GatewayImageEditRequest,
  options?: { signal?: AbortSignal }
): Promise<GatewayImageEditResponse> {
  const serializedBody = JSON.stringify(body);
  const resp = await gatewayFetch('/api/image-edits', {
    method: 'POST',
    body: serializedBody,
    signal: options?.signal,
    timeoutMs: IMAGE_EDIT_TIMEOUT_MS,
    requestLogPrompt: body.prompt,
    requestLogSummary: {
      bodyType: 'localized-image-edit',
      chars: serializedBody.length,
      operation: body.operation,
      localizedPatch: Boolean(body.localizedPatch),
      variants: body.variants || 1,
      source: {
        mimeType: body.sourceImage.mimeType,
        width: body.sourceImage.width,
        height: body.sourceImage.height,
        bytesApprox: estimateDataUrlBytes(body.sourceImage.base64),
      },
      mask: {
        mimeType: body.selectionMask.mimeType,
        width: body.selectionMask.width,
        height: body.selectionMask.height,
        bytesApprox: estimateDataUrlBytes(body.selectionMask.base64),
      },
      referenceCount: body.referenceImages?.length || 0,
      selectionStats: body.selectionStats || null,
    },
  });
  if (!resp.ok) {
    const fallbackMessage = `Image edit failed (${resp.status})`;
    const responseDetails = await resp.json().catch(() => ({ error: fallbackMessage }));
    const detailRecord = asGatewayErrorDetails(responseDetails) || { error: fallbackMessage };
    const retryAfterHeader = resp.headers.get('Retry-After');
    const retryAfterSeconds = parseRetryAfterSeconds(retryAfterHeader)
      ?? readPositiveSeconds(detailRecord.retryAfterSeconds);
    const details = {
      ...detailRecord,
      ...(retryAfterHeader ? { retryAfter: retryAfterHeader } : {}),
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    };
    throw new GatewayApiError(
      getGatewayErrorMessage(details, fallbackMessage),
      resp.status,
      'openai-image-edit',
      details
    );
  }
  return resp.json();
}

// ─── Veo Video Generation ────────────────────────────────────────────────────

export interface VeoGenerateRequest {
  prompt: string;
  image?: { bytesBase64Encoded: string; mimeType: string };
  firstImage?: { bytesBase64Encoded: string; mimeType: string };
  lastImage?: { bytesBase64Encoded: string; mimeType: string };
  durationSeconds?: number;
  aspectRatio?: string;
  resolution?: string;
  generateAudio?: boolean;
  personGeneration?: string;
  negativePrompt?: string;
  seed?: number;
  numberOfVideos?: number;
  useVertexAi?: boolean;
}

export interface VeoStatusResult {
  status: 'complete' | 'processing' | 'error';
  videoUrl?: string;
  videoBase64?: string; // base64-encoded video bytes (Vertex AI embedded response)
  mimeType?: string;
  operationName?: string;
  needsBinaryFetch?: boolean; // true when video is ready but needs /api/veo/video fetch
  expiresAt?: string;
  error?: string;
  debug?: string;
}

export async function veoGenerate(request: VeoGenerateRequest): Promise<VeoStatusResult> {
  return gatewayPost('/api/veo/generate', request, { timeoutMs: VIDEO_GENERATE_TIMEOUT_MS });
}

export async function veoCheckStatus(operationName: string, useVertexAi = false): Promise<VeoStatusResult> {
  const params = new URLSearchParams({ operation: operationName });
  if (useVertexAi) params.set('useVertexAi', 'true');
  return gatewayGet(`/api/veo/status?${params}`, { timeoutMs: 15_000 });
}

/** Download generated video bytes through the gateway proxy and return a local blob URL */
export async function veoDownloadVideo(videoUrl: string): Promise<string> {
  const params = new URLSearchParams({ url: videoUrl });
  const resp = await gatewayFetch(`/api/veo/download?${params}`, { timeoutMs: 180_000 });
  if (!resp.ok) throw new Error(`Video download failed (${resp.status})`);
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}

/** Fetch a completed Vertex AI Veo video by operation name, returned as a local blob URL */
export async function veoFetchVideo(operationName: string): Promise<string> {
  const params = new URLSearchParams({ op: operationName });
  const resp = await gatewayFetch(`/api/veo/video?${params}`, { timeoutMs: 300_000 }); // 5 min for large videos
  if (!resp.ok) throw new Error(`Video fetch failed (${resp.status})`);
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}

// ─── Kling Video Generation ──────────────────────────────────────────────────

export interface KlingGenerateRequest {
  provider?: 'piapi' | 'ulazai' | 'wavespeedai';
  prompt: string;
  inputImage?: string;
  duration?: number;
  aspectRatio?: string;
  quality?: string;
  camera?: { type: string; direction: number; speed: string; smoothness: number };
  seed?: number;
}

export async function klingGenerate(request: KlingGenerateRequest): Promise<{ taskId: string; provider: string }> {
  return gatewayPost('/api/kling/generate', request, { timeoutMs: VIDEO_GENERATE_TIMEOUT_MS });
}

export async function klingCheckStatus(taskId: string, provider = 'piapi'): Promise<any> {
  return gatewayGet(`/api/kling/status?taskId=${encodeURIComponent(taskId)}&provider=${provider}`, { timeoutMs: 15_000 });
}

// ─── ConvertAPI ──────────────────────────────────────────────────────────────

export async function convertPdfToDocx(fileName: string, fileData: string): Promise<any> {
  return gatewayPost('/api/convert/pdf-to-docx', { fileName, fileData }, { timeoutMs: 120_000 });
}

export async function convertDocxToPdf(fileName: string, fileData: string): Promise<any> {
  return gatewayPost('/api/convert/docx-to-pdf', { fileName, fileData }, { timeoutMs: 300_000 });
}

// ─── iLovePDF ────────────────────────────────────────────────────────────────

export async function ilovepdfAuth(): Promise<{ token: string }> {
  return gatewayPost('/api/ilovepdf/auth', {}, { timeoutMs: 15_000 });
}

export async function ilovepdfStart(tool: string, ilovepdfToken: string): Promise<{ server: string; task: string }> {
  return gatewayPost(`/api/ilovepdf/start/${tool}`, { ilovepdfToken }, { timeoutMs: 15_000 });
}

export async function ilovepdfUpload(
  server: string,
  task: string,
  ilovepdfToken: string,
  file: Blob,
  fileName: string
): Promise<{ server_filename: string }> {
  // Upload directly to iLovePDF server (bypasses Worker to avoid 100MB body limit)
  const formData = new FormData();
  formData.append('task', task);
  formData.append('file', file, fileName);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 600_000); // 10 min for large files

  try {
    const resp = await fetch(`https://${server}/v1/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ilovepdfToken}` },
      body: formData,
      signal: controller.signal,
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Upload failed (${resp.status}): ${errText}`);
    }
    return resp.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function ilovepdfProcess(
  server: string,
  ilovepdfToken: string,
  processPayload: any
): Promise<any> {
  return gatewayPost('/api/ilovepdf/process', { server, ilovepdfToken, ...processPayload }, { timeoutMs: 300_000 });
}

export async function ilovepdfDownload(
  server: string,
  task: string,
  ilovepdfToken: string
): Promise<Blob> {
  // Download directly from iLovePDF server (bypasses Worker for large files)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 600_000); // 10 min for large files

  try {
    const resp = await fetch(`https://${server}/v1/download/${task}`, {
      headers: { 'Authorization': `Bearer ${ilovepdfToken}` },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Download failed (${resp.status})`);
    return resp.blob();
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── URL Fetch Proxy (material validation) ───────────────────────────────────

export interface FetchUrlResult {
  url: string;
  title?: string;
  content: string;
  fetchedAt: number;
  error?: string;
}

export async function fetchUrlViaGateway(url: string): Promise<FetchUrlResult> {
  return gatewayGet<FetchUrlResult>(`/api/fetch-url?url=${encodeURIComponent(url)}`, { timeoutMs: 15_000 });
}

// ─── Feedback Reporting ──────────────────────────────────────────────────────

export interface SubmitFeedbackReportPayload {
  title: string;
  description: string;
  category: FeedbackReportCategory;
  priority: FeedbackReportPriority;
  reproductionSteps?: string;
  expectedBehavior?: string;
  projectName?: string;
  mode: GenerationMode;
  appVersion?: string;
  userAgent?: string;
  historyCount: number;
  snapshotVersion: number;
  snapshot: FeedbackProjectSnapshot;
  reportedFeatureKey?: string;
  reportedFeatureLabel?: string;
  imageFeedback?: FeedbackImageAnnotation[];
  documentFeedback?: FeedbackDocumentAttachment[];
}

export interface SubmitFeedbackReportResult {
  success: boolean;
  report: FeedbackReportSummary;
  snapshotStoredInline: boolean;
}

export interface FeedbackReportListParams {
  limit?: number;
  offset?: number;
  status?: FeedbackReportStatus | '';
  priority?: FeedbackReportPriority | '';
  category?: FeedbackReportCategory | '';
  mode?: string;
  reporterEmail?: string;
  search?: string;
}

export interface FeedbackReportListResult {
  success: boolean;
  reports: FeedbackReportSummary[];
}

export interface FeedbackReportDetailResult {
  success: boolean;
  report: FeedbackReportDetail;
  activity: FeedbackActivityItem[];
}

export interface FeedbackSnapshotResult {
  success: boolean;
  source: 'inline' | 'storage';
  snapshot: FeedbackProjectSnapshot;
  snapshotHash: string;
  snapshotSizeBytes: number;
  snapshotVersion: number;
}

export interface FeedbackReportUpdatePayload {
  status?: FeedbackReportStatus;
  priority?: FeedbackReportPriority;
  note?: string;
}

export interface FeedbackReportUpdateResult {
  success: boolean;
  report: Partial<FeedbackReportSummary> | null;
}

export interface FeedbackActivityCreatePayload {
  message: string;
  metadata?: Record<string, any>;
}

export interface FeedbackActivityCreateResult {
  success: boolean;
  activity: FeedbackActivityItem | null;
}

export interface FeedbackReportDeleteResult {
  success: boolean;
  reportId: string;
  deletedSnapshotStorage: boolean;
}

export interface AppGenerationLogSession {
  id: string;
  trace_id: string;
  created_at: string;
  started_at: string;
  updated_at: string;
  completed_at?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  status: 'started' | 'running' | 'completed' | 'failed' | 'cancelled';
  mode?: string | null;
  provider?: string | null;
  model?: string | null;
  prompt?: string | null;
  prompt_hash?: string | null;
  duration_ms?: number | null;
  input_summary?: Record<string, any> | null;
  output_summary?: Record<string, any> | null;
  error_message?: string | null;
  metadata?: Record<string, any> | null;
}

export interface AppRequestLogEntry {
  id: number;
  created_at: string;
  trace_id: string;
  generation_id?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  event_type: string;
  provider?: string | null;
  model?: string | null;
  action?: string | null;
  method?: string | null;
  path?: string | null;
  status_code?: number | null;
  duration_ms?: number | null;
  prompt?: string | null;
  prompt_hash?: string | null;
  request_summary?: Record<string, any> | null;
  response_summary?: Record<string, any> | null;
  error_message?: string | null;
  metadata?: Record<string, any> | null;
}

export interface AppGenerationLogListParams {
  limit?: number;
  offset?: number;
  status?: AppGenerationLogSession['status'] | '';
  mode?: string;
  provider?: string;
  userEmail?: string;
  search?: string;
}

export interface AppGenerationLogListResult {
  success: boolean;
  sessions: AppGenerationLogSession[];
}

export interface AppGenerationLogDetailResult {
  success: boolean;
  session: AppGenerationLogSession;
  events: AppRequestLogEntry[];
}

const buildFeedbackListQuery = (params: FeedbackReportListParams = {}) => {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  if (params.status) qs.set('status', params.status);
  if (params.priority) qs.set('priority', params.priority);
  if (params.category) qs.set('category', params.category);
  if (params.mode) qs.set('mode', params.mode);
  if (params.reporterEmail) qs.set('reporterEmail', params.reporterEmail);
  if (params.search) qs.set('search', params.search);
  return qs.toString();
};

const buildAppLogListQuery = (params: AppGenerationLogListParams = {}) => {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  if (params.status) qs.set('status', params.status);
  if (params.mode) qs.set('mode', params.mode);
  if (params.provider) qs.set('provider', params.provider);
  if (params.userEmail) qs.set('userEmail', params.userEmail);
  if (params.search) qs.set('search', params.search);
  return qs.toString();
};

export async function submitFeedbackReport(payload: SubmitFeedbackReportPayload): Promise<SubmitFeedbackReportResult> {
  return gatewayPost('/api/feedback/reports', payload, { timeoutMs: 180_000 });
}

export async function listFeedbackReports(params: FeedbackReportListParams = {}): Promise<FeedbackReportListResult> {
  const query = buildFeedbackListQuery(params);
  const path = query ? `/api/feedback/reports?${query}` : '/api/feedback/reports';
  return gatewayGet(path, { timeoutMs: 30_000 });
}

export async function getFeedbackReport(reportId: string): Promise<FeedbackReportDetailResult> {
  return gatewayGet(`/api/feedback/reports/${encodeURIComponent(reportId)}`, { timeoutMs: 30_000 });
}

export async function getFeedbackSnapshot(reportId: string): Promise<FeedbackSnapshotResult> {
  return gatewayGet(`/api/feedback/reports/${encodeURIComponent(reportId)}/snapshot`, { timeoutMs: 120_000 });
}

export async function updateFeedbackReport(
  reportId: string,
  payload: FeedbackReportUpdatePayload
): Promise<FeedbackReportUpdateResult> {
  const resp = await gatewayFetch(`/api/feedback/reports/${encodeURIComponent(reportId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    timeoutMs: 30_000,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `Request failed (${resp.status})` }));
    throw new Error(err.error || `Request failed (${resp.status})`);
  }
  return resp.json();
}

export async function addFeedbackActivity(
  reportId: string,
  payload: FeedbackActivityCreatePayload
): Promise<FeedbackActivityCreateResult> {
  return gatewayPost(`/api/feedback/reports/${encodeURIComponent(reportId)}/activity`, payload, { timeoutMs: 30_000 });
}

export async function deleteFeedbackReport(reportId: string): Promise<FeedbackReportDeleteResult> {
  const resp = await gatewayFetch(`/api/feedback/reports/${encodeURIComponent(reportId)}`, {
    method: 'DELETE',
    timeoutMs: 30_000,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `Request failed (${resp.status})` }));
    throw new Error(err.error || `Request failed (${resp.status})`);
  }
  return resp.json();
}

export async function listAppGenerationLogs(
  params: AppGenerationLogListParams = {}
): Promise<AppGenerationLogListResult> {
  const query = buildAppLogListQuery(params);
  const path = query ? `/api/logs/generations?${query}` : '/api/logs/generations';
  return gatewayGet(path, { timeoutMs: 30_000 });
}

export async function getAppGenerationLog(identifier: string): Promise<AppGenerationLogDetailResult> {
  return gatewayGet(`/api/logs/generations/${encodeURIComponent(identifier)}`, { timeoutMs: 30_000 });
}
