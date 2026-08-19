'use client';

import { useState } from 'react';

import type { AccountRole } from '@socialscope/shared';

import type { AccountSummary } from '@/lib/api-types';

interface Props {
  accounts: AccountSummary[] | null;
  busy: boolean;
  schemaWarning: string | null;
  onAdd: (username: string, role: AccountRole) => void;
  onRemove: (account: AccountSummary) => void;
  onScrape: (account: AccountSummary) => void;
  onShowPosts: (account: AccountSummary) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatAvg(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('tr-TR');
}

export function DashboardPanel({
  accounts,
  busy,
  schemaWarning,
  onAdd,
  onRemove,
  onScrape,
  onShowPosts,
}: Props) {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<AccountRole>('competitor');

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Genel Bakış</h2>

        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (username.trim() === '') return;
            onAdd(username, role);
            setUsername('');
          }}
        >
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="@hesap ekle (Instagram)"
            className="w-44 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as AccountRole)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="competitor">Rakip</option>
            <option value="me">Benim hesabım</option>
          </select>
          <button
            type="submit"
            disabled={username.trim() === ''}
            className="rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ekle
          </button>
        </form>
      </div>

      {schemaWarning && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {schemaWarning}
        </p>
      )}

      {accounts === null ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-slate-500">
          Henüz kayıtlı hesap yok. Yukarıdan hesap ekleyin veya bir tarama
          başlatın — taranan hesaplar otomatik kaydedilir.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <article
              key={`${account.platform}:${account.username}`}
              className="space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">@{account.username}</p>
                  <p className="text-xs text-slate-500">{account.platform}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    account.role === 'me'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-sky-500/10 text-sky-400'
                  }`}
                >
                  {account.role === 'me' ? 'Benim hesabım' : 'Rakip'}
                </span>
              </div>

              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-slate-900 py-2">
                  <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                    Gönderi
                  </dt>
                  <dd className="text-sm font-semibold">{account.postCount}</dd>
                </div>
                <div className="rounded-md bg-slate-900 py-2">
                  <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                    Ort. beğeni
                  </dt>
                  <dd className="text-sm font-semibold">{formatAvg(account.avgLikes)}</dd>
                </div>
                <div className="rounded-md bg-slate-900 py-2">
                  <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                    Ort. yorum
                  </dt>
                  <dd className="text-sm font-semibold">{formatAvg(account.avgComments)}</dd>
                </div>
              </dl>

              <p className="text-xs text-slate-500">
                Son tarama: {account.sweptAt ? formatDate(account.sweptAt) : 'hiç'}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onScrape(account)}
                  disabled={busy}
                  className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Tara
                </button>
                <button
                  type="button"
                  onClick={() => onShowPosts(account)}
                  className="rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-emerald-500 hover:text-emerald-400"
                >
                  Gönderiler
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(account)}
                  className="ml-auto rounded-md border border-slate-800 px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-rose-500 hover:text-rose-400"
                >
                  Kaldır
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
