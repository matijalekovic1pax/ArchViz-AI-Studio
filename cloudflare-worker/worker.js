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
 *   GEMINI_API_KEY, VERTEX_AI_TOKEN, GOOGLE_PROJECT_ID,
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
const JWT_EXPIRY_SECONDS = 3600; // 1 hour

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
      prompt, image, durationSeconds = 8, aspectRatio = '16:9',
      resolution = '1080p', generateAudio = false,
      personGeneration = 'allow_adult', seed, numberOfVideos,
      useVertexAi = false,
    } = body;

    // Build instances
    const instance = { prompt };
    if (image?.bytesBase64Encoded && image?.mimeType) {
      instance.image = { bytesBase64Encoded: image.bytesBase64Encoded, mimeType: image.mimeType };
    }

    const parameters = { durationSeconds, aspectRatio, resolution, personGeneration };
    if (seed !== undefined) parameters.seed = seed;

    let endpoint, reqHeaders;

    if (useVertexAi && env.VERTEX_AI_TOKEN && env.GOOGLE_PROJECT_ID) {
      // Vertex AI approach
      parameters.generateAudio = generateAudio;
      if (numberOfVideos) parameters.sampleCount = numberOfVideos;
      endpoint = `${VERTEX_AI_BASE}/projects/${env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/veo-3.1-generate-preview:predictLongRunning`;
      reqHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.VERTEX_AI_TOKEN}`,
        'x-goog-user-project': env.GOOGLE_PROJECT_ID,
      };
    } else {
      // Gemini API approach (recommended)
      if (numberOfVideos) parameters.numberOfVideos = numberOfVideos;
      endpoint = `${GEMINI_API_BASE}/models/veo-3.1-generate-preview:predictLongRunning`;
      reqHeaders = {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      };
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
    if (!data.name) {
      return corsResponse(origin, { status: 'error', error: 'No operation name returned' }, { status: 500 });
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
    if (useVertexAi) {
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

/** Check Vertex AI operation (legacy) */
async function checkVeoVertexOperation(operationName, env) {
  try {
    const projectMatch = operationName.match(/projects\/([^/]+)/);
    const locationMatch = operationName.match(/locations\/([^/]+)/);
    const modelMatch = operationName.match(/models\/([^/]+)/);
    if (!projectMatch || !locationMatch || !modelMatch) {
      return { status: 'error', error: 'Could not parse operation name' };
    }
    const fetchUrl = `${VERTEX_AI_BASE}/projects/${projectMatch[1]}/locations/${locationMatch[1]}/publishers/google/models/${modelMatch[1]}:fetchPredictOperation`;
    const resp = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.VERTEX_AI_TOKEN}`,
        'x-goog-user-project': env.GOOGLE_PROJECT_ID,
      },
      body: JSON.stringify({ operationName }),
    });
    if (!resp.ok) return { status: 'error', error: `API returned ${resp.status}` };
    const data = await resp.json();
    if (data.done) {
      if (data.error) return { status: 'error', error: data.error.message || 'Failed' };
      const videoUrl = extractVertexVideoUrl(data.response);
      if (videoUrl) return { status: 'complete', videoUrl, expiresAt: new Date(Date.now() + 2 * 86400000).toISOString() };
      return { status: 'error', error: 'No video URL found' };
    }
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
  if (response?.predictions?.[0]) {
    const p = response.predictions[0];
    return p.videoUrl || p.videoUri || p.video_url || p.video?.url || p.video?.uri || null;
  }
  if (response?.video?.url || response?.videoUrl) return response.video?.url || response.videoUrl;
  return null;
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
    const resp = await fetch(statusUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
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

    const resp = await fetch(`${CONVERTAPI_BASE}/convert/pdf/to/docx?Secret=${env.CONVERTAPI_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Parameters: [{ Name: 'File', FileValue: { Name: fileName || 'document.pdf', Data: fileData } }],
      }),
    });

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
      const resp = await fetch(`${ILOVEPDF_BASE}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_key: env.ILOVEPDF_PUBLIC_KEY }),
      });
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

      const resp = await fetch(`${ILOVEPDF_BASE}/start/${tool}`, {
        headers: { 'Authorization': `Bearer ${iToken}` },
      });
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

      const resp = await fetch(`https://${server}/v1/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ilovepdfToken}` },
        body: formData,
      });
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

      const resp = await fetch(`https://${server}/v1/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ilovepdfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processPayload),
      });
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

      const resp = await fetch(`https://${server}/v1/download/${taskId}`, {
        headers: { 'Authorization': `Bearer ${iToken}` },
      });
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

    return corsResponse(origin, { error: 'Not found' }, { status: 404 });
  },
};

