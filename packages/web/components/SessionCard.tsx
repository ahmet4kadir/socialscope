'use client';

import type { Platform } from '@socialscope/shared';

import type { SessionInfo } from '@/lib/api-types';

interface Props {
  sessions: SessionInfo[] | null;
  busy: boolean;
  onLogin: (platform: Platform) => void;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  x: 'X (Twitter)',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function SessionCard({ sessions, busy, onLogin }: Props) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">Oturum</h2>

      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-400">
        <li>
          Giriş butonuna tıklayın — SocialScope&apos;un çalıştığı bilgisayarda
          gerçek bir tarayıcı penceresi açılır.
        </li>
        <li>
          Pencerede hesabınıza normal şekilde giriş yapın (iki adımlı doğrulama
          sorun değil).
        </li>
        <li>
          Giriş başarılı olunca pencere kendiliğinden kapanır ve oturum
          kaydedilir — bir daha gerekmez.
        </li>
      </ol>

      <div className="space-y-2">
        {(sessions ?? []).map((session) => (
          <div
            key={session.platform}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">{PLATFORM_LABELS[session.platform]}</p>
              {session.saved ? (
                <p className="text-xs text-emerald-400">
                  Oturum kayıtlı{session.savedAt ? ` (${formatDate(session.savedAt)})` : ''}
                </p>
              ) : (
                <p className="text-xs text-amber-400">Oturum yok</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onLogin(session.platform)}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {session.saved ? 'Yeniden Giriş Yap' : 'Giriş Yap'}
            </button>
          </div>
        ))}
        {sessions === null && <p className="text-sm text-slate-500">Yükleniyor…</p>}
      </div>

      <p className="text-xs text-slate-500">
        Şifreniz hiçbir yere kaydedilmez; yalnızca tarayıcı çerezleri yerel{' '}
        <code className="text-slate-400">.sessions/</code> klasöründe tutulur.
      </p>
    </section>
  );
}
