'use client';

import { useCallback, useEffect, useState } from 'react';

import type { GoalMetric, GoalView } from '@/app/api/goals/route';
import type { AccountSummary } from '@/lib/api-types';
import { formatNumber } from '@/lib/format';

interface Props {
  accounts: AccountSummary[] | null;
}

const METRIC_LABELS: Record<GoalMetric, string> = {
  followers: 'Takipçi sayısı',
  avg_engagement: 'Ort. etkileşim',
  posting_frequency: 'Haftalık gönderi',
};

export function GoalsPanel({ accounts }: Props) {
  const [goals, setGoals] = useState<GoalView[] | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accountKey, setAccountKey] = useState('');
  const [metric, setMetric] = useState<GoalMetric>('followers');
  const [target, setTarget] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/goals');
      const data = (await res.json()) as { goals?: GoalView[]; error?: string };
      setGoals(data.goals ?? []);
      setWarning(data.error ?? null);
    } catch {
      setGoals([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (accountKey === '' && accounts && accounts.length > 0) {
      const mine = accounts.find((account) => account.role === 'me');
      const first = mine ?? accounts[0]!;
      setAccountKey(`${first.platform}:${first.username}`);
    }
  }, [accounts, accountKey]);

  async function createGoal(): Promise<void> {
    setError(null);
    const [platform, username] = accountKey.split(':');
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, username, metric, target: Number(target) }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Hedef oluşturulamadı.');
        return;
      }
      setTarget('');
      void refresh();
    } catch {
      setError('Sunucuya ulaşılamadı.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Hedefler</h2>
        <p className="text-sm text-slate-500">
          Hesap başına KPI hedefleri koyun; ilerleme mevcut verilerden canlı
          hesaplanır.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (accountKey !== '' && target !== '') void createGoal();
        }}
      >
        <label className="space-y-1">
          <span className="block text-xs text-slate-400">Hesap</span>
          <select
            value={accountKey}
            onChange={(event) => setAccountKey(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            {(accounts ?? []).map((account) => (
              <option
                key={`${account.platform}:${account.username}`}
                value={`${account.platform}:${account.username}`}
              >
                @{account.username} ({account.platform})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-slate-400">Metrik</span>
          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value as GoalMetric)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            {(Object.entries(METRIC_LABELS) as Array<[GoalMetric, string]>).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-slate-400">Hedef değer</span>
          <input
            type="number"
            min="1"
            step="any"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="500"
            className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={accountKey === '' || target === ''}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Hedef Ekle
        </button>
      </form>

      {(error ?? warning) && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {error ?? warning}
        </p>
      )}

      {goals === null ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : goals.length === 0 ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-500">
            Henüz hedef yok, örneğin &quot;500 takipçi&quot; hedefi koyup
            ilerlemeyi buradan izleyin.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {goals.map((goal) => (
            <article
              key={goal.id}
              className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">
                    {METRIC_LABELS[goal.metric]}: {formatNumber(goal.target)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    @{goal.username} · {goal.platform}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void (async () => {
                      await fetch(`/api/goals?id=${goal.id}`, { method: 'DELETE' });
                      void refresh();
                    })()
                  }
                  className="text-xs text-slate-500 hover:text-rose-400"
                >
                  Sil
                </button>
              </div>

              {goal.current === null ? (
                <p className="text-sm text-slate-500">
                  Mevcut değer henüz bilinmiyor, tarama verisi biriktikçe
                  hesaplanır.
                </p>
              ) : (
                <>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-300">
                      Mevcut: <strong>{formatNumber(goal.current)}</strong>
                    </span>
                    <span
                      className={
                        goal.progress !== null && goal.progress >= 100
                          ? 'font-semibold text-emerald-400'
                          : 'text-slate-400'
                      }
                    >
                      %{goal.progress ?? 0}
                      {goal.progress !== null && goal.progress >= 100 && ' 🎉'}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${goal.progress ?? 0}%` }}
                    />
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
