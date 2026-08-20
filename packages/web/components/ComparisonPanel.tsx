'use client';

import { useEffect, useState } from 'react';

import type { ComparisonAccount, ComparisonResponse } from '@/lib/api-types';
import { formatNumber } from '@/lib/format';

import { DAY_LABELS, EmphasisBarChart } from './charts';

const MEDIA_LABELS: Record<string, string> = {
  image: 'Görsel',
  video: 'Video',
  carousel: 'Albüm',
  text: 'Metin',
  unknown: 'Bilinmiyor',
};

interface MetricRow {
  label: string;
  value: (account: ComparisonAccount) => number | null;
  format?: (value: number) => string;
}

// Numeric rows where "highest = best" gets the highlight.
const METRIC_ROWS: MetricRow[] = [
  { label: 'Takipçi', value: (a) => a.followers },
  { label: 'Takipçi değişimi', value: (a) => a.followerGrowth },
  { label: 'Ort. etkileşim', value: (a) => a.avgEngagement },
  { label: 'Ort. beğeni', value: (a) => a.avgLikes },
  { label: 'Ort. yorum', value: (a) => a.avgComments },
  { label: 'Gönderi / hafta', value: (a) => a.postingFrequencyPerWeek },
  { label: 'Profil gönderi sayısı', value: (a) => a.profilePostCount },
  { label: 'İncelenen gönderi', value: (a) => a.postCount },
];

function bestSlotLabel(account: ComparisonAccount): string {
  if (!account.bestSlot) return '—';
  const day = DAY_LABELS[account.bestSlot.dayOfWeek] ?? '?';
  return `${day} ${String(account.bestSlot.hour).padStart(2, '0')}:00`;
}

function topMediaLabel(account: ComparisonAccount): string {
  if (!account.topMediaType) return '—';
  return MEDIA_LABELS[account.topMediaType.mediaType] ?? account.topMediaType.mediaType;
}

export function ComparisonPanel() {
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/comparison');
        if (!res.ok) {
          setFailed(true);
          return;
        }
        setData((await res.json()) as ComparisonResponse);
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  if (failed) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm text-rose-300">
          Karşılaştırma verileri yüklenemedi, sayfayı yenileyip tekrar deneyin.
        </p>
      </section>
    );
  }
  if (data === null) {
    return <p className="text-sm text-slate-500">Yükleniyor…</p>;
  }

  const accounts = data.accounts.filter((account) => account.postCount > 0);

  if (accounts.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm text-slate-500">
          Karşılaştırma için taranmış hesap gerekli, Panel sekmesinden önce
          kendi hesabınızı, sonra rakiplerinizi tarayın.
        </p>
      </section>
    );
  }

  const chartData = (pick: (a: ComparisonAccount) => number | null) =>
    accounts
      .filter((account) => pick(account) !== null)
      .map((account) => ({
        name: `@${account.username}`,
        value: pick(account) as number,
        emphasized: account.role === 'me',
      }));

  const engagementData = chartData((a) => a.avgEngagement);
  const followerData = chartData((a) => a.followers);
  const frequencyData = chartData((a) => a.postingFrequencyPerWeek);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Rakip Karşılaştırması</h2>
        {accounts.length < 2 && (
          <p className="text-sm text-amber-400">
            Şu an tek hesap var, rakip ekleyip taradığınızda yan yana
            karşılaştırma burada belirir.
          </p>
        )}
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="py-2 pr-4 text-xs uppercase tracking-wider text-slate-500">
                  Metrik
                </th>
                {accounts.map((account) => (
                  <th key={`${account.platform}:${account.username}`} className="py-2 pr-4">
                    <span className={account.role === 'me' ? 'text-emerald-400' : ''}>
                      @{account.username}
                    </span>
                    <span className="ml-2 text-[10px] font-normal uppercase text-slate-500">
                      {account.role === 'me' ? 'benim' : 'rakip'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map((row) => {
                const values = accounts.map((account) => row.value(account));
                const best = Math.max(...values.filter((v): v is number => v !== null));
                return (
                  <tr key={row.label} className="border-b border-slate-800/60">
                    <td className="py-2 pr-4 text-slate-400">{row.label}</td>
                    {accounts.map((account, index) => {
                      const value = values[index] ?? null;
                      const isBest =
                        value !== null && value === best && accounts.length > 1;
                      return (
                        <td
                          key={`${account.platform}:${account.username}`}
                          className={`py-2 pr-4 ${isBest ? 'font-semibold text-emerald-400' : ''}`}
                        >
                          {formatNumber(value)}
                          {isBest && ' ★'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="border-b border-slate-800/60">
                <td className="py-2 pr-4 text-slate-400">En iyi saat</td>
                {accounts.map((account) => (
                  <td key={`${account.platform}:${account.username}`} className="py-2 pr-4">
                    {bestSlotLabel(account)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-800/60">
                <td className="py-2 pr-4 text-slate-400">En etkili içerik türü</td>
                {accounts.map((account) => (
                  <td key={`${account.platform}:${account.username}`} className="py-2 pr-4">
                    {topMediaLabel(account)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 pr-4 text-slate-400">Öne çıkan hashtagler</td>
                {accounts.map((account) => (
                  <td key={`${account.platform}:${account.username}`} className="py-2 pr-4">
                    {account.topHashtags.length > 0
                      ? account.topHashtags.map((tag) => `#${tag}`).join(' ')
                      : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {accounts.length > 1 && (
          <p className="mt-2 text-xs text-slate-500">★ satırın en iyi değeri</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Ort. etkileşim
          </h3>
          {engagementData.length > 0 ? (
            <EmphasisBarChart data={engagementData} valueLabel="Ort. etkileşim" />
          ) : (
            <p className="text-sm text-slate-500">Veri yok.</p>
          )}
        </section>
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Takipçi
          </h3>
          {followerData.length > 0 ? (
            <EmphasisBarChart data={followerData} valueLabel="Takipçi" />
          ) : (
            <p className="text-sm text-slate-500">
              Takipçi verisi taramalarla birikir.
            </p>
          )}
        </section>
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Gönderi / hafta
          </h3>
          {frequencyData.length > 0 ? (
            <EmphasisBarChart data={frequencyData} valueLabel="Gönderi / hafta" />
          ) : (
            <p className="text-sm text-slate-500">
              Sıklık için hesap başına en az iki gönderi gerekli.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
