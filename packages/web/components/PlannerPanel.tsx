'use client';

import { useCallback, useEffect, useState } from 'react';

import type { MediaType } from '@socialscope/shared';

import type { PlannerSuggestion, PlanView } from '@/app/api/planner/route';
import type { AccountSummary, PostWithMetrics } from '@/lib/api-types';
import { formatDateTime, formatNumber } from '@/lib/format';

interface Props {
  accounts: AccountSummary[] | null;
}

const MEDIA_OPTIONS: Array<[MediaType, string]> = [
  ['image', 'Görsel'],
  ['video', 'Video'],
  ['carousel', 'Albüm'],
  ['text', 'Metin'],
];
const MEDIA_LABELS = Object.fromEntries(MEDIA_OPTIONS) as Record<string, string>;

function accountKey(account: Pick<AccountSummary, 'platform' | 'username'>): string {
  return `${account.platform}:${account.username}`;
}

/** ISO → the value a datetime-local input expects, in the browser's zone. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PlannerPanel({ accounts }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanView[] | null>(null);
  const [suggestion, setSuggestion] = useState<PlannerSuggestion | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkOptions, setLinkOptions] = useState<Record<string, PostWithMetrics[]>>({});

  const [plannedAt, setPlannedAt] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');

  useEffect(() => {
    if (selectedKey !== null || !accounts || accounts.length === 0) return;
    const mine = accounts.find((account) => account.role === 'me');
    setSelectedKey(accountKey(mine ?? accounts[0]!));
  }, [accounts, selectedKey]);

  const refresh = useCallback(async (key: string | null) => {
    const [platform, username] = key?.split(':') ?? [];
    const query =
      platform && username
        ? `?platform=${platform}&username=${encodeURIComponent(username)}`
        : '';
    try {
      const res = await fetch(`/api/planner${query}`);
      const data = (await res.json()) as {
        plans?: PlanView[];
        suggestion?: PlannerSuggestion | null;
        error?: string;
      };
      setPlans(data.plans ?? []);
      setSuggestion(data.suggestion ?? null);
      setWarning(data.error ?? null);
    } catch {
      setPlans([]);
    }
  }, []);

  useEffect(() => {
    void refresh(selectedKey);
  }, [selectedKey, refresh]);

  async function call(url: string, init: RequestInit): Promise<void> {
    setError(null);
    try {
      const res = await fetch(url, init);
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'İşlem başarısız oldu.');
        return;
      }
      void refresh(selectedKey);
    } catch {
      setError('Sunucuya ulaşılamadı.');
    }
  }

  function applySuggestion(): void {
    if (!suggestion) return;
    setPlannedAt(toLocalInput(suggestion.plannedAt));
    setMediaType(suggestion.mediaType);
    if (suggestion.hashtags.length > 0) {
      setHashtags(suggestion.hashtags.map((tag) => `#${tag}`).join(' '));
    }
  }

  async function loadLinkOptions(plan: PlanView): Promise<void> {
    const cacheKey = `${plan.platform}:${plan.username}`;
    if (linkOptions[cacheKey]) return;
    try {
      const res = await fetch(
        `/api/posts?platform=${plan.platform}&username=${encodeURIComponent(plan.username)}`,
      );
      const data = (await res.json()) as { posts?: PostWithMetrics[] };
      setLinkOptions((current) => ({ ...current, [cacheKey]: data.posts ?? [] }));
    } catch {
      setLinkOptions((current) => ({ ...current, [cacheKey]: [] }));
    }
  }

  if (accounts !== null && accounts.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm text-slate-500">
          Planlama için önce hesap ekleyip tarayın.
        </p>
      </section>
    );
  }

  const now = Date.now();
  const upcoming = (plans ?? []).filter(
    (plan) => plan.status === 'planned' && Date.parse(plan.plannedAt) >= now,
  );
  const awaiting = (plans ?? []).filter(
    (plan) => plan.status === 'planned' && Date.parse(plan.plannedAt) < now,
  );
  const history = (plans ?? []).filter((plan) => plan.status !== 'planned');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">İçerik Planlayıcı</h2>
          <p className="text-sm text-slate-500">
            Gönderilerinizi önceden planlayın; yayınlandıktan sonra gerçek
            gönderiyle eşleştirip planın tutup tutmadığını görün.
          </p>
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

      {(error ?? warning) && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {error ?? warning}
        </p>
      )}

      <form
        className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const [platform, username] = (selectedKey ?? '').split(':');
          if (!platform || !username || plannedAt === '') return;
          void call('/api/planner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platform,
              username,
              plannedAt: new Date(plannedAt).toISOString(),
              mediaType,
              captionDraft: caption,
              hashtags,
            }),
          });
          setCaption('');
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Yeni plan
          </h3>
          {suggestion && (
            <button
              type="button"
              onClick={applySuggestion}
              className="rounded-lg border border-emerald-600/60 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-600 hover:text-white"
            >
              ✨ Veriye göre öner: {formatDateTime(suggestion.plannedAt)} ·{' '}
              {MEDIA_LABELS[suggestion.mediaType]}
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs text-slate-400">Planlanan zaman</span>
            <input
              type="datetime-local"
              value={plannedAt}
              onChange={(event) => setPlannedAt(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-400">İçerik türü</span>
            <select
              value={mediaType}
              onChange={(event) => setMediaType(event.target.value as MediaType)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              {MEDIA_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs text-slate-400">Açıklama taslağı</span>
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={2}
            placeholder="Gönderi metni fikri…"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1 space-y-1">
            <span className="block text-xs text-slate-400">Hashtagler</span>
            <input
              type="text"
              value={hashtags}
              onChange={(event) => setHashtags(event.target.value)}
              placeholder="#örnek #etiket"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={plannedAt === ''}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Plana Ekle
          </button>
        </div>
      </form>

      {plans === null ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : (
        <>
          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Yaklaşan planlar
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">
                Yaklaşan plan yok; yukarıdaki formla ekleyin.
              </p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((plan) => (
                  <li
                    key={plan.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-950 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {formatDateTime(plan.plannedAt)} ·{' '}
                        {MEDIA_LABELS[plan.mediaType]} · @{plan.username}
                      </p>
                      {(plan.captionDraft || plan.hashtags) && (
                        <p className="truncate text-xs text-slate-500">
                          {plan.captionDraft} {plan.hashtags}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void call(`/api/planner?id=${plan.id}`, { method: 'DELETE' })
                      }
                      className="text-xs text-slate-500 hover:text-rose-400"
                    >
                      Sil
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {awaiting.length > 0 && (
            <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Eşleştirme bekleyen (zamanı geçti)
              </h3>
              <ul className="space-y-2">
                {awaiting.map((plan) => {
                  const cacheKey = `${plan.platform}:${plan.username}`;
                  const options = linkOptions[cacheKey];
                  return (
                    <li
                      key={plan.id}
                      className="space-y-2 rounded-lg bg-slate-950 px-4 py-3 text-sm"
                    >
                      <p className="font-medium">
                        {formatDateTime(plan.plannedAt)} ·{' '}
                        {MEDIA_LABELS[plan.mediaType]} · @{plan.username}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value=""
                          onFocus={() => void loadLinkOptions(plan)}
                          onChange={(event) => {
                            if (event.target.value === '') return;
                            void call('/api/planner/update', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                id: plan.id,
                                action: 'link',
                                postId: event.target.value,
                              }),
                            });
                          }}
                          className="min-w-64 flex-1 rounded-lg border border-dashed border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-400 focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="">
                            {options
                              ? 'Yayınlanan gönderiyi seçin…'
                              : 'Gönderileri görmek için tıklayın…'}
                          </option>
                          {(options ?? []).slice(0, 15).map((post) => (
                            <option key={post.id} value={post.id}>
                              {new Date(post.postedAt).toLocaleDateString('tr-TR')} ·{' '}
                              {post.contentText.slice(0, 40) || 'açıklama yok'}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            void call('/api/planner/update', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: plan.id, action: 'skip' }),
                            })
                          }
                          className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-400 transition hover:border-rose-500 hover:text-rose-400"
                        >
                          Paylaşılmadı
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {history.length > 0 && (
            <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Geçmiş
              </h3>
              <ul className="space-y-2">
                {history.map((plan) => {
                  const delta =
                    plan.actual && plan.accountAvgEngagement
                      ? Math.round(
                          ((plan.actual.engagement - plan.accountAvgEngagement) /
                            plan.accountAvgEngagement) *
                            100,
                        )
                      : null;
                  return (
                    <li
                      key={plan.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-950 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {formatDateTime(plan.plannedAt)} ·{' '}
                          {MEDIA_LABELS[plan.mediaType]} · @{plan.username}
                        </p>
                        {plan.status === 'published' && plan.actual ? (
                          <p className="text-xs text-slate-500">
                            Yayınlandı: {formatDateTime(plan.actual.postedAt)} ·{' '}
                            {formatNumber(plan.actual.engagement)} etkileşim
                            {delta !== null && (
                              <span
                                className={
                                  delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }
                              >
                                {' '}
                                ({delta >= 0 ? '+' : ''}%{delta} ortalamaya göre)
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500">Paylaşılmadı</p>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          plan.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-700/40 text-slate-400'
                        }`}
                      >
                        {plan.status === 'published' ? 'Yayınlandı' : 'İptal'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
