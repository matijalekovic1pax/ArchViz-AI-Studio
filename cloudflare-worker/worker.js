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
 *   GEMINI_API_KEY, GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_PROJECT_ID,
 *   KLING_PIAPI_API_KEY, KLING_ULAZAI_API_KEY, KLING_WAVESPEEDAI_API_KEY,
 *   CONVERTAPI_SECRET, ILOVEPDF_PUBLIC_KEY
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://arch-viz-ai-studio.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

const MAX_PAYLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
const JWT_EXPIRY_SECONDS = 7200; // 2 hours

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

async function handleGeminiProxy(request, env, subpath) {
  const origin = request.headers.get('Origin') || '';
  const url = `${GEMINI_API_BASE}/${subpath}`;

  const headers = new Headers();
  headers.set('x-goog-api-key', env.GEMINI_API_KEY);

  // Forward content-type
  const ct = request.headers.get('Content-Type');
  if (ct) headers.set('Content-Type', ct);

  const upstreamResp = await fetch(url, {
    method: request.method,
    headers,
    body: request.method !== 'GET' ? request.body : undefined,
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
    //  - Frame interpolation (firstImage + lastImage) → needs veo-2-generate-preview
    //  - Single image animate → veo-3.1-generate-preview on Vertex AI
    //  - Caller explicitly requests Vertex AI
    const useVertex = (hasInterpolation || hasImage || useVertexAi) && hasVertexCreds;

    // Use Veo 3.1 for all modes (veo-2-generate-preview requires separate project access)
    const vertexModel = 'veo-3.1-generate-preview';

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

// ─── Route: POST /api/convert/pdf-to-docx ───────────────────────────────────

async function handleConvertApi(request, env) {
  const origin = request.headers.get('Origin') || '';
  try {
    const body = await request.json();
    const { fileName, fileData } = body;

    if (!fileData) return corsResponse(origin, { error: 'Missing fileData (base64)' }, { status: 400 });

    const convertBody = JSON.stringify({
      Parameters: [{ Name: 'File', FileValue: { Name: fileName || 'document.pdf', Data: fileData } }],
    });
    const resp = await fetchWithRetry(
      (signal) => fetch(`${CONVERTAPI_BASE}/convert/pdf/to/docx?Secret=${env.CONVERTAPI_SECRET}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: convertBody,
        signal,
      }),
      { maxRetries: 2, timeoutMs: 60000, label: 'ConvertAPI' },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return corsResponse(origin, { error: `ConvertAPI error (${resp.status}): ${errText}` }, { status: resp.status });
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
    const fetchUrl = `${VERTEX_AI_BASE}/projects/${env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/veo-3.1-generate-preview:fetchPredictOperation`;
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
  const modelToProbe = new URL(request.url).searchParams.get('model') || 'veo-3.1-generate-preview';
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
        const fetchUrl = `${VERTEX_AI_BASE}/projects/${env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/veo-3.1-generate-preview:fetchPredictOperation`;
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

    // Gemini passthrough: /api/gemini/{anything}
    if (path.startsWith('/api/gemini/')) {
      const subpath = path.replace('/api/gemini/', '') + url.search;
      return handleGeminiProxy(request, env, subpath);
    }

    // Veo video generation
    if (path === '/api/veo/generate' && request.method === 'POST') return handleVeoGenerate(request, env);
    if (path === '/api/veo/status' && request.method === 'GET') return handleVeoStatus(request, env);
    if (path === '/api/veo/download' && request.method === 'GET') return handleVeoDownload(request, env);
    if (path === '/api/veo/video' && request.method === 'GET') return handleVeoVideo(request, env);

    // Kling video generation
    if (path === '/api/kling/generate' && request.method === 'POST') return handleKlingGenerate(request, env);
    if (path === '/api/kling/status' && request.method === 'GET') return handleKlingStatus(request, env);

    // ConvertAPI
    if (path === '/api/convert/pdf-to-docx' && request.method === 'POST') return handleConvertApi(request, env);

    // iLovePDF multi-step proxy
    if (path.startsWith('/api/ilovepdf/')) {
      const subpath = path.replace('/api/ilovepdf/', '');
      return handleILovePdfProxy(request, env, subpath);
    }

    // URL fetch proxy (material validation link fetching)
    if (path === '/api/fetch-url' && request.method === 'GET') return handleFetchUrl(request, env);

    return corsResponse(origin, { error: 'Not found' }, { status: 404 });
  },
};

