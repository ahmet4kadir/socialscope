'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  Recommendation,
  RecommendationCategory,
  RecommendationPriority,
} from '@socialscope/shared';

import type { AccountSummary } from '@/lib/api-types';

interface Props {
  accounts: AccountSummary[] | null;
}

const PRIORITY_BADGES: Record<RecommendationPriority, { label: string; className: string }> = {
  high: { label: 'Yüksek öncelik', className: 'bg-amber-500/10 text-amber-400' },
  medium: { label: 'Orta öncelik', className: 'bg-sky-500/10 text-sky-400' },
  low: { label: 'Bilgi', className: 'bg-slate-700/40 text-slate-400' },
};

const CATEGORY_LABELS: Record<RecommendationCategory, string> = {
  zamanlama: 'Zamanlama',
  içerik: 'İçerik',
  sıklık: 'Sıklık',
  hashtag: 'Hashtag',
  büyüme: 'Büyüme',
  etkileşim: 'Etkileşim',
};

function accountKey(account: Pick<AccountSummary, 'platform' | 'username'>): string {
  return `${account.platform}:${account.username}`;
}

export function RecommendationsPanel({ accounts }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);

  useEffect(() => {
    if (selectedKey !== null || !accounts || accounts.length === 0) return;
    const mine = accounts.find((account) => account.role === 'me');
    setSelectedKey(accountKey(mine ?? accounts[0]!));
  }, [accounts, selectedKey]);

  const load = useCallback(async (key: string) => {
    const [platform, username] = key.split(':');
    if (!platform || !username) return;
    setRecommendations(null);
    try {
      const res = await fetch(
        `/api/recommendations?platform=${platform}&username=${encodeURIComponent(username)}`,
      );
      const data = (await res.json()) as { recommendations?: Recommendation[] };
      setRecommendations(data.recommendations ?? []);
    } catch {
      setRecommendations([]);
    }
  }, []);

  useEffect(() => {
    if (selectedKey) void load(selectedKey);
  }, [selectedKey, load]);

  if (accounts !== null && accounts.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm text-slate-500">
          Öneri üretmek için önce hesap ekleyip tarayın.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Öneriler</h2>
          <p className="text-sm text-slate-500">
            Tüm öneriler kendi verilerinizden türetilir; her kartın altında
            dayandığı kanıt yazar.
          </p>
        </div>
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

      {recommendations === null ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : recommendations.length === 0 ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-500">
            Henüz güçlü bir öneri üretecek kadar veri birikmedi. Tarama sayısı
            ve gönderi arşivi büyüdükçe (özellikle rakip verisiyle birlikte)
            öneriler burada belirecek.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {recommendations.map((rec) => {
            const badge = PRIORITY_BADGES[rec.priority];
            return (
              <article
                key={rec.id}
                className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    {CATEGORY_LABELS[rec.category]}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
                <h3 className="font-semibold">{rec.title}</h3>
                <p className="text-sm text-slate-300">{rec.advice}</p>
                <p className="border-l-2 border-emerald-500/40 pl-3 text-xs text-slate-500">
                  Kanıt: {rec.evidence}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
