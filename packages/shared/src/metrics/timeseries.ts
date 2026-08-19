import { engagementOf, round2, type SnapshotPoint } from './types';

const HOUR_MS = 60 * 60 * 1000;

/** Cumulative counters at one moment, positioned in hours since posting. */
export interface CurvePoint {
  hours: number;
  likes: number;
  comments: number;
  views: number | null;
  engagement: number;
}

/** Growth between two consecutive snapshots. */
export interface GrowthInterval {
  fromHour: number;
  toHour: number;
  deltaLikes: number;
  deltaComments: number;
  deltaViews: number | null;
  deltaEngagement: number;
  /** Engagement growth normalized per hour — comparable across gap sizes. */
  engagementPerHour: number;
}

export interface PostTimeSeriesMetrics {
  snapshotCount: number;
  curve: CurvePoint[];
  intervals: GrowthInterval[];
  /**
   * Engagement gained per hour over roughly the first 3h of the post's life
   * (a post starts at zero engagement). Null when tracking started too late
   * (first snapshot after ~6h) or there are no snapshots.
   */
  earlyVelocity: number | null;
  /** Hour (since posting) at the end of the fastest-growing interval. */
  peakGrowthHour: number | null;
  /**
   * First hour after the peak where growth fell to ≤10% of the peak rate
   * — i.e. where the post stopped taking off. Null if it never plateaued
   * within the observed window.
   */
  plateauHour: number | null;
}

const EMPTY: PostTimeSeriesMetrics = {
  snapshotCount: 0,
  curve: [],
  intervals: [],
  earlyVelocity: null,
  peakGrowthHour: null,
  plateauHour: null,
};

export function computePostTimeSeries(
  postedAt: string,
  snapshots: SnapshotPoint[],
): PostTimeSeriesMetrics {
  const postedMs = Date.parse(postedAt);
  if (!Number.isFinite(postedMs)) return EMPTY;

  // Keep one snapshot per timestamp, in order, and never before the post
  // itself existed (clock skew in scraped data).
  const byTime = new Map<number, SnapshotPoint>();
  for (const snapshot of snapshots) {
    const at = Date.parse(snapshot.capturedAt);
    if (Number.isFinite(at) && at >= postedMs) byTime.set(at, snapshot);
  }
  const ordered = [...byTime.entries()].sort(([a], [b]) => a - b);
  if (ordered.length === 0) return EMPTY;

  const curve: CurvePoint[] = ordered.map(([at, snap]) => ({
    hours: round2((at - postedMs) / HOUR_MS),
    likes: snap.likes,
    comments: snap.comments,
    views: snap.views,
    engagement: engagementOf(snap),
  }));

  const intervals: GrowthInterval[] = [];
  for (let i = 1; i < curve.length; i += 1) {
    const prev = curve[i - 1]!;
    const next = curve[i]!;
    const hoursBetween = next.hours - prev.hours;
    if (hoursBetween <= 0) continue;
    const deltaEngagement = next.engagement - prev.engagement;
    intervals.push({
      fromHour: prev.hours,
      toHour: next.hours,
      deltaLikes: next.likes - prev.likes,
      deltaComments: next.comments - prev.comments,
      deltaViews:
        next.views !== null && prev.views !== null ? next.views - prev.views : null,
      deltaEngagement,
      engagementPerHour: round2(deltaEngagement / hoursBetween),
    });
  }

  return {
    snapshotCount: curve.length,
    curve,
    intervals,
    earlyVelocity: computeEarlyVelocity(curve),
    ...computePeakAndPlateau(intervals),
  };
}

function computeEarlyVelocity(curve: CurvePoint[]): number | null {
  // Preferred: the first snapshot at ≥3h (but ≤6h, else tracking started too
  // late to call it "early"). Fallback: the last snapshot in [1h, 3h).
  const atOrAfter3h = curve.find((point) => point.hours >= 3);
  if (atOrAfter3h && atOrAfter3h.hours <= 6) {
    return round2(atOrAfter3h.engagement / atOrAfter3h.hours);
  }
  if (atOrAfter3h === undefined) {
    const early = [...curve].reverse().find((p) => p.hours >= 1 && p.hours < 3);
    if (early) return round2(early.engagement / early.hours);
  }
  return null;
}

function computePeakAndPlateau(
  intervals: GrowthInterval[],
): Pick<PostTimeSeriesMetrics, 'peakGrowthHour' | 'plateauHour'> {
  if (intervals.length === 0) return { peakGrowthHour: null, plateauHour: null };

  let peakIndex = 0;
  for (let i = 1; i < intervals.length; i += 1) {
    if (intervals[i]!.engagementPerHour > intervals[peakIndex]!.engagementPerHour) {
      peakIndex = i;
    }
  }
  const peakRate = intervals[peakIndex]!.engagementPerHour;
  if (peakRate <= 0) return { peakGrowthHour: null, plateauHour: null };

  let plateauHour: number | null = null;
  for (let i = peakIndex + 1; i < intervals.length; i += 1) {
    if (intervals[i]!.engagementPerHour <= peakRate * 0.1) {
      plateauHour = Math.round(intervals[i]!.toHour);
      break;
    }
  }

  return {
    peakGrowthHour: Math.round(intervals[peakIndex]!.toHour),
    plateauHour,
  };
}
