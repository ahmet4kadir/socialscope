'use client';

import { useCallback, useEffect, useState } from 'react';

import type { AccountSummary, AnalysisResponse } from '@/lib/api-types';

import {
  CategoryBarChart,
  FollowerChart,
  HeatmapGrid,
  HorizontalBarChart,
} from './charts';

interface Props {
  accounts: AccountSummary[] | null;
}

const MEDIA_LABELS: Record<string, string> = {
  image: 'Görsel',
  video: 'Video',
  carousel: 'Albüm',
  text: 'Metin',
  unknown: 'Bilinmiyor',
};

const LENGTH_LABELS: Record<string, string> = {
  '0': 'Açıklama yok',
  '1-50': '1-50',
  '51-150': '51-150',
  '151-300': '151-300',
  '301+': '301+',
};

function accountKey(account: Pick<AccountSummary, 'platform' | 'username'>): string {
  return `${account.platform}:${account.username}`;
}

function formatNumber(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('tr-TR');
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

export function AnalysisPanel({ accounts }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Default to my own account, else the first registered one.
  useEffect(() => {
    if (selectedKey !== null || !accounts || accounts.length === 0) return;
    const mine = accounts.find((account) => account.role === 'me');
    setSelectedKey(accountKey(mine ?? accounts[0]!));
  }, [accounts, selectedKey]);

  const load = useCallback(async (key: string) => {
    const [platform, username] = key.split(':');
    if (!platform || !username) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analysis?platform=${platform}&username=${encodeURIComponent(username)}`,
      );
      setData(res.ok ? ((await res.json()) as AnalysisResponse) : null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedKey) void load(selectedKey);
  }, [selectedKey, load]);

  if (accounts !== null && accounts.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <EmptyNote>
          Analiz için önce bir hesap ekleyip tarayın — Panel sekmesinden
          başlayabilirsiniz.
        </EmptyNote>
      </section>
    );
  }

  const metrics = data?.metrics ?? null;
  const followerPoints = data?.followers.filter((p) => p.followers !== null) ?? [];
  const currentFollowers =
    followerPoints.length > 0
      ? (followerPoints[followerPoints.length - 1]!.followers ?? null)
      : null;

  const profileTotal = data?.profilePostCount ?? null;
  const analyzedLabel =
    profileTotal !== null && metrics !== null && profileTotal > metrics.postCount
      ? `${formatNumber(metrics.postCount)} / ${formatNumber(profileTotal)}`
      : formatNumber(metrics?.postCount ?? null);

  const tiles: Array<{ label: string; value: string }> = [
    { label: 'Takipçi', value: formatNumber(currentFollowers) },
    { label: 'İncelenen gönderi', value: analyzedLabel },
    { label: 'Ort. etkileşim', value: formatNumber(metrics?.avgEngagement ?? null) },
    { label: 'Ort. beğeni', value: formatNumber(metrics?.avgLikes ?? null) },
    { label: 'Ort. yorum', value: formatNumber(metrics?.avgComments ?? null) },
    {
      label: 'Gönderi / hafta',
      value: formatNumber(metrics?.postingFrequencyPerWeek ?? null),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Hesap Analizi</h2>
        <select
          value={selectedKey ?? ''}
          onChange={(event) => setSelectedKey(event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        >
          {(accounts ?? []).map((account) => (
            <option key={accountKey(account)} value={accountKey(account)}>
              @{account.username} ({account.platform},{' '}
              {account.role === 'me' ? 'benim' : 'rakip'})
            </option>
          ))}
        </select>
      </div>

      {loading && <EmptyNote>Yükleniyor…</EmptyNote>}

      {!loading && data && metrics && (
        <>
          {metrics.postCount === 0 ? (
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <EmptyNote>
                Bu hesap için henüz gönderi verisi yok — önce bir tarama
                çalıştırın.
              </EmptyNote>
            </section>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {tiles.map((tile) => (
                  <div
                    key={tile.label}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">
                      {tile.label}
                    </p>
                    <p className="mt-1 text-xl font-bold">{tile.value}</p>
                  </div>
                ))}
              </div>

              <Section title="Takipçi gelişimi">
                {followerPoints.length >= 2 ? (
                  <FollowerChart points={data.followers} />
                ) : (
                  <EmptyNote>
                    Takipçi grafiği için en az iki tarama gerekli — her tarama
                    bir ölçüm ekler, veriler zamanla birikir.
                    {currentFollowers !== null &&
                      ` Şu anki takipçi sayısı: ${formatNumber(currentFollowers)}.`}
                  </EmptyNote>
                )}
              </Section>

              <Section title="Paylaşım saatleri ısı haritası (Türkiye saati)">
                <HeatmapGrid cells={data.heatmap} />
              </Section>

              <div className="grid gap-6 lg:grid-cols-2">
                <Section title="İçerik türü performansı">
                  <CategoryBarChart
                    data={data.media.map((m) => ({
                      name: `${MEDIA_LABELS[m.mediaType] ?? m.mediaType} (${m.count})`,
                      value: m.avgEngagement ?? 0,
                    }))}
                    valueLabel="Ort. etkileşim"
                  />
                </Section>

                <Section title="Açıklama uzunluğu ve performans">
                  <CategoryBarChart
                    data={data.contentLength.map((bucket) => ({
                      name: `${LENGTH_LABELS[bucket.bucket] ?? bucket.bucket} (${bucket.count})`,
                      value: bucket.avgEngagement ?? 0,
                    }))}
                    valueLabel="Ort. etkileşim"
                  />
                </Section>
              </div>

              <Section title="Hashtag performansı">
                {data.hashtags.length > 0 ? (
                  <HorizontalBarChart
                    data={data.hashtags.slice(0, 10).map((tag) => ({
                      name: `#${tag.hashtag} (${tag.count})`,
                      value: tag.avgEngagement ?? 0,
                    }))}
                    valueLabel="Ort. etkileşim"
                  />
                ) : (
                  <EmptyNote>
                    Bu hesabın gönderilerinde hashtag kullanılmamış — hashtag
                    stratejisi analizine veri girince burada görünecek.
                  </EmptyNote>
                )}
              </Section>
            </>
          )}
        </>
      )}
    </div>
  );
}
