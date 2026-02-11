/**
 * API Gateway Client
 *
 * All vendor API calls go through the Cloudflare Worker gateway.
 * The gateway adds API keys server-side — no secrets in the client.
 */

import { fetchWithTimeout } from '../lib/fetchWithTimeout';

const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8787';

// JWT stored in memory only (not localStorage/sessionStorage)
let _jwt: string | null = null;
let _jwtExpiresAt: number = 0;
let _onSessionExpired: (() => void) | null = null;

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

/** Returns the timestamp (ms) when the current token expires, or 0 if none. */
export function getTokenExpiresAt(): number {
  return _jwtExpiresAt;
}

/** Register a callback invoked when a 401 or token expiry is detected. */
export function setOnSessionExpired(callback: (() => void) | null): void {
  _onSessionExpired = callback;
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
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const token = getGatewayToken();
  if (!token) throw new Error('Not authenticated. Please sign in.');

  const { timeoutMs, ...restInit } = init;
  const headers = new Headers(restInit.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && restInit.body && typeof restInit.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const resp = await fetchWithTimeout(`${GATEWAY_URL}${path}`, {
    ...restInit,
    headers,
    timeoutMs: timeoutMs ?? 30_000,
  });

  if (resp.status === 401) {
    clearGatewayToken();
    _onSessionExpired?.();
    throw new Error('Session expired. Please sign in again.');
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
  const resp = await gatewayFetch(`/api/gemini/models/${model}:${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: options?.signal,
    timeoutMs: 120_000,
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
    timeoutMs: 120_000,
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
  return gatewayPost('/api/veo/generate', request, { timeoutMs: 60_000 });
}

export async function veoCheckStatus(operationName: string, useVertexAi = false): Promise<VeoStatusResult> {
  const params = new URLSearchParams({ operation: operationName });
  if (useVertexAi) params.set('useVertexAi', 'true');
  return gatewayGet(`/api/veo/status?${params}`, { timeoutMs: 15_000 });
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
  return gatewayPost('/api/kling/generate', request, { timeoutMs: 60_000 });
}

export async function klingCheckStatus(taskId: string, provider = 'piapi'): Promise<any> {
  return gatewayGet(`/api/kling/status?taskId=${encodeURIComponent(taskId)}&provider=${provider}`, { timeoutMs: 15_000 });
}

// ─── ConvertAPI ──────────────────────────────────────────────────────────────

export async function convertPdfToDocx(fileName: string, fileData: string): Promise<any> {
  return gatewayPost('/api/convert/pdf-to-docx', { fileName, fileData }, { timeoutMs: 120_000 });
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
  fileData: string,
  fileName: string
): Promise<{ server_filename: string }> {
  return gatewayPost('/api/ilovepdf/upload', { server, task, ilovepdfToken, fileData, fileName }, { timeoutMs: 120_000 });
}

export async function ilovepdfProcess(
  server: string,
  ilovepdfToken: string,
  processPayload: any
): Promise<any> {
  return gatewayPost('/api/ilovepdf/process', { server, ilovepdfToken, ...processPayload }, { timeoutMs: 120_000 });
}

export async function ilovepdfDownload(
  server: string,
  task: string,
  ilovepdfToken: string
): Promise<Blob> {
  const resp = await gatewayFetch(
    `/api/ilovepdf/download/${task}?server=${encodeURIComponent(server)}&token=${encodeURIComponent(ilovepdfToken)}`,
    { timeoutMs: 120_000 },
  );
  if (!resp.ok) throw new Error(`Download failed (${resp.status})`);
  return resp.blob();
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
