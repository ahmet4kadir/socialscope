'use client';

import { useState } from 'react';

import type { AccountRole } from '@socialscope/shared';

interface Props {
  busy: boolean;
  onScrape: (username: string, role: AccountRole, force: boolean) => void;
}

export function ScrapeCard({ busy, onScrape }: Props) {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<AccountRole>('me');
  const [force, setForce] = useState(false);

  const canSubmit = username.trim() !== '' && !busy;

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">Veri Çekme</h2>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onScrape(username, role, force);
        }}
      >
        <label className="block space-y-1">
          <span className="text-sm text-slate-400">Instagram kullanıcı adı</span>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="@hesapadi"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </label>

        <fieldset className="flex gap-4">
          <legend className="mb-1 text-sm text-slate-400">Hesap rolü</legend>
          {(
            [
              ['me', 'Benim hesabım'],
              ['competitor', 'Rakip'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="role"
                checked={role === value}
                onChange={() => setRole(value)}
                className="accent-emerald-500"
              />
              {label}
            </label>
          ))}
        </fieldset>

        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={force}
            onChange={(event) => setForce(event.target.checked)}
            className="accent-emerald-500"
          />
          6 saatlik önbelleği yok say (--force)
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Taramayı Başlat
        </button>
      </form>

      <p className="text-xs text-slate-500">
        En fazla 30 gönderi çekilir; insan benzeri gecikmeler yüzünden birkaç
        dakika sürebilir. Aynı hesap 6 saat içinde tekrar taranmaz (--force
        hariç).
      </p>
    </section>
  );
}
