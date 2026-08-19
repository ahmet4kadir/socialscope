import { describe, expect, it } from 'vitest';

import { computePostTimeSeries } from './timeseries';
import type { SnapshotPoint } from './types';

const POSTED_AT = '2026-08-20T00:00:00.000Z';

const snap = (
  hoursAfter: number,
  likes: number,
  comments: number,
  views: number | null = null,
): SnapshotPoint => ({
  capturedAt: new Date(Date.parse(POSTED_AT) + hoursAfter * 3_600_000).toISOString(),
  likes,
  comments,
  shares: null,
  views,
});

// Engagements at 1h/2h/3h/4h/10h: 12, 24, 36, 40, 42.
const SNAPSHOTS = [
  snap(1, 10, 2, 100),
  snap(2, 20, 4, 200),
  snap(3, 30, 6, 300),
  snap(4, 33, 7),
  snap(10, 35, 7, 500),
];

describe('computePostTimeSeries', () => {
  it('builds the cumulative curve in hours since posting', () => {
    const { snapshotCount, curve } = computePostTimeSeries(POSTED_AT, SNAPSHOTS);
    expect(snapshotCount).toBe(5);
    expect(curve.map((p) => p.hours)).toEqual([1, 2, 3, 4, 10]);
    expect(curve.map((p) => p.engagement)).toEqual([12, 24, 36, 40, 42]);
  });

  it('computes per-hour growth intervals, with views only when both ends have them', () => {
    const { intervals } = computePostTimeSeries(POSTED_AT, SNAPSHOTS);
    expect(intervals.map((i) => i.engagementPerHour)).toEqual([12, 12, 4, 0.33]);
    expect(intervals.map((i) => i.deltaViews)).toEqual([100, 100, null, null]);
  });

  it('measures early velocity from the snapshot nearest 3h', () => {
    expect(computePostTimeSeries(POSTED_AT, SNAPSHOTS).earlyVelocity).toBe(12); // 36 / 3h
  });

  it('falls back to a 1-3h snapshot when none exists at ≥3h', () => {
    const result = computePostTimeSeries(POSTED_AT, [snap(2, 20, 4)]);
    expect(result.earlyVelocity).toBe(12); // 24 / 2h
  });

  it('reports no early velocity when tracking started too late', () => {
    expect(computePostTimeSeries(POSTED_AT, [snap(8, 40, 0)]).earlyVelocity).toBeNull();
  });

  it('finds the peak growth hour (earliest on ties) and the plateau', () => {
    const result = computePostTimeSeries(POSTED_AT, SNAPSHOTS);
    expect(result.peakGrowthHour).toBe(2); // rate 12/h, tie broken by earliest
    expect(result.plateauHour).toBe(10); // 0.33/h ≤ 10% of peak
  });

  it('reports no plateau while growth is still strong', () => {
    const result = computePostTimeSeries(POSTED_AT, SNAPSHOTS.slice(0, 4));
    expect(result.peakGrowthHour).toBe(2);
    expect(result.plateauHour).toBeNull(); // 4/h is still >10% of 12/h
  });

  it('handles flat posts (no growth at all)', () => {
    const flat = [snap(1, 5, 0), snap(2, 5, 0), snap(3, 5, 0)];
    const result = computePostTimeSeries(POSTED_AT, flat);
    expect(result.peakGrowthHour).toBeNull();
    expect(result.plateauHour).toBeNull();
  });

  it('dedupes identical timestamps and drops pre-post snapshots', () => {
    const messy = [snap(1, 10, 2), snap(1, 10, 2), snap(-1, 99, 0), snap(2, 20, 4)];
    const result = computePostTimeSeries(POSTED_AT, messy);
    expect(result.snapshotCount).toBe(2);
    expect(result.curve.map((p) => p.hours)).toEqual([1, 2]);
  });

  it('returns the empty shape for no data or a broken post date', () => {
    expect(computePostTimeSeries(POSTED_AT, []).snapshotCount).toBe(0);
    expect(computePostTimeSeries('garbage', SNAPSHOTS).snapshotCount).toBe(0);
  });
});
