import { GENERATION_MODES, type GenerationMode } from '../types';

/**
 * Small UI preferences that should survive a page refresh but not outlive the
 * browser session.
 *
 * These live in sessionStorage deliberately: it is the same lifetime as the
 * signed-in session (lib/googleAuth stores the user profile there too), so a
 * refresh keeps your place while closing the tab starts clean. Nothing here is
 * project work — the app stays a stateless session by design.
 *
 * Every access is guarded: storage throws outright in some privacy modes.
 */

const ACTIVE_MODE_KEY = 'archwiz:active-mode';

/** The mode the user was last in, or null if there is nothing usable stored. */
export function readPersistedMode(): GenerationMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(ACTIVE_MODE_KEY);
    // Never trust the value back out of storage — it can be stale from an older
    // build that had a mode this one no longer knows about.
    return GENERATION_MODES.includes(stored as GenerationMode)
      ? (stored as GenerationMode)
      : null;
  } catch {
    return null;
  }
}

export function persistMode(mode: GenerationMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ACTIVE_MODE_KEY, mode);
  } catch {
    // Storage unavailable or full — losing the preference is not worth an error.
  }
}

export function clearPersistedMode(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(ACTIVE_MODE_KEY);
  } catch {
    // Nothing to do.
  }
}
