import {
  engagementOf,
  mean,
  withValidDate,
  type PostStats,
} from './types';

export interface HeatmapCell {
  /** 0 = Sunday … 6 = Saturday (JS Date convention). */
  dayOfWeek: number;
  /** 0-23 in the given time zone. */
  hour: number;
  count: number;
  avgEngagement: number | null;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Posting day/hour → performance, in the audience's time zone (posted_at is
 * stored in UTC). Sparse: only slots that actually have posts appear.
 */
export function engagementHeatmap(
  posts: PostStats[],
  timeZone = 'Europe/Istanbul',
): HeatmapCell[] {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  });

  const cells = new Map<string, { dayOfWeek: number; hour: number; engagements: number[] }>();
  for (const post of withValidDate(posts)) {
    const parts = formatter.formatToParts(new Date(post.postedAt));
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '';
    const dayOfWeek = WEEKDAY_INDEX[weekday];
    const hour = Number(hourPart);
    if (dayOfWeek === undefined || !Number.isInteger(hour)) continue;

    const key = `${dayOfWeek}:${hour}`;
    const cell = cells.get(key) ?? { dayOfWeek, hour, engagements: [] };
    cell.engagements.push(engagementOf(post));
    cells.set(key, cell);
  }

  return [...cells.values()]
    .map(({ dayOfWeek, hour, engagements }) => ({
      dayOfWeek,
      hour,
      count: engagements.length,
      avgEngagement: mean(engagements),
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour);
}

/** The slot with the best average engagement (ties: more posts wins). */
export function bestHeatmapSlot(cells: HeatmapCell[]): HeatmapCell | null {
  let best: HeatmapCell | null = null;
  for (const cell of cells) {
    if (
      best === null ||
      (cell.avgEngagement ?? 0) > (best.avgEngagement ?? 0) ||
      ((cell.avgEngagement ?? 0) === (best.avgEngagement ?? 0) && cell.count > best.count)
    ) {
      best = cell;
    }
  }
  return best;
}
