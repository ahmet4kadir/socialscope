'use client';

import { useEffect, useState } from 'react';

import type { TrackedPostView } from '@/app/api/tracking/route';
import { formatDateTime, formatNumber } from '@/lib/format';

import { CategoryBarChart, GrowthCurveChart, OverlayLineChart } from './charts';

const OVERLAY_LIMIT = 5;

function postLabel(post: TrackedPostView): string {
  const date = new Date(post.postedAt).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
  });
  return `@${post.username} · ${date}`;
}

export function TrackingPanel({ technical }: { technical: boolean }) {
  const [posts, setPosts] = useState<TrackedPostView[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/tracking');
        const data = (await res.json()) as { posts?: TrackedPostView[] };
        setPosts(data.posts ?? []);
        setSelectedId((current) => current ?? data.posts?.[0]?.postId ?? null);
      } catch {
        setPosts([]);
      }
    })();
  }, []);

  if (posts === null) return <p className="text-sm text-slate-500">Yükleniyor…</p>;

  if (posts.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm text-slate-500">
          Henüz takip edilen gönderi yok. Panel sekmesinde bir gönderinin
          yanındaki &quot;Takibe Al&quot; butonunu kullanın; yeni
          gönderileriniz ise takip servisi çalışırken otomatik takibe alınır.
          {technical ? (
            <>
              {' '}Saatlik ölçümler için{' '}
              <code className="text-slate-400">npm run tracker</code> çalışıyor
              olmalı.
            </>
          ) : (
            ' Saatlik ölçümlerin birikmesi için takip servisinin açık olması gerekir.'
          )}
        </p>
      </section>
    );
  }

  const selected = posts.find((post) => post.postId === selectedId) ?? posts[0]!;
  const overlaySeries = posts
    .filter((post) => post.series.curve.length >= 2)
    .slice(0, OVERLAY_LIMIT)
    .map((post) => ({
      name: postLabel(post),
      points: post.series.curve
        .filter((point) => point.hours <= 24)
        .map((point) => ({ hours: point.hours, engagement: point.engagement })),
    }))
    .filter((entry) => entry.points.length >= 2);

  const stats: Array<{ label: string; value: string }> = [
    { label: 'Ölçüm sayısı', value: formatNumber(selected.series.snapshotCount) },
    {
      label: 'Erken hız (ilk 3s)',
      value:
        selected.series.earlyVelocity === null
          ? '—'
          : `${formatNumber(selected.series.earlyVelocity)}/saat`,
    },
    {
      label: 'Zirve saati',
      value:
        selected.series.peakGrowthHour === null
          ? '—'
          : `${selected.series.peakGrowthHour}. saat`,
    },
    {
      label: 'Plato',
      value:
        selected.series.plateauHour === null
          ? '—'
          : `${selected.series.plateauHour}. saat`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Gönderi Takibi</h2>
        <select
          value={selected.postId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        >
          {posts.map((post) => (
            <option key={post.postId} value={post.postId}>
              {postLabel(post)} {post.status === 'active' ? '(takipte)' : '(bitti)'}
            </option>
          ))}
        </select>
      </div>

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center gap-4">
          {selected.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selected.thumbnailUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-md object-cover"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-slate-300">
              {selected.contentText || <em className="text-slate-600">açıklama yok</em>}
            </p>
            <p className="text-xs text-slate-500">
              Paylaşım: {formatDateTime(selected.postedAt)} · Takip bitişi:{' '}
              {formatDateTime(selected.autoStopAt)} ·{' '}
              <a
                href={selected.url}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline"
              >
                Gönderiye git ↗
              </a>
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              selected.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-slate-700/40 text-slate-400'
            }`}
          >
            {selected.status === 'active' ? 'Takipte' : 'Takip bitti'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg bg-slate-950 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                {stat.label}
              </p>
              <p className="mt-1 text-lg font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {selected.series.curve.length >= 2 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Büyüme eğrisi (toplam etkileşim)
              </h3>
              <GrowthCurveChart
                points={selected.series.curve.map((point) => ({
                  hours: point.hours,
                  engagement: point.engagement,
                }))}
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Saatlik büyüme hızı
              </h3>
              <CategoryBarChart
                data={selected.series.intervals.map((interval) => ({
                  name: `${Math.round(interval.toHour)}s`,
                  value: interval.engagementPerHour,
                }))}
                valueLabel="Etkileşim / saat"
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Eğri için en az iki ölçüm gerekli, tracker çalıştıkça saatlik
            ölçümler birikir.
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          İlk 24 saat karşılaştırması (son {OVERLAY_LIMIT} takip)
        </h3>
        {overlaySeries.length > 0 ? (
          <OverlayLineChart series={overlaySeries} />
        ) : (
          <p className="text-sm text-slate-500">
            Bu grafik, takip edilen gönderilerin ilk 24 saatteki büyüme
            eğrilerini üst üste bindirir, hangi gönderinin daha hızlı
            &quot;kalktığını&quot; gösterir. En az bir gönderide iki ölçüm
            birikince burada belirir.
          </p>
        )}
      </section>
    </div>
  );
}
