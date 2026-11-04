// Makes video start requests safe to retry. Starting a video is billed, and a
// browser on a poor connection can lose the response after the job has started.
// Each click carries a request id; the ledger remembers what that id started so
// a retry gets the running job back instead of paying for a second one.
export const VIDEO_REQUEST_ID_HEADER = 'X-Video-Request-Id';
const LEASE_MS = 2 * 60_000;
const RETENTION_MS = 48 * 60 * 60_000;
const MAX_STORED_CHARS = 1_000_000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export class VideoStartLedger {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const { op, body, status } = await request.json();
    const now = Date.now();
    const entry = await this.storage.get('entry');
    const live = entry?.state === 'done' || (entry?.state === 'pending' && entry.leaseUntil > now) ? entry : null;

    if (op === 'lookup') return Response.json(live || { state: 'none' });
    if (op === 'claim') {
      if (live) return Response.json(live);
      await this.storage.put('entry', { state: 'pending', leaseUntil: now + LEASE_MS });
      await this.storage.setAlarm(now + RETENTION_MS);
      return Response.json({ state: 'claimed' });
    }
    if (op === 'complete') {
      await this.storage.put('entry', { state: 'done', body, status });
      return Response.json({ state: 'done' });
    }
    if (op === 'release') {
      await this.storage.deleteAlarm();
      await this.storage.deleteAll();
      return Response.json({ state: 'none' });
    }
    return Response.json({ error: 'Unknown ledger operation' }, { status: 400 });
  }

  async alarm() {
    await this.storage.deleteAll();
  }
}

async function callLedger(env, user, requestId, payload) {
  const namespace = env.VIDEO_START_LEDGER;
  const stub = namespace.get(namespace.idFromName(`${user.email}:${requestId}`));
  const response = await stub.fetch('https://video-start-ledger/', { method: 'POST', body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Video start ledger failed (${response.status})`);
  return response.json();
}

const isValidRequestId = (value) => typeof value === 'string' && REQUEST_ID_PATTERN.test(value);

/** Only a job that really started is worth replaying; failures may be retried. */
function isReplayable(response, body) {
  if (!response.ok || body.length > MAX_STORED_CHARS) return false;
  try {
    return JSON.parse(body)?.status !== 'error';
  } catch {
    return false;
  }
}

/** Runs a billed video start at most once per request id. */
export async function runVideoStart(request, env, ctx, user, respond, handler) {
  const origin = request.headers.get('Origin') || '';
  const requestId = request.headers.get(VIDEO_REQUEST_ID_HEADER);
  if (!env.VIDEO_START_LEDGER || !isValidRequestId(requestId)) return handler();

  let claim;
  try {
    claim = await callLedger(env, user, requestId, { op: 'claim' });
  } catch (err) {
    // The ledger only protects retries, so its failure must not block generation.
    console.warn('[video-start] claim failed', err?.message || err);
    return handler();
  }
  if (claim.state === 'done') return respond(origin, claim.body, { status: claim.status });
  if (claim.state === 'pending') return respond(origin, { status: 'pending' }, { status: 202 });

  const settle = async (payload) => {
    try {
      await callLedger(env, user, requestId, payload);
    } catch (err) {
      console.warn(`[video-start] ${payload.op} failed`, err?.message || err);
    }
  };

  // Keep going if the browser disconnects, so the job's id still gets recorded.
  const work = (async () => {
    let response;
    try {
      response = await handler();
    } catch (err) {
      await settle({ op: 'release' });
      throw err;
    }
    const body = await response.clone().text();
    await settle(isReplayable(response, body)
      ? { op: 'complete', body, status: response.status }
      : { op: 'release' });
    return response;
  })();
  ctx.waitUntil(work.catch(() => {}));
  return work;
}

/** Lets a client that lost a response check on a start without re-uploading it. */
export async function lookupVideoStart(request, env, user, respond) {
  const origin = request.headers.get('Origin') || '';
  const requestId = new URL(request.url).searchParams.get('id');
  if (!isValidRequestId(requestId)) return respond(origin, { error: 'Invalid video request id' }, { status: 400 });
  if (!env.VIDEO_START_LEDGER) return respond(origin, { state: 'none' });

  const entry = await callLedger(env, user, requestId, { op: 'lookup' });
  if (entry.state === 'done') return respond(origin, { state: 'done', result: JSON.parse(entry.body) });
  return respond(origin, { state: entry.state === 'pending' ? 'pending' : 'none' });
}
