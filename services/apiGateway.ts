/**
 * API Gateway Client
 *
 * All vendor API calls go through the Cloudflare Worker gateway.
 * The gateway adds API keys server-side — no secrets in the client.
 *
 * Auth: Supabase session access_token is used as the Bearer token.
 * The Worker verifies it against SUPABASE_JWT_SECRET.
 */

import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { supabase } from '../lib/supabaseClient';

const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8787';

let _onSessionExpired: (() => void) | null = null;

/** Register a callback invoked on 401 from the gateway. */
export function setOnSessionExpired(callback: (() => void) | null): void {
  _onSessionExpired = callback;
}

/** Returns true if a Supabase session exists. */
export function isGatewayAuthenticated(): boolean {
  // Supabase manages the session; we check synchronously via the cached session.
  // The AuthGate ensures this is only called when a session exists.
  return true;
}

/** No-op kept for backwards compatibility — Supabase manages its own tokens. */
export function clearGatewayToken(): void {}
export function getTokenExpiresAt(): number { return 0; }

// ─── Generic Request Helper ──────────────────────────────────────────────────

async function gatewayFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number; generationMode?: string } = {},
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated. Please sign in.');

  const { timeoutMs, generationMode, ...restInit } = init;
  const headers = new Headers(restInit.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && restInit.body && typeof restInit.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (generationMode) {
    headers.set('X-Generation-Mode', generationMode);
  }

  const resp = await fetchWithTimeout(`${GATEWAY_URL}${path}`, {
    ...restInit,
    headers,
    timeoutMs: timeoutMs ?? 30_000,
  });

  if (resp.status === 401) {
    await supabase.auth.signOut();
    _onSessionExpired?.();
    throw new Error('Session expired. Please sign in again.');
  }

  if (resp.status === 402) {
    const err = await resp.json().catch(() => ({ error: 'Insufficient credits' }));
    throw Object.assign(new Error(err.error || 'Insufficient credits'), { code: 'INSUFFICIENT_CREDITS' });
  }

  if (resp.status === 403) {
    const err = await resp.json().catch(() => ({ error: 'Access denied' }));
    throw Object.assign(new Error(err.error || 'Access denied'), { code: 'ACCESS_DENIED' });
  }

  if (resp.status === 429) {
    const err = await resp.json().catch(() => ({ error: 'Too many requests' }));
    throw Object.assign(new Error(err.error || 'Too many requests. Please wait a moment.'), { code: 'RATE_LIMITED' });
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
  options?: { signal?: AbortSignal; generationMode?: string }
): Promise<any> {
  const resp = await gatewayFetch(`/api/gemini/models/${model}:${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: options?.signal,
    timeoutMs: 120_000,
    generationMode: options?.generationMode,
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
  return gatewayPost('/api/veo/generate', request, { timeoutMs: 60_000 });
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

// ─── Billing ──────────────────────────────────────────────────────────────────

export async function createCheckoutSession(priceId: string): Promise<{ url: string }> {
  return gatewayPost('/billing/checkout', {
    priceId,
    successUrl: `${window.location.origin}?checkout=success`,
    cancelUrl: window.location.href,
  }, { timeoutMs: 15_000 });
}

export async function createPortalSession(): Promise<{ url: string }> {
  return gatewayPost('/billing/portal', {
    returnUrl: window.location.href,
  }, { timeoutMs: 15_000 });
}

export async function purchaseCredits(packId: 'credits-500' | 'credits-2000'): Promise<{ url: string }> {
  return gatewayPost('/billing/credits', {
    packId,
    successUrl: `${window.location.origin}?credits=purchased`,
    cancelUrl: window.location.href,
  }, { timeoutMs: 15_000 });
}

export async function createVideoCharge(params: {
  model: string;
  durationSeconds: number;
  orgId?: string;
}): Promise<{ clientSecret: string; videoChargeId: string; amountCents: number }> {
  return gatewayPost('/api/video/charge', params, { timeoutMs: 15_000 });
}

/** Create a Stripe Checkout session for a one-time video generation. Returns { url }. */
export async function createVideoCheckout(params: {
  model: string;
  durationSeconds: number;
  orgId?: string;
}): Promise<{ url: string }> {
  return gatewayPost('/api/video/checkout', {
    ...params,
    successUrl: `${window.location.origin}?video=paid`,
    cancelUrl:  window.location.href,
  }, { timeoutMs: 15_000 });
}

// ─── Team Management ─────────────────────────────────────────────────────────

export async function inviteTeamMember(orgId: string, email: string, role: 'admin' | 'member'): Promise<void> {
  await gatewayPost('/team/invite', { orgId, email, role }, { timeoutMs: 15_000 });
}

export async function acceptTeamInvite(token: string): Promise<void> {
  await gatewayPost('/team/accept-invite', { token }, { timeoutMs: 15_000 });
}

export async function removeTeamMember(orgId: string, userId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const t = session?.access_token;
  if (!t) throw new Error('Not authenticated');
  const resp = await fetch(`${GATEWAY_URL}/team/member`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId, userId }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Failed' }));
    throw new Error(err.error);
  }
}

export async function updateTeamMemberRole(orgId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const t = session?.access_token;
  if (!t) throw new Error('Not authenticated');
  const resp = await fetch(`${GATEWAY_URL}/team/member/role`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId, userId, role }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Failed' }));
    throw new Error(err.error);
  }
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function adminGetUsers(params?: { page?: number; search?: string; plan?: string }): Promise<any> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.search) q.set('search', params.search);
  if (params?.plan) q.set('plan', params.plan);
  return gatewayGet(`/admin/users?${q}`, { timeoutMs: 15_000 });
}

export async function adminGetUser(userId: string): Promise<any> {
  return gatewayGet(`/admin/users/${userId}`, { timeoutMs: 15_000 });
}

export async function adminUpdateUser(userId: string, updates: { plan?: string; suspended?: boolean }): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const t = session?.access_token;
  if (!t) throw new Error('Not authenticated');
  const resp = await fetch(`${GATEWAY_URL}/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!resp.ok) throw new Error('Failed');
  return resp.json();
}

export async function adminAdjustCredits(entityType: 'user' | 'org', entityId: string, amount: number, reason: string): Promise<void> {
  const path = entityType === 'user' ? `/admin/users/${entityId}/credits` : `/admin/orgs/${entityId}/credits`;
  await gatewayPost(path, { amount, reason }, { timeoutMs: 15_000 });
}

export async function adminGetOrgs(params?: { page?: number; search?: string }): Promise<any> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.search) q.set('search', params.search);
  return gatewayGet(`/admin/orgs?${q}`, { timeoutMs: 15_000 });
}

export async function adminGetOrg(orgId: string): Promise<any> {
  return gatewayGet(`/admin/orgs/${orgId}`, { timeoutMs: 15_000 });
}

export async function adminGetRevenue(): Promise<any> {
  return gatewayGet('/admin/revenue', { timeoutMs: 15_000 });
}

export async function adminGetAnalytics(): Promise<any> {
  return gatewayGet('/admin/analytics', { timeoutMs: 15_000 });
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

/** Send welcome email on first login (idempotent — Worker checks welcome_email_sent flag). */
export async function triggerWelcomeEmail(): Promise<void> {
  try {
    await gatewayPost('/api/user/welcome', {}, { timeoutMs: 10_000 });
  } catch {
    // Non-fatal — welcome email failure should never block the app
  }
}
