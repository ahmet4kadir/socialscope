// Pure scheduling rules for post tracking — no I/O, fully testable.
//
// Per spec: hourly snapshots (±10min jitter) for the first 24h of tracking,
// then every 6h for the second 24h, hard stop 48h after tracking started.

export const HOUR_MS = 60 * 60 * 1000;
export const HOURLY_PHASE_MS = 24 * HOUR_MS;
export const TRACKING_TOTAL_MS = 48 * HOUR_MS;
export const SIX_HOURS_MS = 6 * HOUR_MS;
export const JITTER_MS = 10 * 60 * 1000;

/** Snapshot interval for a post at a given moment of its tracking window. */
export function cadenceMs(trackingStartedAt: string, now: number): number {
  return now - Date.parse(trackingStartedAt) < HOURLY_PHASE_MS
    ? HOUR_MS
    : SIX_HOURS_MS;
}

/**
 * When the next snapshot is due: one cadence after the last one, shifted by
 * a random jitter in [-10min, +10min]. `random` is injected for testability
 * (pass Math.random in production).
 */
export function nextDueAt(
  lastSnapshotAtMs: number,
  cadence: number,
  random: () => number,
): number {
  const jitter = Math.round((random() * 2 - 1) * JITTER_MS);
  return lastSnapshotAtMs + cadence + jitter;
}

/**
 * Whether a first-seen post should be auto-enrolled: only posts still inside
 * the 48h tracking-worthy window. (Without this, the very first sweep of an
 * account would enroll its entire 25-post history.)
 */
export function shouldAutoEnroll(postedAt: string, now: number): boolean {
  const postedMs = Date.parse(postedAt);
  return Number.isFinite(postedMs) && now - postedMs < TRACKING_TOTAL_MS;
}

export function autoStopAt(trackingStartedAt: string): string {
  return new Date(Date.parse(trackingStartedAt) + TRACKING_TOTAL_MS).toISOString();
}
