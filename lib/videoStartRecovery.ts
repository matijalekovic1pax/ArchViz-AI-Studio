/**
 * Starts a billed video job over an unreliable connection. After a lost response
 * it checks whether the job already started before sending the request again.
 */
export type VideoStartOutcome<T> = { state: 'done'; result: T } | { state: 'pending' };
export type VideoStartProbe<T> = VideoStartOutcome<T> | { state: 'none' };

export const VIDEO_CONNECTION_ERROR_MESSAGE =
  'The connection to the video server dropped and could not be recovered. Please check your internet connection or VPN, then try again.';

const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000];

/** fetch() rejects with a TypeError when no readable response arrives. */
export const isConnectionFailure = (error: unknown): boolean =>
  error instanceof TypeError ||
  (error instanceof Error && error.message.startsWith('Request timed out'));

const waitFor = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Request aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });

export async function startVideoWithRecovery<T>(options: {
  send: () => Promise<VideoStartOutcome<T>>;
  lookup: () => Promise<VideoStartProbe<T>>;
  signal?: AbortSignal;
  delaysMs?: number[];
}): Promise<T> {
  const { send, lookup, signal, delaysMs = RETRY_DELAYS_MS } = options;
  let mayAlreadyExist = false;

  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    if (attempt > 0) await waitFor(delaysMs[attempt - 1], signal);
    try {
      if (mayAlreadyExist) {
        const probe = await lookup();
        if (probe.state === 'done') return probe.result;
        if (probe.state === 'pending') continue;
      }
      const outcome = await send();
      if (outcome.state === 'done') return outcome.result;
      mayAlreadyExist = true;
    } catch (error) {
      if (!isConnectionFailure(error)) throw error;
      mayAlreadyExist = true;
    }
  }

  throw new Error(VIDEO_CONNECTION_ERROR_MESSAGE);
}
