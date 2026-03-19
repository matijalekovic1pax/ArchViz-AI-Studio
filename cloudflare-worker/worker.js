/**
 * AVAS — API Gateway (Cloudflare Worker)
 *
 * Handles:
 * - Supabase JWT verification (HS256) for all protected routes
 * - Credit checking + deduction before every generation
 * - JWT-authenticated proxy for all vendor APIs (Gemini, Veo, Kling, ConvertAPI, iLovePDF)
 * - Stripe webhook handling (subscriptions, invoices, payment intents)
 * - Video pre-auth + Stripe Payment Intent creation
 * - Billing endpoints (checkout, portal, credit top-up)
 * - Team management (invite, accept, remove, role change)
 * - Admin endpoints (users, orgs, revenue, analytics)
 * - Usage logging after successful generations
 * - CORS lockdown to production domain
 * - Payload size limits
 *
 * Secrets (set via `wrangler secret put`):
 *   JWT_SECRET (kept for verifyJwt helper, used with SUPABASE_JWT_SECRET)
 *   SUPABASE_JWT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   GEMINI_API_KEY, GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_PROJECT_ID,
 *   KLING_PIAPI_API_KEY, KLING_ULAZAI_API_KEY, KLING_WAVESPEEDAI_API_KEY,
 *   CONVERTAPI_SECRET, ILOVEPDF_PUBLIC_KEY,
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   RESEND_API_KEY, EMAIL_FROM
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://arch-viz-ai-studio.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

const MAX_PAYLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

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

// ─── Credit Configuration ─────────────────────────────────────────────────────

const CREDITS_PER_MODE = {
  'render-3d':           4,
  'render-cad':          4,
  'render-sketch':       4,
  'masterplan':          4,
  'visual-edit':         4,
  'exploded':            4,
  'section':             4,
  'multi-angle':         4,
  'headshot':            4,
  'generate-text':       4,
  'upscale':             3,
  'pdf-compression':     1,
  'img-to-cad':          4,
  'img-to-3d':           4,
  'document-translate':  8,  // fast; professional quality = 12 (checked at runtime)
  'material-validation': 12,
  'video':               0,  // pay-per-gen via Stripe
};

// Modes accessible per plan
const PLAN_MODE_ACCESS = {
  unsubscribed:  ['render-3d', 'render-cad'],
  starter:       ['render-3d', 'render-cad', 'render-sketch', 'masterplan', 'visual-edit',
                  'exploded', 'section', 'multi-angle', 'headshot', 'generate-text',
                  'upscale', 'video'],
  professional:  'all',
  studio:        'all',
  enterprise:    'all',
};

// Modes allowed for signup bonus credit pool
const BONUS_ALLOWED_MODES = ['render-3d', 'render-cad'];

// ─── Video Prices (cents) ─────────────────────────────────────────────────────

const VIDEO_PRICES = {
  'kling-standard-5':  25,
  'kling-standard-10': 50,
  'kling-pro-10':      85,
  'veo-fast-5':        95,
  'veo-standard-8':    399,
};

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// Uses Cloudflare Cache API as a lightweight rate limiter.
// Key: `rate-limit:{userId}:{window}` (window = floor(now / windowMs))

const RATE_LIMITS = {
  gemini:  { maxRequests: 30, windowMs: 60_000 },  // 30 image gens / min per user
  billing: { maxRequests: 10, windowMs: 60_000 },  // 10 billing ops / min
  admin:   { maxRequests: 60, windowMs: 60_000 },  // 60 admin queries / min
};

async function checkRateLimit(userId, bucket) {
  const limit = RATE_LIMITS[bucket];
  if (!limit) return true; // no limit defined → allow
  try {
    const window = Math.floor(Date.now() / limit.windowMs);
    const cacheKey = `https://rate-limit.internal/${userId}/${bucket}/${window}`;
    const cache = caches.default;
    const cached = await cache.match(new Request(cacheKey));
    const count = cached ? parseInt(await cached.text()) : 0;
    if (count >= limit.maxRequests) return false;
    // Store updated count
    const resp = new Response(String(count + 1), {
      headers: { 'Cache-Control': `max-age=${Math.ceil(limit.windowMs / 1000)}` },
    });
    await cache.put(new Request(cacheKey), resp);
    return true;
  } catch {
    return true; // fail open — don't block on cache errors
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

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

// ─── Vertex AI Service Account Token ──────────────────────────────────────────

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

// ─── CORS ─────────────────────────────────────────────────────────────────────

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Generation-Mode, Stripe-Signature',
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

// ─── JWT (HS256) ──────────────────────────────────────────────────────────────

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
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

// ─── Supabase Auth Middleware ──────────────────────────────────────────────────

/**
 * Verify the Authorization: Bearer <supabase-jwt> header.
 * Supabase JWTs are HS256 signed with SUPABASE_JWT_SECRET.
 * Returns { userId, email } or null.
 */
async function authenticateRequest(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const payload = await verifyJwt(token, env.SUPABASE_JWT_SECRET);
    if (!payload.sub) return null;
    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

/** Return 401 response */
function unauthorized(origin, message = 'Unauthorized') {
  return corsResponse(origin, { error: message }, { status: 401 });
}

/** Return 403 response */
function forbidden(origin, message = 'Forbidden') {
  return corsResponse(origin, { error: message }, { status: 403 });
}

// ─── Supabase REST Helpers ────────────────────────────────────────────────────

async function supabaseQuery(env, path, options = {}) {
  const url = `${env.SUPABASE_URL}/rest/v1/${path}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {}),
    },
  });
  return resp;
}

async function supabaseRpc(env, fnName, params = {}) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  return resp;
}

// ─── Credit Checking ──────────────────────────────────────────────────────────

/**
 * Check credits and deduct them for a generation request.
 * Returns { ok: true } or { ok: false, error: string, status: number }
 */
async function checkAndDeductCredits(env, userId, mode, qualityHint) {
  // Determine credit cost
  let cost = CREDITS_PER_MODE[mode] ?? 4;
  // document-translate: professional quality costs 12 instead of 8
  if (mode === 'document-translate' && qualityHint === 'professional') {
    cost = 12;
  }
  // video is pay-per-gen, skip credit check
  if (mode === 'video') return { ok: true };

  try {
    // Step 1: Resolve credit pool (returns pool info: plan, credits, bonus credits, suspended, org_id)
    const poolResp = await supabaseRpc(env, 'resolve_credit_pool', { p_user_id: userId });
    if (!poolResp.ok) {
      const errText = await poolResp.text();
      console.error('[credits] resolve_credit_pool failed:', poolResp.status, errText);
      return { ok: false, error: 'Failed to resolve credit pool', status: 500 };
    }
    const pool = await poolResp.json();

    // Step 2: Check suspension
    if (pool.suspended) {
      return { ok: false, error: 'Account suspended', status: 403 };
    }

    // Step 3: Check mode access based on plan
    const plan = pool.plan || 'unsubscribed';
    const allowedModes = PLAN_MODE_ACCESS[plan];
    if (allowedModes !== 'all' && !allowedModes?.includes(mode)) {
      return { ok: false, error: `Mode '${mode}' is not available on your current plan (${plan})`, status: 403 };
    }

    // Step 4: For unsubscribed users, only bonus modes are allowed and only if bonus credits exist
    if (plan === 'unsubscribed') {
      if (!BONUS_ALLOWED_MODES.includes(mode)) {
        return { ok: false, error: `Mode '${mode}' requires a subscription`, status: 402 };
      }
      if (!pool.bonus_credits || pool.bonus_credits < cost) {
        return { ok: false, error: 'No signup bonus credits remaining. Please subscribe to continue.', status: 402 };
      }
    } else {
      // Check total available credits
      const totalCredits = (pool.credits || 0) + (pool.bonus_credits || 0);
      if (totalCredits < cost) {
        return { ok: false, error: 'Insufficient credits', status: 402 };
      }
    }

    // Step 5: Deduct credits
    const deductResp = await supabaseRpc(env, 'deduct_credits', {
      p_user_id: userId,
      p_amount:  cost,
      p_mode:    mode,
    });
    if (!deductResp.ok) {
      const errText = await deductResp.text();
      console.error('[credits] deduct_credits failed:', deductResp.status, errText);
      return { ok: false, error: 'Failed to deduct credits', status: 500 };
    }

    // Step 6: Fire-and-forget low-credits warning email
    const creditsAfter = ((pool.org_id ? pool.credits : pool.credits) || 0) - cost;
    const LOW_CREDITS_THRESHOLD = 50;
    if (creditsAfter <= LOW_CREDITS_THRESHOLD && creditsAfter >= 0 && plan !== 'unsubscribed') {
      // Fetch user email for notification
      const userResp = await supabaseQuery(env, `users?id=eq.${userId}&select=email,name`, { method: 'GET' });
      if (userResp.ok) {
        const userRows = await userResp.json();
        const userEmail = userRows?.[0]?.email;
        const userName = userRows?.[0]?.name || 'there';
        if (userEmail) {
          sendEmail(env, {
            to: userEmail,
            subject: 'Running low on AVAS credits',
            html: `<p>Hi ${userName},</p>
<p>You only have <strong>${creditsAfter} credits</strong> remaining on AVAS.</p>
<p>Top up your credits or upgrade your plan to keep generating.</p>
<p><a href="https://app.avas.ai/billing">Manage Billing →</a></p>
<p>The AVAS Team</p>`,
          }).catch(() => {}); // fire-and-forget
        }
      }
    }

    return { ok: true, creditsUsed: cost, orgId: pool.org_id || null };
  } catch (err) {
    console.error('[credits] unexpected error:', err.message);
    return { ok: false, error: 'Credit check failed: ' + err.message, status: 500 };
  }
}

// ─── Usage Logging ────────────────────────────────────────────────────────────

async function logUsage(env, { userId, orgId, mode, creditsUsed }) {
  try {
    await supabaseQuery(env, 'usage_log', {
      method: 'POST',
      body: JSON.stringify({
        user_id:      userId,
        org_id:       orgId || null,
        mode,
        credits_used: creditsUsed,
        created_at:   new Date().toISOString(),
      }),
    });
  } catch (err) {
    // Non-fatal — log and continue
    console.error('[usage_log] failed:', err.message);
  }
}

// ─── Email Helper ─────────────────────────────────────────────────────────────

async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || 'AVAS <noreply@avas.ai>',
        to,
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error('[email] send failed:', err.message);
  }
}

// ─── Admin Guard ──────────────────────────────────────────────────────────────

async function isAdmin(env, userId) {
  try {
    const resp = await supabaseQuery(env, `profiles?id=eq.${userId}&select=role`, { method: 'GET' });
    if (!resp.ok) return false;
    const rows = await resp.json();
    return rows?.[0]?.role === 'superadmin';
  } catch {
    return false;
  }
}

// ─── Stripe Helper ────────────────────────────────────────────────────────────

async function stripeRequest(env, path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };
  if (body) opts.body = body;
  return fetch(`https://api.stripe.com/v1/${path}`, opts);
}

/** Convert an object to URL-encoded form data (shallow, supports nested with []) */
function toFormData(obj, prefix = '') {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === null || v === undefined) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      parts.push(...toFormData(v, key).split('&').filter(Boolean));
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => parts.push(`${key}[${i}]=${encodeURIComponent(item)}`));
    } else {
      parts.push(`${key}=${encodeURIComponent(v)}`);
    }
  }
  return parts.join('&');
}

/** Verify Stripe webhook signature (manual HMAC-SHA256) */
async function verifyStripeWebhook(payload, sigHeader, secret) {
  const parts = sigHeader.split(',');
  const tPart = parts.find(p => p.startsWith('t='));
  const v1Parts = parts.filter(p => p.startsWith('v1='));
  if (!tPart || !v1Parts.length) throw new Error('Invalid Stripe signature header');
  const timestamp = tPart.slice(2);
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expectedHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  const valid = v1Parts.some(p => p.slice(3) === expectedHex);
  if (!valid) throw new Error('Stripe signature mismatch');
  // Check timestamp tolerance (5 minutes)
  const ts = parseInt(timestamp, 10);
  if (Math.abs(Date.now() / 1000 - ts) > 300) throw new Error('Stripe webhook timestamp too old');
}

// ─── Route: POST /webhooks/stripe ────────────────────────────────────────────

async function handleStripeWebhook(request, env) {
  const origin = request.headers.get('Origin') || '';
  const sigHeader = request.headers.get('Stripe-Signature') || '';
  const rawBody = await request.text();

  try {
    await verifyStripeWebhook(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return corsResponse(origin, { error: 'Webhook signature invalid: ' + err.message }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return corsResponse(origin, { error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const obj = event.data?.object;

    switch (event.type) {
      // ── Subscription events ──
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = obj;
        const customerId = sub.customer;
        const status = sub.status;
        const planNickname = sub.items?.data?.[0]?.price?.nickname || sub.items?.data?.[0]?.price?.metadata?.plan || 'starter';
        const plan = mapStripePlanToPlan(planNickname);

        // Find user by Stripe customer ID
        const userResp = await supabaseQuery(env, `profiles?stripe_customer_id=eq.${customerId}&select=id`, { method: 'GET' });
        const users = userResp.ok ? await userResp.json() : [];
        const userId = users?.[0]?.id;

        // Upsert subscription row
        await supabaseQuery(env, 'subscriptions', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({
            stripe_subscription_id: sub.id,
            stripe_customer_id:     customerId,
            user_id:                userId || null,
            plan,
            status,
            current_period_start:   new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end:   sub.cancel_at_period_end,
            updated_at:             new Date().toISOString(),
          }),
        });

        // Update user plan
        if (userId) {
          await supabaseQuery(env, `profiles?id=eq.${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({ plan, updated_at: new Date().toISOString() }),
          });
          // Award credits on new subscription
          if (event.type === 'customer.subscription.created' && status === 'active') {
            await supabaseRpc(env, 'reset_credits_on_renewal', { p_user_id: userId, p_plan: plan });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = obj;
        const customerId = sub.customer;

        await supabaseQuery(env, `subscriptions?stripe_subscription_id=eq.${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'canceled', updated_at: new Date().toISOString() }),
        });

        const userResp = await supabaseQuery(env, `profiles?stripe_customer_id=eq.${customerId}&select=id`, { method: 'GET' });
        const users = userResp.ok ? await userResp.json() : [];
        const userId = users?.[0]?.id;
        if (userId) {
          await supabaseQuery(env, `profiles?id=eq.${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({ plan: 'unsubscribed', updated_at: new Date().toISOString() }),
          });
        }
        break;
      }

      // ── Invoice events ──
      case 'invoice.paid': {
        const invoice = obj;
        const customerId = invoice.customer;
        const subId = invoice.subscription;

        // Resolve subscription → plan
        let plan = 'starter';
        if (subId) {
          const subResp = await supabaseQuery(env, `subscriptions?stripe_subscription_id=eq.${subId}&select=plan,user_id`, { method: 'GET' });
          const subs = subResp.ok ? await subResp.json() : [];
          if (subs?.[0]) {
            plan = subs[0].plan;
            if (subs[0].user_id) {
              await supabaseRpc(env, 'reset_credits_on_renewal', { p_user_id: subs[0].user_id, p_plan: plan });
            }
          }
        }
        break;
      }

      // ── Payment Intent events ──
      case 'payment_intent.succeeded': {
        const pi = obj;
        // Update video_charges
        await supabaseQuery(env, `video_charges?stripe_payment_intent_id=eq.${pi.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'succeeded', updated_at: new Date().toISOString() }),
        });
        // Update credit_purchases
        await supabaseQuery(env, `credit_purchases?stripe_payment_intent_id=eq.${pi.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'succeeded', updated_at: new Date().toISOString() }),
        });
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = obj;
        await supabaseQuery(env, `video_charges?stripe_payment_intent_id=eq.${pi.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'failed', updated_at: new Date().toISOString() }),
        });
        await supabaseQuery(env, `credit_purchases?stripe_payment_intent_id=eq.${pi.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'failed', updated_at: new Date().toISOString() }),
        });
        break;
      }

      default:
        // Unhandled event type — return 200 to acknowledge
        break;
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err.message);
    // Still return 200 so Stripe doesn't retry
  }

  return corsResponse(origin, { received: true });
}

function mapStripePlanToPlan(nickname) {
  const n = (nickname || '').toLowerCase();
  if (n.includes('professional') || n.includes('pro')) return 'professional';
  if (n.includes('studio')) return 'studio';
  if (n.includes('enterprise')) return 'enterprise';
  return 'starter';
}

// ─── Route: POST /api/video/charge ───────────────────────────────────────────

async function handleVideoCharge(request, env, user) {
  const origin = request.headers.get('Origin') || '';
  try {
    const { model, durationSeconds, orgId } = await request.json();
    const priceKey = `${model}-${durationSeconds}`;
    const amountCents = VIDEO_PRICES[priceKey];
    if (!amountCents) {
      return corsResponse(origin, { error: `Unknown video model/duration: ${priceKey}` }, { status: 400 });
    }

    // Get or create Stripe customer for user
    const profileResp = await supabaseQuery(env, `profiles?id=eq.${user.userId}&select=stripe_customer_id,email`, { method: 'GET' });
    const profiles = profileResp.ok ? await profileResp.json() : [];
    let stripeCustomerId = profiles?.[0]?.stripe_customer_id;

    if (!stripeCustomerId) {
      // Create a Stripe customer
      const custResp = await stripeRequest(env, 'customers', 'POST',
        toFormData({ email: user.email || profiles?.[0]?.email || '', metadata: { user_id: user.userId } })
      );
      if (!custResp.ok) {
        const err = await custResp.text();
        return corsResponse(origin, { error: 'Failed to create Stripe customer: ' + err }, { status: 500 });
      }
      const cust = await custResp.json();
      stripeCustomerId = cust.id;
      await supabaseQuery(env, `profiles?id=eq.${user.userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stripe_customer_id: stripeCustomerId }),
      });
    }

    // Create Payment Intent
    const piResp = await stripeRequest(env, 'payment_intents', 'POST',
      toFormData({
        amount:   amountCents,
        currency: 'usd',
        customer: stripeCustomerId,
        automatic_payment_methods: { enabled: true },
        metadata: { user_id: user.userId, model, duration_seconds: durationSeconds, org_id: orgId || '' },
      })
    );
    if (!piResp.ok) {
      const err = await piResp.text();
      return corsResponse(origin, { error: 'Failed to create Payment Intent: ' + err }, { status: 500 });
    }
    const pi = await piResp.json();

    // Insert video_charges row
    const chargeResp = await supabaseQuery(env, 'video_charges', {
      method: 'POST',
      body: JSON.stringify({
        user_id:                   user.userId,
        org_id:                    orgId || null,
        stripe_payment_intent_id:  pi.id,
        model,
        duration_seconds:          durationSeconds,
        amount_cents:              amountCents,
        status:                    'pending',
        created_at:                new Date().toISOString(),
        updated_at:                new Date().toISOString(),
      }),
    });
    const charges = chargeResp.ok ? await chargeResp.json() : [];
    const videoChargeId = charges?.[0]?.id || null;

    return corsResponse(origin, { clientSecret: pi.client_secret, videoChargeId });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── Route: POST /billing/checkout ───────────────────────────────────────────

async function handleBillingCheckout(request, env, user) {
  const origin = request.headers.get('Origin') || '';
  try {
    const { priceId, successUrl, cancelUrl } = await request.json();
    if (!priceId || !successUrl || !cancelUrl) {
      return corsResponse(origin, { error: 'Missing priceId, successUrl, or cancelUrl' }, { status: 400 });
    }

    // Get or create Stripe customer
    const profileResp = await supabaseQuery(env, `profiles?id=eq.${user.userId}&select=stripe_customer_id`, { method: 'GET' });
    const profiles = profileResp.ok ? await profileResp.json() : [];
    let stripeCustomerId = profiles?.[0]?.stripe_customer_id;

    if (!stripeCustomerId) {
      const custResp = await stripeRequest(env, 'customers', 'POST',
        toFormData({ email: user.email || '', metadata: { user_id: user.userId } })
      );
      if (custResp.ok) {
        const cust = await custResp.json();
        stripeCustomerId = cust.id;
        await supabaseQuery(env, `profiles?id=eq.${user.userId}`, {
          method: 'PATCH',
          body: JSON.stringify({ stripe_customer_id: stripeCustomerId }),
        });
      }
    }

    const sessionBody = {
      mode: 'subscription',
      success_url: successUrl,
      cancel_url:  cancelUrl,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': 1,
    };
    if (stripeCustomerId) sessionBody.customer = stripeCustomerId;

    const resp = await stripeRequest(env, 'checkout/sessions', 'POST', toFormData(sessionBody));
    if (!resp.ok) {
      const err = await resp.text();
      return corsResponse(origin, { error: 'Checkout session failed: ' + err }, { status: 500 });
    }
    const session = await resp.json();
    return corsResponse(origin, { url: session.url });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── Route: POST /billing/portal ─────────────────────────────────────────────

async function handleBillingPortal(request, env, user) {
  const origin = request.headers.get('Origin') || '';
  try {
    const { returnUrl } = await request.json().catch(() => ({}));
    const profileResp = await supabaseQuery(env, `profiles?id=eq.${user.userId}&select=stripe_customer_id`, { method: 'GET' });
    const profiles = profileResp.ok ? await profileResp.json() : [];
    const stripeCustomerId = profiles?.[0]?.stripe_customer_id;
    if (!stripeCustomerId) {
      return corsResponse(origin, { error: 'No Stripe customer found for this account' }, { status: 400 });
    }

    const resp = await stripeRequest(env, 'billing_portal/sessions', 'POST',
      toFormData({ customer: stripeCustomerId, return_url: returnUrl || 'https://avas.ai/billing' })
    );
    if (!resp.ok) {
      const err = await resp.text();
      return corsResponse(origin, { error: 'Portal session failed: ' + err }, { status: 500 });
    }
    const session = await resp.json();
    return corsResponse(origin, { url: session.url });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── Route: POST /billing/credits ────────────────────────────────────────────

async function handleBillingCredits(request, env, user) {
  const origin = request.headers.get('Origin') || '';
  try {
    const { priceId, successUrl, cancelUrl } = await request.json();
    if (!priceId || !successUrl || !cancelUrl) {
      return corsResponse(origin, { error: 'Missing priceId, successUrl, or cancelUrl' }, { status: 400 });
    }

    const profileResp = await supabaseQuery(env, `profiles?id=eq.${user.userId}&select=stripe_customer_id`, { method: 'GET' });
    const profiles = profileResp.ok ? await profileResp.json() : [];
    let stripeCustomerId = profiles?.[0]?.stripe_customer_id;

    if (!stripeCustomerId) {
      const custResp = await stripeRequest(env, 'customers', 'POST',
        toFormData({ email: user.email || '', metadata: { user_id: user.userId } })
      );
      if (custResp.ok) {
        const cust = await custResp.json();
        stripeCustomerId = cust.id;
        await supabaseQuery(env, `profiles?id=eq.${user.userId}`, {
          method: 'PATCH',
          body: JSON.stringify({ stripe_customer_id: stripeCustomerId }),
        });
      }
    }

    const sessionBody = {
      mode: 'payment',
      success_url: successUrl,
      cancel_url:  cancelUrl,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': 1,
    };
    if (stripeCustomerId) sessionBody.customer = stripeCustomerId;

    const resp = await stripeRequest(env, 'checkout/sessions', 'POST', toFormData(sessionBody));
    if (!resp.ok) {
      const err = await resp.text();
      return corsResponse(origin, { error: 'Credit checkout session failed: ' + err }, { status: 500 });
    }
    const session = await resp.json();
    return corsResponse(origin, { url: session.url });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── Route: POST /team/invite ─────────────────────────────────────────────────

async function handleTeamInvite(request, env, user) {
  const origin = request.headers.get('Origin') || '';
  try {
    const { orgId, email, role = 'member' } = await request.json();
    if (!orgId || !email) {
      return corsResponse(origin, { error: 'Missing orgId or email' }, { status: 400 });
    }

    // Verify requester is admin of the org
    const memberResp = await supabaseQuery(env,
      `org_members?org_id=eq.${orgId}&user_id=eq.${user.userId}&select=role`,
      { method: 'GET' }
    );
    const members = memberResp.ok ? await memberResp.json() : [];
    if (!members?.[0] || !['admin', 'owner'].includes(members[0].role)) {
      return forbidden(origin, 'Only org admins can invite members');
    }

    // Generate a random invite token
    const token = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(); // 7 days

    await supabaseQuery(env, 'org_invites', {
      method: 'POST',
      body: JSON.stringify({
        org_id:     orgId,
        email,
        role,
        token,
        invited_by: user.userId,
        expires_at: expiresAt,
        status:     'pending',
        created_at: new Date().toISOString(),
      }),
    });

    // Send invite email
    const orgResp = await supabaseQuery(env, `organizations?id=eq.${orgId}&select=name`, { method: 'GET' });
    const orgs = orgResp.ok ? await orgResp.json() : [];
    const orgName = orgs?.[0]?.name || 'your team';

    await sendEmail(env, {
      to: email,
      subject: `You've been invited to join ${orgName} on AVAS`,
      html: `
        <p>You have been invited to join <strong>${orgName}</strong> on AVAS as a <strong>${role}</strong>.</p>
        <p><a href="https://avas.ai/invite?token=${token}">Accept Invitation</a></p>
        <p>This invitation expires in 7 days.</p>
      `,
    });

    return corsResponse(origin, { success: true, token });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── Route: POST /team/accept-invite ─────────────────────────────────────────

async function handleTeamAcceptInvite(request, env, user) {
  const origin = request.headers.get('Origin') || '';
  try {
    const { token } = await request.json();
    if (!token) return corsResponse(origin, { error: 'Missing token' }, { status: 400 });

    // Lookup invite
    const inviteResp = await supabaseQuery(env,
      `org_invites?token=eq.${token}&status=eq.pending&select=*`,
      { method: 'GET' }
    );
    const invites = inviteResp.ok ? await inviteResp.json() : [];
    const invite = invites?.[0];
    if (!invite) {
      return corsResponse(origin, { error: 'Invalid or expired invite token' }, { status: 400 });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return corsResponse(origin, { error: 'Invite token has expired' }, { status: 400 });
    }

    // Add user to org
    await supabaseQuery(env, 'org_members', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({
        org_id:     invite.org_id,
        user_id:    user.userId,
        role:       invite.role,
        joined_at:  new Date().toISOString(),
      }),
    });

    // Mark invite as accepted
    await supabaseQuery(env, `org_invites?token=eq.${token}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted', accepted_at: new Date().toISOString() }),
    });

    return corsResponse(origin, { success: true, orgId: invite.org_id, role: invite.role });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── Route: DELETE /team/member ───────────────────────────────────────────────

async function handleTeamRemoveMember(request, env, user) {
  const origin = request.headers.get('Origin') || '';
  try {
    const { orgId, userId: targetUserId } = await request.json();
    if (!orgId || !targetUserId) {
      return corsResponse(origin, { error: 'Missing orgId or userId' }, { status: 400 });
    }

    // Verify requester is admin
    const memberResp = await supabaseQuery(env,
      `org_members?org_id=eq.${orgId}&user_id=eq.${user.userId}&select=role`,
      { method: 'GET' }
    );
    const members = memberResp.ok ? await memberResp.json() : [];
    if (!members?.[0] || !['admin', 'owner'].includes(members[0].role)) {
      return forbidden(origin, 'Only org admins can remove members');
    }

    await supabaseQuery(env, `org_members?org_id=eq.${orgId}&user_id=eq.${targetUserId}`, {
      method: 'DELETE',
    });

    return corsResponse(origin, { success: true });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── Route: PATCH /team/member/role ──────────────────────────────────────────

async function handleTeamChangeRole(request, env, user) {
  const origin = request.headers.get('Origin') || '';
  try {
    const { orgId, userId: targetUserId, role } = await request.json();
    if (!orgId || !targetUserId || !role) {
      return corsResponse(origin, { error: 'Missing orgId, userId, or role' }, { status: 400 });
    }

    // Verify requester is admin
    const memberResp = await supabaseQuery(env,
      `org_members?org_id=eq.${orgId}&user_id=eq.${user.userId}&select=role`,
      { method: 'GET' }
    );
    const members = memberResp.ok ? await memberResp.json() : [];
    if (!members?.[0] || !['admin', 'owner'].includes(members[0].role)) {
      return forbidden(origin, 'Only org admins can change member roles');
    }

    await supabaseQuery(env, `org_members?org_id=eq.${orgId}&user_id=eq.${targetUserId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role, updated_at: new Date().toISOString() }),
    });

    return corsResponse(origin, { success: true });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── Admin Routes ─────────────────────────────────────────────────────────────

async function handleAdminUsers(request, env) {
  const origin = request.headers.get('Origin') || '';
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;
  const search = url.searchParams.get('search') || '';
  const plan   = url.searchParams.get('plan') || '';

  let qs = `profiles?select=id,email,full_name,plan,suspended,created_at,stripe_customer_id&limit=${pageSize}&offset=${offset}&order=created_at.desc`;
  if (plan) qs += `&plan=eq.${plan}`;
  // Note: full-text search across email/name requires PostgREST ilike
  if (search) qs += `&or=(email.ilike.*${encodeURIComponent(search)}*,full_name.ilike.*${encodeURIComponent(search)}*)`;

  const resp = await supabaseQuery(env, qs, { method: 'GET', headers: { 'Prefer': 'count=exact' } });
  const users = resp.ok ? await resp.json() : [];
  const totalCount = parseInt(resp.headers.get('Content-Range')?.split('/')?.[1] || '0', 10);
  return corsResponse(origin, { users, page, pageSize, total: totalCount });
}

async function handleAdminUserDetail(request, env, targetUserId) {
  const origin = request.headers.get('Origin') || '';
  const profileResp = await supabaseQuery(env, `profiles?id=eq.${targetUserId}&select=*`, { method: 'GET' });
  const profiles = profileResp.ok ? await profileResp.json() : [];
  const profile = profiles?.[0];
  if (!profile) return corsResponse(origin, { error: 'User not found' }, { status: 404 });

  const usageResp = await supabaseQuery(env,
    `usage_log?user_id=eq.${targetUserId}&select=mode,credits_used,created_at&order=created_at.desc&limit=100`,
    { method: 'GET' }
  );
  const usage = usageResp.ok ? await usageResp.json() : [];

  return corsResponse(origin, { profile, usage });
}

async function handleAdminUpdateUser(request, env, targetUserId) {
  const origin = request.headers.get('Origin') || '';
  try {
    const body = await request.json();
    const allowed = ['plan', 'suspended', 'full_name'];
    const patch = {};
    for (const k of allowed) {
      if (k in body) patch[k] = body[k];
    }
    patch.updated_at = new Date().toISOString();
    await supabaseQuery(env, `profiles?id=eq.${targetUserId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return corsResponse(origin, { success: true });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

async function handleAdminUserCredits(request, env, targetUserId) {
  const origin = request.headers.get('Origin') || '';
  try {
    const { amount, note } = await request.json();
    if (typeof amount !== 'number') {
      return corsResponse(origin, { error: 'amount must be a number' }, { status: 400 });
    }
    await supabaseQuery(env, 'credit_adjustments', {
      method: 'POST',
      body: JSON.stringify({
        user_id:    targetUserId,
        amount,
        note:       note || 'Manual admin adjustment',
        created_at: new Date().toISOString(),
      }),
    });
    // Apply the credit adjustment via RPC
    await supabaseRpc(env, 'apply_credit_adjustment', { p_user_id: targetUserId, p_amount: amount });
    return corsResponse(origin, { success: true });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

async function handleAdminOrgs(request, env) {
  const origin = request.headers.get('Origin') || '';
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;
  const resp = await supabaseQuery(env,
    `organizations?select=*&limit=${pageSize}&offset=${offset}&order=created_at.desc`,
    { method: 'GET', headers: { 'Prefer': 'count=exact' } }
  );
  const orgs = resp.ok ? await resp.json() : [];
  const total = parseInt(resp.headers.get('Content-Range')?.split('/')?.[1] || '0', 10);
  return corsResponse(origin, { orgs, page, pageSize, total });
}

async function handleAdminOrgDetail(request, env, orgId) {
  const origin = request.headers.get('Origin') || '';
  const orgResp = await supabaseQuery(env, `organizations?id=eq.${orgId}&select=*`, { method: 'GET' });
  const orgs = orgResp.ok ? await orgResp.json() : [];
  const org = orgs?.[0];
  if (!org) return corsResponse(origin, { error: 'Org not found' }, { status: 404 });

  const membersResp = await supabaseQuery(env,
    `org_members?org_id=eq.${orgId}&select=user_id,role,joined_at`,
    { method: 'GET' }
  );
  const members = membersResp.ok ? await membersResp.json() : [];
  return corsResponse(origin, { org, members });
}

async function handleAdminUpdateOrg(request, env, orgId) {
  const origin = request.headers.get('Origin') || '';
  try {
    const body = await request.json();
    const allowed = ['name', 'plan', 'suspended'];
    const patch = {};
    for (const k of allowed) {
      if (k in body) patch[k] = body[k];
    }
    patch.updated_at = new Date().toISOString();
    await supabaseQuery(env, `organizations?id=eq.${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return corsResponse(origin, { success: true });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

async function handleAdminOrgCredits(request, env, orgId) {
  const origin = request.headers.get('Origin') || '';
  try {
    const { amount, note } = await request.json();
    if (typeof amount !== 'number') {
      return corsResponse(origin, { error: 'amount must be a number' }, { status: 400 });
    }
    await supabaseQuery(env, 'credit_adjustments', {
      method: 'POST',
      body: JSON.stringify({
        org_id:     orgId,
        amount,
        note:       note || 'Manual admin org adjustment',
        created_at: new Date().toISOString(),
      }),
    });
    await supabaseRpc(env, 'apply_org_credit_adjustment', { p_org_id: orgId, p_amount: amount });
    return corsResponse(origin, { success: true });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

async function handleAdminRevenue(request, env) {
  const origin = request.headers.get('Origin') || '';
  try {
    // Video charges total
    const vcResp = await supabaseQuery(env,
      `video_charges?status=eq.succeeded&select=amount_cents`,
      { method: 'GET' }
    );
    const vcs = vcResp.ok ? await vcResp.json() : [];
    const videoRevenue = vcs.reduce((sum, r) => sum + (r.amount_cents || 0), 0);

    // Credit purchases total
    const cpResp = await supabaseQuery(env,
      `credit_purchases?status=eq.succeeded&select=amount_cents`,
      { method: 'GET' }
    );
    const cps = cpResp.ok ? await cpResp.json() : [];
    const creditRevenue = cps.reduce((sum, r) => sum + (r.amount_cents || 0), 0);

    // Active subscriptions count
    const subResp = await supabaseQuery(env,
      `subscriptions?status=eq.active&select=plan`,
      { method: 'GET', headers: { 'Prefer': 'count=exact' } }
    );
    const subs = subResp.ok ? await subResp.json() : [];
    const totalSubs = parseInt(subResp.headers.get('Content-Range')?.split('/')?.[1] || '0', 10);

    return corsResponse(origin, {
      videoRevenueCents:  videoRevenue,
      creditRevenueCents: creditRevenue,
      totalRevenueCents:  videoRevenue + creditRevenue,
      activeSubscriptions: totalSubs,
      subscriptionsByPlan: subs.reduce((acc, s) => {
        acc[s.plan] = (acc[s.plan] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

async function handleAdminAnalytics(request, env) {
  const origin = request.headers.get('Origin') || '';
  try {
    // Usage grouped by mode (last 30 days)
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const usageResp = await supabaseQuery(env,
      `usage_log?created_at=gte.${since}&select=mode,credits_used`,
      { method: 'GET' }
    );
    const usage = usageResp.ok ? await usageResp.json() : [];

    const byMode = {};
    let totalCreditsUsed = 0;
    for (const row of usage) {
      if (!byMode[row.mode]) byMode[row.mode] = { count: 0, creditsUsed: 0 };
      byMode[row.mode].count++;
      byMode[row.mode].creditsUsed += row.credits_used || 0;
      totalCreditsUsed += row.credits_used || 0;
    }

    return corsResponse(origin, {
      periodDays: 30,
      totalGenerations: usage.length,
      totalCreditsUsed,
      byMode,
    });
  } catch (err) {
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── Route: POST /api/user/welcome ───────────────────────────────────────────
// Sends welcome email on first login. Idempotent (checks welcome_email_sent flag).

async function handleUserWelcome(request, env, user) {
  const origin = request.headers.get('Origin') || '';
  try {
    // Fetch user record
    const resp = await supabaseQuery(env, `users?id=eq.${user.userId}&select=email,name,welcome_email_sent`, { method: 'GET' });
    if (!resp.ok) return corsResponse(origin, { error: 'User not found' }, { status: 404 });
    const rows = await resp.json();
    const u = rows?.[0];
    if (!u) return corsResponse(origin, { error: 'User not found' }, { status: 404 });

    // Already sent — skip
    if (u.welcome_email_sent) return corsResponse(origin, { ok: true, skipped: true });

    // Mark as sent first to prevent duplicates on concurrent requests
    await supabaseQuery(env, `users?id=eq.${user.userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ welcome_email_sent: true }),
    });

    // Send welcome email
    await sendEmail(env, {
      to: u.email,
      subject: 'Welcome to AVAS — your 20 free credits are ready',
      html: `<p>Hi ${u.name || 'there'},</p>
<p>Welcome to <strong>AVAS</strong> — the AI studio built for architects.</p>
<p>You have <strong>20 free credits</strong> to try 3D rendering and CAD rendering modes.</p>
<p>When you're ready to unlock more modes and credits, check out our plans:</p>
<p><a href="https://app.avas.ai/billing">View Plans →</a></p>
<p>Happy rendering,<br/>The AVAS Team</p>`,
    });

    return corsResponse(origin, { ok: true });
  } catch (err) {
    console.error('[welcome] error:', err.message);
    return corsResponse(origin, { error: err.message }, { status: 500 });
  }
}

// ─── Route: /api/gemini/* (passthrough proxy with credit check) ───────────────

async function handleGeminiProxy(request, env, subpath, user) {
  const origin = request.headers.get('Origin') || '';

  // Rate limit: 30 Gemini requests per minute per user
  const allowed = await checkRateLimit(user.userId, 'gemini');
  if (!allowed) {
    return corsResponse(origin, { error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
  }

  // Credit check + deduction
  const mode = request.headers.get('X-Generation-Mode') || 'render-3d';
  const qualityHint = request.headers.get('X-Quality-Hint') || '';
  const creditResult = await checkAndDeductCredits(env, user.userId, mode, qualityHint);
  if (!creditResult.ok) {
    return corsResponse(origin, { error: creditResult.error }, { status: creditResult.status || 402 });
  }

  const url = `${GEMINI_API_BASE}/${subpath}`;

  const headers = new Headers();
  headers.set('x-goog-api-key', env.GEMINI_API_KEY);

  const ct = request.headers.get('Content-Type');
  if (ct) headers.set('Content-Type', ct);

  let upstreamResp;
  try {
    upstreamResp = await fetch(url, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? request.body : undefined,
    });
  } catch (fetchErr) {
    // Network error → refund credits
    await supabaseRpc(env, 'add_credits', {
      p_entity_type: creditResult.orgId ? 'org' : 'user',
      p_entity_id:   creditResult.orgId || user.userId,
      p_amount:      creditResult.creditsUsed || 0,
    }).catch(() => {});
    console.error('[gemini] fetch error, credits refunded:', fetchErr.message);
    return corsResponse(origin, { error: 'Upstream service unavailable. Credits refunded.' }, { status: 503 });
  }

  // On upstream 5xx, refund credits
  if (upstreamResp.status >= 500) {
    await supabaseRpc(env, 'add_credits', {
      p_entity_type: creditResult.orgId ? 'org' : 'user',
      p_entity_id:   creditResult.orgId || user.userId,
      p_amount:      creditResult.creditsUsed || 0,
    }).catch(() => {});
  }

  // Log usage on success (non-blocking)
  if (upstreamResp.ok) {
    logUsage(env, {
      userId:      user.userId,
      orgId:       creditResult.orgId || null,
      mode,
      creditsUsed: creditResult.creditsUsed || 0,
    });
  }

  // Stream the response back with CORS headers
  const respHeaders = { ...getCorsHeaders(origin) };
  const upstreamCt = upstreamResp.headers.get('Content-Type');
  if (upstreamCt) respHeaders['Content-Type'] = upstreamCt;

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: respHeaders,
  });
}

// ─── Route: POST /api/veo/generate ───────────────────────────────────────────

async function handleVeoGenerate(request, env, user) {
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

    // Use Veo 3.1 for all modes
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

    // Log usage
    logUsage(env, { userId: user.userId, orgId: null, mode: 'video', creditsUsed: 0 });

    // Quick-poll a few times
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

// ─── Route: GET /api/veo/status ───────────────────────────────────────────────

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

// ─── Route: GET /api/veo/download ─────────────────────────────────────────────

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

// ─── Route: POST /api/kling/generate ──────────────────────────────────────────

async function handleKlingGenerate(request, env, user) {
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

    // Log usage
    logUsage(env, { userId: user.userId, orgId: null, mode: 'video', creditsUsed: 0 });

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

// ─── Route: GET /api/kling/status ─────────────────────────────────────────────

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

// ─── Route: POST /api/convert/pdf-to-docx ────────────────────────────────────

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

// ─── Route: /api/ilovepdf/* (multi-step passthrough proxy) ───────────────────

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

// ─── URL Fetch Proxy (for material validation link fetching) ──────────────────

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

// ─── Route: GET /health/vertex (diagnostics, no JWT) ──────────────────────────

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

// ─── Router ───────────────────────────────────────────────────────────────────

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

    // ── Public routes (no JWT required) ──────────────────────────────────────

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

    // Stripe webhooks (public — verified via signature)
    if (path === '/webhooks/stripe' && request.method === 'POST') {
      return handleStripeWebhook(request, env);
    }

    // ── Protected routes (JWT required) ──────────────────────────────────────
    const user = await authenticateRequest(request, env);
    if (!user) return unauthorized(origin);

    // ── Gemini passthrough: /api/gemini/{anything} ──
    if (path.startsWith('/api/gemini/')) {
      const subpath = path.replace('/api/gemini/', '') + url.search;
      return handleGeminiProxy(request, env, subpath, user);
    }

    // ── Veo video generation ──
    if (path === '/api/veo/generate' && request.method === 'POST') return handleVeoGenerate(request, env, user);
    if (path === '/api/veo/status'   && request.method === 'GET')  return handleVeoStatus(request, env);
    if (path === '/api/veo/download' && request.method === 'GET')  return handleVeoDownload(request, env);
    if (path === '/api/veo/video'    && request.method === 'GET')  return handleVeoVideo(request, env);

    // ── Kling video generation ──
    if (path === '/api/kling/generate' && request.method === 'POST') return handleKlingGenerate(request, env, user);
    if (path === '/api/kling/status'   && request.method === 'GET')  return handleKlingStatus(request, env);

    // ── ConvertAPI ──
    if (path === '/api/convert/pdf-to-docx' && request.method === 'POST') return handleConvertApi(request, env);

    // ── iLovePDF multi-step proxy ──
    if (path.startsWith('/api/ilovepdf/')) {
      const subpath = path.replace('/api/ilovepdf/', '');
      return handleILovePdfProxy(request, env, subpath);
    }

    // ── URL fetch proxy (material validation link fetching) ──
    if (path === '/api/fetch-url' && request.method === 'GET') return handleFetchUrl(request, env);

    // ── User onboarding ──
    if (path === '/api/user/welcome' && request.method === 'POST') return handleUserWelcome(request, env, user);

    // ── Video pre-auth ──
    if (path === '/api/video/charge' && request.method === 'POST') return handleVideoCharge(request, env, user);

    // ── Billing ──
    if (path.startsWith('/billing/')) {
      if (!await checkRateLimit(user.userId, 'billing')) {
        return corsResponse(origin, { error: 'Too many billing requests. Please wait.' }, { status: 429 });
      }
    }
    if (path === '/billing/checkout' && request.method === 'POST') return handleBillingCheckout(request, env, user);
    if (path === '/billing/portal'   && request.method === 'POST') return handleBillingPortal(request, env, user);
    if (path === '/billing/credits'  && request.method === 'POST') return handleBillingCredits(request, env, user);

    // ── Team management ──
    if (path === '/team/invite'              && request.method === 'POST')   return handleTeamInvite(request, env, user);
    if (path === '/team/accept-invite'       && request.method === 'POST')   return handleTeamAcceptInvite(request, env, user);
    if (path === '/team/member'              && request.method === 'DELETE') return handleTeamRemoveMember(request, env, user);
    if (path === '/team/member/role'         && request.method === 'PATCH')  return handleTeamChangeRole(request, env, user);

    // ── Admin endpoints (require superadmin role) ──
    if (path.startsWith('/admin/')) {
      const adminOk = await isAdmin(env, user.userId);
      if (!adminOk) return forbidden(origin, 'Admin access required');

      if (path === '/admin/users'      && request.method === 'GET')   return handleAdminUsers(request, env);
      if (path === '/admin/orgs'       && request.method === 'GET')   return handleAdminOrgs(request, env);
      if (path === '/admin/revenue'    && request.method === 'GET')   return handleAdminRevenue(request, env);
      if (path === '/admin/analytics'  && request.method === 'GET')   return handleAdminAnalytics(request, env);

      // /admin/users/:id
      const userMatch = path.match(/^\/admin\/users\/([^/]+)(\/credits)?$/);
      if (userMatch) {
        const targetId = userMatch[1];
        if (userMatch[2] === '/credits' && request.method === 'POST') return handleAdminUserCredits(request, env, targetId);
        if (request.method === 'GET')   return handleAdminUserDetail(request, env, targetId);
        if (request.method === 'PATCH') return handleAdminUpdateUser(request, env, targetId);
      }

      // /admin/orgs/:id
      const orgMatch = path.match(/^\/admin\/orgs\/([^/]+)(\/credits)?$/);
      if (orgMatch) {
        const targetOrgId = orgMatch[1];
        if (orgMatch[2] === '/credits' && request.method === 'POST') return handleAdminOrgCredits(request, env, targetOrgId);
        if (request.method === 'GET')   return handleAdminOrgDetail(request, env, targetOrgId);
        if (request.method === 'PATCH') return handleAdminUpdateOrg(request, env, targetOrgId);
      }
    }

    return corsResponse(origin, { error: 'Not found' }, { status: 404 });
  },
};
