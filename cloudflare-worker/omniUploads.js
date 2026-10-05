// Source files are private, short-lived capabilities bound to the signed-in user.
// Uses the established Gemini key and a domain-separated existing JWT secret.
export const VIDEO_UPLOAD_LIMIT = 32 * 1024 * 1024;
const BASE = 'https://generativelanguage.googleapis.com';
const BLOCKED = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH GB'.split(' '));
const encoder = new TextEncoder();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const encode = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const decode = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function key(env) {
  if (!env.JWT_SECRET || !env.GEMINI_API_KEY) fail('Video upload is not configured on the gateway.', 503);
  return crypto.subtle.importKey('raw', encoder.encode(`avas-omni-source-v1:${env.JWT_SECRET}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function seal(claim, env) {
  const body = encode(encoder.encode(JSON.stringify(claim)));
  return `${body}.${encode(new Uint8Array(await crypto.subtle.sign('HMAC', await key(env), encoder.encode(body))))}`;
}
async function open(token, env, user) {
  try {
    if (typeof token !== 'string' || token.length > 4096) throw new Error();
    const [body, signature, extra] = token.split('.');
    if (extra || !body || !signature || !await crypto.subtle.verify('HMAC', await key(env), decode(signature), encoder.encode(body))) throw new Error();
    const claim = JSON.parse(new TextDecoder().decode(decode(body)));
    if (!user?.email || claim.owner !== user.email || !Number.isFinite(claim.exp) || claim.exp <= Date.now() || !/^files\/[A-Za-z0-9_-]+$/.test(claim.name)) throw new Error();
    return claim;
  } catch (error) { if (error.status === 503) throw error; fail('This video upload expired or belongs to another account. Upload it again.', 403); }
}
export function uploadAvailability(request) {
  const country = request.cf?.country || null;
  const available = Boolean(country && !BLOCKED.has(country) && country !== 'XX' && country !== 'T1');
  return { available, country, maxDurationSeconds: 10, maxBytes: VIDEO_UPLOAD_LIMIT,
    message: available ? '' : country && BLOCKED.has(country)
      ? 'Google does not currently support editing or extending uploaded videos for users in the EEA, Switzerland or UK. You can still edit or extend videos generated with Omni.'
      : 'Uploaded-video availability could not be verified for your location. Generated-video editing is still available.' };
}
function requireAvailable(request) {
  const capability = uploadAvailability(request);
  if (!capability.available) fail(capability.message, 403);
}
async function google(env, path, init = {}) {
  const response = await fetch(`${BASE}${path}`, { ...init, redirect: 'error',
    headers: { ...init.headers, 'x-goog-api-key': env.GEMINI_API_KEY }, signal: AbortSignal.timeout(180000) });
  if (response.status === 404 && init.method === 'DELETE') return new Response('{}');
  if (response.status === 404 && path.startsWith('/v1beta/files/')) fail('This source file expired or was removed. Upload the clip again.', 410);
  if (!response.ok) fail(`Google video upload failed (${response.status}). Check Gemini access or try again.`, 502);
  return response;
}
function durationOf(file) {
  const duration = file.videoMetadata?.videoDuration;
  if (typeof duration === 'string' && /^\d+(\.\d+)?s$/.test(duration)) return Number(duration.slice(0, -1));
  if (duration && typeof duration === 'object') return Number(duration.seconds || 0) + Number(duration.nanos || 0) / 1e9;
  return NaN;
}
async function fileState(claim, env) {
  const file = await (await google(env, `/v1beta/${claim.name}`)).json();
  const state = file.state;
  if (state === 'FAILED') { await google(env, `/v1beta/${claim.name}`, { method: 'DELETE' }).catch(() => {}); fail('Google could not process this video. Export it as MP4 or WebM and try again.', 422); }
  if (state !== 'ACTIVE') return { status: 'processing', fileToken: await seal(claim, env), expiresAt: new Date(claim.exp).toISOString() };
  const durationSeconds = durationOf(file);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 10) {
    await google(env, `/v1beta/${claim.name}`, { method: 'DELETE' }).catch(() => {});
    fail('The uploaded clip must contain a valid video of 10 seconds or less. Trim it and upload again.', 422);
  }
  const ready = { ...claim, ready: true, durationSeconds };
  return { status: 'ready', fileToken: await seal(ready, env), name: claim.name, durationSeconds,
    mimeType: file.mimeType, expiresAt: new Date(claim.exp).toISOString() };
}
export async function uploadVideo(request, env, user) {
  requireAvailable(request);
  await key(env);
  if (!user?.email) fail('Sign in before uploading a video.', 401);
  const mime = request.headers.get('Content-Type')?.split(';')[0];
  if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(mime)) fail('Choose an MP4, WebM or MOV video.', 415);
  const declared = Number(request.headers.get('Content-Length'));
  if (declared > VIDEO_UPLOAD_LIMIT) fail('The prepared clip must be 32 MB or smaller.', 413);
  const reader = request.body?.getReader();
  if (!reader) fail('The upload is empty.');
  // Buffer only a bounded clip. A missing/false Content-Length cannot bypass the limit.
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > VIDEO_UPLOAD_LIMIT) { await reader.cancel(); fail('The prepared clip must be 32 MB or smaller.', 413); }
    chunks.push(value);
  }
  if (!size) fail('The upload is empty.');
  let displayName = 'uploaded-video';
  try { displayName = decodeURIComponent(request.headers.get('X-Video-Name') || displayName).slice(0, 120); } catch {}
  const start = await google(env, '/upload/v1beta/files', { method: 'POST', headers: {
    'Content-Type': 'application/json', 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
    'X-Goog-Upload-Header-Content-Length': String(size), 'X-Goog-Upload-Header-Content-Type': mime,
  }, body: JSON.stringify({ file: { display_name: displayName } }) });
  const uploadUrl = start.headers.get('x-goog-upload-url');
  const url = new URL(uploadUrl || 'https://invalid.invalid');
  if (url.protocol !== 'https:' || url.hostname !== 'generativelanguage.googleapis.com') fail('Google returned an invalid upload destination.', 502);
  const bytes = new Blob(chunks, { type: mime });
  const uploaded = await fetch(url, { method: 'POST', redirect: 'error', headers: { 'Content-Type': mime, 'Content-Length': String(size),
    'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: bytes, signal: AbortSignal.timeout(180000) });
  if (!uploaded.ok) fail(`Google could not store the clip (${uploaded.status}). Try again.`, 502);
  const { file } = await uploaded.json();
  if (!/^files\/[A-Za-z0-9_-]+$/.test(file?.name)) fail('Google returned an invalid file reference.', 502);
  const providerExpiry = Date.parse(file.expirationTime || '');
  const claim = { name: file.name, owner: user.email, exp: Math.min(Number.isFinite(providerExpiry) ? providerExpiry : Infinity, Date.now() + 47 * 3600000) };
  return fileState(claim, env);
}
export async function inspectUpload(request, env, user, token, remove = false) {
  const claim = await open(token, env, user);
  if (remove) { await google(env, `/v1beta/${claim.name}`, { method: 'DELETE' }); return { deleted: true }; }
  requireAvailable(request);
  return fileState(claim, env);
}
export async function sourceVideoContent(request, env, user, token) {
  requireAvailable(request);
  const claim = await open(token, env, user);
  const ready = await fileState(claim, env);
  if (ready.status !== 'ready') fail('The source video is still processing. Wait before editing or extending it.', 409);
  return { type: 'video', uri: `${BASE}/v1beta/${claim.name}`, mime_type: ready.mimeType };
}

export async function uploadTokenFromBody(request) {
  const reader = request.body?.getReader();
  if (!reader) fail('Missing source file token.');
  let size = 0; const chunks = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); fail('Source status request is too large.', 413); }
    chunks.push(value);
  }
  try { return JSON.parse(await new Blob(chunks).text()).fileToken; }
  catch { fail('Invalid source status request.'); }
}
