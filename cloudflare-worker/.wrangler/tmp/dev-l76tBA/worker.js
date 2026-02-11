var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-RGYhRm/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// worker.js
var ALLOWED_ORIGINS = [
  "https://arch-viz-ai-studio.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173"
];
var MAX_PAYLOAD_BYTES = 25 * 1024 * 1024;
var JWT_EXPIRY_SECONDS = 7200;
var GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
var VERTEX_AI_BASE = "https://us-central1-aiplatform.googleapis.com/v1";
var CONVERTAPI_BASE = "https://v2.convertapi.com";
var ILOVEPDF_BASE = "https://api.ilovepdf.com/v1";
var KLING_ENDPOINTS = {
  piapi: { base: "https://api.piapi.ai/api/kling/v1" },
  ulazai: { base: "https://api.ulazai.com/v1/kling" },
  wavespeedai: { base: "https://api.wavespeed.ai/v1/kling" }
};
var QUICK_POLL_ATTEMPTS = 3;
var POLL_INTERVAL_MS = 2e3;
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(sleep, "sleep");
async function fetchWithRetry(fn, options = {}) {
  const { maxRetries = 2, timeoutMs = 3e4, label = "request" } = options;
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
        const delay = Math.min(1e3 * Math.pow(2, attempt), 8e3);
        await sleep(delay);
      }
    }
  }
  throw lastError || new Error(`${label} failed after ${maxRetries + 1} attempts`);
}
__name(fetchWithRetry, "fetchWithRetry");
function base64UrlEncode(data) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(base64UrlDecode, "base64UrlDecode");
function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}
__name(getCorsHeaders, "getCorsHeaders");
function corsResponse(origin, body, init = {}) {
  const headers = { ...getCorsHeaders(origin), "Content-Type": "application/json", ...init.headers || {} };
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { ...init, headers });
}
__name(corsResponse, "corsResponse");
function handleOptions(request) {
  const origin = request.headers.get("Origin") || "";
  return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
}
__name(handleOptions, "handleOptions");
async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
__name(importHmacKey, "importHmacKey");
async function signJwt(payload, secret) {
  const key = await importHmacKey(secret);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${base64UrlEncode(sig)}`;
}
__name(signJwt, "signJwt");
async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const key = await importHmacKey(secret);
  const data = `${parts[0]}.${parts[1]}`;
  const sig = base64UrlDecode(parts[2]);
  const valid = await crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(data));
  if (!valid) throw new Error("Invalid JWT signature");
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) throw new Error("JWT expired");
  return payload;
}
__name(verifyJwt, "verifyJwt");
var cachedGoogleKeys = null;
var googleKeysFetchedAt = 0;
var GOOGLE_KEYS_TTL_MS = 36e5;
async function getGooglePublicKeys() {
  if (cachedGoogleKeys && Date.now() - googleKeysFetchedAt < GOOGLE_KEYS_TTL_MS) {
    return cachedGoogleKeys;
  }
  const resp = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!resp.ok) throw new Error("Failed to fetch Google public keys");
  const jwks = await resp.json();
  cachedGoogleKeys = jwks.keys;
  googleKeysFetchedAt = Date.now();
  return cachedGoogleKeys;
}
__name(getGooglePublicKeys, "getGooglePublicKeys");
async function verifyGoogleIdToken(idToken, clientId, allowedDomain) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid ID token format");
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  const keys = await getGooglePublicKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("No matching Google key found for kid: " + header.kid);
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const sig = base64UrlDecode(parts[2]);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, data);
  if (!valid) throw new Error("Invalid Google ID token signature");
  const now = Math.floor(Date.now() / 1e3);
  if (payload.exp < now) throw new Error("ID token expired");
  if (payload.aud !== clientId) throw new Error("ID token audience mismatch");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) {
    throw new Error("ID token issuer mismatch");
  }
  if (allowedDomain && payload.hd !== allowedDomain) {
    throw new Error(`Domain ${payload.hd} not allowed. Expected: ${allowedDomain}`);
  }
  if (!payload.email_verified) throw new Error("Email not verified");
  return payload;
}
__name(verifyGoogleIdToken, "verifyGoogleIdToken");
async function authenticateRequest(request, env) {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  try {
    return await verifyJwt(auth.slice(7), env.JWT_SECRET);
  } catch {
    return null;
  }
}
__name(authenticateRequest, "authenticateRequest");
function unauthorized(origin, message = "Unauthorized") {
  return corsResponse(origin, { error: message }, { status: 401 });
}
__name(unauthorized, "unauthorized");
async function handleAuthVerify(request, env) {
  const origin = request.headers.get("Origin") || "";
  try {
    const { idToken } = await request.json();
    if (!idToken) return corsResponse(origin, { error: "Missing idToken" }, { status: 400 });
    const googlePayload = await verifyGoogleIdToken(idToken, env.GOOGLE_CLIENT_ID, env.ALLOWED_DOMAIN);
    const now = Math.floor(Date.now() / 1e3);
    const jwt = await signJwt({
      sub: googlePayload.sub,
      email: googlePayload.email,
      name: googlePayload.name,
      picture: googlePayload.picture,
      hd: googlePayload.hd,
      iat: now,
      exp: now + JWT_EXPIRY_SECONDS
    }, env.JWT_SECRET);
    return corsResponse(origin, {
      token: jwt,
      expiresIn: JWT_EXPIRY_SECONDS,
      user: {
        email: googlePayload.email,
        name: googlePayload.name,
        picture: googlePayload.picture,
        domain: googlePayload.hd
      }
    });
  } catch (err) {
    return corsResponse(origin, { error: "Authentication failed: " + err.message }, { status: 401 });
  }
}
__name(handleAuthVerify, "handleAuthVerify");
async function handleGeminiProxy(request, env, subpath) {
  const origin = request.headers.get("Origin") || "";
  const url = `${GEMINI_API_BASE}/${subpath}`;
  const headers = new Headers();
  headers.set("x-goog-api-key", env.GEMINI_API_KEY);
  const ct = request.headers.get("Content-Type");
  if (ct) headers.set("Content-Type", ct);
  const upstreamResp = await fetch(url, {
    method: request.method,
    headers,
    body: request.method !== "GET" ? request.body : void 0
  });
  const respHeaders = { ...getCorsHeaders(origin) };
  const upstreamCt = upstreamResp.headers.get("Content-Type");
  if (upstreamCt) respHeaders["Content-Type"] = upstreamCt;
  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: respHeaders
  });
}
__name(handleGeminiProxy, "handleGeminiProxy");
async function handleVeoGenerate(request, env) {
  const origin = request.headers.get("Origin") || "";
  try {
    const body = await request.json();
    const {
      prompt,
      image,
      durationSeconds = 8,
      aspectRatio = "16:9",
      resolution = "1080p",
      generateAudio = false,
      personGeneration = "allow_adult",
      seed,
      numberOfVideos,
      useVertexAi = false
    } = body;
    const instance = { prompt };
    if (image?.bytesBase64Encoded && image?.mimeType) {
      instance.image = { bytesBase64Encoded: image.bytesBase64Encoded, mimeType: image.mimeType };
    }
    const parameters = { durationSeconds, aspectRatio, resolution, personGeneration };
    if (seed !== void 0) parameters.seed = seed;
    let endpoint, reqHeaders;
    if (useVertexAi && env.VERTEX_AI_TOKEN && env.GOOGLE_PROJECT_ID) {
      parameters.generateAudio = generateAudio;
      if (numberOfVideos) parameters.sampleCount = numberOfVideos;
      endpoint = `${VERTEX_AI_BASE}/projects/${env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/veo-3.1-generate-preview:predictLongRunning`;
      reqHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.VERTEX_AI_TOKEN}`,
        "x-goog-user-project": env.GOOGLE_PROJECT_ID
      };
    } else {
      if (numberOfVideos) parameters.numberOfVideos = numberOfVideos;
      endpoint = `${GEMINI_API_BASE}/models/veo-3.1-generate-preview:predictLongRunning`;
      reqHeaders = {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY
      };
    }
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify({ instances: [instance], parameters })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      let msg = `API error (${resp.status})`;
      try {
        msg = JSON.parse(errText).error?.message || msg;
      } catch {
      }
      return corsResponse(origin, { status: "error", error: msg }, { status: resp.status });
    }
    const data = await resp.json();
    if (!data.name) {
      return corsResponse(origin, { status: "error", error: "No operation name returned" }, { status: 500 });
    }
    const token = useVertexAi ? env.VERTEX_AI_TOKEN : null;
    const projectId = useVertexAi ? env.GOOGLE_PROJECT_ID : null;
    for (let i = 0; i < QUICK_POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const result = await checkVeoOperation(data.name, env, useVertexAi);
      if (result.status === "complete" || result.status === "error") {
        return corsResponse(origin, result);
      }
    }
    return corsResponse(origin, {
      status: "processing",
      operationName: data.name,
      message: "Video generation in progress. Poll /api/veo/status for updates."
    });
  } catch (err) {
    return corsResponse(origin, { status: "error", error: err.message }, { status: 500 });
  }
}
__name(handleVeoGenerate, "handleVeoGenerate");
async function handleVeoStatus(request, env) {
  const origin = request.headers.get("Origin") || "";
  const url = new URL(request.url);
  const operationName = url.searchParams.get("operation");
  const useVertexAi = url.searchParams.get("useVertexAi") === "true";
  if (!operationName) {
    return corsResponse(origin, { error: "Missing operation parameter" }, { status: 400 });
  }
  const result = await checkVeoOperation(operationName, env, useVertexAi);
  return corsResponse(origin, result);
}
__name(handleVeoStatus, "handleVeoStatus");
async function checkVeoOperation(operationName, env, useVertexAi) {
  try {
    if (useVertexAi) {
      return await checkVeoVertexOperation(operationName, env);
    }
    const resp = await fetch(`${GEMINI_API_BASE}/${operationName}`, {
      headers: { "x-goog-api-key": env.GEMINI_API_KEY }
    });
    if (!resp.ok) {
      return { status: "error", error: `Status check failed (${resp.status})` };
    }
    const data = await resp.json();
    if (data.done) {
      if (data.error) return { status: "error", error: data.error.message || "Operation failed" };
      const videoUrl = extractGeminiVideoUrl(data.response);
      if (videoUrl) {
        return { status: "complete", videoUrl, expiresAt: new Date(Date.now() + 2 * 864e5).toISOString() };
      }
      return { status: "error", error: "No video URL in completed response" };
    }
    return { status: "processing", operationName };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}
__name(checkVeoOperation, "checkVeoOperation");
async function checkVeoVertexOperation(operationName, env) {
  try {
    const projectMatch = operationName.match(/projects\/([^/]+)/);
    const locationMatch = operationName.match(/locations\/([^/]+)/);
    const modelMatch = operationName.match(/models\/([^/]+)/);
    if (!projectMatch || !locationMatch || !modelMatch) {
      return { status: "error", error: "Could not parse operation name" };
    }
    const fetchUrl = `${VERTEX_AI_BASE}/projects/${projectMatch[1]}/locations/${locationMatch[1]}/publishers/google/models/${modelMatch[1]}:fetchPredictOperation`;
    const resp = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.VERTEX_AI_TOKEN}`,
        "x-goog-user-project": env.GOOGLE_PROJECT_ID
      },
      body: JSON.stringify({ operationName })
    });
    if (!resp.ok) return { status: "error", error: `API returned ${resp.status}` };
    const data = await resp.json();
    if (data.done) {
      if (data.error) return { status: "error", error: data.error.message || "Failed" };
      const videoUrl = extractVertexVideoUrl(data.response);
      if (videoUrl) return { status: "complete", videoUrl, expiresAt: new Date(Date.now() + 2 * 864e5).toISOString() };
      return { status: "error", error: "No video URL found" };
    }
    return { status: "processing", operationName };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}
__name(checkVeoVertexOperation, "checkVeoVertexOperation");
function extractGeminiVideoUrl(response) {
  try {
    const samples = response?.generateVideoResponse?.generatedSamples;
    if (samples?.[0]?.video?.uri) return samples[0].video.uri;
  } catch {
  }
  return null;
}
__name(extractGeminiVideoUrl, "extractGeminiVideoUrl");
function extractVertexVideoUrl(response) {
  if (response?.predictions?.[0]) {
    const p = response.predictions[0];
    return p.videoUrl || p.videoUri || p.video_url || p.video?.url || p.video?.uri || null;
  }
  if (response?.video?.url || response?.videoUrl) return response.video?.url || response.videoUrl;
  return null;
}
__name(extractVertexVideoUrl, "extractVertexVideoUrl");
async function handleKlingGenerate(request, env) {
  const origin = request.headers.get("Origin") || "";
  try {
    const body = await request.json();
    const { provider = "piapi", ...params } = body;
    const endpoint = KLING_ENDPOINTS[provider];
    if (!endpoint) return corsResponse(origin, { error: `Unknown Kling provider: ${provider}` }, { status: 400 });
    const keyMap = { piapi: env.KLING_PIAPI_API_KEY, ulazai: env.KLING_ULAZAI_API_KEY, wavespeedai: env.KLING_WAVESPEEDAI_API_KEY };
    const apiKey = keyMap[provider];
    if (!apiKey) return corsResponse(origin, { error: `No API key configured for provider: ${provider}` }, { status: 500 });
    let url, payload;
    if (provider === "piapi") {
      url = `${endpoint.base}/video/generation`;
      payload = buildPiApiPayload(params);
    } else if (provider === "ulazai") {
      url = `${endpoint.base}/video/generate`;
      payload = buildUlazAiPayload(params);
    } else {
      url = `${endpoint.base}/generate`;
      payload = buildWaveSpeedPayload(params);
    }
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
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
__name(handleKlingGenerate, "handleKlingGenerate");
function buildPiApiPayload(p) {
  const payload = {
    model: "kling-v1-5",
    prompt: p.prompt,
    duration: p.duration || 5,
    aspect_ratio: p.aspectRatio || "16:9",
    mode: p.inputImage ? "image2video" : "text2video"
  };
  if (p.inputImage) payload.image_url = p.inputImage;
  if (p.camera) {
    payload.camera_control = {
      type: p.camera.type,
      speed: p.camera.speed || "normal",
      direction: p.camera.direction || 0,
      smoothness: (p.camera.smoothness || 50) / 100
    };
  }
  return payload;
}
__name(buildPiApiPayload, "buildPiApiPayload");
function buildUlazAiPayload(p) {
  const payload = {
    text: p.prompt,
    duration: (p.duration || 5) + "s",
    ratio: p.aspectRatio || "16:9",
    mode: p.inputImage ? "img2video" : "txt2video",
    quality: p.quality || "standard"
  };
  if (p.inputImage) payload.image = p.inputImage;
  if (p.camera) {
    payload.camera_movement = {
      type: p.camera.type,
      strength: (p.camera.smoothness || 50) / 100,
      angle: p.camera.direction || 0
    };
  }
  return payload;
}
__name(buildUlazAiPayload, "buildUlazAiPayload");
function buildWaveSpeedPayload(p) {
  const payload = {
    prompt: p.prompt,
    video_length: p.duration || 5,
    aspect_ratio: p.aspectRatio || "16:9"
  };
  if (p.inputImage) payload.image = p.inputImage;
  if (p.seed !== void 0) payload.seed = p.seed;
  if (p.camera) {
    payload.camera = {
      motion: p.camera.type,
      direction: p.camera.direction || 0,
      speed: p.camera.speed || "normal",
      smoothness: p.camera.smoothness || 50
    };
  }
  return payload;
}
__name(buildWaveSpeedPayload, "buildWaveSpeedPayload");
async function handleKlingStatus(request, env) {
  const origin = request.headers.get("Origin") || "";
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId");
  const provider = url.searchParams.get("provider") || "piapi";
  if (!taskId) return corsResponse(origin, { error: "Missing taskId" }, { status: 400 });
  const endpoint = KLING_ENDPOINTS[provider];
  if (!endpoint) return corsResponse(origin, { error: `Unknown provider: ${provider}` }, { status: 400 });
  const keyMap = { piapi: env.KLING_PIAPI_API_KEY, ulazai: env.KLING_ULAZAI_API_KEY, wavespeedai: env.KLING_WAVESPEEDAI_API_KEY };
  const apiKey = keyMap[provider];
  let statusUrl;
  if (provider === "piapi") statusUrl = `${endpoint.base}/video/${taskId}`;
  else if (provider === "ulazai") statusUrl = `${endpoint.base}/video/status/${taskId}`;
  else statusUrl = `${endpoint.base}/status/${taskId}`;
  try {
    const resp = await fetchWithRetry(
      (signal) => fetch(statusUrl, {
        headers: { "Authorization": `Bearer ${apiKey}` },
        signal
      }),
      { maxRetries: 2, timeoutMs: 15e3, label: "Kling status" }
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
__name(handleKlingStatus, "handleKlingStatus");
async function handleConvertApi(request, env) {
  const origin = request.headers.get("Origin") || "";
  try {
    const body = await request.json();
    const { fileName, fileData } = body;
    if (!fileData) return corsResponse(origin, { error: "Missing fileData (base64)" }, { status: 400 });
    const convertBody = JSON.stringify({
      Parameters: [{ Name: "File", FileValue: { Name: fileName || "document.pdf", Data: fileData } }]
    });
    const resp = await fetchWithRetry(
      (signal) => fetch(`${CONVERTAPI_BASE}/convert/pdf/to/docx?Secret=${env.CONVERTAPI_SECRET}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: convertBody,
        signal
      }),
      { maxRetries: 2, timeoutMs: 6e4, label: "ConvertAPI" }
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
__name(handleConvertApi, "handleConvertApi");
async function handleILovePdfProxy(request, env, subpath) {
  const origin = request.headers.get("Origin") || "";
  try {
    if (subpath === "auth") {
      const authBody = JSON.stringify({ public_key: env.ILOVEPDF_PUBLIC_KEY });
      const resp = await fetchWithRetry(
        (signal) => fetch(`${ILOVEPDF_BASE}/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: authBody,
          signal
        }),
        { maxRetries: 2, timeoutMs: 15e3, label: "iLovePDF auth" }
      );
      if (!resp.ok) {
        const errText = await resp.text();
        return corsResponse(origin, { error: `iLovePDF auth failed: ${errText}` }, { status: resp.status });
      }
      const data = await resp.json();
      return corsResponse(origin, data);
    }
    if (subpath.startsWith("start/")) {
      const tool = subpath.replace("start/", "");
      const body = await request.json();
      const iToken = body.ilovepdfToken;
      if (!iToken) return corsResponse(origin, { error: "Missing ilovepdfToken" }, { status: 400 });
      const resp = await fetchWithRetry(
        (signal) => fetch(`${ILOVEPDF_BASE}/start/${tool}`, {
          headers: { "Authorization": `Bearer ${iToken}` },
          signal
        }),
        { maxRetries: 2, timeoutMs: 15e3, label: "iLovePDF start" }
      );
      if (!resp.ok) {
        const errText = await resp.text();
        return corsResponse(origin, { error: `Start task failed: ${errText}` }, { status: resp.status });
      }
      return corsResponse(origin, await resp.json());
    }
    if (subpath === "upload") {
      const body = await request.json();
      const { server, task, ilovepdfToken, fileData, fileName } = body;
      if (!server || !task || !ilovepdfToken || !fileData) {
        return corsResponse(origin, { error: "Missing required upload fields" }, { status: 400 });
      }
      const binaryStr = atob(fileData);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const formData = new FormData();
      formData.append("task", task);
      formData.append("file", blob, fileName || "document.pdf");
      const resp = await fetchWithRetry(
        (signal) => fetch(`https://${server}/v1/upload`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${ilovepdfToken}` },
          body: formData,
          signal
        }),
        { maxRetries: 2, timeoutMs: 6e4, label: "iLovePDF upload" }
      );
      if (!resp.ok) {
        const errText = await resp.text();
        return corsResponse(origin, { error: `Upload failed: ${errText}` }, { status: resp.status });
      }
      return corsResponse(origin, await resp.json());
    }
    if (subpath === "process") {
      const body = await request.json();
      const { server, ilovepdfToken, ...processPayload } = body;
      if (!server || !ilovepdfToken) {
        return corsResponse(origin, { error: "Missing server or ilovepdfToken" }, { status: 400 });
      }
      const processBody = JSON.stringify(processPayload);
      const resp = await fetchWithRetry(
        (signal) => fetch(`https://${server}/v1/process`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${ilovepdfToken}`,
            "Content-Type": "application/json"
          },
          body: processBody,
          signal
        }),
        { maxRetries: 2, timeoutMs: 6e4, label: "iLovePDF process" }
      );
      if (!resp.ok) {
        const errText = await resp.text();
        return corsResponse(origin, { error: `Process failed: ${errText}` }, { status: resp.status });
      }
      const text = await resp.text();
      return corsResponse(origin, text ? JSON.parse(text) : { success: true });
    }
    if (subpath.startsWith("download/")) {
      const taskId = subpath.replace("download/", "");
      const url = new URL(request.url);
      const server = url.searchParams.get("server");
      const iToken = url.searchParams.get("token");
      if (!server || !iToken) {
        return corsResponse(origin, { error: "Missing server or token params" }, { status: 400 });
      }
      const resp = await fetchWithRetry(
        (signal) => fetch(`https://${server}/v1/download/${taskId}`, {
          headers: { "Authorization": `Bearer ${iToken}` },
          signal
        }),
        { maxRetries: 2, timeoutMs: 6e4, label: "iLovePDF download" }
      );
      if (!resp.ok) {
        return corsResponse(origin, { error: `Download failed (${resp.status})` }, { status: resp.status });
      }
      return new Response(resp.body, {
        headers: {
          ...getCorsHeaders(origin),
          "Content-Type": resp.headers.get("Content-Type") || "application/octet-stream",
          "Content-Disposition": resp.headers.get("Content-Disposition") || ""
        }
      });
    }
    return corsResponse(origin, { error: `Unknown iLovePDF endpoint: ${subpath}` }, { status: 404 });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}
__name(handleILovePdfProxy, "handleILovePdfProxy");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return handleOptions(request);
    if (request.method === "POST") {
      const cl = parseInt(request.headers.get("Content-Length") || "0", 10);
      if (cl > MAX_PAYLOAD_BYTES) {
        return corsResponse(origin, { error: "Payload too large" }, { status: 413 });
      }
    }
    if (path === "/auth/verify" && request.method === "POST") {
      return handleAuthVerify(request, env);
    }
    if (path === "/health") {
      return corsResponse(origin, { status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    }
    const user = await authenticateRequest(request, env);
    if (!user) return unauthorized(origin);
    if (path.startsWith("/api/gemini/")) {
      const subpath = path.replace("/api/gemini/", "") + url.search;
      return handleGeminiProxy(request, env, subpath);
    }
    if (path === "/api/veo/generate" && request.method === "POST") return handleVeoGenerate(request, env);
    if (path === "/api/veo/status" && request.method === "GET") return handleVeoStatus(request, env);
    if (path === "/api/kling/generate" && request.method === "POST") return handleKlingGenerate(request, env);
    if (path === "/api/kling/status" && request.method === "GET") return handleKlingStatus(request, env);
    if (path === "/api/convert/pdf-to-docx" && request.method === "POST") return handleConvertApi(request, env);
    if (path.startsWith("/api/ilovepdf/")) {
      const subpath = path.replace("/api/ilovepdf/", "");
      return handleILovePdfProxy(request, env, subpath);
    }
    return corsResponse(origin, { error: "Not found" }, { status: 404 });
  }
};

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-RGYhRm/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-RGYhRm/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
