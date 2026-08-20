'use client';

import { useCallback, useEffect, useState } from 'react';

import type { TrendsResponse } from '@/app/api/trends/route';
import type { AccountSummary } from '@/lib/api-types';
import { formatNumber } from '@/lib/format';

interface Props {
  accounts: AccountSummary[] | null;
}

function accountKey(account: Pick<AccountSummary, 'platform' | 'username'>): string {
  return `${account.platform}:${account.username}`;
}

function Delta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null || previous === 0) {
    return <span className="text-xs text-slate-500">önceki dönem verisi yok</span>;
  }
  const change = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (change === 0) return <span className="text-xs text-slate-500">değişim yok</span>;
  return (
    <span
      className={`text-xs font-medium ${change > 0 ? 'text-emerald-400' : 'text-rose-400'}`}
    >
      {change > 0 ? '▲' : '▼'} %{Math.abs(change)}
    </span>
  );
}

export function TrendsPanel({ accounts }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [days, setDays] = useState<7 | 30>(30);
  const [data, setData] = useState<TrendsResponse | null>(null);

  useEffect(() => {
    if (selectedKey !== null || !accounts || accounts.length === 0) return;
    const mine = accounts.find((account) => account.role === 'me');
    setSelectedKey(accountKey(mine ?? accounts[0]!));
  }, [accounts, selectedKey]);

  const load = useCallback(async (key: string, windowDays: number) => {
    const [platform, username] = key.split(':');
    if (!platform || !username) return;
    setData(null);
    try {
      const res = await fetch(
        `/api/trends?platform=${platform}&username=${encodeURIComponent(username)}&days=${windowDays}`,
      );
      setData(res.ok ? ((await res.json()) as TrendsResponse) : null);
    } catch {
      setData(null);
    }
  }, []);

  useEffect(() => {
    if (selectedKey) void load(selectedKey, days);
  }, [selectedKey, days, load]);

  if (accounts !== null && accounts.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm text-slate-500">
          Trendler için önce hesap ekleyip tarayın.
        </p>
      </section>
    );
  }

  const cards: Array<{
    label: string;
    current: number | null;
    previous: number | null;
  }> = data
    ? [
        { label: 'Gönderi sayısı', current: data.current.postCount, previous: data.previous.postCount },
        { label: 'Ort. etkileşim', current: data.current.avgEngagement, previous: data.previous.avgEngagement },
        { label: 'Toplam etkileşim', current: data.current.totalEngagement, previous: data.previous.totalEngagement },
        { label: 'Ort. beğeni', current: data.current.avgLikes, previous: data.previous.avgLikes },
        { label: 'Takipçi değişimi', current: data.current.followerChange, previous: data.previous.followerChange },
      ]
    : [];

  const nothing =
    data !== null &&
    data.current.postCount === 0 &&
    data.previous.postCount === 0 &&
    data.current.followerChange === null &&
    data.previous.followerChange === null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Dönem Trendleri</h2>
          <p className="text-sm text-slate-500">
            Seçili dönem, bir önceki eşit uzunluktaki dönemle karşılaştırılır.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-700 text-xs font-medium">
            {([7, 30] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value)}
                className={`px-3 py-1.5 transition ${
                  days === value
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {value} gün
              </button>
            ))}
          </div>
          <select
            value={selectedKey ?? ''}
            onChange={(event) => setSelectedKey(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            {(accounts ?? []).map((account) => (
              <option key={accountKey(account)} value={accountKey(account)}>
                @{account.username} ({account.platform})
              </option>
            ))}
          </select>
        </div>
      </div>

      {data === null ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : nothing ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-500">
            Son {days * 2} günde bu hesap için veri yok. Hesap düzenli
            tarandıkça dönemler arası karşılaştırma burada belirir.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((card) => (
            <article
              key={card.label}
              className="space-y-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-4"
            >
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                {card.label}
              </p>
              <p className="text-2xl font-bold">{formatNumber(card.current)}</p>
              <p className="text-xs text-slate-500">
                Önceki dönem: {formatNumber(card.previous)}
              </p>
              <Delta current={card.current} previous={card.previous} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
