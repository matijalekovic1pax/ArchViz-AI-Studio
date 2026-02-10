/**
 * API Gateway Client
 *
 * All vendor API calls go through the Cloudflare Worker gateway.
 * The gateway adds API keys server-side — no secrets in the client.
 */

const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8787';

// JWT stored in memory only (not localStorage/sessionStorage)
let _jwt: string | null = null;
let _jwtExpiresAt: number = 0;

// ─── Token Management ────────────────────────────────────────────────────────

export function setGatewayToken(token: string, expiresIn: number): void {
  _jwt = token;
  _jwtExpiresAt = Date.now() + expiresIn * 1000;
}

export function getGatewayToken(): string | null {
  if (_jwt && Date.now() < _jwtExpiresAt) return _jwt;
  _jwt = null;
  return null;
}

export function clearGatewayToken(): void {
  _jwt = null;
  _jwtExpiresAt = 0;
}

export function isGatewayAuthenticated(): boolean {
  return getGatewayToken() !== null;
}

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
  const resp = await fetch(`${GATEWAY_URL}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
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

async function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getGatewayToken();
  if (!token) throw new Error('Not authenticated. Please sign in.');

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const resp = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers });

  if (resp.status === 401) {
    clearGatewayToken();
    throw new Error('Session expired. Please sign in again.');
  }

  return resp;
}

async function gatewayPost<T = any>(path: string, body: any): Promise<T> {
  const resp = await gatewayFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `Request failed (${resp.status})` }));
    throw new Error(err.error || `Request failed (${resp.status})`);
  }
  return resp.json();
}

async function gatewayGet<T = any>(path: string): Promise<T> {
  const resp = await gatewayFetch(path);
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
  const resp = await gatewayFetch(`/api/gemini/models/${model}:${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: options?.signal,
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
  const resp = await gatewayFetch(`/api/gemini/models/${model}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: options?.signal,
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
  const resp = await gatewayFetch(`/api/gemini/${operationName}`);
  if (!resp.ok) throw new Error(`Operation poll failed (${resp.status})`);
  return resp.json();
}

// ─── Veo Video Generation ────────────────────────────────────────────────────

export interface VeoGenerateRequest {
  prompt: string;
  image?: { bytesBase64Encoded: string; mimeType: string };
  durationSeconds?: number;
  aspectRatio?: string;
  resolution?: string;
  generateAudio?: boolean;
  personGeneration?: string;
  seed?: number;
  numberOfVideos?: number;
  useVertexAi?: boolean;
}

export interface VeoStatusResult {
  status: 'complete' | 'processing' | 'error';
  videoUrl?: string;
  operationName?: string;
  expiresAt?: string;
  error?: string;
}

export async function veoGenerate(request: VeoGenerateRequest): Promise<VeoStatusResult> {
  return gatewayPost('/api/veo/generate', request);
}

export async function veoCheckStatus(operationName: string, useVertexAi = false): Promise<VeoStatusResult> {
  const params = new URLSearchParams({ operation: operationName });
  if (useVertexAi) params.set('useVertexAi', 'true');
  return gatewayGet(`/api/veo/status?${params}`);
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
  return gatewayPost('/api/kling/generate', request);
}

export async function klingCheckStatus(taskId: string, provider = 'piapi'): Promise<any> {
  return gatewayGet(`/api/kling/status?taskId=${encodeURIComponent(taskId)}&provider=${provider}`);
}

// ─── ConvertAPI ──────────────────────────────────────────────────────────────

export async function convertPdfToDocx(fileName: string, fileData: string): Promise<any> {
  return gatewayPost('/api/convert/pdf-to-docx', { fileName, fileData });
}

// ─── iLovePDF ────────────────────────────────────────────────────────────────

export async function ilovepdfAuth(): Promise<{ token: string }> {
  return gatewayPost('/api/ilovepdf/auth', {});
}

export async function ilovepdfStart(tool: string, ilovepdfToken: string): Promise<{ server: string; task: string }> {
  return gatewayPost(`/api/ilovepdf/start/${tool}`, { ilovepdfToken });
}

export async function ilovepdfUpload(
  server: string,
  task: string,
  ilovepdfToken: string,
  fileData: string,
  fileName: string
): Promise<{ server_filename: string }> {
  return gatewayPost('/api/ilovepdf/upload', { server, task, ilovepdfToken, fileData, fileName });
}

export async function ilovepdfProcess(
  server: string,
  ilovepdfToken: string,
  processPayload: any
): Promise<any> {
  return gatewayPost('/api/ilovepdf/process', { server, ilovepdfToken, ...processPayload });
}

export async function ilovepdfDownload(
  server: string,
  task: string,
  ilovepdfToken: string
): Promise<Blob> {
  const resp = await gatewayFetch(
    `/api/ilovepdf/download/${task}?server=${encodeURIComponent(server)}&token=${encodeURIComponent(ilovepdfToken)}`
  );
  if (!resp.ok) throw new Error(`Download failed (${resp.status})`);
  return resp.blob();
}
