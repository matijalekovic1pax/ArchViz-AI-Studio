/**
 * ArchViz AI Studio — API Gateway (Cloudflare Worker)
 *
 * Handles:
 * - Google ID token verification + short-lived JWT issuance
 * - JWT-authenticated proxy for all vendor APIs
 * - CORS lockdown to production domain
 * - Payload size limits
 *
 * Secrets (set via `wrangler secret put`):
 *   JWT_SECRET, GOOGLE_CLIENT_ID, ALLOWED_DOMAIN,
 *   GEMINI_API_KEY, OPENAI_API_KEY, GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_PROJECT_ID,
 *   KLING_PIAPI_API_KEY, KLING_ULAZAI_API_KEY, KLING_WAVESPEEDAI_API_KEY,
 *   CONVERTAPI_SECRET, ILOVEPDF_PUBLIC_KEY,
 *   APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY,
 *   APPWRITE_DATABASE_ID, APPWRITE_REPORTS_COLLECTION_ID,
 *   APPWRITE_ACTIVITY_COLLECTION_ID, APPWRITE_ADMINS_COLLECTION_ID,
 *   APPWRITE_SNAPSHOTS_BUCKET_ID
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://arch-viz-ai-studio.vercel.app',
  'https://archviz-ai-studio.matija-lekovic.workers.dev',
  'http://localhost:3000',
  'http://localhost:5173',
];

// Cloudflare's documented request body cap is 100 MB on Free/Pro accounts.
// Keep the gateway limit just below that so high-resolution image+mask edits
// can pass while still failing before the platform edge limit.
const MAX_PAYLOAD_BYTES = 95 * 1024 * 1024; // 95 MB
const JWT_EXPIRY_SECONDS = 86400; // 24 hours

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_API_BASE_V1 = 'https://generativelanguage.googleapis.com/v1';
const OPENAI_API_BASE = 'https://api.openai.com/v1';
const OPENAI_IMAGE_MODEL = 'gpt-image-2';
const OPENAI_IMAGE_UPSTREAM_TIMEOUT_MS = 9 * 60 * 1000;
const VERTEX_AI_BASE  = 'https://us-central1-aiplatform.googleapis.com/v1';
const CONVERTAPI_BASE = 'https://v2.convertapi.com';
const ILOVEPDF_BASE   = 'https://api.ilovepdf.com/v1';

const KLING_ENDPOINTS = {
  piapi:       { base: 'https://api.piapi.ai/api/kling/v1' },
  ulazai:      { base: 'https://api.ulazai.com/v1/kling' },
  wavespeedai: { base: 'https://api.wavespeed.ai/v1/kling' },
};

// Vertex AI polling
const QUICK_POLL_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 2000;

// Feedback reporting
const FEEDBACK_SNAPSHOT_INLINE_LIMIT_BYTES = 6 * 1024 * 1024; // 6MB
const FEEDBACK_ALLOWED_STATUSES = new Set(['new', 'triaged', 'in_progress', 'resolved', 'closed']);
const FEEDBACK_ALLOWED_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const FEEDBACK_ALLOWED_CATEGORIES = new Set(['bug', 'quality', 'ux', 'performance', 'feature_request', 'other']);
const FEEDBACK_ALLOWED_IMAGE_SOURCES = new Set(['source', 'current', 'history']);
const FEEDBACK_ALLOWED_DOCUMENT_KINDS = new Set(['original', 'translated']);
const APP_LOG_ALLOWED_STATUSES = new Set(['started', 'running', 'completed', 'failed', 'cancelled']);
const APP_LOG_PROMPT_MAX_CHARS = 80_000;
const APP_LOG_TEXT_MAX_CHARS = 12_000;
const APP_LOG_JSON_MAX_DEPTH = 6;
const APP_LOG_JSON_MAX_ARRAY_ITEMS = 80;
const APP_LOG_JSON_MAX_OBJECT_KEYS = 100;
const APP_LOG_DATA_URL_PREVIEW_CHARS = 96;
const SUPABASE_REQUEST_TIMEOUT_MS = 20_000;
const SUPABASE_STORAGE_TIMEOUT_MS = 90_000;
const APPWRITE_REQUEST_TIMEOUT_MS = 20_000;
const APPWRITE_STORAGE_TIMEOUT_MS = 90_000;
const APPWRITE_RESPONSE_FORMAT = '1.9.5';
const DEFAULT_APPWRITE_DATABASE_ID = 'archviz_reports';
const DEFAULT_APPWRITE_REPORTS_COLLECTION_ID = 'feedback_reports';
const DEFAULT_APPWRITE_ACTIVITY_COLLECTION_ID = 'feedback_activity';
const DEFAULT_APPWRITE_ADMINS_COLLECTION_ID = 'feedback_admins';
const DEFAULT_APPWRITE_SNAPSHOTS_BUCKET_ID = 'feedback_snapshots';
const DEFAULT_APPWRITE_LOG_SESSIONS_COLLECTION_ID = 'app_generation_sessions';
const DEFAULT_APPWRITE_LOG_EVENTS_COLLECTION_ID = 'app_request_logs';
const FEEDBACK_ADMIN_EMAIL = 'matija.lekovic@1pax.com';
const GEMINI_JSON_REWRITE_MAX_BYTES = 1 * 1024 * 1024;

// ─── Utilities ───────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a fetch call with exponential backoff.
 * @param {Function} fn - Async function receiving (signal) that returns a Response
 * @param {Object} options
 * @param {number} [options.maxRetries=2] - Max retry attempts
 * @param {number} [options.timeoutMs=30000] - Per-attempt timeout
 * @param {string} [options.label='request'] - Label for error messages
 */
async function fetchWithRetry(fn, options = {}) {
  const { maxRetries = 2, timeoutMs = 30000, label = 'request' } = options;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const result = await fn(controller.signal);
        clearTimeout(timeoutId);
        return result;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        await sleep(delay);
      }
    }
  }
  throw lastError || new Error(`${label} failed after ${maxRetries + 1} attempts`);
}

/** Base64url encode a buffer or string */
function base64UrlEncode(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Base64url decode to Uint8Array */
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

// ─── Vertex AI Service Account Token ─────────────────────────────────────────

// In-memory cache: survives for the lifetime of the worker instance
let _vertexTokenCache = null; // { token: string, expiresAt: number }

/** Decode standard base64 (not base64url) to Uint8Array */
function base64Decode(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Mint a short-lived Google OAuth2 access token from a service account JSON key.
 * Caches the result for 55 minutes (tokens last 60 min).
 */
async function getVertexAccessToken(env) {
  // Return cached token if still valid
  if (_vertexTokenCache && _vertexTokenCache.expiresAt > Date.now() + 60_000) {
    return _vertexTokenCache.token;
  }

  if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY secret is not set');
  }

  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const now = Math.floor(Date.now() / 1000);

  // Build JWT header + payload
  const header  = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }));
  const unsigned = `${header}.${payload}`;

  // Import the RSA private key (PKCS8 PEM → DER bytes)
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const keyBytes = base64Decode(pemBody);

  const rsaKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign
  const sigBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    rsaKey,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64UrlEncode(sigBytes)}`;

  // Exchange JWT for access token
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResp.ok) {
    const err = await tokenResp.text();
    throw new Error(`Service account token exchange failed (${tokenResp.status}): ${err}`);
  }

  const tokenData = await tokenResp.json();
  _vertexTokenCache = {
    token:     tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in - 60) * 1000,
  };

  return _vertexTokenCache.token;
}

// ─── CORS ────────────────────────────────────────────────────────────────────

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Archviz-Trace-Id',
    'Access-Control-Max-Age': '86400',
  };
}

function corsResponse(origin, body, init = {}) {
  const headers = { ...getCorsHeaders(origin), 'Content-Type': 'application/json', ...(init.headers || {}) };
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { ...init, headers });
}

function handleOptions(request) {
  const origin = request.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
}

// ─── JWT (HS256) ─────────────────────────────────────────────────────────────

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signJwt(payload, secret) {
  const key = await importHmacKey(secret);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${base64UrlEncode(sig)}`;
}

async function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const key = await importHmacKey(secret);
  const data = `${parts[0]}.${parts[1]}`;
  const sig = base64UrlDecode(parts[2]);
  const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data));
  if (!valid) throw new Error('Invalid JWT signature');
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('JWT expired');
  return payload;
}

// ─── Google ID Token Verification ────────────────────────────────────────────

let cachedGoogleKeys = null;
let googleKeysFetchedAt = 0;
const GOOGLE_KEYS_TTL_MS = 3600_000; // 1 hour

async function getGooglePublicKeys() {
  if (cachedGoogleKeys && Date.now() - googleKeysFetchedAt < GOOGLE_KEYS_TTL_MS) {
    return cachedGoogleKeys;
  }
  const resp = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!resp.ok) throw new Error('Failed to fetch Google public keys');
  const jwks = await resp.json();
  cachedGoogleKeys = jwks.keys;
  googleKeysFetchedAt = Date.now();
  return cachedGoogleKeys;
}

async function verifyGoogleIdToken(idToken, clientId, allowedDomain) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid ID token format');

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));

  // Fetch and find matching key
  const keys = await getGooglePublicKeys();
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('No matching Google key found for kid: ' + header.kid);

  // Import RSA key and verify signature
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sig = base64UrlDecode(parts[2]);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
  if (!valid) throw new Error('Invalid Google ID token signature');

  // Validate claims
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error('ID token expired');
  if (payload.aud !== clientId) throw new Error('ID token audience mismatch');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
    throw new Error('ID token issuer mismatch');
  }
  if (allowedDomain && payload.hd !== allowedDomain) {
    throw new Error(`Domain ${payload.hd} not allowed. Expected: ${allowedDomain}`);
  }
  if (!payload.email_verified) throw new Error('Email not verified');

  return payload;
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

/** Verify the Authorization: Bearer <jwt> header. Returns payload or null. */
async function authenticateRequest(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    return await verifyJwt(auth.slice(7), env.JWT_SECRET);
  } catch {
    return null;
  }
}

/** Return 401 response */
function unauthorized(origin, message = 'Unauthorized') {
  return corsResponse(origin, { error: message }, { status: 401 });
}

function forbidden(origin, message = 'Forbidden') {
  return corsResponse(origin, { error: message }, { status: 403 });
}

function badRequest(origin, message = 'Bad request') {
  return corsResponse(origin, { error: message }, { status: 400 });
}

function sanitizeText(value, maxLen = 4000) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

function sanitizeEnum(value, allowedSet, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return allowedSet.has(normalized) ? normalized : fallback;
}

function sanitizeDataImageUrl(value, maxLen = 3000000) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLen) return null;
  if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(normalized)) return null;
  return normalized;
}

function sanitizeDataFileUrl(value, maxLen = 50000000) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLen) return null;
  if (!/^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i.test(normalized)) return null;
  return normalized;
}

function clampNumber(value, min, max, fallback = null) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function sanitizeFeedbackImageAnnotations(input) {
  if (!Array.isArray(input)) return [];

  return input
    .slice(0, 80)
    .map((entry, index) => {
      const sourceType = sanitizeEnum(entry?.sourceType, FEEDBACK_ALLOWED_IMAGE_SOURCES, null);
      if (!sourceType) return null;

      const label = sanitizeText(entry?.label, 200) || `${sourceType}-${index + 1}`;
      const historyId = sanitizeText(entry?.historyId, 120);
      const historyIndexRaw = clampNumber(entry?.historyIndex, 0, 99999, null);
      const historyIndex = historyIndexRaw == null ? null : Math.floor(historyIndexRaw);
      const mode = sanitizeText(entry?.mode, 64);
      const timestampRaw = clampNumber(entry?.timestamp, 0, 9999999999999, null);
      const timestamp = timestampRaw == null ? null : Math.floor(timestampRaw);
      const note = sanitizeText(entry?.note, 12000);

      const markups = Array.isArray(entry?.markups)
        ? entry.markups
            .slice(0, 120)
            .map((markup, markupIndex) => {
              if (Array.isArray(markup?.points)) {
                const points = markup.points
                  .slice(0, 500)
                  .map((point) => {
                    const x = clampNumber(point?.x, 0, 1, null);
                    const y = clampNumber(point?.y, 0, 1, null);
                    if (x == null || y == null) return null;
                    return { x, y };
                  })
                  .filter(Boolean);
                if (points.length >= 3) {
                  return {
                    id: sanitizeText(markup?.id, 120) || `markup-${index + 1}-${markupIndex + 1}`,
                    points,
                  };
                }
              }

              // Legacy circle support
              const x = clampNumber(markup?.x, 0, 1, null);
              const y = clampNumber(markup?.y, 0, 1, null);
              const radius = clampNumber(markup?.radius, 0.001, 1, null);
              if (x == null || y == null || radius == null) return null;
              return {
                id: sanitizeText(markup?.id, 120) || `markup-${index + 1}-${markupIndex + 1}`,
                x,
                y,
                radius,
              };
            })
            .filter(Boolean)
        : [];

      if (!note && markups.length === 0) return null;

      return {
        id: sanitizeText(entry?.id, 120) || `image-feedback-${index + 1}`,
        sourceType,
        label,
        historyId: historyId || null,
        historyIndex,
        mode: mode || null,
        timestamp,
        note: note || null,
        // The snapshot already contains the source/history images. Keeping
        // data URLs in metadata duplicates large image payloads and can make
        // feedback inserts fail for reports that only need pointers.
        previewDataUrl: null,
        markups,
      };
    })
    .filter(Boolean);
}

function sanitizeFeedbackDocumentAttachments(input) {
  if (!Array.isArray(input)) return [];

  return input
    .slice(0, 8)
    .map((entry, index) => {
      const kind = sanitizeEnum(entry?.kind, FEEDBACK_ALLOWED_DOCUMENT_KINDS, null);
      const name = sanitizeText(entry?.name, 240);
      const mimeType = sanitizeText(entry?.mimeType, 200);
      const dataUrl = sanitizeDataFileUrl(entry?.dataUrl, 50000000);
      if (!kind || !name || !mimeType || !dataUrl) return null;

      const sizeRaw = clampNumber(entry?.size, 0, 500000000, null);
      const size = sizeRaw == null ? null : Math.floor(sizeRaw);
      const sourceDocumentId = sanitizeText(entry?.sourceDocumentId, 120);

      return {
        id: sanitizeText(entry?.id, 120) || `document-feedback-${index + 1}`,
        kind,
        name,
        mimeType,
        size,
        dataUrl,
        sourceDocumentId: sourceDocumentId || null,
      };
    })
    .filter(Boolean);
}

function compactObject(input) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null)
  );
}

function parseJsonValue(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isAppwriteFeedbackConfigured(env) {
  return Boolean(
    (env.APPWRITE_ENDPOINT || env.APPWRITE_API_ENDPOINT) &&
    env.APPWRITE_PROJECT_ID &&
    env.APPWRITE_API_KEY
  );
}

function resolveAppwriteConfig(env) {
  const endpoint = (env.APPWRITE_ENDPOINT || env.APPWRITE_API_ENDPOINT || '').replace(/\/+$/, '');
  const projectId = env.APPWRITE_PROJECT_ID || '';
  const apiKey = env.APPWRITE_API_KEY || '';
  if (!endpoint) throw new Error('APPWRITE_ENDPOINT is not configured');
  if (!projectId) throw new Error('APPWRITE_PROJECT_ID is not configured');
  if (!apiKey) throw new Error('APPWRITE_API_KEY is not configured');
  return {
    endpoint,
    projectId,
    apiKey,
    databaseId: env.APPWRITE_DATABASE_ID || DEFAULT_APPWRITE_DATABASE_ID,
    reportsCollectionId: env.APPWRITE_REPORTS_COLLECTION_ID || DEFAULT_APPWRITE_REPORTS_COLLECTION_ID,
    activityCollectionId: env.APPWRITE_ACTIVITY_COLLECTION_ID || DEFAULT_APPWRITE_ACTIVITY_COLLECTION_ID,
    adminsCollectionId: env.APPWRITE_ADMINS_COLLECTION_ID || DEFAULT_APPWRITE_ADMINS_COLLECTION_ID,
    snapshotsBucketId: env.APPWRITE_SNAPSHOTS_BUCKET_ID || DEFAULT_APPWRITE_SNAPSHOTS_BUCKET_ID,
    logSessionsCollectionId: env.APPWRITE_LOG_SESSIONS_COLLECTION_ID || DEFAULT_APPWRITE_LOG_SESSIONS_COLLECTION_ID,
    logEventsCollectionId: env.APPWRITE_LOG_EVENTS_COLLECTION_ID || DEFAULT_APPWRITE_LOG_EVENTS_COLLECTION_ID,
  };
}

async function appwriteFetch(env, path, init = {}) {
  const config = resolveAppwriteConfig(env);
  const { timeoutMs = APPWRITE_REQUEST_TIMEOUT_MS, signal: callerSignal, ...fetchInit } = init;
  const headers = new Headers(fetchInit.headers || {});
  headers.set('X-Appwrite-Response-Format', APPWRITE_RESPONSE_FORMAT);
  headers.set('X-Appwrite-Project', config.projectId);
  headers.set('X-Appwrite-Key', config.apiKey);
  const isFormDataBody = typeof FormData !== 'undefined' && fetchInit.body instanceof FormData;
  if (!isFormDataBody && !headers.has('Content-Type') && fetchInit.body && typeof fetchInit.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  callerSignal?.addEventListener?.('abort', onCallerAbort);

  try {
    return await fetch(`${config.endpoint}${path}`, {
      ...fetchInit,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && !callerSignal?.aborted) {
      throw new Error(`Appwrite request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener?.('abort', onCallerAbort);
  }
}

async function appwriteJson(env, path, init = {}) {
  const resp = await appwriteFetch(env, path, init);
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Appwrite request failed (${resp.status}): ${errText.slice(0, 600)}`);
  }
  if (resp.status === 204) return null;
  const text = await resp.text();
  if (!text) return null;
  return JSON.parse(text);
}

function appwriteQuery(method, attribute, values = []) {
  const query = { method };
  if (attribute) query.attribute = attribute;
  query.values = Array.isArray(values) ? values : [values];
  return JSON.stringify(query);
}

function buildAppwriteQueryString(queries) {
  const params = new URLSearchParams();
  queries.filter(Boolean).forEach((query, index) => params.append(`queries[${index}]`, query));
  return params.toString();
}

async function appwriteSetupExists(env, path) {
  const resp = await appwriteFetch(env, path);
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Appwrite setup request failed (${resp.status}): ${errText.slice(0, 600)}`);
  }
  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

async function appwriteSetupWaitForResource(env, path, label) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const resource = await appwriteSetupExists(env, path);
    const status = resource?.status;
    if (!status || status === 'available') return resource;
    if (status === 'failed') throw new Error(`${label} failed: ${resource?.error || 'unknown error'}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} did not become available in time.`);
}

async function appwriteSetupCreateIfMissing(env, logs, label, getPath, createPath, body) {
  const current = await appwriteSetupExists(env, getPath);
  if (current) {
    logs.push(`${label}: exists`);
    return current;
  }
  logs.push(`${label}: creating`);
  return appwriteJson(env, createPath, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function appwriteSetupAttributePath(config, collectionId, key) {
  return `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(collectionId)}/attributes/${encodeURIComponent(key)}`;
}

async function appwriteSetupCreateAttribute(env, logs, config, collectionId, spec) {
  const current = await appwriteSetupExists(env, appwriteSetupAttributePath(config, collectionId, spec.key));
  if (current) {
    logs.push(`${collectionId}.${spec.key}: attribute exists`);
    return current;
  }

  const { type, ...body } = spec;
  logs.push(`${collectionId}.${spec.key}: creating attribute`);
  await appwriteJson(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(collectionId)}/attributes/${type}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  return appwriteSetupWaitForResource(env, appwriteSetupAttributePath(config, collectionId, spec.key), `${collectionId}.${spec.key}`);
}

async function appwriteSetupCreateIndex(env, logs, config, collectionId, key, attributes, orders = []) {
  const path = `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(collectionId)}/indexes/${encodeURIComponent(key)}`;
  const current = await appwriteSetupExists(env, path);
  if (current) {
    logs.push(`${collectionId}.${key}: index exists`);
    return current;
  }

  logs.push(`${collectionId}.${key}: creating index`);
  await appwriteJson(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(collectionId)}/indexes`,
    {
      method: 'POST',
      body: JSON.stringify({
        key,
        type: 'key',
        attributes,
        orders,
      }),
    }
  );
  return appwriteSetupWaitForResource(env, path, `${collectionId}.${key}`);
}

function appwriteSetupStringAttr(key, size, required = false) {
  return { type: 'string', key, size, required, array: false, encrypt: false };
}

function appwriteSetupTextAttr(key, required = false) {
  return { type: 'text', key, required, array: false, encrypt: false };
}

function appwriteSetupDatetimeAttr(key, required = false) {
  return { type: 'datetime', key, required, array: false };
}

function appwriteSetupEmailAttr(key, required = false) {
  return { type: 'email', key, required, array: false };
}

function appwriteSetupIntAttr(key, required = false) {
  return { type: 'integer', key, required, array: false };
}

function appwriteSetupBoolAttr(key, required = false) {
  return { type: 'boolean', key, required, array: false };
}

function appwriteSetupEnumAttr(key, elements, required = false) {
  return { type: 'enum', key, elements, required, array: false };
}

function appwriteSetupSchemas() {
  const statusValues = ['new', 'triaged', 'in_progress', 'resolved', 'closed'];
  const priorityValues = ['low', 'normal', 'high', 'urgent'];
  const categoryValues = ['bug', 'quality', 'ux', 'performance', 'feature_request', 'other'];
  const activityKindValues = ['created', 'comment', 'status_changed', 'priority_changed', 'system'];
  const logStatusValues = ['started', 'running', 'completed', 'failed', 'cancelled'];

  return {
    reportAttributes: [
      appwriteSetupDatetimeAttr('created_at', true),
      appwriteSetupDatetimeAttr('updated_at', true),
      appwriteSetupDatetimeAttr('last_activity_at', true),
      appwriteSetupEmailAttr('reporter_email', true),
      appwriteSetupStringAttr('reporter_name', 200),
      appwriteSetupTextAttr('reporter_picture'),
      appwriteSetupEnumAttr('status', statusValues, true),
      appwriteSetupEnumAttr('priority', priorityValues, true),
      appwriteSetupEnumAttr('category', categoryValues, true),
      appwriteSetupStringAttr('title', 200, true),
      appwriteSetupTextAttr('description', true),
      appwriteSetupTextAttr('reproduction_steps'),
      appwriteSetupTextAttr('expected_behavior'),
      appwriteSetupStringAttr('mode', 64),
      appwriteSetupStringAttr('app_version', 128),
      appwriteSetupTextAttr('user_agent'),
      appwriteSetupStringAttr('project_name', 200),
      appwriteSetupIntAttr('history_count', true),
      appwriteSetupIntAttr('snapshot_version', true),
      appwriteSetupStringAttr('snapshot_hash', 128, true),
      appwriteSetupIntAttr('snapshot_size_bytes', true),
      appwriteSetupTextAttr('snapshot_json'),
      appwriteSetupStringAttr('snapshot_storage_path', 240),
      appwriteSetupDatetimeAttr('resolved_at'),
      appwriteSetupEmailAttr('resolved_by'),
      appwriteSetupTextAttr('metadata_json'),
    ],
    activityAttributes: [
      appwriteSetupIntAttr('activity_id', true),
      appwriteSetupStringAttr('report_id', 36, true),
      appwriteSetupDatetimeAttr('created_at', true),
      appwriteSetupEmailAttr('actor_email', true),
      appwriteSetupStringAttr('actor_name', 200),
      appwriteSetupEnumAttr('kind', activityKindValues, true),
      appwriteSetupTextAttr('message', true),
      appwriteSetupEnumAttr('from_status', statusValues),
      appwriteSetupEnumAttr('to_status', statusValues),
      appwriteSetupEnumAttr('from_priority', priorityValues),
      appwriteSetupEnumAttr('to_priority', priorityValues),
      appwriteSetupTextAttr('metadata_json'),
    ],
    adminAttributes: [
      appwriteSetupEmailAttr('email', true),
      appwriteSetupBoolAttr('is_active', true),
      appwriteSetupDatetimeAttr('created_at', true),
      appwriteSetupStringAttr('created_by', 120),
      appwriteSetupTextAttr('notes'),
    ],
    logSessionAttributes: [
      appwriteSetupStringAttr('trace_id', 160, true),
      appwriteSetupDatetimeAttr('created_at', true),
      appwriteSetupDatetimeAttr('started_at', true),
      appwriteSetupDatetimeAttr('updated_at', true),
      appwriteSetupDatetimeAttr('completed_at'),
      appwriteSetupEmailAttr('user_email'),
      appwriteSetupStringAttr('user_name', 200),
      appwriteSetupEnumAttr('status', logStatusValues, true),
      appwriteSetupStringAttr('mode', 80),
      appwriteSetupStringAttr('provider', 120),
      appwriteSetupStringAttr('model', 160),
      appwriteSetupTextAttr('prompt'),
      appwriteSetupStringAttr('prompt_hash', 128),
      appwriteSetupIntAttr('duration_ms'),
      appwriteSetupTextAttr('input_summary_json'),
      appwriteSetupTextAttr('output_summary_json'),
      appwriteSetupTextAttr('error_message'),
      appwriteSetupTextAttr('metadata_json'),
    ],
    logEventAttributes: [
      appwriteSetupIntAttr('event_id', true),
      appwriteSetupDatetimeAttr('created_at', true),
      appwriteSetupStringAttr('trace_id', 160, true),
      appwriteSetupStringAttr('generation_id', 36),
      appwriteSetupEmailAttr('user_email'),
      appwriteSetupStringAttr('user_name', 200),
      appwriteSetupStringAttr('event_type', 120, true),
      appwriteSetupStringAttr('provider', 120),
      appwriteSetupStringAttr('model', 160),
      appwriteSetupStringAttr('action', 160),
      appwriteSetupStringAttr('method', 16),
      appwriteSetupStringAttr('path', 600),
      appwriteSetupIntAttr('status_code'),
      appwriteSetupIntAttr('duration_ms'),
      appwriteSetupTextAttr('prompt'),
      appwriteSetupStringAttr('prompt_hash', 128),
      appwriteSetupTextAttr('request_summary_json'),
      appwriteSetupTextAttr('response_summary_json'),
      appwriteSetupTextAttr('error_message'),
      appwriteSetupTextAttr('metadata_json'),
    ],
  };
}

async function setupAppwriteFeedbackResources(env, requestedPhase = 'all', options = {}) {
  const config = resolveAppwriteConfig(env);
  const phases = String(requestedPhase || 'all')
    .split(',')
    .map((phase) => phase.trim())
    .filter(Boolean);
  const phaseSet = new Set(phases.length > 0 ? phases : ['all']);
  const shouldRun = (phase) => phaseSet.has('all') || phaseSet.has(phase);
  const batchStart = Math.max(0, Number.isFinite(Number(options.start)) ? Math.floor(Number(options.start)) : 0);
  const batchLimit = Number.isFinite(Number(options.limit)) && Number(options.limit) > 0
    ? Math.max(1, Math.floor(Number(options.limit)))
    : null;
  const batchSlice = (items) => batchLimit ? items.slice(batchStart, batchStart + batchLimit) : items;
  const logs = [];
  const { reportAttributes, activityAttributes, adminAttributes, logSessionAttributes, logEventAttributes } = appwriteSetupSchemas();

  if (shouldRun('resources')) {
    await appwriteSetupCreateIfMissing(
      env,
      logs,
      'database',
      `/databases/${encodeURIComponent(config.databaseId)}`,
      '/databases',
      {
        databaseId: config.databaseId,
        name: 'ArchViz Feedback Reports',
        enabled: true,
      }
    );

    await appwriteSetupCreateIfMissing(
      env,
      logs,
      'reports collection',
      `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.reportsCollectionId)}`,
      `/databases/${encodeURIComponent(config.databaseId)}/collections`,
      {
        collectionId: config.reportsCollectionId,
        name: 'Feedback Reports',
        permissions: [],
        documentSecurity: false,
        enabled: true,
      }
    );

    await appwriteSetupCreateIfMissing(
      env,
      logs,
      'activity collection',
      `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.activityCollectionId)}`,
      `/databases/${encodeURIComponent(config.databaseId)}/collections`,
      {
        collectionId: config.activityCollectionId,
        name: 'Feedback Activity',
        permissions: [],
        documentSecurity: false,
        enabled: true,
      }
    );

    await appwriteSetupCreateIfMissing(
      env,
      logs,
      'admins collection',
      `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.adminsCollectionId)}`,
      `/databases/${encodeURIComponent(config.databaseId)}/collections`,
      {
        collectionId: config.adminsCollectionId,
        name: 'Feedback Admins',
        permissions: [],
        documentSecurity: false,
        enabled: true,
      }
    );

    await appwriteSetupCreateIfMissing(
      env,
      logs,
      'log sessions collection',
      `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.logSessionsCollectionId)}`,
      `/databases/${encodeURIComponent(config.databaseId)}/collections`,
      {
        collectionId: config.logSessionsCollectionId,
        name: 'App Generation Sessions',
        permissions: [],
        documentSecurity: false,
        enabled: true,
      }
    );

    await appwriteSetupCreateIfMissing(
      env,
      logs,
      'log events collection',
      `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.logEventsCollectionId)}`,
      `/databases/${encodeURIComponent(config.databaseId)}/collections`,
      {
        collectionId: config.logEventsCollectionId,
        name: 'App Request Logs',
        permissions: [],
        documentSecurity: false,
        enabled: true,
      }
    );

    await appwriteSetupCreateIfMissing(
      env,
      logs,
      'snapshot bucket',
      `/storage/buckets/${encodeURIComponent(config.snapshotsBucketId)}`,
      '/storage/buckets',
      {
        bucketId: config.snapshotsBucketId,
        name: 'Feedback Snapshots',
        permissions: [],
        fileSecurity: false,
        enabled: true,
        maximumFileSize: 50_000_000,
        allowedFileExtensions: ['json'],
        compression: 'gzip',
        encryption: true,
        antivirus: true,
        transformations: false,
      }
    );
  }

  if (shouldRun('reports')) {
    for (const spec of batchSlice(reportAttributes)) {
      await appwriteSetupCreateAttribute(env, logs, config, config.reportsCollectionId, spec);
    }
  }

  if (shouldRun('activity')) {
    for (const spec of batchSlice(activityAttributes)) {
      await appwriteSetupCreateAttribute(env, logs, config, config.activityCollectionId, spec);
    }
  }

  if (shouldRun('admins')) {
    for (const spec of batchSlice(adminAttributes)) {
      await appwriteSetupCreateAttribute(env, logs, config, config.adminsCollectionId, spec);
    }
  }

  if (shouldRun('logs') || shouldRun('log-sessions')) {
    for (const spec of batchSlice(logSessionAttributes)) {
      await appwriteSetupCreateAttribute(env, logs, config, config.logSessionsCollectionId, spec);
    }
  }

  if (shouldRun('logs') || shouldRun('log-events')) {
    for (const spec of batchSlice(logEventAttributes)) {
      await appwriteSetupCreateAttribute(env, logs, config, config.logEventsCollectionId, spec);
    }
  }

  if (shouldRun('indexes')) {
    const indexes = [
      [config.reportsCollectionId, 'created_at_desc', ['created_at'], ['DESC']],
      [config.reportsCollectionId, 'status_idx', ['status']],
      [config.reportsCollectionId, 'priority_idx', ['priority']],
      [config.reportsCollectionId, 'category_idx', ['category']],
      [config.reportsCollectionId, 'mode_idx', ['mode']],
      [config.reportsCollectionId, 'reporter_email_idx', ['reporter_email']],
      [config.activityCollectionId, 'report_created_idx', ['report_id', 'created_at'], ['ASC', 'ASC']],
      [config.adminsCollectionId, 'email_active_idx', ['email', 'is_active'], ['ASC', 'ASC']],
      [config.logSessionsCollectionId, 'trace_id_idx', ['trace_id']],
      [config.logSessionsCollectionId, 'created_at_desc', ['created_at'], ['DESC']],
      [config.logSessionsCollectionId, 'status_created_idx', ['status', 'created_at'], ['ASC', 'DESC']],
      [config.logSessionsCollectionId, 'provider_created_idx', ['provider', 'created_at'], ['ASC', 'DESC']],
      [config.logSessionsCollectionId, 'mode_created_idx', ['mode', 'created_at'], ['ASC', 'DESC']],
      [config.logSessionsCollectionId, 'user_created_idx', ['user_email', 'created_at'], ['ASC', 'DESC']],
      [config.logEventsCollectionId, 'trace_created_idx', ['trace_id', 'created_at'], ['ASC', 'ASC']],
      [config.logEventsCollectionId, 'event_id_idx', ['event_id']],
      [config.logEventsCollectionId, 'created_at_desc', ['created_at'], ['DESC']],
      [config.logEventsCollectionId, 'event_type_created_idx', ['event_type', 'created_at'], ['ASC', 'DESC']],
    ];
    for (const [collectionId, key, attributes, orders = []] of batchSlice(indexes)) {
      await appwriteSetupCreateIndex(env, logs, config, collectionId, key, attributes, orders);
    }
  }

  if (shouldRun('seed')) {
    const adminEmail = String(env.APPWRITE_FEEDBACK_ADMIN_EMAIL || 'matija.lekovic@1pax.com').trim().toLowerCase();
    const query = buildAppwriteQueryString([
      appwriteQuery('equal', 'email', [adminEmail]),
      appwriteQuery('limit', null, [1]),
    ]);
    const existingAdmins = await appwriteJson(
      env,
      `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.adminsCollectionId)}/documents?${query}`
    );

    if (Array.isArray(existingAdmins?.documents) && existingAdmins.documents.length > 0) {
      logs.push(`admin ${adminEmail}: exists`);
    } else {
      const adminHash = await sha256Hex(adminEmail);
      logs.push(`admin ${adminEmail}: seeding`);
      const createResp = await appwriteFetch(
        env,
        `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.adminsCollectionId)}/documents`,
        {
          method: 'POST',
          body: JSON.stringify({
            documentId: `admin_${adminHash.slice(0, 30)}`,
            data: {
              email: adminEmail,
              is_active: true,
              created_at: new Date().toISOString(),
              created_by: 'cloudflare-worker-setup',
              notes: 'Initial feedback admin',
            },
          }),
        }
      );
      if (!createResp.ok && createResp.status !== 409) {
        const errText = await createResp.text();
        throw new Error(`Appwrite request failed (${createResp.status}): ${errText.slice(0, 600)}`);
      }
      if (createResp.status === 409) logs.push(`admin ${adminEmail}: already existed`);
    }
  }

  return {
    phases: [...phaseSet],
    start: batchStart,
    limit: batchLimit,
    logs,
  };
}

function appwriteReportToRow(doc) {
  if (!doc) return null;
  return {
    id: doc.$id,
    created_at: doc.created_at || doc.$createdAt,
    updated_at: doc.updated_at || doc.$updatedAt,
    last_activity_at: doc.last_activity_at || doc.updated_at || doc.$updatedAt,
    reporter_email: doc.reporter_email,
    reporter_name: doc.reporter_name ?? null,
    reporter_picture: doc.reporter_picture ?? null,
    status: doc.status,
    priority: doc.priority,
    category: doc.category,
    title: doc.title,
    description: doc.description,
    reproduction_steps: doc.reproduction_steps ?? null,
    expected_behavior: doc.expected_behavior ?? null,
    mode: doc.mode ?? null,
    app_version: doc.app_version ?? null,
    user_agent: doc.user_agent ?? null,
    project_name: doc.project_name ?? null,
    history_count: doc.history_count ?? 0,
    snapshot_version: doc.snapshot_version ?? 1,
    snapshot_hash: doc.snapshot_hash,
    snapshot_size_bytes: doc.snapshot_size_bytes,
    snapshot_json: parseJsonValue(doc.snapshot_json, null),
    snapshot_storage_path: doc.snapshot_storage_path ?? null,
    resolved_at: doc.resolved_at ?? null,
    resolved_by: doc.resolved_by ?? null,
    metadata: parseJsonValue(doc.metadata_json, {}),
  };
}

function appwriteActivityToRow(doc) {
  if (!doc) return null;
  return {
    id: doc.activity_id ?? (Date.parse(doc.created_at || doc.$createdAt || '') || 0),
    created_at: doc.created_at || doc.$createdAt,
    actor_email: doc.actor_email,
    actor_name: doc.actor_name ?? null,
    kind: doc.kind,
    message: doc.message,
    from_status: doc.from_status ?? null,
    to_status: doc.to_status ?? null,
    from_priority: doc.from_priority ?? null,
    to_priority: doc.to_priority ?? null,
    metadata: parseJsonValue(doc.metadata_json, {}),
  };
}

function appwriteReportDocumentData(reportPayload) {
  const now = new Date().toISOString();
  return compactObject({
    created_at: reportPayload.created_at || now,
    updated_at: reportPayload.updated_at || now,
    last_activity_at: reportPayload.last_activity_at || now,
    reporter_email: reportPayload.reporter_email,
    reporter_name: reportPayload.reporter_name,
    reporter_picture: reportPayload.reporter_picture,
    status: reportPayload.status,
    priority: reportPayload.priority,
    category: reportPayload.category,
    title: reportPayload.title,
    description: reportPayload.description,
    reproduction_steps: reportPayload.reproduction_steps,
    expected_behavior: reportPayload.expected_behavior,
    mode: reportPayload.mode,
    app_version: reportPayload.app_version,
    user_agent: reportPayload.user_agent,
    project_name: reportPayload.project_name,
    history_count: reportPayload.history_count,
    snapshot_version: reportPayload.snapshot_version,
    snapshot_hash: reportPayload.snapshot_hash,
    snapshot_size_bytes: reportPayload.snapshot_size_bytes,
    snapshot_json: reportPayload.snapshot_json ? JSON.stringify(reportPayload.snapshot_json) : undefined,
    snapshot_storage_path: reportPayload.snapshot_storage_path,
    resolved_at: reportPayload.resolved_at,
    resolved_by: reportPayload.resolved_by,
    metadata_json: JSON.stringify(reportPayload.metadata || {}),
  });
}

function appwriteActivityDocumentData(activityPayload) {
  const now = new Date().toISOString();
  return compactObject({
    activity_id: activityPayload.activity_id || Math.floor(Date.now() + Math.random() * 1000),
    report_id: activityPayload.report_id,
    created_at: activityPayload.created_at || now,
    actor_email: activityPayload.actor_email,
    actor_name: activityPayload.actor_name,
    kind: activityPayload.kind,
    message: activityPayload.message,
    from_status: activityPayload.from_status,
    to_status: activityPayload.to_status,
    from_priority: activityPayload.from_priority,
    to_priority: activityPayload.to_priority,
    metadata_json: JSON.stringify(activityPayload.metadata || {}),
  });
}

async function createAppwriteFeedbackReport(env, reportPayload) {
  const config = resolveAppwriteConfig(env);
  const doc = await appwriteJson(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.reportsCollectionId)}/documents`,
    {
      method: 'POST',
      body: JSON.stringify({
        documentId: reportPayload.id,
        data: appwriteReportDocumentData(reportPayload),
      }),
    }
  );
  return appwriteReportToRow(doc);
}

async function createAppwriteFeedbackActivity(env, activityPayload) {
  const config = resolveAppwriteConfig(env);
  const payloads = Array.isArray(activityPayload) ? activityPayload : [activityPayload];
  const rows = [];
  for (const payload of payloads) {
    const doc = await appwriteJson(
      env,
      `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.activityCollectionId)}/documents`,
      {
        method: 'POST',
        body: JSON.stringify({
          documentId: crypto.randomUUID(),
          data: appwriteActivityDocumentData(payload),
        }),
      }
    );
    rows.push(appwriteActivityToRow(doc));
  }
  return rows;
}

async function listAppwriteFeedbackReports(env, filters) {
  const config = resolveAppwriteConfig(env);
  const queries = [
    appwriteQuery('orderDesc', 'created_at'),
    appwriteQuery('limit', null, [Math.max(1, Math.min(filters.limit || 50, 200))]),
    appwriteQuery('offset', null, [Math.max(0, filters.offset || 0)]),
  ];
  if (filters.status) queries.push(appwriteQuery('equal', 'status', [filters.status]));
  if (filters.priority) queries.push(appwriteQuery('equal', 'priority', [filters.priority]));
  if (filters.category) queries.push(appwriteQuery('equal', 'category', [filters.category]));
  if (filters.mode) queries.push(appwriteQuery('equal', 'mode', [filters.mode]));
  if (filters.reporterEmail) queries.push(appwriteQuery('equal', 'reporter_email', [filters.reporterEmail]));

  const query = buildAppwriteQueryString(queries);
  const result = await appwriteJson(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.reportsCollectionId)}/documents?${query}`
  );

  let reports = Array.isArray(result?.documents) ? result.documents.map(appwriteReportToRow) : [];
  if (filters.search) {
    const needle = String(filters.search).toLowerCase();
    reports = reports.filter((report) =>
      [report.title, report.description, report.reporter_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }
  return reports;
}

async function getAppwriteFeedbackReport(env, reportId) {
  const config = resolveAppwriteConfig(env);
  const resp = await appwriteFetch(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.reportsCollectionId)}/documents/${encodeURIComponent(reportId)}`
  );
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Appwrite request failed (${resp.status}): ${errText.slice(0, 600)}`);
  }
  const doc = await resp.json();
  return appwriteReportToRow(doc);
}

async function listAppwriteFeedbackActivity(env, reportId) {
  const config = resolveAppwriteConfig(env);
  const query = buildAppwriteQueryString([
    appwriteQuery('equal', 'report_id', [reportId]),
    appwriteQuery('orderAsc', 'created_at'),
    appwriteQuery('limit', null, [200]),
  ]);
  const result = await appwriteJson(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.activityCollectionId)}/documents?${query}`
  );
  return Array.isArray(result?.documents) ? result.documents.map(appwriteActivityToRow) : [];
}

async function updateAppwriteFeedbackReport(env, reportId, patchPayload) {
  const config = resolveAppwriteConfig(env);
  const doc = await appwriteJson(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.reportsCollectionId)}/documents/${encodeURIComponent(reportId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        data: compactObject({
          ...patchPayload,
          updated_at: new Date().toISOString(),
        }),
      }),
    }
  );
  return appwriteReportToRow(doc);
}

async function deleteAppwriteFeedbackReport(env, reportId) {
  const config = resolveAppwriteConfig(env);
  await appwriteJson(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.reportsCollectionId)}/documents/${encodeURIComponent(reportId)}`,
    { method: 'DELETE' }
  );
}

async function isAppwriteFeedbackAdmin(env, email) {
  const config = resolveAppwriteConfig(env);
  const query = buildAppwriteQueryString([
    appwriteQuery('equal', 'email', [email]),
    appwriteQuery('equal', 'is_active', [true]),
    appwriteQuery('limit', null, [1]),
  ]);
  const result = await appwriteJson(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.adminsCollectionId)}/documents?${query}`
  );
  return Array.isArray(result?.documents) && result.documents.length > 0;
}

async function uploadFeedbackSnapshotToAppwrite(env, reportId, snapshotText) {
  const config = resolveAppwriteConfig(env);
  const formData = new FormData();
  formData.append('fileId', reportId);
  formData.append('file', new Blob([snapshotText], { type: 'application/json' }), 'snapshot.json');

  await appwriteJson(
    env,
    `/storage/buckets/${encodeURIComponent(config.snapshotsBucketId)}/files`,
    {
      method: 'POST',
      body: formData,
      timeoutMs: APPWRITE_STORAGE_TIMEOUT_MS,
    }
  );

  return `appwrite://${config.snapshotsBucketId}/${reportId}`;
}

function parseAppwriteStoragePath(snapshotStoragePath) {
  if (!snapshotStoragePath || !String(snapshotStoragePath).startsWith('appwrite://')) return null;
  const withoutScheme = String(snapshotStoragePath).slice('appwrite://'.length);
  const [bucketId, fileId] = withoutScheme.split('/');
  if (!bucketId || !fileId) return null;
  return { bucketId, fileId };
}

async function downloadFeedbackSnapshotFromAppwrite(env, snapshotStoragePath) {
  const parsed = parseAppwriteStoragePath(snapshotStoragePath);
  if (!parsed) throw new Error('Invalid Appwrite snapshot storage path.');
  const resp = await appwriteFetch(
    env,
    `/storage/buckets/${encodeURIComponent(parsed.bucketId)}/files/${encodeURIComponent(parsed.fileId)}/download`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeoutMs: APPWRITE_STORAGE_TIMEOUT_MS,
    }
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Snapshot download failed (${resp.status}): ${errText.slice(0, 500)}`);
  }
  return resp.json();
}

async function deleteFeedbackSnapshotFromAppwrite(env, snapshotStoragePath) {
  const parsed = parseAppwriteStoragePath(snapshotStoragePath);
  if (!parsed) return;
  const resp = await appwriteFetch(
    env,
    `/storage/buckets/${encodeURIComponent(parsed.bucketId)}/files/${encodeURIComponent(parsed.fileId)}`,
    {
      method: 'DELETE',
      timeoutMs: APPWRITE_STORAGE_TIMEOUT_MS,
    }
  );
  if (!resp.ok && resp.status !== 404) {
    const errText = await resp.text();
    throw new Error(`Snapshot storage delete failed (${resp.status}): ${errText.slice(0, 500)}`);
  }
}

function resolveSupabaseUrl(env) {
  if (!env.SUPABASE_URL) throw new Error('SUPABASE_URL is not configured');
  return env.SUPABASE_URL.replace(/\/+$/, '');
}

function resolveSupabaseKey(env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

async function supabaseFetch(env, path, init = {}) {
  const baseUrl = resolveSupabaseUrl(env);
  const serviceKey = resolveSupabaseKey(env);
  const { timeoutMs = SUPABASE_REQUEST_TIMEOUT_MS, signal: callerSignal, ...fetchInit } = init;
  const headers = new Headers(fetchInit.headers || {});
  if (!headers.has('apikey')) headers.set('apikey', serviceKey);
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${serviceKey}`);
  if (!headers.has('Content-Type') && fetchInit.body && typeof fetchInit.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  callerSignal?.addEventListener?.('abort', onCallerAbort);

  try {
    return await fetch(`${baseUrl}${path}`, {
      ...fetchInit,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && !callerSignal?.aborted) {
      throw new Error(`Supabase request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener?.('abort', onCallerAbort);
  }
}

async function supabaseJson(env, path, init = {}) {
  const resp = await supabaseFetch(env, path, init);
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Supabase request failed (${resp.status}): ${errText.slice(0, 600)}`);
  }
  if (resp.status === 204) return null;
  const text = await resp.text();
  if (!text) return null;
  return JSON.parse(text);
}

function isSupabaseConfigured(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function sanitizeLogTraceId(value) {
  const text = sanitizeText(value, 160);
  return text && /^[a-zA-Z0-9_.:-]{8,160}$/.test(text) ? text : null;
}

function sanitizeLogText(value, maxLen = APP_LOG_TEXT_MAX_CHARS) {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, maxLen);
}

function summarizeDataUrlForLog(value) {
  const match = value.match(/^data:([^;,]+)(?:;[^,]*)?,(.*)$/s);
  const mimeType = match?.[1] || null;
  const payload = match?.[2] || '';
  const isBase64 = /;base64,/i.test(value.slice(0, Math.min(value.length, 128)));
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  const bytesApprox = isBase64
    ? Math.max(0, Math.floor((payload.length * 3) / 4) - padding)
    : payload.length;

  return {
    kind: 'data-url',
    mimeType,
    chars: value.length,
    bytesApprox,
    preview: value.slice(0, APP_LOG_DATA_URL_PREVIEW_CHARS),
  };
}

function summarizeStringForLog(value, maxLen = APP_LOG_TEXT_MAX_CHARS) {
  if (value.startsWith('data:')) return summarizeDataUrlForLog(value);
  if (value.length <= maxLen) return value;
  return {
    kind: 'string',
    chars: value.length,
    preview: value.slice(0, maxLen),
    truncated: true,
  };
}

function sanitizeLogJson(value, depth = 0) {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return summarizeStringForLog(value);
  if (typeof value !== 'object') return String(value).slice(0, 500);
  if (depth >= APP_LOG_JSON_MAX_DEPTH) return '[MaxDepth]';

  if (Array.isArray(value)) {
    const items = value
      .slice(0, APP_LOG_JSON_MAX_ARRAY_ITEMS)
      .map((item) => sanitizeLogJson(item, depth + 1));
    if (value.length > APP_LOG_JSON_MAX_ARRAY_ITEMS) {
      items.push({ truncatedItems: value.length - APP_LOG_JSON_MAX_ARRAY_ITEMS });
    }
    return items;
  }

  const entries = Object.entries(value).slice(0, APP_LOG_JSON_MAX_OBJECT_KEYS);
  const output = {};
  for (const [key, item] of entries) {
    output[String(key).slice(0, 120)] = sanitizeLogJson(item, depth + 1);
  }
  if (Object.keys(value).length > APP_LOG_JSON_MAX_OBJECT_KEYS) {
    output.__truncatedKeys = Object.keys(value).length - APP_LOG_JSON_MAX_OBJECT_KEYS;
  }
  return output;
}

function normalizeLogStatus(value, fallback = null) {
  return sanitizeEnum(value, APP_LOG_ALLOWED_STATUSES, fallback);
}

function normalizeLogInteger(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function extractPromptFromLogPayload(body) {
  return sanitizeLogText(
    body?.prompt ||
    body?.metadata?.prompt ||
    body?.requestSummary?.prompt ||
    body?.request_summary?.prompt,
    APP_LOG_PROMPT_MAX_CHARS
  );
}

function summarizeResponseHeaders(response) {
  return {
    contentType: response.headers.get('Content-Type'),
    contentLength: response.headers.get('Content-Length'),
  };
}

function getLogProviderForPath(path) {
  if (path.startsWith('/api/gemini/')) return 'gemini';
  if (path.startsWith('/api/openai/')) return 'openai';
  if (path.startsWith('/api/veo/')) return 'veo';
  if (path.startsWith('/api/kling/')) return 'kling';
  if (path.startsWith('/api/convert/')) return 'convertapi';
  if (path.startsWith('/api/ilovepdf/')) return 'ilovepdf';
  if (path.startsWith('/api/fetch-url')) return 'url-fetch';
  if (path.startsWith('/api/feedback/')) return 'feedback';
  return null;
}

async function upsertAppGenerationSession(env, user, traceId, body, prompt, promptHash) {
  const eventType = sanitizeLogText(body?.eventType, 120) || 'client_event';
  const isCompletion = eventType === 'generation_completed' || eventType === 'generation_failed' || eventType === 'generation_cancelled';
  const statusFromEvent =
    eventType === 'generation_completed' ? 'completed' :
    eventType === 'generation_failed' ? 'failed' :
    eventType === 'generation_cancelled' ? 'cancelled' :
    eventType === 'generation_started' ? 'started' :
    normalizeLogStatus(body?.status, null);

  const payload = {
    trace_id: traceId,
    user_email: sanitizeLogText(user?.email, 320),
    user_name: sanitizeLogText(user?.name, 200),
    status: statusFromEvent || 'running',
    mode: sanitizeLogText(body?.mode, 80),
    provider: sanitizeLogText(body?.provider, 120),
    model: sanitizeLogText(body?.model, 160),
    prompt: prompt || undefined,
    prompt_hash: promptHash || undefined,
    duration_ms: normalizeLogInteger(body?.durationMs ?? body?.duration_ms, 0, 24 * 60 * 60 * 1000),
    error_message: sanitizeLogText(body?.errorMessage ?? body?.error_message, 20000),
  };

  if ('inputSummary' in body || 'input_summary' in body) {
    payload.input_summary = sanitizeLogJson(body?.inputSummary ?? body?.input_summary ?? {});
  }
  if ('outputSummary' in body || 'output_summary' in body) {
    payload.output_summary = sanitizeLogJson(body?.outputSummary ?? body?.output_summary ?? {});
  }
  if ('metadata' in body) {
    payload.metadata = sanitizeLogJson(body?.metadata ?? {});
  }

  if (eventType === 'generation_started') {
    payload.started_at = new Date().toISOString();
  }
  if (isCompletion) {
    payload.completed_at = new Date().toISOString();
  }

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  const rows = await supabaseJson(env, '/rest/v1/app_generation_sessions?on_conflict=trace_id&select=id,trace_id,status,created_at,started_at,updated_at,completed_at', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload),
  });

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function getAppGenerationSessionByTrace(env, traceId) {
  if (!traceId) return null;
  const rows = await supabaseJson(
    env,
    `/rest/v1/app_generation_sessions?select=id,trace_id,status&trace_id=eq.${encodeURIComponent(traceId)}&limit=1`
  );
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function createAppLogEvent(env, user, rawBody) {
  if (isAppwriteFeedbackConfigured(env)) {
    return createAppwriteAppLogEvent(env, user, rawBody);
  }

  if (!isSupabaseConfigured(env)) {
    return { success: false, skipped: true, reason: 'Supabase logging is not configured.' };
  }

  const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {};
  const traceId = sanitizeLogTraceId(body.traceId || body.trace_id) || crypto.randomUUID();
  const eventType = sanitizeLogText(body.eventType || body.event_type, 120) || 'client_event';
  const prompt = extractPromptFromLogPayload(body);
  const promptHash = prompt ? await sha256Hex(prompt) : null;
  const shouldUpsertSession =
    eventType.startsWith('generation_') ||
    body.session === true ||
    body.sessionEvent === true;

  let session = null;
  if (shouldUpsertSession) {
    session = await upsertAppGenerationSession(env, user, traceId, body, prompt, promptHash);
  } else if (traceId) {
    session = await getAppGenerationSessionByTrace(env, traceId);
  }

  const logPayload = {
    trace_id: traceId,
    generation_id: session?.id || null,
    user_email: sanitizeLogText(user?.email, 320),
    user_name: sanitizeLogText(user?.name, 200),
    event_type: eventType,
    provider: sanitizeLogText(body.provider, 120),
    model: sanitizeLogText(body.model, 160),
    action: sanitizeLogText(body.action, 160),
    method: sanitizeLogText(body.method, 16),
    path: sanitizeLogText(body.path, 600),
    status_code: normalizeLogInteger(body.statusCode ?? body.status_code, 100, 599),
    duration_ms: normalizeLogInteger(body.durationMs ?? body.duration_ms, 0, 24 * 60 * 60 * 1000),
    prompt,
    prompt_hash: promptHash,
    request_summary: sanitizeLogJson(body.requestSummary ?? body.request_summary ?? {}),
    response_summary: sanitizeLogJson(body.responseSummary ?? body.response_summary ?? {}),
    error_message: sanitizeLogText(body.errorMessage ?? body.error_message, 20000),
    metadata: sanitizeLogJson(body.metadata ?? {}),
  };

  const rows = await supabaseJson(env, '/rest/v1/app_request_logs?select=id,created_at', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(logPayload),
  });

  return {
    success: true,
    traceId,
    generationId: session?.id || null,
    event: Array.isArray(rows) && rows.length > 0 ? rows[0] : null,
  };
}

function getRequestTraceId(request) {
  return sanitizeLogTraceId(request.headers.get('X-Archviz-Trace-Id'));
}

function logEventInBackground(ctx, env, user, event) {
  const promise = createAppLogEvent(env, user, event).catch((error) => {
    console.warn('[logs] background log failed', error?.message || error);
  });
  if (ctx?.waitUntil) ctx.waitUntil(promise);
}

async function withLoggedGatewayRequest(request, env, ctx, user, details, handler) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const traceId = getRequestTraceId(request) || crypto.randomUUID();
  const provider = details.provider || getLogProviderForPath(url.pathname);
  const method = request.method;
  const path = url.pathname + url.search;
  const requestSummary = {
    source: 'worker',
    contentType: request.headers.get('Content-Type'),
    contentLength: request.headers.get('Content-Length'),
  };

  try {
    const response = await handler();
    logEventInBackground(ctx, env, user, {
      traceId,
      eventType: 'worker_request',
      provider,
      model: details.model,
      action: details.action,
      method,
      path,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
      requestSummary,
      responseSummary: summarizeResponseHeaders(response),
      metadata: {
        route: details.route || url.pathname,
      },
    });
    return response;
  } catch (error) {
    logEventInBackground(ctx, env, user, {
      traceId,
      eventType: 'worker_request_failed',
      provider,
      model: details.model,
      action: details.action,
      method,
      path,
      durationMs: Date.now() - startedAt,
      requestSummary,
      errorMessage: error?.message || String(error),
      metadata: {
        route: details.route || url.pathname,
      },
    });
    throw error;
  }
}

async function isFeedbackAdmin(env, email) {
  return String(email || '').trim().toLowerCase() === FEEDBACK_ADMIN_EMAIL;
}

function appwriteLogJsonText(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
}

function appwriteLogSessionToRow(doc) {
  if (!doc) return null;
  return {
    id: doc.$id || doc.id,
    trace_id: doc.trace_id,
    created_at: doc.created_at || doc.$createdAt,
    started_at: doc.started_at || doc.created_at || doc.$createdAt,
    updated_at: doc.updated_at || doc.$updatedAt || doc.created_at || doc.$createdAt,
    completed_at: doc.completed_at || null,
    user_email: doc.user_email || null,
    user_name: doc.user_name || null,
    status: normalizeLogStatus(doc.status, 'running'),
    mode: doc.mode || null,
    provider: doc.provider || null,
    model: doc.model || null,
    prompt: doc.prompt || null,
    prompt_hash: doc.prompt_hash || null,
    duration_ms: Number.isFinite(Number(doc.duration_ms)) ? Number(doc.duration_ms) : null,
    input_summary: parseJsonValue(doc.input_summary_json, {}),
    output_summary: parseJsonValue(doc.output_summary_json, {}),
    error_message: doc.error_message || null,
    metadata: parseJsonValue(doc.metadata_json, {}),
  };
}

function appwriteLogEventToRow(doc) {
  if (!doc) return null;
  return {
    id: Number.isFinite(Number(doc.event_id)) ? Number(doc.event_id) : Date.parse(doc.created_at || doc.$createdAt || '') || 0,
    created_at: doc.created_at || doc.$createdAt,
    trace_id: doc.trace_id,
    generation_id: doc.generation_id || null,
    user_email: doc.user_email || null,
    user_name: doc.user_name || null,
    event_type: doc.event_type || 'client_event',
    provider: doc.provider || null,
    model: doc.model || null,
    action: doc.action || null,
    method: doc.method || null,
    path: doc.path || null,
    status_code: Number.isFinite(Number(doc.status_code)) ? Number(doc.status_code) : null,
    duration_ms: Number.isFinite(Number(doc.duration_ms)) ? Number(doc.duration_ms) : null,
    prompt: doc.prompt || null,
    prompt_hash: doc.prompt_hash || null,
    request_summary: parseJsonValue(doc.request_summary_json, {}),
    response_summary: parseJsonValue(doc.response_summary_json, {}),
    error_message: doc.error_message || null,
    metadata: parseJsonValue(doc.metadata_json, {}),
  };
}

async function appwriteLogSessionDocumentId(traceId) {
  const hash = await sha256Hex(traceId);
  return `log_${hash.slice(0, 32)}`;
}

async function findAppwriteLogSessionDocumentByTrace(env, traceId) {
  const config = resolveAppwriteConfig(env);
  const query = buildAppwriteQueryString([
    appwriteQuery('equal', 'trace_id', [traceId]),
    appwriteQuery('limit', null, [1]),
  ]);
  const result = await appwriteJson(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.logSessionsCollectionId)}/documents?${query}`
  );
  return Array.isArray(result?.documents) && result.documents.length > 0 ? result.documents[0] : null;
}

async function getAppwriteLogSessionDocument(env, identifier) {
  const config = resolveAppwriteConfig(env);
  const byTrace = await findAppwriteLogSessionDocumentByTrace(env, identifier);
  if (byTrace) return byTrace;

  const resp = await appwriteFetch(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.logSessionsCollectionId)}/documents/${encodeURIComponent(identifier)}`
  );
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Appwrite request failed (${resp.status}): ${errText.slice(0, 600)}`);
  }
  return resp.json();
}

function appwriteLogSessionDocumentData(user, traceId, body, prompt, promptHash, existingDoc = null) {
  const now = new Date().toISOString();
  const eventType = sanitizeLogText(body?.eventType || body?.event_type, 120) || 'client_event';
  const isCompletion = eventType === 'generation_completed' || eventType === 'generation_failed' || eventType === 'generation_cancelled';
  const statusFromEvent =
    eventType === 'generation_completed' ? 'completed' :
    eventType === 'generation_failed' ? 'failed' :
    eventType === 'generation_cancelled' ? 'cancelled' :
    eventType === 'generation_started' ? 'started' :
    normalizeLogStatus(body?.status, null);
  const hasInputSummary = 'inputSummary' in body || 'input_summary' in body;
  const hasOutputSummary = 'outputSummary' in body || 'output_summary' in body;
  const hasMetadata = 'metadata' in body;

  return compactObject({
    trace_id: traceId,
    created_at: existingDoc?.created_at || now,
    started_at: eventType === 'generation_started' ? now : existingDoc?.started_at || now,
    updated_at: now,
    completed_at: isCompletion ? now : existingDoc?.completed_at,
    user_email: sanitizeLogText(user?.email, 320) || existingDoc?.user_email,
    user_name: sanitizeLogText(user?.name, 200) || existingDoc?.user_name,
    status: statusFromEvent || normalizeLogStatus(existingDoc?.status, null) || 'running',
    mode: sanitizeLogText(body?.mode, 80) || existingDoc?.mode,
    provider: sanitizeLogText(body?.provider, 120) || existingDoc?.provider,
    model: sanitizeLogText(body?.model, 160) || existingDoc?.model,
    prompt: prompt || existingDoc?.prompt,
    prompt_hash: promptHash || existingDoc?.prompt_hash,
    duration_ms: normalizeLogInteger(body?.durationMs ?? body?.duration_ms, 0, 24 * 60 * 60 * 1000) ?? existingDoc?.duration_ms,
    input_summary_json: hasInputSummary
      ? appwriteLogJsonText(sanitizeLogJson(body?.inputSummary ?? body?.input_summary ?? {}))
      : existingDoc?.input_summary_json,
    output_summary_json: hasOutputSummary
      ? appwriteLogJsonText(sanitizeLogJson(body?.outputSummary ?? body?.output_summary ?? {}))
      : existingDoc?.output_summary_json,
    error_message: sanitizeLogText(body?.errorMessage ?? body?.error_message, 20000) || existingDoc?.error_message,
    metadata_json: hasMetadata ? appwriteLogJsonText(sanitizeLogJson(body?.metadata ?? {})) : existingDoc?.metadata_json,
  });
}

async function upsertAppwriteGenerationSession(env, user, traceId, body, prompt, promptHash) {
  const config = resolveAppwriteConfig(env);
  const existingDoc = await findAppwriteLogSessionDocumentByTrace(env, traceId);
  const data = appwriteLogSessionDocumentData(user, traceId, body, prompt, promptHash, existingDoc);

  if (existingDoc) {
    const doc = await appwriteJson(
      env,
      `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.logSessionsCollectionId)}/documents/${encodeURIComponent(existingDoc.$id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ data }),
      }
    );
    return appwriteLogSessionToRow(doc);
  }

  const documentId = await appwriteLogSessionDocumentId(traceId);
  const resp = await appwriteFetch(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.logSessionsCollectionId)}/documents`,
    {
      method: 'POST',
      body: JSON.stringify({ documentId, data }),
    }
  );
  if (resp.status === 409) {
    const retryDoc = await findAppwriteLogSessionDocumentByTrace(env, traceId);
    if (retryDoc) return appwriteLogSessionToRow(retryDoc);
  }
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Appwrite request failed (${resp.status}): ${errText.slice(0, 600)}`);
  }
  return appwriteLogSessionToRow(await resp.json());
}

async function createAppwriteLogEventDocument(env, user, body, traceId, eventType, session, prompt, promptHash) {
  const config = resolveAppwriteConfig(env);
  const now = new Date().toISOString();
  const eventId = Date.now() + Math.floor(Math.random() * 1000);
  const data = compactObject({
    event_id: eventId,
    created_at: now,
    trace_id: traceId,
    generation_id: session?.id,
    user_email: sanitizeLogText(user?.email, 320),
    user_name: sanitizeLogText(user?.name, 200),
    event_type: eventType,
    provider: sanitizeLogText(body.provider, 120),
    model: sanitizeLogText(body.model, 160),
    action: sanitizeLogText(body.action, 160),
    method: sanitizeLogText(body.method, 16),
    path: sanitizeLogText(body.path, 600),
    status_code: normalizeLogInteger(body.statusCode ?? body.status_code, 100, 599),
    duration_ms: normalizeLogInteger(body.durationMs ?? body.duration_ms, 0, 24 * 60 * 60 * 1000),
    prompt,
    prompt_hash: promptHash,
    request_summary_json: appwriteLogJsonText(sanitizeLogJson(body.requestSummary ?? body.request_summary ?? {})),
    response_summary_json: appwriteLogJsonText(sanitizeLogJson(body.responseSummary ?? body.response_summary ?? {})),
    error_message: sanitizeLogText(body.errorMessage ?? body.error_message, 20000),
    metadata_json: appwriteLogJsonText(sanitizeLogJson(body.metadata ?? {})),
  });

  const doc = await appwriteJson(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.logEventsCollectionId)}/documents`,
    {
      method: 'POST',
      body: JSON.stringify({
        documentId: crypto.randomUUID(),
        data,
      }),
    }
  );
  return appwriteLogEventToRow(doc);
}

async function createAppwriteAppLogEvent(env, user, rawBody) {
  const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {};
  const traceId = sanitizeLogTraceId(body.traceId || body.trace_id) || crypto.randomUUID();
  const eventType = sanitizeLogText(body.eventType || body.event_type, 120) || 'client_event';
  const prompt = extractPromptFromLogPayload(body);
  const promptHash = prompt ? await sha256Hex(prompt) : null;
  const shouldUpsertSession =
    eventType.startsWith('generation_') ||
    body.session === true ||
    body.sessionEvent === true;

  let session = null;
  if (shouldUpsertSession) {
    session = await upsertAppwriteGenerationSession(env, user, traceId, body, prompt, promptHash);
  } else {
    session = appwriteLogSessionToRow(await findAppwriteLogSessionDocumentByTrace(env, traceId));
  }

  const event = await createAppwriteLogEventDocument(env, user, body, traceId, eventType, session, prompt, promptHash);
  return {
    success: true,
    traceId,
    generationId: session?.id || null,
    event: event ? { id: event.id, created_at: event.created_at } : null,
  };
}

async function listAppwriteGenerationLogs(env, filters) {
  const config = resolveAppwriteConfig(env);
  const queries = [
    appwriteQuery('orderDesc', 'created_at'),
    appwriteQuery('limit', null, [Math.max(1, Math.min(filters.limit || 80, 200))]),
    appwriteQuery('offset', null, [Math.max(0, filters.offset || 0)]),
  ];
  if (filters.status) queries.push(appwriteQuery('equal', 'status', [filters.status]));
  if (filters.mode) queries.push(appwriteQuery('equal', 'mode', [filters.mode]));
  if (filters.provider) queries.push(appwriteQuery('equal', 'provider', [filters.provider]));
  if (filters.userEmail) queries.push(appwriteQuery('equal', 'user_email', [filters.userEmail]));

  const query = buildAppwriteQueryString(queries);
  const result = await appwriteJson(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.logSessionsCollectionId)}/documents?${query}`
  );

  let sessions = Array.isArray(result?.documents)
    ? result.documents.map(appwriteLogSessionToRow).filter(Boolean)
    : [];
  if (filters.search) {
    const needle = String(filters.search).toLowerCase();
    sessions = sessions.filter((session) =>
      [
        session.trace_id,
        session.user_email,
        session.user_name,
        session.mode,
        session.provider,
        session.model,
        session.prompt,
        session.error_message,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }
  return sessions;
}

async function getAppwriteGenerationLogDetail(env, identifier) {
  const config = resolveAppwriteConfig(env);
  const sessionDoc = await getAppwriteLogSessionDocument(env, identifier);
  const session = appwriteLogSessionToRow(sessionDoc);
  if (!session) return null;

  const query = buildAppwriteQueryString([
    appwriteQuery('equal', 'trace_id', [session.trace_id]),
    appwriteQuery('orderAsc', 'created_at'),
    appwriteQuery('limit', null, [500]),
  ]);
  const result = await appwriteJson(
    env,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.logEventsCollectionId)}/documents?${query}`
  );
  const events = Array.isArray(result?.documents)
    ? result.documents.map(appwriteLogEventToRow).filter(Boolean)
    : [];
  return { session, events };
}

async function uploadFeedbackSnapshotToStorage(env, reportId, snapshotText) {
  if (isAppwriteFeedbackConfigured(env)) {
    return uploadFeedbackSnapshotToAppwrite(env, reportId, snapshotText);
  }

  const bucket = (env.SUPABASE_FEEDBACK_BUCKET || 'feedback-snapshots').trim();
  const path = `${reportId}/snapshot.json`;
  const encodedPath = path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  const storagePath = `/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`;

  const resp = await supabaseFetch(env, storagePath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    },
    body: snapshotText,
    timeoutMs: SUPABASE_STORAGE_TIMEOUT_MS,
  });
  if (!resp.ok) {
    const errText = await resp.text();
    const error = new Error(`Snapshot storage upload failed (${resp.status}): ${errText.slice(0, 600)}`);
    error.statusCode = resp.status;
    error.responseText = errText;
    throw error;
  }

  return `${bucket}/${path}`;
}

async function deleteFeedbackSnapshotFromStorage(env, snapshotStoragePath) {
  if (!snapshotStoragePath) return;
  if (String(snapshotStoragePath).startsWith('appwrite://')) {
    await deleteFeedbackSnapshotFromAppwrite(env, snapshotStoragePath);
    return;
  }

  const [bucket, ...rest] = String(snapshotStoragePath).split('/');
  const objectPath = rest.join('/');
  if (!bucket || !objectPath) return;

  const encodedPath = objectPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  const resp = await supabaseFetch(env, `/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: 'DELETE',
    timeoutMs: SUPABASE_STORAGE_TIMEOUT_MS,
  });

  if (!resp.ok && resp.status !== 404) {
    const errText = await resp.text();
    throw new Error(`Snapshot storage delete failed (${resp.status}): ${errText.slice(0, 500)}`);
  }
}

async function downloadFeedbackSnapshotFromStorage(env, snapshotStoragePath) {
  if (String(snapshotStoragePath).startsWith('appwrite://')) {
    return downloadFeedbackSnapshotFromAppwrite(env, snapshotStoragePath);
  }

  const [bucket, ...rest] = String(snapshotStoragePath).split('/');
  const objectPath = rest.join('/');
  const encodedPath = objectPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  const storageResp = await supabaseFetch(env, `/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    timeoutMs: SUPABASE_STORAGE_TIMEOUT_MS,
  });

  if (!storageResp.ok) {
    const errText = await storageResp.text();
    throw new Error(`Snapshot download failed (${storageResp.status}): ${errText.slice(0, 500)}`);
  }

  return storageResp.json();
}

// ─── Route: POST /auth/verify ────────────────────────────────────────────────

async function handleAuthVerify(request, env) {
  const origin = request.headers.get('Origin') || '';
  try {
    const { idToken } = await request.json();
    if (!idToken) return corsResponse(origin, { error: 'Missing idToken' }, { status: 400 });

    const googlePayload = await verifyGoogleIdToken(idToken, env.GOOGLE_CLIENT_ID, env.ALLOWED_DOMAIN);

    const now = Math.floor(Date.now() / 1000);
    const jwt = await signJwt({
      sub: googlePayload.sub,
      email: googlePayload.email,
      name: googlePayload.name,
      picture: googlePayload.picture,
      hd: googlePayload.hd,
      iat: now,
      exp: now + JWT_EXPIRY_SECONDS,
    }, env.JWT_SECRET);

    return corsResponse(origin, {
      token: jwt,
      expiresIn: JWT_EXPIRY_SECONDS,
      user: {
        email: googlePayload.email,
        name: googlePayload.name,
        picture: googlePayload.picture,
        domain: googlePayload.hd,
      },
    });
  } catch (err) {
return corsResponse(origin, { error: 'Authentication failed: ' + err.message }, { status: 401 });
  }
}

// ─── Route: /api/gemini/* (passthrough proxy) ────────────────────────────────

const GEMINI_IMAGE_RESPONSE_ASPECT_RATIO_MAP = {
  '1:1': 'ASPECT_RATIO_ONE_BY_ONE',
  '2:3': 'ASPECT_RATIO_TWO_BY_THREE',
  '3:2': 'ASPECT_RATIO_THREE_BY_TWO',
  '3:4': 'ASPECT_RATIO_THREE_BY_FOUR',
  '4:3': 'ASPECT_RATIO_FOUR_BY_THREE',
  '4:5': 'ASPECT_RATIO_FOUR_BY_FIVE',
  '5:4': 'ASPECT_RATIO_FIVE_BY_FOUR',
  '9:16': 'ASPECT_RATIO_NINE_BY_SIXTEEN',
  '16:9': 'ASPECT_RATIO_SIXTEEN_BY_NINE',
  '21:9': 'ASPECT_RATIO_TWENTY_ONE_BY_NINE',
  '1:8': 'ASPECT_RATIO_ONE_BY_EIGHT',
  '8:1': 'ASPECT_RATIO_EIGHT_BY_ONE',
  '1:4': 'ASPECT_RATIO_ONE_BY_FOUR',
  '4:1': 'ASPECT_RATIO_FOUR_BY_ONE',
};

const GEMINI_IMAGE_RESPONSE_SIZE_MAP = {
  '512': 'IMAGE_SIZE_FIVE_TWELVE',
  '1K': 'IMAGE_SIZE_ONE_K',
  '2K': 'IMAGE_SIZE_TWO_K',
  '4K': 'IMAGE_SIZE_FOUR_K',
};

const GEMINI_IMAGE_CONFIG_ASPECT_RATIO_MAP = {
  ASPECT_RATIO_ONE_BY_ONE: '1:1',
  ASPECT_RATIO_TWO_BY_THREE: '2:3',
  ASPECT_RATIO_THREE_BY_TWO: '3:2',
  ASPECT_RATIO_THREE_BY_FOUR: '3:4',
  ASPECT_RATIO_FOUR_BY_THREE: '4:3',
  ASPECT_RATIO_FOUR_BY_FIVE: '4:5',
  ASPECT_RATIO_FIVE_BY_FOUR: '5:4',
  ASPECT_RATIO_NINE_BY_SIXTEEN: '9:16',
  ASPECT_RATIO_SIXTEEN_BY_NINE: '16:9',
  ASPECT_RATIO_TWENTY_ONE_BY_NINE: '21:9',
  ASPECT_RATIO_ONE_BY_EIGHT: '1:8',
  ASPECT_RATIO_EIGHT_BY_ONE: '8:1',
  ASPECT_RATIO_ONE_BY_FOUR: '1:4',
  ASPECT_RATIO_FOUR_BY_ONE: '4:1',
};

const GEMINI_IMAGE_CONFIG_SIZE_MAP = {
  IMAGE_SIZE_FIVE_TWELVE: '512',
  IMAGE_SIZE_ONE_K: '1K',
  IMAGE_SIZE_TWO_K: '2K',
  IMAGE_SIZE_FOUR_K: '4K',
};

const GEMINI_THINKING_LEVEL_MAP = {
  minimal: 'MINIMAL',
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  MINIMAL: 'MINIMAL',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
};

function toGeminiImageResponseFormat(imageConfig) {
  if (!imageConfig || typeof imageConfig !== 'object' || Array.isArray(imageConfig)) {
    return imageConfig;
  }

  const responseImageConfig = { ...imageConfig };
  if (typeof imageConfig.aspectRatio === 'string') {
    responseImageConfig.aspectRatio =
      GEMINI_IMAGE_RESPONSE_ASPECT_RATIO_MAP[imageConfig.aspectRatio] || imageConfig.aspectRatio;
  }
  if (typeof imageConfig.imageSize === 'string') {
    responseImageConfig.imageSize =
      GEMINI_IMAGE_RESPONSE_SIZE_MAP[imageConfig.imageSize] || imageConfig.imageSize;
  }

  return responseImageConfig;
}

function toGeminiImageConfig(imageConfig) {
  if (!imageConfig || typeof imageConfig !== 'object' || Array.isArray(imageConfig)) {
    return imageConfig;
  }

  const legacyImageConfig = { ...imageConfig };
  if (typeof imageConfig.aspectRatio === 'string') {
    legacyImageConfig.aspectRatio =
      GEMINI_IMAGE_CONFIG_ASPECT_RATIO_MAP[imageConfig.aspectRatio] || imageConfig.aspectRatio;
  }
  if (typeof imageConfig.imageSize === 'string') {
    legacyImageConfig.imageSize =
      GEMINI_IMAGE_CONFIG_SIZE_MAP[imageConfig.imageSize] || imageConfig.imageSize;
  }

  return legacyImageConfig;
}

function toGeminiThinkingConfig(thinkingConfig) {
  if (!thinkingConfig || typeof thinkingConfig !== 'object' || Array.isArray(thinkingConfig)) {
    return thinkingConfig;
  }

  const next = { ...thinkingConfig };
  if (typeof thinkingConfig.thinkingLevel === 'string') {
    next.thinkingLevel = GEMINI_THINKING_LEVEL_MAP[thinkingConfig.thinkingLevel] || thinkingConfig.thinkingLevel;
  }

  return next;
}

function geminiProxyModelFromSubpath(subpath) {
  return subpath.match(/^models\/([^:/?]+)/)?.[1] || '';
}

function usesGeminiResponseFormatImageConfig(subpath) {
  const modelId = geminiProxyModelFromSubpath(subpath).toLowerCase();
  return modelId.startsWith('gemini-3') && modelId.includes('image');
}

function sanitizeGeminiGenerationConfig(config, subpath = '') {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return config;
  }

  const next = { ...config };
  const usesResponseFormatImage = usesGeminiResponseFormatImageConfig(subpath);
  const responseImageConfig = next.responseFormat?.image || next.imageConfig;
  const wantsImage = Array.isArray(next.responseModalities)
    ? next.responseModalities.includes('IMAGE')
    : Boolean(responseImageConfig);
  const thinkingConfig = next.thinkingConfig &&
    typeof next.thinkingConfig === 'object' &&
    !Array.isArray(next.thinkingConfig)
      ? next.thinkingConfig
      : undefined;

  delete next.thinkingConfig;
  delete next.responseModalities;
  delete next.responseFormat;

  if (!wantsImage && thinkingConfig) {
    next.thinkingConfig = toGeminiThinkingConfig(thinkingConfig);
  }

  if (wantsImage && responseImageConfig) {
    if (usesResponseFormatImage) {
      delete next.imageConfig;
      next.responseFormat = { image: toGeminiImageResponseFormat(responseImageConfig) };
    } else {
      next.imageConfig = toGeminiImageConfig(responseImageConfig);
    }
  }

  return next;
}

async function getGeminiProxyBody(request, subpath = '') {
  if (request.method === 'GET') return undefined;

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return request.body;
  }

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(contentLength) && contentLength > GEMINI_JSON_REWRITE_MAX_BYTES) {
    return request.body;
  }

  const rawBody = await request.text();
  if (!rawBody) return rawBody;

  try {
    const body = JSON.parse(rawBody);
    if (body && typeof body === 'object' && !Array.isArray(body) && 'generationConfig' in body) {
      body.generationConfig = sanitizeGeminiGenerationConfig(body.generationConfig, subpath);
    }
    return JSON.stringify(body);
  } catch {
    return rawBody;
  }
}

async function handleGeminiProxy(request, env, subpath) {
  const origin = request.headers.get('Origin') || '';
  const apiBase = /^models\/(?:gemini-3\.1-[^/:?]*image[^/:?]*):/.test(subpath)
    ? GEMINI_API_BASE_V1
    : GEMINI_API_BASE;
  const url = `${apiBase}/${subpath}`;

  const headers = new Headers();
  headers.set('x-goog-api-key', env.GEMINI_API_KEY);

  // Forward content-type
  const ct = request.headers.get('Content-Type');
  if (ct) headers.set('Content-Type', ct);

  const upstreamResp = await fetch(url, {
    method: request.method,
    headers,
    body: await getGeminiProxyBody(request, subpath),
  });

  // Stream the response back with CORS headers
  const respHeaders = { ...getCorsHeaders(origin) };
  const upstreamCt = upstreamResp.headers.get('Content-Type');
  if (upstreamCt) respHeaders['Content-Type'] = upstreamCt;

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: respHeaders,
  });
}

// ─── Route: POST /api/openai/images ─────────────────────────────────────────

const OPENAI_IMAGE_MAX_PROMPT_CHARS = 32_000;
const OPENAI_IMAGE_MAX_INPUT_IMAGES = 16;
const OPENAI_IMAGE_MAX_OUTPUTS = 10;
const OPENAI_IMAGE_ALLOWED_SIZES = new Set(['1024x1024', '1024x1536', '1536x1024', 'auto']);

function parseAspectRatio(aspectRatio) {
  if (typeof aspectRatio !== 'string') return 16 / 9;
  const [widthRaw, heightRaw] = aspectRatio.split(':').map(Number);
  if (!Number.isFinite(widthRaw) || !Number.isFinite(heightRaw) || widthRaw <= 0 || heightRaw <= 0) {
    return 16 / 9;
  }

  const ratio = widthRaw / heightRaw;
  return Math.min(3, Math.max(1 / 3, ratio));
}

function normalizeOpenAISize(aspectRatio, imageSize) {
  if (OPENAI_IMAGE_ALLOWED_SIZES.has(imageSize)) return imageSize;

  const ratio = parseAspectRatio(aspectRatio);
  if (ratio > 1.05) return '1536x1024';
  if (ratio < 0.95) return '1024x1536';
  return '1024x1024';
}

function normalizeOpenAISizeValue(size) {
  if (OPENAI_IMAGE_ALLOWED_SIZES.has(size)) return size;
  if (typeof size !== 'string') return 'auto';

  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return 'auto';

  return normalizeOpenAISize(`${match[1]}:${match[2]}`, undefined);
}

function normalizeOpenAIQuality(imageSize) {
  if (imageSize === '4K') return 'high';
  if (imageSize === '1K') return 'low';
  return 'medium';
}

function normalizeOpenAIQualityValue(value) {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'auto'
    ? value
    : 'medium';
}

function normalizeOpenAIOutputFormat(value) {
  return value === 'png' || value === 'webp' || value === 'jpeg'
    ? value
    : 'png';
}

function normalizeOpenAIBackground(value) {
  return value === 'transparent' || value === 'opaque' || value === 'auto'
    ? value
    : 'auto';
}

function getOpenAIImageOptions(generationConfig = {}) {
  const imageConfig = generationConfig.imageConfig || generationConfig.responseFormat?.image || {};
  const background = generationConfig.openAI?.background || imageConfig.background;
  return {
    size: normalizeOpenAISize(imageConfig.aspectRatio || '16:9', imageConfig.imageSize || '2K'),
    quality: normalizeOpenAIQuality(imageConfig.imageSize || '2K'),
    outputFormat: 'png',
    background: normalizeOpenAIBackground(background),
  };
}

function decodeBase64Image(image, index) {
  if (!image || typeof image.base64 !== 'string') return null;
  const mimeType = typeof image.mimeType === 'string' && /^image\/(png|jpe?g|webp)$/i.test(image.mimeType)
    ? image.mimeType.toLowerCase().replace('image/jpg', 'image/jpeg')
    : 'image/png';

  const binary = atob(image.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] || 'png';
  return {
    blob: new Blob([bytes], { type: mimeType }),
    filename: `input-${index + 1}.${ext}`,
  };
}

function normalizeOpenAIImages(input) {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, OPENAI_IMAGE_MAX_INPUT_IMAGES)
    .map((image, index) => decodeBase64Image(image, index))
    .filter(Boolean);
}

function extractOpenAIError(data, fallback) {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

function normalizeOpenAIImageResponse(data) {
  const outputFormat = data?.output_format || 'png';
  const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : `image/${outputFormat}`;
  const images = Array.isArray(data?.data)
    ? data.data
        .map((entry) => {
          const base64 = entry?.b64_json;
          if (!base64 || typeof base64 !== 'string') return null;
          return {
            base64,
            mimeType,
            dataUrl: `data:${mimeType};base64,${base64}`,
          };
        })
        .filter(Boolean)
    : [];

  return {
    text: null,
    images,
    usage: data?.usage || null,
    model: OPENAI_IMAGE_MODEL,
  };
}

function base64Encode(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
let _pngCrcTable = null;

function readUint32(bytes, offset) {
  return (
    ((bytes[offset] << 24) >>> 0) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 255;
  bytes[offset + 1] = (value >>> 16) & 255;
  bytes[offset + 2] = (value >>> 8) & 255;
  bytes[offset + 3] = value & 255;
}

function getPngCrcTable() {
  if (_pngCrcTable) return _pngCrcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  _pngCrcTable = table;
  return table;
}

function crc32(bytes) {
  const table = getPngCrcTable();
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = table[(crc ^ bytes[index]) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function pngChunk(type, data = new Uint8Array()) {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  writeUint32(out, 0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  writeUint32(out, 8 + data.length, crc32(concatBytes([typeBytes, data])));
  return out;
}

async function inflatePngData(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflatePngData(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

async function decodePngRgba(bytes) {
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      throw new Error('Only PNG images are supported for precise compositing.');
    }
  }

  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatParts = [];

  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) throw new Error('Invalid PNG data.');
    const data = bytes.subarray(dataStart, dataEnd);

    if (type === 'IHDR') {
      width = readUint32(data, 0);
      height = readUint32(data, 4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  if (!width || !height) throw new Error('Invalid PNG dimensions.');
  if (bitDepth !== 8) throw new Error('Only 8-bit PNG images are supported for precise compositing.');
  if (interlace !== 0) throw new Error('Interlaced PNG images are not supported for precise compositing.');

  const channelsByColorType = { 0: 1, 2: 3, 4: 2, 6: 4 };
  const channels = channelsByColorType[colorType];
  if (!channels) throw new Error('Unsupported PNG color type for precise compositing.');

  const inflated = await inflatePngData(concatBytes(idatParts));
  const rowBytes = width * channels;
  const expected = (rowBytes + 1) * height;
  if (inflated.length < expected) throw new Error('PNG pixel data is incomplete.');

  const rgba = new Uint8Array(width * height * 4);
  let inputOffset = 0;
  let previous = new Uint8Array(rowBytes);
  let pixelOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset++];
    const row = new Uint8Array(rowBytes);
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[inputOffset++];
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x] || 0;
      const upLeft = x >= channels ? previous[x - channels] || 0 : 0;
      let value = raw;
      if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paethPredictor(left, up, upLeft);
      else if (filter !== 0) throw new Error('Unsupported PNG filter.');
      row[x] = value & 255;
    }

    for (let x = 0; x < width; x += 1) {
      const sourceOffset = x * channels;
      if (colorType === 6) {
        rgba[pixelOffset++] = row[sourceOffset];
        rgba[pixelOffset++] = row[sourceOffset + 1];
        rgba[pixelOffset++] = row[sourceOffset + 2];
        rgba[pixelOffset++] = row[sourceOffset + 3];
      } else if (colorType === 2) {
        rgba[pixelOffset++] = row[sourceOffset];
        rgba[pixelOffset++] = row[sourceOffset + 1];
        rgba[pixelOffset++] = row[sourceOffset + 2];
        rgba[pixelOffset++] = 255;
      } else if (colorType === 0) {
        const value = row[sourceOffset];
        rgba[pixelOffset++] = value;
        rgba[pixelOffset++] = value;
        rgba[pixelOffset++] = value;
        rgba[pixelOffset++] = 255;
      } else {
        const value = row[sourceOffset];
        rgba[pixelOffset++] = value;
        rgba[pixelOffset++] = value;
        rgba[pixelOffset++] = value;
        rgba[pixelOffset++] = row[sourceOffset + 1];
      }
    }

    previous = row;
  }

  return { width, height, data: rgba };
}

async function encodePngRgba(width, height, rgba) {
  const rowBytes = width * 4;
  const raw = new Uint8Array((rowBytes + 1) * height);
  let inputOffset = 0;
  let outputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[outputOffset++] = 0;
    raw.set(rgba.subarray(inputOffset, inputOffset + rowBytes), outputOffset);
    inputOffset += rowBytes;
    outputOffset += rowBytes;
  }

  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, width);
  writeUint32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return concatBytes([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', await deflatePngData(raw)),
    pngChunk('IEND'),
  ]);
}

function rgbaToSelectionAlpha(maskPng) {
  const pixels = maskPng.data;
  const alpha = new Uint8Array(maskPng.width * maskPng.height);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
    const luminance = Math.round((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);
    alpha[p] = Math.round((luminance * pixels[i + 3]) / 255);
  }
  return alpha;
}

function alphaStats(alpha) {
  let selected = 0;
  for (let index = 0; index < alpha.length; index += 1) {
    if (alpha[index] >= 16) selected += 1;
  }
  return { selected, ratio: selected / Math.max(alpha.length, 1) };
}

function dilateAlpha(alpha, width, height, radius) {
  if (radius <= 0) return alpha;
  const binary = new Uint8Array(alpha.length);
  for (let index = 0; index < alpha.length; index += 1) {
    binary[index] = alpha[index] >= 16 ? 1 : 0;
  }
  const stride = width + 1;
  const integral = new Uint32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += binary[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + rowSum;
    }
  }

  const out = new Uint8Array(alpha.length);
  for (let y = 0; y < height; y += 1) {
    const y1 = Math.max(0, y - radius);
    const y2 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x1 = Math.max(0, x - radius);
      const x2 = Math.min(width - 1, x + radius);
      const sum =
        integral[(y2 + 1) * stride + x2 + 1] -
        integral[y1 * stride + x2 + 1] -
        integral[(y2 + 1) * stride + x1] +
        integral[y1 * stride + x1];
      out[y * width + x] = sum > 0 ? 255 : 0;
    }
  }
  return out;
}

function boxBlurAlpha(alpha, width, height, radius) {
  if (radius <= 0) return alpha;
  const stride = width + 1;
  const integral = new Uint32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += alpha[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + rowSum;
    }
  }

  const out = new Uint8Array(alpha.length);
  for (let y = 0; y < height; y += 1) {
    const y1 = Math.max(0, y - radius);
    const y2 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x1 = Math.max(0, x - radius);
      const x2 = Math.min(width - 1, x + radius);
      const sum =
        integral[(y2 + 1) * stride + x2 + 1] -
        integral[y1 * stride + x2 + 1] -
        integral[(y2 + 1) * stride + x1] +
        integral[y1 * stride + x1];
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      out[y * width + x] = Math.round(sum / count);
    }
  }
  return out;
}

function buildOpenAIAlphaMaskPng(width, height, selectedAlpha) {
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0, pixel = 0; index < selectedAlpha.length; index += 1, pixel += 4) {
    rgba[pixel] = 255;
    rgba[pixel + 1] = 255;
    rgba[pixel + 2] = 255;
    // OpenAI image edit masks use transparent pixels as the editable area.
    rgba[pixel + 3] = 255 - selectedAlpha[index];
  }
  return encodePngRgba(width, height, rgba);
}

function compositeRgba(source, edited, matte) {
  const out = new Uint8Array(source.data.length);
  for (let i = 0, p = 0; i < source.data.length; i += 4, p += 1) {
    const alpha = matte[p] / 255;
    const inverse = 1 - alpha;
    out[i] = Math.round(source.data[i] * inverse + edited.data[i] * alpha);
    out[i + 1] = Math.round(source.data[i + 1] * inverse + edited.data[i + 1] * alpha);
    out[i + 2] = Math.round(source.data[i + 2] * inverse + edited.data[i + 2] * alpha);
    out[i + 3] = Math.round(source.data[i + 3] * inverse + edited.data[i + 3] * alpha);
  }
  return out;
}

function normalizeImageEditOperation(value) {
  const allowed = new Set(['replace_material', 'recolor', 'add_people', 'remove_people', 'remove_object', 'custom']);
  return allowed.has(value) ? value : 'custom';
}

function normalizeImageEditQuality(value) {
  if (value === 'draft' || value === 'standard' || value === 'final') return value;
  return 'standard';
}

function mapImageEditQualityToOpenAI(value) {
  if (value === 'draft') return 'low';
  if (value === 'final') return 'high';
  return 'medium';
}

function getImageEditRadius(width, height, operation) {
  const longEdge = Math.max(width, height);
  const peopleOrRemoval = operation === 'add_people' || operation === 'remove_people' || operation === 'remove_object';
  const dilation = peopleOrRemoval
    ? Math.round(Math.min(32, Math.max(14, longEdge * 0.009)))
    : Math.round(Math.min(20, Math.max(8, longEdge * 0.0045)));
  const feather = peopleOrRemoval
    ? Math.round(Math.min(14, Math.max(6, longEdge * 0.004)))
    : Math.round(Math.min(10, Math.max(4, longEdge * 0.0025)));
  return { dilation, feather };
}

function buildImageEditPrompt(request) {
  const operation = normalizeImageEditOperation(request.operation);
  const userPrompt = sanitizeText(request.prompt, OPENAI_IMAGE_MAX_PROMPT_CHARS);
  const targetLabel = sanitizeText(request.targetLabel, 160) || 'selected area';
  const materialDescription = sanitizeText(request.materialDescription, 500);
  const colorHex = /^#[0-9a-fA-F]{6}$/.test(String(request.colorHex || '')) ? request.colorHex : '';
  const materialOrColor = materialDescription || colorHex || userPrompt || 'the requested finish';

  const base = 'Edit only the masked/selected area of this architectural visualization. Preserve the original camera angle, perspective, geometry, room layout, furniture positions, lighting direction, shadows, reflections, image style, and all unselected areas. Do not change walls, floors, furniture, people, objects, text, signage, or background outside the selected area unless physically necessary at the mask boundary.';
  let task = '';
  if (operation === 'replace_material' || operation === 'recolor') {
    task = `In the selected area, change the ${targetLabel} to ${materialOrColor}. Preserve the exact shape, seams, folds, perspective, scale, texture direction, highlights, shadows, and contact shadows. The result should look like a realistic architectural visualization, not a painted overlay.`;
  } else if (operation === 'add_people') {
    task = `Add realistic people only inside the selected area according to this request: ${userPrompt || 'Add a small number of naturally integrated people.'} They should have correct architectural scale, believable posture, lighting, shadows, reflections, and perspective. Preserve the rest of the image unchanged.`;
  } else if (operation === 'remove_people' || operation === 'remove_object') {
    task = `Remove the selected ${operation === 'remove_people' ? 'people' : targetLabel || 'object'}. Reconstruct the background, furniture, floor, wall, and lighting behind them naturally as if they were never there. Preserve surrounding architecture, perspective, texture, shadows, and all unselected areas.`;
  } else {
    task = `Apply this edit only to the selected area: ${userPrompt}. Preserve the rest of the image unchanged.`;
  }

  const context = sanitizeText(request.originalGenerationPrompt, 1600);
  return [base, task, context ? `Original render description/context: ${context}` : ''].filter(Boolean).join('\n\n');
}

function decodeImageEditBase64Image(image, label) {
  if (!image || typeof image.base64 !== 'string') {
    throw new Error(`${label} is missing.`);
  }
  const mimeType = typeof image.mimeType === 'string'
    ? image.mimeType.toLowerCase().replace('image/jpg', 'image/jpeg')
    : 'image/png';
  if (mimeType !== 'image/png') {
    throw new Error(`${label} must be a PNG image for precise masked editing.`);
  }
  const bytes = base64Decode(image.base64);
  return { bytes, mimeType };
}

function getDeclaredImageEditSize(image) {
  const width = Math.floor(clampNumber(image?.width, 0, 3840, 0));
  const height = Math.floor(clampNumber(image?.height, 0, 3840, 0));
  return { width, height };
}

async function createOpenAIImageProxyResponse(origin, upstreamResp) {
  const respHeaders = { ...getCorsHeaders(origin) };
  const contentType = upstreamResp.headers.get('Content-Type');
  if (contentType) respHeaders['Content-Type'] = contentType;

  if (upstreamResp.ok) {
    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      headers: respHeaders,
    });
  }

  const errText = await upstreamResp.text().catch(() => '');
  let errData = null;
  try {
    errData = errText ? JSON.parse(errText) : null;
  } catch {}

  const message = extractOpenAIError(
    errData,
    errText.slice(0, 500) || `OpenAI image API error (${upstreamResp.status})`
  );
  return corsResponse(origin, { error: message }, { status: upstreamResp.status });
}

function appendOpenAIFormFile(form, key, value, fallbackName) {
  if (!(value instanceof Blob)) return;
  const filename = typeof value.name === 'string' && value.name.trim()
    ? value.name
    : fallbackName;
  form.append(key, value, filename);
}

async function handleOpenAIMultipartImages(request, env, origin) {
  const incoming = await request.formData();
  const prompt = sanitizeText(String(incoming.get('prompt') || ''), OPENAI_IMAGE_MAX_PROMPT_CHARS);
  if (!prompt) return badRequest(origin, 'Missing prompt');

  const form = new FormData();
  form.append('model', OPENAI_IMAGE_MODEL);
  form.append('prompt', prompt);
  form.append('n', String(Math.max(1, Math.min(
    OPENAI_IMAGE_MAX_OUTPUTS,
    Math.floor(clampNumber(incoming.get('n'), 1, OPENAI_IMAGE_MAX_OUTPUTS, 1))
  ))));
  form.append('size', normalizeOpenAISizeValue(incoming.get('size')));
  form.append('quality', normalizeOpenAIQualityValue(incoming.get('quality')));
  form.append('output_format', normalizeOpenAIOutputFormat(incoming.get('output_format')));

  const background = normalizeOpenAIBackground(incoming.get('background'));
  if (background !== 'auto') {
    form.append('background', background);
  }

  const images = [
    ...incoming.getAll('image[]'),
    ...incoming.getAll('image'),
  ].slice(0, OPENAI_IMAGE_MAX_INPUT_IMAGES);
  if (images.length === 0) return badRequest(origin, 'Missing image');
  images.forEach((image, index) => {
    appendOpenAIFormFile(form, 'image[]', image, `input-${index + 1}.png`);
  });
  appendOpenAIFormFile(form, 'mask', incoming.get('mask'), 'mask.png');

  const upstreamResp = await fetchWithRetry((signal) =>
    fetch(`${OPENAI_API_BASE}/images/edits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: form,
      signal,
    }),
    { maxRetries: 0, timeoutMs: OPENAI_IMAGE_UPSTREAM_TIMEOUT_MS, label: 'OpenAI image edit' }
  );
  return createOpenAIImageProxyResponse(origin, upstreamResp);
}

async function handleImageEdit(request, env, user) {
  const origin = request.headers.get('Origin') || '';
  if (!env.OPENAI_API_KEY) {
    return corsResponse(origin, {
      error: 'OPENAI_API_KEY is not configured. Add it with `wrangler secret put OPENAI_API_KEY` after enabling OpenAI billing.',
    }, { status: 500 });
  }
  if ((env.IMAGE_EDIT_PROVIDER || 'openai').toLowerCase() !== 'openai') {
    return corsResponse(origin, { error: 'Only the OpenAI image edit provider is enabled.' }, { status: 501 });
  }

  try {
    const body = await request.json();
    const operation = normalizeImageEditOperation(body.operation);
    const quality = normalizeImageEditQuality(body.quality);
    const variants = Math.max(1, Math.min(4, Math.floor(clampNumber(body.variants, 1, 4, 1))));
    const prompt = buildImageEditPrompt({ ...body, operation });
    if (!sanitizeText(body.prompt, OPENAI_IMAGE_MAX_PROMPT_CHARS)) {
      return badRequest(origin, 'The normalized edit prompt is empty.');
    }

    const sourceSize = getDeclaredImageEditSize(body.sourceImage);
    const maskSize = getDeclaredImageEditSize(body.selectionMask);
    if (!sourceSize.width || !sourceSize.height || !maskSize.width || !maskSize.height) {
      return badRequest(origin, 'Source image and selection mask dimensions are required.');
    }
    if (sourceSize.width !== maskSize.width || sourceSize.height !== maskSize.height) {
      return badRequest(origin, 'Selection mask dimensions must match the source image.');
    }
    if (sourceSize.width % 16 !== 0 || sourceSize.height % 16 !== 0) {
      return badRequest(origin, 'The image dimensions must be divisible by 16 for precise editing.');
    }

    const longEdge = Math.max(sourceSize.width, sourceSize.height);
    const shortEdge = Math.max(1, Math.min(sourceSize.width, sourceSize.height));
    const totalPixels = sourceSize.width * sourceSize.height;
    if (longEdge > 3840 || longEdge / shortEdge > 3 || totalPixels < 655_360 || totalPixels > 8_294_400) {
      return badRequest(origin, 'The image size is outside GPT Image edit limits.');
    }

    const selectedPixels = clampNumber(body.selectionStats?.selectedPixels, 0, totalPixels, null);
    const selectedRatio = clampNumber(
      body.selectionStats?.selectedRatio,
      0,
      1,
      selectedPixels == null ? null : selectedPixels / Math.max(totalPixels, 1)
    );
    if (selectedRatio != null) {
      if (selectedRatio <= 0) {
        return badRequest(origin, 'Please select an area to edit.');
      }
      if (selectedRatio < 0.0025) {
        return badRequest(origin, 'The selected area is too small.');
      }
      if (operation !== 'custom' && selectedRatio > 0.7) {
        return badRequest(origin, 'The selected area is too large for this edit. Try a smaller mask or use a custom edit.');
      }
    }

    const sourceInput = decodeImageEditBase64Image(body.sourceImage, 'Source image');
    const maskInput = decodeImageEditBase64Image(body.selectionMask, 'Selection mask');
    const outputFormat = normalizeOpenAIOutputFormat(body.outputFormat);
    const outputMimeType = outputFormat === 'jpeg' ? 'image/jpeg' : `image/${outputFormat}`;

    const form = new FormData();
    const model = env.IMAGE_EDIT_DEFAULT_MODEL || OPENAI_IMAGE_MODEL;
    form.append('model', model);
    form.append('prompt', prompt);
    form.append('n', String(variants));
    form.append('size', `${sourceSize.width}x${sourceSize.height}`);
    form.append('quality', mapImageEditQualityToOpenAI(quality));
    form.append('output_format', outputFormat);
    form.append('image[]', new Blob([sourceInput.bytes], { type: sourceInput.mimeType }), 'source.png');
    form.append('mask', new Blob([maskInput.bytes], { type: maskInput.mimeType }), 'mask.png');

    const referenceImages = Array.isArray(body.referenceImages) ? body.referenceImages.slice(0, 4) : [];
    referenceImages.forEach((image, index) => {
      if (!image || typeof image.base64 !== 'string') return;
      const mimeType = typeof image.mimeType === 'string' && /^image\/(png|jpe?g|webp)$/i.test(image.mimeType)
        ? image.mimeType.toLowerCase().replace('image/jpg', 'image/jpeg')
        : 'image/png';
      const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] || 'png';
      form.append('image[]', new Blob([base64Decode(image.base64)], { type: mimeType }), `reference-${index + 1}.${ext}`);
    });

    const upstreamResp = await fetchWithRetry((signal) =>
      fetch(`${OPENAI_API_BASE}/images/edits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: form,
        signal,
      }),
      { maxRetries: 0, timeoutMs: OPENAI_IMAGE_UPSTREAM_TIMEOUT_MS, label: 'OpenAI precise image edit' }
    );

    const data = await upstreamResp.json().catch(() => null);
    if (!upstreamResp.ok) {
      const message = extractOpenAIError(data, `OpenAI image edit failed (${upstreamResp.status})`);
      return corsResponse(origin, { error: message }, { status: upstreamResp.status });
    }

    const rawEntries = Array.isArray(data?.data) ? data.data : [];
    if (rawEntries.length === 0) {
      return corsResponse(origin, { error: 'OpenAI image edit returned no image data.' }, { status: 502 });
    }

    const editId = crypto.randomUUID();
    const requestId = upstreamResp.headers.get('x-request-id') || upstreamResp.headers.get('openai-request-id') || null;
    const versions = rawEntries
      .map((entry, index) => {
        const rawBase64 = entry?.b64_json;
        if (!rawBase64 || typeof rawBase64 !== 'string') return null;
        return {
          id: crypto.randomUUID(),
          imageUrl: `data:${outputMimeType};base64,${rawBase64}`,
          rawImageUrl: `data:${outputMimeType};base64,${rawBase64}`,
          parentImageId: null,
          operation,
          prompt,
          provider: 'openai',
          model,
          metadata: {
            editId,
            variantIndex: index,
            userEmail: user?.email || null,
            quality,
            openAIQuality: mapImageEditQualityToOpenAI(quality),
            outputFormat,
            width: sourceSize.width,
            height: sourceSize.height,
            selectedRatio,
            requestId,
            usage: data?.usage || null,
          },
        };
      })
      .filter(Boolean);

    if (versions.length === 0) {
      return corsResponse(origin, { error: 'OpenAI image edit returned unreadable image data.' }, { status: 502 });
    }

    return corsResponse(origin, {
      editId,
      status: 'completed',
      versions,
      usage: data?.usage || null,
    });
  } catch (err) {
    const timedOut = err?.name === 'AbortError';
    return corsResponse(origin, {
      error: timedOut
        ? 'The edit failed because the image service timed out. Try a smaller selected area or lower quality.'
        : err.message || 'The edit failed. Try expanding the selected area slightly or simplifying the instruction.',
    }, { status: timedOut ? 504 : 500 });
  }
}

async function handleOpenAIImages(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!env.OPENAI_API_KEY) {
    return corsResponse(origin, {
      error: 'OPENAI_API_KEY is not configured. Add it with `wrangler secret put OPENAI_API_KEY` after enabling OpenAI billing.',
    }, { status: 500 });
  }

  try {
    const contentType = request.headers.get('Content-Type') || '';
    if (contentType.toLowerCase().includes('multipart/form-data')) {
      return await handleOpenAIMultipartImages(request, env, origin);
    }

    const body = await request.json();
    const prompt = sanitizeText(body.prompt, OPENAI_IMAGE_MAX_PROMPT_CHARS);
    if (!prompt) return badRequest(origin, 'Missing prompt');

    const images = normalizeOpenAIImages(body.images);
    const maskImage = decodeBase64Image(body.maskImage, 0);
    const numberOfImages = Math.max(1, Math.min(
      OPENAI_IMAGE_MAX_OUTPUTS,
      Math.floor(clampNumber(body.numberOfImages, 1, OPENAI_IMAGE_MAX_OUTPUTS, 1))
    ));
    const { size, quality, outputFormat, background } = getOpenAIImageOptions(body.generationConfig);
    const model = body.model === OPENAI_IMAGE_MODEL ? body.model : OPENAI_IMAGE_MODEL;

    let upstreamResp;
    if (images.length > 0) {
      const form = new FormData();
      form.append('model', model);
      form.append('prompt', prompt);
      form.append('n', String(numberOfImages));
      form.append('size', size);
      form.append('quality', quality);
      form.append('output_format', outputFormat);
      if (background !== 'auto') {
        form.append('background', background);
      }

      images.forEach((image) => {
        form.append('image[]', image.blob, image.filename);
      });
      if (maskImage) {
        form.append('mask', maskImage.blob, `mask-${maskImage.filename}`);
      }

      upstreamResp = await fetchWithRetry((signal) =>
        fetch(`${OPENAI_API_BASE}/images/edits`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: form,
          signal,
        }),
        { maxRetries: 0, timeoutMs: OPENAI_IMAGE_UPSTREAM_TIMEOUT_MS, label: 'OpenAI image edit' }
      );
    } else {
      const generationBody = JSON.stringify({
        model,
        prompt,
        n: numberOfImages,
        size,
        quality,
        output_format: outputFormat,
        ...(background !== 'auto' ? { background } : {}),
      });
      upstreamResp = await fetchWithRetry((signal) =>
        fetch(`${OPENAI_API_BASE}/images/generations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: generationBody,
          signal,
        }),
        { maxRetries: 0, timeoutMs: OPENAI_IMAGE_UPSTREAM_TIMEOUT_MS, label: 'OpenAI image generation' }
      );
    }
    const data = await upstreamResp.json().catch(() => null);
    if (!upstreamResp.ok) {
      const message = extractOpenAIError(data, `OpenAI image API error (${upstreamResp.status})`);
      return corsResponse(origin, { error: message }, { status: upstreamResp.status });
    }

    const normalized = normalizeOpenAIImageResponse(data);
    if (normalized.images.length === 0) {
      return corsResponse(origin, { error: 'OpenAI image API returned no image data.' }, { status: 502 });
    }

    return corsResponse(origin, normalized);
  } catch (err) {
    const timedOut = err?.name === 'AbortError';
    return corsResponse(origin, {
      error: timedOut
        ? 'OpenAI image generation timed out before an image was returned. Try 1K output or fewer/lower-resolution reference images, then retry.'
        : err.message || 'OpenAI image generation failed.',
    }, { status: timedOut ? 504 : 500 });
  }
}

// ─── Route: POST /api/veo/generate ──────────────────────────────────────────

async function handleVeoGenerate(request, env) {
  const origin = request.headers.get('Origin') || '';
  try {
    const body = await request.json();
    const {
      prompt, image, firstImage, lastImage,
      durationSeconds = 8, aspectRatio = '16:9',
      resolution = '1080p', generateAudio = false,
      personGeneration = 'allow_adult', negativePrompt, seed, numberOfVideos,
      useVertexAi = false,
    } = body;

    const parameters = { durationSeconds, aspectRatio, resolution, personGeneration };
    if (seed !== undefined) parameters.seed = seed;

    const instance = { prompt };
    if (negativePrompt) instance.negativePrompt = negativePrompt;

    // Auto-route to Vertex AI when:
    // 1. Service account key is configured, AND
    // 2. Interpolation frames are provided (firstImage/lastImage), OR caller explicitly requests it
    const hasInterpolation = !!(firstImage?.bytesBase64Encoded || lastImage?.bytesBase64Encoded);
    const hasImage       = !!(image?.bytesBase64Encoded);
    const hasVertexCreds = !!(env.GOOGLE_SERVICE_ACCOUNT_KEY && env.GOOGLE_PROJECT_ID);

    // Route to Vertex AI when:
    //  - Frame interpolation (firstImage + lastImage) → veo-3.1-generate-preview on Vertex AI
    //  - Single image animate → veo-3.1-generate-preview on Vertex AI
    //  - Caller explicitly requests Vertex AI
    const useVertex = (hasInterpolation || hasImage || useVertexAi) && hasVertexCreds;

    // Use Veo 3.1 for all modes
    const vertexModel = 'veo-3.1-generate-001';

    console.log(`[veo-generate] hasInterpolation=${hasInterpolation} hasImage=${hasImage} useVertex=${!!useVertex} model=${useVertex ? vertexModel : 'gemini/veo-3.1'} firstImageBytes=${firstImage?.bytesBase64Encoded?.length || 0} lastImageBytes=${lastImage?.bytesBase64Encoded?.length || 0} imageBytes=${image?.bytesBase64Encoded?.length || 0}`);

    let endpoint, reqHeaders;

    if (useVertex) {
      // ── Vertex AI path ──
      const accessToken = await getVertexAccessToken(env);
      parameters.generateAudio = generateAudio;
      if (numberOfVideos) parameters.sampleCount = numberOfVideos;
      endpoint = `${VERTEX_AI_BASE}/projects/${env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/${vertexModel}:predictLongRunning`;
      reqHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-user-project': env.GOOGLE_PROJECT_ID,
      };
      if (hasInterpolation) {
        // Frame interpolation: Veo API uses `image` for the first frame and `lastFrame` for the last frame
        if (firstImage?.bytesBase64Encoded && firstImage?.mimeType) {
          instance.image = { bytesBase64Encoded: firstImage.bytesBase64Encoded, mimeType: firstImage.mimeType };
        }
        if (lastImage?.bytesBase64Encoded && lastImage?.mimeType) {
          instance.lastFrame = { bytesBase64Encoded: lastImage.bytesBase64Encoded, mimeType: lastImage.mimeType };
        }
      } else if (hasImage) {
        // Single image animation
        instance.image = { bytesBase64Encoded: image.bytesBase64Encoded, mimeType: image.mimeType };
      }
    } else {
      // ── Gemini API path (text-to-video fallback) ──
      if (numberOfVideos) parameters.numberOfVideos = numberOfVideos;
      endpoint = `${GEMINI_API_BASE}/models/veo-3.1-generate-preview:predictLongRunning`;
      reqHeaders = {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      };
      // Single image if provided
      const refImage = firstImage || image;
      if (refImage?.bytesBase64Encoded && refImage?.mimeType) {
        instance.image = { bytesBase64Encoded: refImage.bytesBase64Encoded, mimeType: refImage.mimeType };
      }
    }

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify({ instances: [instance], parameters }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let msg = `API error (${resp.status})`;
      try { msg = JSON.parse(errText).error?.message || msg; } catch {}
      return corsResponse(origin, { status: 'error', error: msg }, { status: resp.status });
    }

    const data = await resp.json();
    console.log(`[veo-generate] response: name=${data.name} done=${data.done} error=${JSON.stringify(data.error)}`);
    if (!data.name) {
      return corsResponse(origin, { status: 'error', error: 'No operation name returned', debug: JSON.stringify(data).slice(0, 300) }, { status: 500 });
    }

    // Quick-poll a few times
    const token = useVertexAi ? env.VERTEX_AI_TOKEN : null;
    const projectId = useVertexAi ? env.GOOGLE_PROJECT_ID : null;

    for (let i = 0; i < QUICK_POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const result = await checkVeoOperation(data.name, env, useVertexAi);
      if (result.status === 'complete' || result.status === 'error') {
        return corsResponse(origin, result);
      }
    }

    return corsResponse(origin, {
      status: 'processing',
      operationName: data.name,
      message: 'Video generation in progress. Poll /api/veo/status for updates.',
    });
  } catch (err) {
return corsResponse(origin, { status: 'error', error: err.message }, { status: 500 });
  }
}

// ─── Route: GET /api/veo/status ──────────────────────────────────────────────

async function handleVeoStatus(request, env) {
  const origin = request.headers.get('Origin') || '';
  const url = new URL(request.url);
  const operationName = url.searchParams.get('operation');
  const useVertexAi = url.searchParams.get('useVertexAi') === 'true';

  if (!operationName) {
    return corsResponse(origin, { error: 'Missing operation parameter' }, { status: 400 });
  }

  const result = await checkVeoOperation(operationName, env, useVertexAi);
  return corsResponse(origin, result);
}

/** Check a Veo operation status */
async function checkVeoOperation(operationName, env, useVertexAi) {
  try {
    // Auto-detect Vertex AI operations by their name format (start with "projects/")
    const isVertexOp = useVertexAi || operationName.startsWith('projects/');
    if (isVertexOp) {
      return await checkVeoVertexOperation(operationName, env);
    }
    // Gemini API: GET the operation
    const resp = await fetch(`${GEMINI_API_BASE}/${operationName}`, {
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY },
    });
    if (!resp.ok) {
      return { status: 'error', error: `Status check failed (${resp.status})` };
    }
    const data = await resp.json();
    if (data.done) {
      if (data.error) return { status: 'error', error: data.error.message || 'Operation failed' };
      const videoUrl = extractGeminiVideoUrl(data.response);
      if (videoUrl) {
        return { status: 'complete', videoUrl, expiresAt: new Date(Date.now() + 2 * 86400000).toISOString() };
      }
      return { status: 'error', error: 'No video URL in completed response' };
    }
    return { status: 'processing', operationName };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

/** Check Vertex AI operation */
async function checkVeoVertexOperation(operationName, env) {
  try {
    const projectMatch = operationName.match(/projects\/([^/]+)/);
    const locationMatch = operationName.match(/locations\/([^/]+)/);
    const modelMatch = operationName.match(/models\/([^/]+)/);
    if (!projectMatch || !locationMatch || !modelMatch) {
      return { status: 'error', error: 'Could not parse operation name' };
    }
    const accessToken = await getVertexAccessToken(env);
    const fetchUrl = `${VERTEX_AI_BASE}/projects/${projectMatch[1]}/locations/${locationMatch[1]}/publishers/google/models/${modelMatch[1]}:fetchPredictOperation`;
    const resp = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-user-project': env.GOOGLE_PROJECT_ID,
      },
      body: JSON.stringify({ operationName }),
    });
    const respText = await resp.text();
    console.log(`[veo-status] fetchPredictOperation status=${resp.status} body=${respText.slice(0, 1000)}`);
    if (!resp.ok) return { status: 'error', error: `API returned ${resp.status}: ${respText.slice(0, 200)}` };
    const data = JSON.parse(respText);
    if (data.done) {
      if (data.error) return { status: 'error', error: data.error.message || 'Failed' };
      const responseKeys = Object.keys(data.response || {});
      const video0 = data.response?.videos?.[0] || data.response?.predictions?.[0];
      console.log(`[veo-status] done=true response keys=${JSON.stringify(responseKeys)} video0 keys=${JSON.stringify(Object.keys(video0 || {}))}`);
      // RAI content filter blocked the generation
      if (data.response?.raiMediaFilteredCount > 0) {
        const reasons = data.response.raiMediaFilteredReasons || [];
        const reasonStr = reasons.length ? ': ' + reasons.join(', ') : '';
        console.log(`[veo-status] RAI filter blocked video${reasonStr}`);
        return { status: 'error', error: `Video blocked by content safety filters${reasonStr}. Try a different prompt or image.` };
      }
      const videoUrl = extractVertexVideoUrl(data.response);
      if (videoUrl) return { status: 'complete', videoUrl, expiresAt: new Date(Date.now() + 2 * 86400000).toISOString() };
      // Base64 video: don't embed in JSON — return operationName so client can stream binary via /api/veo/video
      const hasBase64 = !!(data.response?.videos?.[0]?.bytesBase64Encoded || data.response?.predictions?.[0]?.bytesBase64Encoded);
      if (hasBase64) return { status: 'complete', operationName, needsBinaryFetch: true };
      return { status: 'error', error: 'No video found in response', debug: `response keys=${JSON.stringify(responseKeys)} video0 keys=${JSON.stringify(Object.keys(video0 || {}))}` };
    }
    console.log(`[veo-status] done=false, still processing`);
    return { status: 'processing', operationName };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

function extractGeminiVideoUrl(response) {
  try {
    const samples = response?.generateVideoResponse?.generatedSamples;
    if (samples?.[0]?.video?.uri) return samples[0].video.uri;
  } catch {}
  return null;
}

function extractVertexVideoUrl(response) {
  // Veo 3.1 actual format: response.videos[0]
  if (response?.videos?.[0]) {
    const v = response.videos[0];
    // All known field names for GCS / HTTP video URLs
    return v.gcsUri || v.videoUri || v.videoGcsUri || v.uri || v.videoUrl || v.url || null;
  }
  // Legacy predictions format
  if (response?.predictions?.[0]) {
    const p = response.predictions[0];
    return p.gcsUri || p.videoUri || p.videoGcsUri || p.uri || p.videoUrl || p.video?.uri || p.video?.url || null;
  }
  return null;
}

function extractVertexVideoBase64(response) {
  // Veo 3.1 actual format: response.videos[0].bytesBase64Encoded
  if (response?.videos?.[0]?.bytesBase64Encoded) {
    return { base64: response.videos[0].bytesBase64Encoded, mimeType: response.videos[0].mimeType || 'video/mp4' };
  }
  // Legacy predictions format
  if (response?.predictions?.[0]?.bytesBase64Encoded) {
    const p = response.predictions[0];
    return { base64: p.bytesBase64Encoded, mimeType: p.mimeType || 'video/mp4' };
  }
  return null;
}

// ─── Route: GET /api/veo/download ───────────────────────────────────────────

async function handleVeoDownload(request, env) {
  const origin = request.headers.get('Origin') || '';
  const url = new URL(request.url);
  const videoUrl = url.searchParams.get('url');

  if (!videoUrl) {
    return corsResponse(origin, { error: 'Missing url parameter' }, { status: 400 });
  }

  // Only allow downloading from known Google domains
  let fetchUrl = videoUrl;
  let fetchHeaders = {};

  if (videoUrl.startsWith('https://generativelanguage.googleapis.com/')) {
    // Gemini Files API — needs API key and alt=media
    const parsed = new URL(videoUrl);
    if (!parsed.searchParams.has('alt')) parsed.searchParams.set('alt', 'media');
    fetchUrl = parsed.toString();
    fetchHeaders = { 'x-goog-api-key': env.GEMINI_API_KEY };
  } else if (videoUrl.startsWith('gs://')) {
    // Convert gs:// to HTTPS storage URL, auth via service account
    fetchUrl = videoUrl.replace('gs://', 'https://storage.googleapis.com/');
    if (env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      const token = await getVertexAccessToken(env);
      fetchHeaders = { 'Authorization': `Bearer ${token}` };
    }
  } else if (videoUrl.startsWith('https://storage.googleapis.com/')) {
    fetchUrl = videoUrl;
    // Vertex AI GCS videos need service account auth (private bucket)
    if (env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      const token = await getVertexAccessToken(env);
      fetchHeaders = { 'Authorization': `Bearer ${token}` };
    }
  } else {
    return corsResponse(origin, { error: 'URL domain not allowed' }, { status: 403 });
  }

  try {
    const resp = await fetch(fetchUrl, { headers: fetchHeaders });
    if (!resp.ok) {
      return corsResponse(origin, { error: `Download failed (${resp.status})` }, { status: resp.status });
    }
    const contentType = resp.headers.get('Content-Type') || 'video/mp4';
    return new Response(resp.body, {
      status: 200,
      headers: {
        ...getCorsHeaders(origin),
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=172800', // 2 days
      },
    });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── Route: POST /api/kling/generate ─────────────────────────────────────────

async function handleKlingGenerate(request, env) {
  const origin = request.headers.get('Origin') || '';
  try {
    const body = await request.json();
    const { provider = 'piapi', ...params } = body;

    const endpoint = KLING_ENDPOINTS[provider];
    if (!endpoint) return corsResponse(origin, { error: `Unknown Kling provider: ${provider}` }, { status: 400 });

    const keyMap = { piapi: env.KLING_PIAPI_API_KEY, ulazai: env.KLING_ULAZAI_API_KEY, wavespeedai: env.KLING_WAVESPEEDAI_API_KEY };
    const apiKey = keyMap[provider];
    if (!apiKey) return corsResponse(origin, { error: `No API key configured for provider: ${provider}` }, { status: 500 });

    // Build provider-specific payload
    let url, payload;
    if (provider === 'piapi') {
      url = `${endpoint.base}/video/generation`;
      payload = buildPiApiPayload(params);
    } else if (provider === 'ulazai') {
      url = `${endpoint.base}/video/generate`;
      payload = buildUlazAiPayload(params);
    } else {
      url = `${endpoint.base}/generate`;
      payload = buildWaveSpeedPayload(params);
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return corsResponse(origin, { error: `Kling API error (${resp.status}): ${errText}` }, { status: resp.status });
    }

    const data = await resp.json();
    const taskId = data.task_id || data.id || data.taskId;
    return corsResponse(origin, { taskId, provider, raw: data });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

function buildPiApiPayload(p) {
  const payload = {
    model: 'kling-v1-5',
    prompt: p.prompt,
    duration: p.duration || 5,
    aspect_ratio: p.aspectRatio || '16:9',
    mode: p.inputImage ? 'image2video' : 'text2video',
  };
  if (p.inputImage) payload.image_url = p.inputImage;
  if (p.camera) {
    payload.camera_control = {
      type: p.camera.type,
      speed: p.camera.speed || 'normal',
      direction: p.camera.direction || 0,
      smoothness: (p.camera.smoothness || 50) / 100,
    };
  }
  return payload;
}

function buildUlazAiPayload(p) {
  const payload = {
    text: p.prompt,
    duration: (p.duration || 5) + 's',
    ratio: p.aspectRatio || '16:9',
    mode: p.inputImage ? 'img2video' : 'txt2video',
    quality: p.quality || 'standard',
  };
  if (p.inputImage) payload.image = p.inputImage;
  if (p.camera) {
    payload.camera_movement = {
      type: p.camera.type,
      strength: (p.camera.smoothness || 50) / 100,
      angle: p.camera.direction || 0,
    };
  }
  return payload;
}

function buildWaveSpeedPayload(p) {
  const payload = {
    prompt: p.prompt,
    video_length: p.duration || 5,
    aspect_ratio: p.aspectRatio || '16:9',
  };
  if (p.inputImage) payload.image = p.inputImage;
  if (p.seed !== undefined) payload.seed = p.seed;
  if (p.camera) {
    payload.camera = {
      motion: p.camera.type,
      direction: p.camera.direction || 0,
      speed: p.camera.speed || 'normal',
      smoothness: p.camera.smoothness || 50,
    };
  }
  return payload;
}

// ─── Route: GET /api/kling/status ────────────────────────────────────────────

async function handleKlingStatus(request, env) {
  const origin = request.headers.get('Origin') || '';
  const url = new URL(request.url);
  const taskId = url.searchParams.get('taskId');
  const provider = url.searchParams.get('provider') || 'piapi';

  if (!taskId) return corsResponse(origin, { error: 'Missing taskId' }, { status: 400 });

  const endpoint = KLING_ENDPOINTS[provider];
  if (!endpoint) return corsResponse(origin, { error: `Unknown provider: ${provider}` }, { status: 400 });

  const keyMap = { piapi: env.KLING_PIAPI_API_KEY, ulazai: env.KLING_ULAZAI_API_KEY, wavespeedai: env.KLING_WAVESPEEDAI_API_KEY };
  const apiKey = keyMap[provider];

  let statusUrl;
  if (provider === 'piapi') statusUrl = `${endpoint.base}/video/${taskId}`;
  else if (provider === 'ulazai') statusUrl = `${endpoint.base}/video/status/${taskId}`;
  else statusUrl = `${endpoint.base}/status/${taskId}`;

  try {
    const resp = await fetchWithRetry(
      (signal) => fetch(statusUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal,
      }),
      { maxRetries: 2, timeoutMs: 15000, label: 'Kling status' },
    );
    if (!resp.ok) {
      return corsResponse(origin, { error: `Status check failed (${resp.status})` }, { status: resp.status });
    }
    const data = await resp.json();
    return corsResponse(origin, data);
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── Route: POST /api/convert/* ──────────────────────────────────────────────

async function handleConvertApi(request, env, inputFormat = 'pdf', outputFormat = 'docx') {
  const origin = request.headers.get('Origin') || '';
  try {
    const body = await request.json();
    const { fileName, fileData } = body;

    if (!fileData) return corsResponse(origin, { error: 'Missing fileData (base64)' }, { status: 400 });

    const convertBody = JSON.stringify({
      Parameters: [{ Name: 'File', FileValue: { Name: fileName || `document.${inputFormat}`, Data: fileData } }],
    });
    const resp = await fetchWithRetry(
      (signal) => fetch(`${CONVERTAPI_BASE}/convert/${inputFormat}/to/${outputFormat}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.CONVERTAPI_SECRET}`,
        },
        body: convertBody,
        signal,
      }),
      { maxRetries: 2, timeoutMs: 300000, label: 'ConvertAPI' },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      // Remap any upstream status to 502 so a vendor 401 (e.g. bad/expired
      // CONVERTAPI_SECRET) is never confused with our own JWT rejection on the
      // client — that would otherwise trigger an unintended logout.
      return corsResponse(
        origin,
        { error: `ConvertAPI error (${resp.status}): ${errText}` },
        { status: 502 },
      );
    }

    const data = await resp.json();
    return corsResponse(origin, data);
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── Route: /api/ilovepdf/* (multi-step passthrough proxy) ──────────────────

async function handleILovePdfProxy(request, env, subpath) {
  const origin = request.headers.get('Origin') || '';
  try {
    if (subpath === 'auth') {
      // Step 1: Authenticate with iLovePDF using our secret key
      const authBody = JSON.stringify({ public_key: env.ILOVEPDF_PUBLIC_KEY });
      const resp = await fetchWithRetry(
        (signal) => fetch(`${ILOVEPDF_BASE}/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: authBody,
          signal,
        }),
        { maxRetries: 2, timeoutMs: 15000, label: 'iLovePDF auth' },
      );
      if (!resp.ok) {
        const errText = await resp.text();
        return corsResponse(origin, { error: `iLovePDF auth failed: ${errText}` }, { status: resp.status });
      }
      const data = await resp.json();
      return corsResponse(origin, data);
    }

    if (subpath.startsWith('start/')) {
      // Step 2: Start a task (e.g., start/pdfdocx or start/compress)
      const tool = subpath.replace('start/', '');
      const body = await request.json();
      const iToken = body.ilovepdfToken;
      if (!iToken) return corsResponse(origin, { error: 'Missing ilovepdfToken' }, { status: 400 });

      const resp = await fetchWithRetry(
        (signal) => fetch(`${ILOVEPDF_BASE}/start/${tool}`, {
          headers: { 'Authorization': `Bearer ${iToken}` },
          signal,
        }),
        { maxRetries: 2, timeoutMs: 15000, label: 'iLovePDF start' },
      );
      if (!resp.ok) {
        const errText = await resp.text();
        return corsResponse(origin, { error: `Start task failed: ${errText}` }, { status: resp.status });
      }
      return corsResponse(origin, await resp.json());
    }

    if (subpath === 'upload') {
      // Step 3: Upload file to the dynamic server
      const body = await request.json();
      const { server, task, ilovepdfToken, fileData, fileName } = body;
      if (!server || !task || !ilovepdfToken || !fileData) {
        return corsResponse(origin, { error: 'Missing required upload fields' }, { status: 400 });
      }

      // Convert base64 to blob and upload via FormData
      const binaryStr = atob(fileData);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });

      const formData = new FormData();
      formData.append('task', task);
      formData.append('file', blob, fileName || 'document.pdf');

      const resp = await fetchWithRetry(
        (signal) => fetch(`https://${server}/v1/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${ilovepdfToken}` },
          body: formData,
          signal,
        }),
        { maxRetries: 2, timeoutMs: 60000, label: 'iLovePDF upload' },
      );
      if (!resp.ok) {
        const errText = await resp.text();
        return corsResponse(origin, { error: `Upload failed: ${errText}` }, { status: resp.status });
      }
      return corsResponse(origin, await resp.json());
    }

    if (subpath === 'process') {
      // Step 4: Process the task
      const body = await request.json();
      const { server, ilovepdfToken, ...processPayload } = body;
      if (!server || !ilovepdfToken) {
        return corsResponse(origin, { error: 'Missing server or ilovepdfToken' }, { status: 400 });
      }

      const processBody = JSON.stringify(processPayload);
      const resp = await fetchWithRetry(
        (signal) => fetch(`https://${server}/v1/process`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ilovepdfToken}`,
            'Content-Type': 'application/json',
          },
          body: processBody,
          signal,
        }),
        { maxRetries: 2, timeoutMs: 60000, label: 'iLovePDF process' },
      );
      if (!resp.ok) {
        const errText = await resp.text();
        return corsResponse(origin, { error: `Process failed: ${errText}` }, { status: resp.status });
      }
      // process may return empty body on success
      const text = await resp.text();
      return corsResponse(origin, text ? JSON.parse(text) : { success: true });
    }

    if (subpath.startsWith('download/')) {
      // Step 5: Download the result
      const taskId = subpath.replace('download/', '');
      const url = new URL(request.url);
      const server = url.searchParams.get('server');
      const iToken = url.searchParams.get('token');
      if (!server || !iToken) {
        return corsResponse(origin, { error: 'Missing server or token params' }, { status: 400 });
      }

      const resp = await fetchWithRetry(
        (signal) => fetch(`https://${server}/v1/download/${taskId}`, {
          headers: { 'Authorization': `Bearer ${iToken}` },
          signal,
        }),
        { maxRetries: 2, timeoutMs: 60000, label: 'iLovePDF download' },
      );
      if (!resp.ok) {
        return corsResponse(origin, { error: `Download failed (${resp.status})` }, { status: resp.status });
      }

      // Return binary response
      return new Response(resp.body, {
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': resp.headers.get('Content-Type') || 'application/octet-stream',
          'Content-Disposition': resp.headers.get('Content-Disposition') || '',
        },
      });
    }

    return corsResponse(origin, { error: `Unknown iLovePDF endpoint: ${subpath}` }, { status: 404 });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── URL Fetch Proxy (for material validation link fetching) ─────────────────

async function handleFetchUrl(request, env) {
  const origin = request.headers.get('Origin') || '';
  const reqUrl = new URL(request.url);
  const targetUrl = reqUrl.searchParams.get('url');

  if (!targetUrl) {
    return corsResponse(origin, { error: 'Missing url parameter' }, { status: 400 });
  }

  let parsedUrl;
  try {
    let normalizedUrl = targetUrl;
    if (normalizedUrl.startsWith('www.')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    parsedUrl = new URL(normalizedUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return corsResponse(origin, { error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const resp = await fetchWithRetry(
      (signal) => fetch(parsedUrl.href, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'ArchVizAIStudio/1.0',
        },
        signal,
        redirect: 'follow',
      }),
      { maxRetries: 1, timeoutMs: 10000, label: 'URL fetch' }
    );

    if (!resp.ok) {
      return corsResponse(origin, {
        url: parsedUrl.href,
        content: '',
        fetchedAt: Date.now(),
        error: `HTTP ${resp.status}`
      });
    }

    const html = await resp.text();
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;
    const content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    return corsResponse(origin, {
      url: parsedUrl.href,
      title,
      content,
      fetchedAt: Date.now()
    });
  } catch (err) {
    return corsResponse(origin, {
      url: parsedUrl.href,
      content: '',
      fetchedAt: Date.now(),
      error: err.message
    });
  }
}

// ─── Route: GET /api/veo/video?op=... (stream binary video from completed Vertex AI op) ─

async function handleVeoVideo(request, env) {
  const origin = request.headers.get('Origin') || '';
  const operationName = new URL(request.url).searchParams.get('op');
  if (!operationName) return corsResponse(origin, { error: 'Missing op parameter' }, { status: 400 });

  try {
    const accessToken = await getVertexAccessToken(env);
    const projectMatch = operationName.match(/projects\/([^/]+)/);
    const locationMatch = operationName.match(/locations\/([^/]+)/);
    const modelMatch = operationName.match(/models\/([^/]+)/);
    if (!projectMatch || !locationMatch || !modelMatch) {
      return corsResponse(origin, { error: 'Invalid operation name format' }, { status: 400 });
    }

    const fetchUrl = `${VERTEX_AI_BASE}/projects/${projectMatch[1]}/locations/${locationMatch[1]}/publishers/google/models/${modelMatch[1]}:fetchPredictOperation`;
    const resp = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-user-project': env.GOOGLE_PROJECT_ID,
      },
      body: JSON.stringify({ operationName }),
    });

    if (!resp.ok) {
      return corsResponse(origin, { error: `fetchPredictOperation failed (${resp.status})` }, { status: resp.status });
    }

    const data = await resp.json();
    if (!data.done) return corsResponse(origin, { error: 'Operation not yet complete' }, { status: 202 });
    if (data.error) return corsResponse(origin, { error: data.error.message || 'Operation failed' }, { status: 500 });

    // Extract base64 bytes from the actual response format
    const embedded = extractVertexVideoBase64(data.response);
    if (!embedded) {
      // Try URL-based response
      const videoUrl = extractVertexVideoUrl(data.response);
      if (videoUrl) {
        // Redirect or proxy the URL
        const dlResp = await fetch(videoUrl.replace('gs://', 'https://storage.googleapis.com/'), {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        return new Response(dlResp.body, {
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'video/mp4', 'Content-Disposition': 'inline' },
        });
      }
      return corsResponse(origin, { error: 'No video data in response' }, { status: 500 });
    }

    // Decode base64 → binary and stream
    const binaryStr = atob(embedded.base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    return new Response(bytes, {
      status: 200,
      headers: {
        ...getCorsHeaders(origin),
        'Content-Type': embedded.mimeType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=172800',
      },
    });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── Route: GET /health/vertex/poll?op=... (poll a specific operation, no JWT) ─

async function handleVertexPoll(request, env) {
  const origin = request.headers.get('Origin') || '';
  const opName = new URL(request.url).searchParams.get('op');
  if (!opName) return corsResponse(origin, { error: 'Missing op param' }, { status: 400 });
  try {
    const accessToken = await getVertexAccessToken(env);
    const fetchUrl = `${VERTEX_AI_BASE}/projects/${env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/veo-3.1-generate-001:fetchPredictOperation`;
    const resp = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-user-project': env.GOOGLE_PROJECT_ID,
      },
      body: JSON.stringify({ operationName: opName }),
    });
    const text = await resp.text();
    // Don't parse if huge (base64 video) — just show first 2KB
    const preview = text.slice(0, 2000);
    const data = JSON.parse(text);
    // If done, show structure but truncate huge base64 values
    if (data.done && data.response?.predictions) {
      const safe = JSON.parse(JSON.stringify(data));
      safe.response.predictions = (safe.response.predictions || []).map(p => {
        const copy = { ...p };
        if (copy.bytesBase64Encoded) copy.bytesBase64Encoded = `[${copy.bytesBase64Encoded.length} chars base64]`;
        return copy;
      });
      return corsResponse(origin, { status: resp.status, done: true, safe });
    }
    return corsResponse(origin, { status: resp.status, preview, done: data.done || false });
  } catch (e) {
    return corsResponse(origin, { error: e.message }, { status: 500 });
  }
}

// ─── Route: GET /health/vertex (diagnostics, no JWT) ─────────────────────────

async function handleVertexDiag(request, env) {
  const origin = request.headers.get('Origin') || '';
  const result = { steps: [] };

  // Step 1: secrets present?
  const hasKey = !!env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const hasProject = !!env.GOOGLE_PROJECT_ID;
  result.steps.push({ step: 'secrets', hasKey, hasProject, project: env.GOOGLE_PROJECT_ID || null });
  if (!hasKey || !hasProject) {
    return corsResponse(origin, { ...result, error: 'Missing secrets' });
  }

  // Step 2: parse service account JSON
  let sa;
  try {
    sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
    result.steps.push({ step: 'parse_sa', ok: true, client_email: sa.client_email, project_id: sa.project_id });
  } catch (e) {
    return corsResponse(origin, { ...result, error: 'Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON: ' + e.message });
  }

  // Step 3: mint access token
  let accessToken;
  try {
    accessToken = await getVertexAccessToken(env);
    result.steps.push({ step: 'mint_token', ok: true, tokenPrefix: accessToken.slice(0, 20) + '...' });
  } catch (e) {
    return corsResponse(origin, { ...result, error: 'Token mint failed: ' + e.message });
  }

  // Step 4: probe Veo model — optionally test with firstImage/lastImage
  const modelToProbe = new URL(request.url).searchParams.get('model') || 'veo-3.1-generate-001';
  const testInterp = new URL(request.url).searchParams.get('interp') === '1';
  // 1×1 white JPEG in base64 (minimal valid image for testing)
  const TINY_JPEG_B64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEA/8QAIhAAAQMEAgMAAAAAAAAAAAAAAQIDBAUREiExQVH/2gAIAQEAAD8AqGmQyuPvIxlxhRt1kNaKMfEQEEGh3Pn9n//Z';
  try {
    const instance = testInterp
      ? { prompt: '__diag_interp_test__', image: { bytesBase64Encoded: TINY_JPEG_B64, mimeType: 'image/jpeg' }, lastFrame: { bytesBase64Encoded: TINY_JPEG_B64, mimeType: 'image/jpeg' } }
      : { prompt: '__diag_test__' };
    const probeUrl = `${VERTEX_AI_BASE}/projects/${env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/${modelToProbe}:predictLongRunning`;
    const resp = await fetch(probeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-user-project': env.GOOGLE_PROJECT_ID,
      },
      body: JSON.stringify({ instances: [instance], parameters: { durationSeconds: 4, aspectRatio: '16:9' } }),
    });
    const body = await resp.text();
    result.steps.push({ step: 'vertex_predict_probe', status: resp.status, body: body.slice(0, 600) });
    // 400 = reachable but bad request (expected for minimal payload) → Vertex AI is working
    // 403 = permission denied (API not enabled or IAM missing)
    // 404 = model not found / not available in this project
    // 200/202 = it actually started (great!)
    if (resp.status === 403 || resp.status === 404) {
      return corsResponse(origin, { ...result, error: `Vertex AI returned ${resp.status} — see body` });
    }

    // Step 5: check status via fetchPredictOperation
    let opName;
    try { opName = JSON.parse(body).name; } catch {}
    if (opName) {
      await sleep(3000); // wait 3s so op has a chance to register
      try {
        const fetchUrl = `${VERTEX_AI_BASE}/projects/${env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/veo-3.1-generate-001:fetchPredictOperation`;
        const statusResp = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'x-goog-user-project': env.GOOGLE_PROJECT_ID,
          },
          body: JSON.stringify({ operationName: opName }),
        });
        const statusBody = await statusResp.text();
        result.steps.push({ step: 'fetch_predict_operation', status: statusResp.status, body: statusBody.slice(0, 600) });
        if (!statusResp.ok) {
          return corsResponse(origin, { ...result, error: `fetchPredictOperation returned ${statusResp.status}` });
        }
      } catch (e) {
        return corsResponse(origin, { ...result, error: 'fetchPredictOperation failed: ' + e.message });
      }
    }
  } catch (e) {
    return corsResponse(origin, { ...result, error: 'Vertex AI fetch failed: ' + e.message });
  }

  return corsResponse(origin, { ...result, ok: true });
}

// ─── Feedback Reporting API ───────────────────────────────────────────────────

async function handleFeedbackCreate(request, env, user) {
  const origin = request.headers.get('Origin') || '';

  try {
    const body = await request.json();
    const title = sanitizeText(body?.title, 200);
    const description = sanitizeText(body?.description, 12000);

    if (!title) return badRequest(origin, 'Feedback title is required.');
    if (!description) return badRequest(origin, 'Feedback description is required.');
    if (!user?.email) return unauthorized(origin, 'Missing authenticated user email.');

    const snapshot = body?.snapshot;
    if (!snapshot || typeof snapshot !== 'object') {
      return badRequest(origin, 'A valid project snapshot is required.');
    }

    const snapshotText = JSON.stringify(snapshot);
    const snapshotSizeBytes = new TextEncoder().encode(snapshotText).length;
    if (snapshotSizeBytes <= 0) {
      return badRequest(origin, 'Snapshot cannot be empty.');
    }

    const snapshotHash = await sha256Hex(snapshotText);
    const snapshotVersionRaw = Number(body?.snapshotVersion);
    const snapshotVersion = Number.isFinite(snapshotVersionRaw) && snapshotVersionRaw > 0
      ? Math.floor(snapshotVersionRaw)
      : 1;

    const category = sanitizeEnum(body?.category, FEEDBACK_ALLOWED_CATEGORIES, 'bug');
    const priority = sanitizeEnum(body?.priority, FEEDBACK_ALLOWED_PRIORITIES, 'normal');
    const mode = sanitizeText(body?.mode || body?.appContext?.mode, 64);
    const appVersion = sanitizeText(body?.appVersion || body?.appContext?.appVersion, 128);
    const projectName = sanitizeText(body?.projectName || body?.appContext?.projectName, 200);
    const userAgent = sanitizeText(body?.userAgent || request.headers.get('User-Agent') || '', 512);
    const reproductionSteps = sanitizeText(body?.reproductionSteps, 12000);
    const expectedBehavior = sanitizeText(body?.expectedBehavior, 12000);

    const historyCountRaw = Number(body?.historyCount ?? body?.appContext?.historyCount ?? 0);
    const historyCount = Number.isFinite(historyCountRaw)
      ? Math.max(0, Math.min(Math.floor(historyCountRaw), 100000))
      : 0;

    const reportId = crypto.randomUUID();
    const metadataInput = body?.metadata && typeof body.metadata === 'object' ? body.metadata : {};
    const reportedFeatureKey = sanitizeText(body?.reportedFeatureKey || body?.mode || mode, 120);
    const reportedFeatureLabel = sanitizeText(body?.reportedFeatureLabel, 200);
    const imageFeedback = sanitizeFeedbackImageAnnotations(body?.imageFeedback);
    const documentFeedback = sanitizeFeedbackDocumentAttachments(body?.documentFeedback);

    const reportMetadata = {
      ...metadataInput,
      reportedFeatureKey: reportedFeatureKey || null,
      reportedFeatureLabel: reportedFeatureLabel || null,
      imageFeedback,
      documentFeedback,
    };

    const reportPayload = {
      id: reportId,
      reporter_email: user.email,
      reporter_name: sanitizeText(user?.name || '', 200),
      reporter_picture: sanitizeText(user?.picture || '', 2000),
      status: 'new',
      priority,
      category,
      title,
      description,
      reproduction_steps: reproductionSteps,
      expected_behavior: expectedBehavior,
      mode,
      app_version: appVersion,
      user_agent: userAgent,
      project_name: projectName,
      history_count: historyCount,
      snapshot_version: snapshotVersion,
      snapshot_hash: snapshotHash,
      snapshot_size_bytes: snapshotSizeBytes,
      metadata: reportMetadata,
    };

    const useAppwriteFeedback = isAppwriteFeedbackConfigured(env);
    let snapshotStoredInline = !useAppwriteFeedback && snapshotSizeBytes <= FEEDBACK_SNAPSHOT_INLINE_LIMIT_BYTES;

    if (snapshotStoredInline) {
      reportPayload.snapshot_json = snapshot;
    } else {
      try {
        reportPayload.snapshot_storage_path = await uploadFeedbackSnapshotToStorage(env, reportId, snapshotText);
      } catch (storageError) {
        const storageErrorMessage = String(storageError?.message || storageError || '').slice(0, 500);
        console.warn('[feedback] snapshot storage upload failed, falling back to inline JSON', {
          reportId,
          error: storageErrorMessage,
        });

        const existingMetadata = reportPayload.metadata && typeof reportPayload.metadata === 'object'
          ? reportPayload.metadata
          : {};
        reportPayload.metadata = {
          ...existingMetadata,
          snapshotStorageFallback: true,
          snapshotStorageFallbackReason: storageErrorMessage,
        };
        reportPayload.snapshot_json = snapshot;
        snapshotStoredInline = true;
      }
    }

    if (useAppwriteFeedback) {
      const report = await createAppwriteFeedbackReport(env, reportPayload);
      await createAppwriteFeedbackActivity(env, {
        report_id: reportId,
        actor_email: user.email,
        actor_name: sanitizeText(user?.name || '', 200),
        kind: 'created',
        message: 'Feedback report created.',
        metadata: {
          source: 'in_app_report',
          snapshotSizeBytes,
        },
      });

      return corsResponse(origin, {
        success: true,
        report,
        snapshotStoredInline,
      });
    }

    const insertedRows = await supabaseJson(env, '/rest/v1/feedback_reports?select=id,created_at,status,priority,category,title,mode,project_name,snapshot_size_bytes,snapshot_storage_path', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(reportPayload),
    });

    if (!Array.isArray(insertedRows) || insertedRows.length === 0) {
      throw new Error('Failed to insert feedback report.');
    }

    await supabaseJson(env, '/rest/v1/feedback_activity', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        report_id: reportId,
        actor_email: user.email,
        actor_name: sanitizeText(user?.name || '', 200),
        kind: 'created',
        message: 'Feedback report created.',
        metadata: {
          source: 'in_app_report',
          snapshotSizeBytes,
        },
      }),
    });

    return corsResponse(origin, {
      success: true,
      report: insertedRows[0],
      snapshotStoredInline,
    });
  } catch (error) {
    console.error('[feedback] create failed', {
      message: error?.message || String(error),
    });
    return corsResponse(origin, { error: error.message || 'Failed to submit feedback report.' }, { status: 500 });
  }
}

async function handleFeedbackList(request, env, user, isAdmin) {
  const origin = request.headers.get('Origin') || '';
  if (!isAdmin) return forbidden(origin, 'Admin access required.');

  try {
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get('limit') || 50);
    const offsetRaw = Number(url.searchParams.get('offset') || 0);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(Math.floor(limitRaw), 200)) : 50;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;

    const status = sanitizeEnum(url.searchParams.get('status'), FEEDBACK_ALLOWED_STATUSES, null);
    const priority = sanitizeEnum(url.searchParams.get('priority'), FEEDBACK_ALLOWED_PRIORITIES, null);
    const category = sanitizeEnum(url.searchParams.get('category'), FEEDBACK_ALLOWED_CATEGORIES, null);
    const mode = sanitizeText(url.searchParams.get('mode'), 64);
    const reporterEmail = sanitizeText(url.searchParams.get('reporterEmail'), 320);
    const search = sanitizeText(url.searchParams.get('search'), 120);

    const params = new URLSearchParams();
    params.set('select', 'id,created_at,updated_at,last_activity_at,reporter_email,reporter_name,status,priority,category,title,mode,project_name,history_count,snapshot_size_bytes,snapshot_storage_path');
    params.set('order', 'created_at.desc');
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (status) params.set('status', `eq.${status}`);
    if (priority) params.set('priority', `eq.${priority}`);
    if (category) params.set('category', `eq.${category}`);
    if (mode) params.set('mode', `eq.${mode}`);
    if (reporterEmail) params.set('reporter_email', `eq.${reporterEmail}`);
    if (search) {
      const safeSearch = search.replace(/[*,]/g, '');
      params.set('or', `(title.ilike.*${safeSearch}*,description.ilike.*${safeSearch}*,reporter_email.ilike.*${safeSearch}*)`);
    }

    if (isAppwriteFeedbackConfigured(env)) {
      const reports = await listAppwriteFeedbackReports(env, {
        limit,
        offset,
        status,
        priority,
        category,
        mode,
        reporterEmail,
        search,
      });
      return corsResponse(origin, {
        success: true,
        reports,
      });
    }

    const data = await supabaseJson(env, `/rest/v1/feedback_reports?${params.toString()}`, {
      headers: { Prefer: 'count=exact' },
    });

    return corsResponse(origin, {
      success: true,
      reports: Array.isArray(data) ? data : [],
    });
  } catch (error) {
    return corsResponse(origin, { error: error.message || 'Failed to load feedback reports.' }, { status: 500 });
  }
}

async function handleFeedbackDetail(request, env, reportId, isAdmin, user) {
  const origin = request.headers.get('Origin') || '';
  if (!isAdmin) return forbidden(origin, 'Admin access required.');

  try {
    if (isAppwriteFeedbackConfigured(env)) {
      const report = await getAppwriteFeedbackReport(env, reportId);
      if (!report) {
        return corsResponse(origin, { error: 'Report not found.' }, { status: 404 });
      }
      const activity = await listAppwriteFeedbackActivity(env, reportId);
      return corsResponse(origin, {
        success: true,
        report,
        activity,
      });
    }

    const reportRows = await supabaseJson(
      env,
      `/rest/v1/feedback_reports?select=id,created_at,updated_at,last_activity_at,reporter_email,reporter_name,reporter_picture,status,priority,category,title,description,reproduction_steps,expected_behavior,mode,app_version,user_agent,project_name,history_count,snapshot_version,snapshot_hash,snapshot_size_bytes,snapshot_storage_path,resolved_at,resolved_by,metadata&id=eq.${encodeURIComponent(reportId)}&limit=1`
    );

    if (!Array.isArray(reportRows) || reportRows.length === 0) {
      return corsResponse(origin, { error: 'Report not found.' }, { status: 404 });
    }

    const activityRows = await supabaseJson(
      env,
      `/rest/v1/feedback_activity?select=id,created_at,actor_email,actor_name,kind,message,from_status,to_status,from_priority,to_priority,metadata&report_id=eq.${encodeURIComponent(reportId)}&order=created_at.asc`
    );

    return corsResponse(origin, {
      success: true,
      report: reportRows[0],
      activity: Array.isArray(activityRows) ? activityRows : [],
    });
  } catch (error) {
    return corsResponse(origin, { error: error.message || 'Failed to load feedback report.' }, { status: 500 });
  }
}

async function handleFeedbackSnapshot(request, env, reportId, isAdmin) {
  const origin = request.headers.get('Origin') || '';
  if (!isAdmin) return forbidden(origin, 'Admin access required.');

  try {
    if (isAppwriteFeedbackConfigured(env)) {
      const report = await getAppwriteFeedbackReport(env, reportId);
      if (!report) {
        return corsResponse(origin, { error: 'Report not found.' }, { status: 404 });
      }
      if (report.snapshot_json) {
        return corsResponse(origin, {
          success: true,
          source: 'inline',
          snapshot: report.snapshot_json,
          snapshotHash: report.snapshot_hash,
          snapshotSizeBytes: report.snapshot_size_bytes,
          snapshotVersion: report.snapshot_version,
        });
      }
      if (!report.snapshot_storage_path) {
        return corsResponse(origin, { error: 'No snapshot found for this report.' }, { status: 404 });
      }
      const snapshot = await downloadFeedbackSnapshotFromStorage(env, report.snapshot_storage_path);
      return corsResponse(origin, {
        success: true,
        source: 'storage',
        snapshot,
        snapshotHash: report.snapshot_hash,
        snapshotSizeBytes: report.snapshot_size_bytes,
        snapshotVersion: report.snapshot_version,
      });
    }

    const rows = await supabaseJson(
      env,
      `/rest/v1/feedback_reports?select=id,snapshot_json,snapshot_storage_path,snapshot_hash,snapshot_size_bytes,snapshot_version&id=eq.${encodeURIComponent(reportId)}&limit=1`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return corsResponse(origin, { error: 'Report not found.' }, { status: 404 });
    }

    const report = rows[0];
    if (report.snapshot_json) {
      return corsResponse(origin, {
        success: true,
        source: 'inline',
        snapshot: report.snapshot_json,
        snapshotHash: report.snapshot_hash,
        snapshotSizeBytes: report.snapshot_size_bytes,
        snapshotVersion: report.snapshot_version,
      });
    }

    if (!report.snapshot_storage_path) {
      return corsResponse(origin, { error: 'No snapshot found for this report.' }, { status: 404 });
    }

    const snapshot = await downloadFeedbackSnapshotFromStorage(env, report.snapshot_storage_path);
    return corsResponse(origin, {
      success: true,
      source: 'storage',
      snapshot,
      snapshotHash: report.snapshot_hash,
      snapshotSizeBytes: report.snapshot_size_bytes,
      snapshotVersion: report.snapshot_version,
    });
  } catch (error) {
    return corsResponse(origin, { error: error.message || 'Failed to load snapshot.' }, { status: 500 });
  }
}

async function handleFeedbackUpdate(request, env, reportId, isAdmin, user) {
  const origin = request.headers.get('Origin') || '';
  if (!isAdmin) return forbidden(origin, 'Admin access required.');

  try {
    const body = await request.json();
    const nextStatus = sanitizeEnum(body?.status, FEEDBACK_ALLOWED_STATUSES, null);
    const nextPriority = sanitizeEnum(body?.priority, FEEDBACK_ALLOWED_PRIORITIES, null);
    const adminNote = sanitizeText(body?.note, 12000);

    if (!nextStatus && !nextPriority && !adminNote) {
      return badRequest(origin, 'No update fields provided.');
    }

    if (isAppwriteFeedbackConfigured(env)) {
      const current = await getAppwriteFeedbackReport(env, reportId);
      if (!current) {
        return corsResponse(origin, { error: 'Report not found.' }, { status: 404 });
      }
      const patchPayload = {
        last_activity_at: new Date().toISOString(),
      };
      if (nextStatus) patchPayload.status = nextStatus;
      if (nextPriority) patchPayload.priority = nextPriority;
      if (nextStatus === 'resolved' || nextStatus === 'closed') {
        patchPayload.resolved_at = new Date().toISOString();
        patchPayload.resolved_by = user?.email || null;
      }

      const updated = await updateAppwriteFeedbackReport(env, reportId, patchPayload);
      const activityInserts = [];
      const actorEmail = user?.email || 'unknown';
      const actorName = sanitizeText(user?.name || '', 200);
      if (nextStatus && nextStatus !== current.status) {
        activityInserts.push({
          report_id: reportId,
          actor_email: actorEmail,
          actor_name: actorName,
          kind: 'status_changed',
          message: `Status changed from ${current.status} to ${nextStatus}.`,
          from_status: current.status,
          to_status: nextStatus,
          metadata: {},
        });
      }
      if (nextPriority && nextPriority !== current.priority) {
        activityInserts.push({
          report_id: reportId,
          actor_email: actorEmail,
          actor_name: actorName,
          kind: 'priority_changed',
          message: `Priority changed from ${current.priority} to ${nextPriority}.`,
          from_priority: current.priority,
          to_priority: nextPriority,
          metadata: {},
        });
      }
      if (adminNote) {
        activityInserts.push({
          report_id: reportId,
          actor_email: actorEmail,
          actor_name: actorName,
          kind: 'comment',
          message: adminNote,
          metadata: {},
        });
      }
      if (activityInserts.length > 0) {
        await createAppwriteFeedbackActivity(env, activityInserts);
      }

      return corsResponse(origin, {
        success: true,
        report: updated,
      });
    }

    const currentRows = await supabaseJson(
      env,
      `/rest/v1/feedback_reports?select=id,status,priority&id=eq.${encodeURIComponent(reportId)}&limit=1`
    );
    if (!Array.isArray(currentRows) || currentRows.length === 0) {
      return corsResponse(origin, { error: 'Report not found.' }, { status: 404 });
    }
    const current = currentRows[0];

    const patchPayload = {
      last_activity_at: new Date().toISOString(),
    };
    if (nextStatus) patchPayload.status = nextStatus;
    if (nextPriority) patchPayload.priority = nextPriority;
    if (nextStatus === 'resolved' || nextStatus === 'closed') {
      patchPayload.resolved_at = new Date().toISOString();
      patchPayload.resolved_by = user?.email || null;
    }

    const updatedRows = await supabaseJson(
      env,
      `/rest/v1/feedback_reports?id=eq.${encodeURIComponent(reportId)}&select=id,status,priority,updated_at,last_activity_at,resolved_at,resolved_by`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(patchPayload),
      }
    );

    const activityInserts = [];
    const actorEmail = user?.email || 'unknown';
    const actorName = sanitizeText(user?.name || '', 200);

    if (nextStatus && nextStatus !== current.status) {
      activityInserts.push({
        report_id: reportId,
        actor_email: actorEmail,
        actor_name: actorName,
        kind: 'status_changed',
        message: `Status changed from ${current.status} to ${nextStatus}.`,
        from_status: current.status,
        to_status: nextStatus,
        metadata: {},
      });
    }
    if (nextPriority && nextPriority !== current.priority) {
      activityInserts.push({
        report_id: reportId,
        actor_email: actorEmail,
        actor_name: actorName,
        kind: 'priority_changed',
        message: `Priority changed from ${current.priority} to ${nextPriority}.`,
        from_priority: current.priority,
        to_priority: nextPriority,
        metadata: {},
      });
    }
    if (adminNote) {
      activityInserts.push({
        report_id: reportId,
        actor_email: actorEmail,
        actor_name: actorName,
        kind: 'comment',
        message: adminNote,
        metadata: {},
      });
    }

    if (activityInserts.length > 0) {
      await supabaseJson(env, '/rest/v1/feedback_activity', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(activityInserts),
      });
    }

    return corsResponse(origin, {
      success: true,
      report: Array.isArray(updatedRows) && updatedRows.length > 0 ? updatedRows[0] : null,
    });
  } catch (error) {
    return corsResponse(origin, { error: error.message || 'Failed to update feedback report.' }, { status: 500 });
  }
}

async function handleFeedbackDelete(request, env, reportId, isAdmin) {
  const origin = request.headers.get('Origin') || '';
  if (!isAdmin) return forbidden(origin, 'Admin access required.');

  try {
    if (isAppwriteFeedbackConfigured(env)) {
      const report = await getAppwriteFeedbackReport(env, reportId);
      if (!report) {
        return corsResponse(origin, { error: 'Report not found.' }, { status: 404 });
      }

      await deleteAppwriteFeedbackReport(env, reportId);

      let deletedSnapshotStorage = false;
      if (report.snapshot_storage_path) {
        try {
          await deleteFeedbackSnapshotFromStorage(env, report.snapshot_storage_path);
          deletedSnapshotStorage = true;
        } catch (storageError) {
          console.warn('[feedback] failed to delete snapshot object after report delete', {
            reportId,
            error: String(storageError?.message || storageError || '').slice(0, 500),
          });
        }
      }

      return corsResponse(origin, {
        success: true,
        reportId,
        deletedSnapshotStorage,
      });
    }

    const rows = await supabaseJson(
      env,
      `/rest/v1/feedback_reports?select=id,snapshot_storage_path&id=eq.${encodeURIComponent(reportId)}&limit=1`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return corsResponse(origin, { error: 'Report not found.' }, { status: 404 });
    }

    const report = rows[0];

    await supabaseJson(
      env,
      `/rest/v1/feedback_reports?id=eq.${encodeURIComponent(reportId)}`,
      {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      }
    );

    let deletedSnapshotStorage = false;
    if (report.snapshot_storage_path) {
      try {
        await deleteFeedbackSnapshotFromStorage(env, report.snapshot_storage_path);
        deletedSnapshotStorage = true;
      } catch (storageError) {
        console.warn('[feedback] failed to delete snapshot object after report delete', {
          reportId,
          error: String(storageError?.message || storageError || '').slice(0, 500),
        });
      }
    }

    return corsResponse(origin, {
      success: true,
      reportId,
      deletedSnapshotStorage,
    });
  } catch (error) {
    return corsResponse(origin, { error: error.message || 'Failed to delete feedback report.' }, { status: 500 });
  }
}

async function handleFeedbackActivityCreate(request, env, reportId, isAdmin, user) {
  const origin = request.headers.get('Origin') || '';
  if (!isAdmin) return forbidden(origin, 'Admin access required.');

  try {
    const body = await request.json();
    const message = sanitizeText(body?.message, 12000);
    if (!message) return badRequest(origin, 'Comment message is required.');

    if (isAppwriteFeedbackConfigured(env)) {
      const [activity] = await createAppwriteFeedbackActivity(env, {
        report_id: reportId,
        actor_email: user?.email || 'unknown',
        actor_name: sanitizeText(user?.name || '', 200),
        kind: 'comment',
        message,
        metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      });

      await updateAppwriteFeedbackReport(env, reportId, {
        last_activity_at: new Date().toISOString(),
      });

      return corsResponse(origin, {
        success: true,
        activity: activity || null,
      });
    }

    const rows = await supabaseJson(env, '/rest/v1/feedback_activity?select=id,created_at,actor_email,actor_name,kind,message,metadata', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        report_id: reportId,
        actor_email: user?.email || 'unknown',
        actor_name: sanitizeText(user?.name || '', 200),
        kind: 'comment',
        message,
        metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      }),
    });

    await supabaseJson(
      env,
      `/rest/v1/feedback_reports?id=eq.${encodeURIComponent(reportId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ last_activity_at: new Date().toISOString() }),
      }
    );

    return corsResponse(origin, {
      success: true,
      activity: Array.isArray(rows) && rows.length > 0 ? rows[0] : null,
    });
  } catch (error) {
    return corsResponse(origin, { error: error.message || 'Failed to add feedback activity.' }, { status: 500 });
  }
}

// ─── App Generation Logs API ────────────────────────────────────────────────

async function handleAppLogEventCreate(request, env, user) {
  const origin = request.headers.get('Origin') || '';

  try {
    const body = await request.json();
    const result = await createAppLogEvent(env, user, body);
    return corsResponse(origin, result);
  } catch (error) {
    console.error('[logs] event create failed', {
      message: error?.message || String(error),
    });
    return corsResponse(origin, { error: error.message || 'Failed to write application log.' }, { status: 500 });
  }
}

function sanitizePostgrestSearch(value) {
  const text = sanitizeText(value, 160);
  return text ? text.replace(/[*,()]/g, ' ').replace(/\s+/g, ' ').trim() : null;
}

async function handleAppLogList(request, env, isAdmin) {
  const origin = request.headers.get('Origin') || '';
  if (!isAdmin) return forbidden(origin, 'Admin access required.');

  try {
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get('limit') || 80);
    const offsetRaw = Number(url.searchParams.get('offset') || 0);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(Math.floor(limitRaw), 200)) : 80;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;
    const status = normalizeLogStatus(url.searchParams.get('status'), null);
    const mode = sanitizeText(url.searchParams.get('mode'), 80);
    const provider = sanitizeText(url.searchParams.get('provider'), 120);
    const userEmail = sanitizeText(url.searchParams.get('userEmail'), 320);
    const searchText = sanitizeText(url.searchParams.get('search'), 240);

    if (isAppwriteFeedbackConfigured(env)) {
      const sessions = await listAppwriteGenerationLogs(env, {
        limit,
        offset,
        status,
        mode,
        provider,
        userEmail,
        search: searchText,
      });
      return corsResponse(origin, {
        success: true,
        sessions,
      });
    }

    const search = sanitizePostgrestSearch(searchText);

    const params = new URLSearchParams();
    params.set('select', 'id,trace_id,created_at,started_at,updated_at,completed_at,user_email,user_name,status,mode,provider,model,prompt,prompt_hash,duration_ms,input_summary,output_summary,error_message,metadata');
    params.set('order', 'created_at.desc');
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (status) params.set('status', `eq.${status}`);
    if (mode) params.set('mode', `eq.${mode}`);
    if (provider) params.set('provider', `eq.${provider}`);
    if (userEmail) params.set('user_email', `eq.${userEmail}`);
    if (search) {
      params.set(
        'or',
        `(trace_id.ilike.*${search}*,user_email.ilike.*${search}*,mode.ilike.*${search}*,provider.ilike.*${search}*,model.ilike.*${search}*,prompt.ilike.*${search}*,error_message.ilike.*${search}*)`
      );
    }

    const sessions = await supabaseJson(env, `/rest/v1/app_generation_sessions?${params.toString()}`, {
      headers: { Prefer: 'count=exact' },
    });

    return corsResponse(origin, {
      success: true,
      sessions: Array.isArray(sessions) ? sessions : [],
    });
  } catch (error) {
    return corsResponse(origin, { error: error.message || 'Failed to load application logs.' }, { status: 500 });
  }
}

async function handleAppLogDetail(request, env, identifier, isAdmin) {
  const origin = request.headers.get('Origin') || '';
  if (!isAdmin) return forbidden(origin, 'Admin access required.');

  try {
    if (isAppwriteFeedbackConfigured(env)) {
      const detail = await getAppwriteGenerationLogDetail(env, identifier);
      if (!detail) {
        return corsResponse(origin, { error: 'Log session not found.' }, { status: 404 });
      }
      return corsResponse(origin, {
        success: true,
        session: detail.session,
        events: detail.events,
      });
    }

    const isUuid = /^[0-9a-fA-F-]{36}$/.test(identifier);
    const filter = isUuid
      ? `or=(id.eq.${encodeURIComponent(identifier)},trace_id.eq.${encodeURIComponent(identifier)})`
      : `trace_id=eq.${encodeURIComponent(identifier)}`;
    const sessions = await supabaseJson(
      env,
      `/rest/v1/app_generation_sessions?select=id,trace_id,created_at,started_at,updated_at,completed_at,user_email,user_name,status,mode,provider,model,prompt,prompt_hash,duration_ms,input_summary,output_summary,error_message,metadata&${filter}&limit=1`
    );

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return corsResponse(origin, { error: 'Log session not found.' }, { status: 404 });
    }

    const session = sessions[0];
    const events = await supabaseJson(
      env,
      `/rest/v1/app_request_logs?select=id,created_at,trace_id,generation_id,user_email,user_name,event_type,provider,model,action,method,path,status_code,duration_ms,prompt,prompt_hash,request_summary,response_summary,error_message,metadata&trace_id=eq.${encodeURIComponent(session.trace_id)}&order=created_at.asc&limit=500`
    );

    return corsResponse(origin, {
      success: true,
      session,
      events: Array.isArray(events) ? events : [],
    });
  } catch (error) {
    return corsResponse(origin, { error: error.message || 'Failed to load application log detail.' }, { status: 500 });
  }
}

async function handleAppwriteFeedbackSetup(request, env) {
  const origin = request.headers.get('Origin') || '';
  const setupToken = env.APPWRITE_SETUP_TOKEN;
  if (!setupToken) {
    return corsResponse(origin, { error: 'Appwrite setup route is disabled.' }, { status: 404 });
  }

  const providedToken = request.headers.get('X-Appwrite-Setup-Token') || request.headers.get('X-Setup-Token') || '';
  if (providedToken !== setupToken) {
    return forbidden(origin, 'Invalid setup token.');
  }

  if (!isAppwriteFeedbackConfigured(env)) {
    return corsResponse(origin, { error: 'Appwrite feedback is not configured.' }, { status: 500 });
  }

  const startedAt = Date.now();
  try {
    const url = new URL(request.url);
    const phase = url.searchParams.get('phase') || 'all';
    const start = Number(url.searchParams.get('start') || 0);
    const limit = Number(url.searchParams.get('limit') || 0);
    const setupEnv = {
      ...env,
      APPWRITE_ENDPOINT: url.searchParams.get('endpoint') || env.APPWRITE_ENDPOINT,
      APPWRITE_PROJECT_ID: url.searchParams.get('projectId') || env.APPWRITE_PROJECT_ID,
    };
    const result = await setupAppwriteFeedbackResources(setupEnv, phase, {
      start,
      limit,
    });
    return corsResponse(origin, {
      success: true,
      phase,
      durationMs: Date.now() - startedAt,
      ...result,
    });
  } catch (error) {
    console.error('[feedback] Appwrite setup failed', {
      message: error?.message || String(error),
    });
    return corsResponse(origin, { error: error.message || 'Appwrite setup failed.' }, { status: 500 });
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') return handleOptions(request);

    // Payload size check for POST requests
    if (request.method === 'POST') {
      const cl = parseInt(request.headers.get('Content-Length') || '0', 10);
      if (cl > MAX_PAYLOAD_BYTES) {
        return corsResponse(origin, { error: 'Payload too large' }, { status: 413 });
      }
    }

    // ── Public routes (no JWT required) ──
    if (path === '/auth/verify' && request.method === 'POST') {
      return handleAuthVerify(request, env);
    }

    // Health check
    if (path === '/health') {
      return corsResponse(origin, { status: 'ok', timestamp: new Date().toISOString() });
    }

    if (path === '/internal/appwrite/setup' && request.method === 'POST') {
      return handleAppwriteFeedbackSetup(request, env);
    }

    // Vertex AI diagnostics (no auth required for easy testing)
    if (path === '/health/vertex' && request.method === 'GET') {
      return handleVertexDiag(request, env);
    }
    if (path === '/health/vertex/poll' && request.method === 'GET') {
      return handleVertexPoll(request, env);
    }

    // ── Protected routes (JWT required) ──
    const user = await authenticateRequest(request, env);
    if (!user) return unauthorized(origin);

    const isFeedbackRoute = path.startsWith('/api/feedback/');
    const isAppLogRoute = path.startsWith('/api/logs/');
    const needsFeedbackAdmin =
      (isFeedbackRoute && !(path === '/api/feedback/reports' && request.method === 'POST')) ||
      (isAppLogRoute && !(path === '/api/logs/events' && request.method === 'POST'));
    let feedbackAdmin = false;
    if (needsFeedbackAdmin) {
      feedbackAdmin = await isFeedbackAdmin(env, user.email);
    }

    if (path === '/api/feedback/reports' && request.method === 'POST') {
      return handleFeedbackCreate(request, env, user);
    }
    if (path === '/api/feedback/reports' && request.method === 'GET') {
      return handleFeedbackList(request, env, user, feedbackAdmin);
    }

    const feedbackReportSnapshotMatch = path.match(/^\/api\/feedback\/reports\/([0-9a-fA-F-]{36})\/snapshot$/);
    if (feedbackReportSnapshotMatch && request.method === 'GET') {
      return handleFeedbackSnapshot(request, env, feedbackReportSnapshotMatch[1], feedbackAdmin);
    }

    const feedbackReportActivityMatch = path.match(/^\/api\/feedback\/reports\/([0-9a-fA-F-]{36})\/activity$/);
    if (feedbackReportActivityMatch && request.method === 'POST') {
      return handleFeedbackActivityCreate(request, env, feedbackReportActivityMatch[1], feedbackAdmin, user);
    }

    const feedbackReportMatch = path.match(/^\/api\/feedback\/reports\/([0-9a-fA-F-]{36})$/);
    if (feedbackReportMatch && request.method === 'GET') {
      return handleFeedbackDetail(request, env, feedbackReportMatch[1], feedbackAdmin, user);
    }
    if (feedbackReportMatch && request.method === 'PATCH') {
      return handleFeedbackUpdate(request, env, feedbackReportMatch[1], feedbackAdmin, user);
    }
    if (feedbackReportMatch && request.method === 'DELETE') {
      return handleFeedbackDelete(request, env, feedbackReportMatch[1], feedbackAdmin);
    }

    if (path === '/api/logs/events' && request.method === 'POST') {
      return handleAppLogEventCreate(request, env, user);
    }
    if (path === '/api/logs/generations' && request.method === 'GET') {
      return handleAppLogList(request, env, feedbackAdmin);
    }
    const appLogGenerationMatch = path.match(/^\/api\/logs\/generations\/([^/]+)$/);
    if (appLogGenerationMatch && request.method === 'GET') {
      return handleAppLogDetail(request, env, appLogGenerationMatch[1], feedbackAdmin);
    }

    // Gemini passthrough: /api/gemini/{anything}
    if (path.startsWith('/api/gemini/')) {
      const subpath = path.replace('/api/gemini/', '') + url.search;
      return withLoggedGatewayRequest(
        request,
        env,
        ctx,
        user,
        { provider: 'gemini', action: subpath.split(':')[1]?.split('?')[0] || 'request', route: '/api/gemini/*' },
        () => handleGeminiProxy(request, env, subpath)
      );
    }

    // OpenAI Image API
    if (path === '/api/openai/images' && request.method === 'POST') {
      return withLoggedGatewayRequest(
        request,
        env,
        ctx,
        user,
        { provider: 'openai', model: OPENAI_IMAGE_MODEL, action: 'images', route: '/api/openai/images' },
        () => handleOpenAIImages(request, env)
      );
    }

    if (path === '/api/image-edits' && request.method === 'POST') {
      return withLoggedGatewayRequest(
        request,
        env,
        ctx,
        user,
        { provider: 'openai', model: OPENAI_IMAGE_MODEL, action: 'image-edit', route: '/api/image-edits' },
        () => handleImageEdit(request, env, user)
      );
    }

    // Veo video generation
    if (path === '/api/veo/generate' && request.method === 'POST') {
      return withLoggedGatewayRequest(request, env, ctx, user, { provider: 'veo', action: 'generate', route: '/api/veo/generate' }, () => handleVeoGenerate(request, env));
    }
    if (path === '/api/veo/status' && request.method === 'GET') {
      return withLoggedGatewayRequest(request, env, ctx, user, { provider: 'veo', action: 'status', route: '/api/veo/status' }, () => handleVeoStatus(request, env));
    }
    if (path === '/api/veo/download' && request.method === 'GET') {
      return withLoggedGatewayRequest(request, env, ctx, user, { provider: 'veo', action: 'download', route: '/api/veo/download' }, () => handleVeoDownload(request, env));
    }
    if (path === '/api/veo/video' && request.method === 'GET') {
      return withLoggedGatewayRequest(request, env, ctx, user, { provider: 'veo', action: 'video', route: '/api/veo/video' }, () => handleVeoVideo(request, env));
    }

    // Kling video generation
    if (path === '/api/kling/generate' && request.method === 'POST') {
      return withLoggedGatewayRequest(request, env, ctx, user, { provider: 'kling', action: 'generate', route: '/api/kling/generate' }, () => handleKlingGenerate(request, env));
    }
    if (path === '/api/kling/status' && request.method === 'GET') {
      return withLoggedGatewayRequest(request, env, ctx, user, { provider: 'kling', action: 'status', route: '/api/kling/status' }, () => handleKlingStatus(request, env));
    }

    // ConvertAPI
    if (path === '/api/convert/pdf-to-docx' && request.method === 'POST') {
      return withLoggedGatewayRequest(request, env, ctx, user, { provider: 'convertapi', action: 'pdf-to-docx', route: '/api/convert/pdf-to-docx' }, () => handleConvertApi(request, env, 'pdf', 'docx'));
    }
    if (path === '/api/convert/docx-to-pdf' && request.method === 'POST') {
      return withLoggedGatewayRequest(request, env, ctx, user, { provider: 'convertapi', action: 'docx-to-pdf', route: '/api/convert/docx-to-pdf' }, () => handleConvertApi(request, env, 'docx', 'pdf'));
    }

    // iLovePDF multi-step proxy
    if (path.startsWith('/api/ilovepdf/')) {
      const subpath = path.replace('/api/ilovepdf/', '');
      return withLoggedGatewayRequest(request, env, ctx, user, { provider: 'ilovepdf', action: subpath, route: '/api/ilovepdf/*' }, () => handleILovePdfProxy(request, env, subpath));
    }

    // URL fetch proxy (material validation link fetching)
    if (path === '/api/fetch-url' && request.method === 'GET') {
      return withLoggedGatewayRequest(request, env, ctx, user, { provider: 'url-fetch', action: 'fetch-url', route: '/api/fetch-url' }, () => handleFetchUrl(request, env));
    }

    return corsResponse(origin, { error: 'Not found' }, { status: 404 });
  },
};
