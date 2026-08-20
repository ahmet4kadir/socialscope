'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { HeatmapCell } from '@socialscope/shared';

import type { FollowerPoint } from '@/lib/api-types';
import { formatNumber } from '@/lib/format';

// Chart tokens on the app's dark slate surface. Identity is carried by axis
// labels everywhere, so a single accent hue does all the work (no rainbow).
const ACCENT = '#10b981'; // emerald-500
const INK_MUTED = '#94a3b8'; // slate-400
const GRID = '#1e293b'; // slate-800

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
} as const;

const AXIS_TICK = { fill: INK_MUTED, fontSize: 11 } as const;

const formatTick = (value: number): string => formatNumber(value);
const formatTooltipValue = (value: unknown): string =>
  typeof value === 'number' ? formatNumber(value) : String(value);

interface NamedValue {
  name: string;
  value: number;
  detail?: string;
}

/** Vertical bars of one measure across categories. */
export function CategoryBarChart({
  data,
  valueLabel,
}: {
  data: NamedValue[];
  valueLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatTick} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: '#1e293b', opacity: 0.4 }}
          formatter={(value) => [formatTooltipValue(value), valueLabel]}
        />
        <Bar dataKey="value" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars — used where category names are long (hashtags). */
export function HorizontalBarChart({
  data,
  valueLabel,
}: {
  data: NamedValue[];
  valueLabel: string;
}) {
  const height = Math.max(120, data.length * 34 + 30);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          tickFormatter={formatTick}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: '#1e293b', opacity: 0.4 }}
          formatter={(value) => [formatTooltipValue(value), valueLabel]}
        />
        <Bar dataKey="value" fill={ACCENT} radius={[0, 4, 4, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const NEUTRAL = '#64748b'; // slate-500 — competitor bars

// Validated categorical order for multi-series overlays (dark surface;
// dataviz validator: lightness band, chroma, CVD separation, contrast all
// pass). Assigned in fixed order, never cycled per-render.
export const CATEGORICAL = ['#059669', '#0284c7', '#d97706', '#8b5cf6', '#ec4899'];

interface EmphasisValue {
  name: string;
  value: number;
  /** true = my account (accent color); false = competitor (neutral). */
  emphasized: boolean;
}

/**
 * One measure across accounts, my own account emphasized in the accent hue.
 * Two-class encoding (benim/rakip), so it ships with a small legend.
 */
export function EmphasisBarChart({
  data,
  valueLabel,
}: {
  data: EmphasisValue[];
  valueLabel: string;
}) {
  return (
    <div className="space-y-1">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatTick} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: '#1e293b', opacity: 0.4 }}
            formatter={(value) => [formatTooltipValue(value), valueLabel]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.emphasized ? ACCENT : NEUTRAL} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-end gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: ACCENT }} />
          Benim hesabım
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: NEUTRAL }} />
          Rakip
        </span>
      </div>
    </div>
  );
}

/** Follower count over time — a single line, so no legend needed. */
export function FollowerChart({ points }: { points: FollowerPoint[] }) {
  const data = points
    .filter((p) => p.followers !== null)
    .map((p) => ({
      name: new Date(p.capturedAt).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
      }),
      value: p.followers as number,
    }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
          tickFormatter={formatTick}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [formatTooltipValue(value), 'Takipçi']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={ACCENT}
          strokeWidth={2}
          dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface CurvePointInput {
  hours: number;
  engagement: number;
}

/** One tracked post's cumulative engagement over hours since posting. */
export function GrowthCurveChart({ points }: { points: CurvePointInput[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          type="number"
          dataKey="hours"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          tickFormatter={(h: number) => `${Math.round(h)}s`}
          domain={[0, 'dataMax']}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatTick} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(h) => `${Math.round(Number(h))}. saat`}
          formatter={(value) => [formatTooltipValue(value), 'Etkileşim']}
        />
        <Line
          type="monotone"
          dataKey="engagement"
          stroke={ACCENT}
          strokeWidth={2}
          dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export interface OverlaySeries {
  name: string;
  points: CurvePointInput[];
}

/**
 * First-24h overlay: each tracked post's engagement curve on a shared
 * hours-since-posting axis. Multiple series → validated categorical palette
 * in fixed order + a legend.
 */
export function OverlayLineChart({ series }: { series: OverlaySeries[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          type="number"
          dataKey="hours"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          tickFormatter={(h: number) => `${Math.round(h)}s`}
          domain={[0, 24]}
          ticks={[0, 6, 12, 18, 24]}
          allowDataOverflow
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatTick} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(h) => `${Math.round(Number(h))}. saat`}
          formatter={(value, name) => [formatTooltipValue(value), String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: INK_MUTED }} />
        {series.map((entry, index) => (
          <Line
            key={entry.name}
            data={entry.points}
            dataKey="engagement"
            name={entry.name}
            type="monotone"
            stroke={CATEGORICAL[index % CATEGORICAL.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Posting heatmap: day × hour grid, sequential one-hue ramp (dark→bright on
// the dark surface). Recharts has no heatmap; a CSS grid does it better.
// ---------------------------------------------------------------------------

// Emerald ramp, low → high engagement.
const RAMP = ['#064e3b', '#047857', '#059669', '#10b981', '#34d399'];
const EMPTY_CELL = 'rgba(30, 41, 59, 0.45)'; // slate-800 @ 45%

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday-first
export const DAY_LABELS: Record<number, string> = {
  0: 'Paz',
  1: 'Pzt',
  2: 'Sal',
  3: 'Çar',
  4: 'Per',
  5: 'Cum',
  6: 'Cmt',
};

export function HeatmapGrid({ cells }: { cells: HeatmapCell[] }) {
  const byKey = new Map(cells.map((cell) => [`${cell.dayOfWeek}:${cell.hour}`, cell]));
  const max = Math.max(...cells.map((c) => c.avgEngagement ?? 0), 1);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px] space-y-1">
        {DAY_ORDER.map((day) => (
          <div key={day} className="flex items-center gap-1">
            <span className="w-8 shrink-0 text-right text-[10px] text-slate-500">
              {DAY_LABELS[day]}
            </span>
            {Array.from({ length: 24 }, (_, hour) => {
              const cell = byKey.get(`${day}:${hour}`);
              const value = cell?.avgEngagement ?? null;
              const color =
                value === null
                  ? EMPTY_CELL
                  : RAMP[Math.min(RAMP.length - 1, Math.floor((value / max) * RAMP.length))];
              return (
                <div
                  key={hour}
                  title={
                    cell
                      ? `${DAY_LABELS[day]} ${String(hour).padStart(2, '0')}:00 — ort. etkileşim ${value}, ${cell.count} gönderi`
                      : `${DAY_LABELS[day]} ${String(hour).padStart(2, '0')}:00 — gönderi yok`
                  }
                  className="h-4 flex-1 rounded-[3px]"
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
        ))}
        <div className="flex items-center gap-1 pl-9 text-[10px] text-slate-500">
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour} className="flex-1 text-center">
              {hour % 3 === 0 ? hour : ''}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-end gap-1 pt-1 text-[10px] text-slate-500">
          Az
          {RAMP.map((color) => (
            <span
              key={color}
              className="h-3 w-3 rounded-[3px]"
              style={{ backgroundColor: color }}
            />
          ))}
          Çok
        </div>
      </div>
    </div>
  );
}
