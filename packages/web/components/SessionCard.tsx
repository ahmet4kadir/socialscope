'use client';

import type { SessionInfo } from '@/lib/api-types';

interface Props {
  sessions: SessionInfo[] | null;
  busy: boolean;
  onLogin: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function SessionCard({ sessions, busy, onLogin }: Props) {
  const instagram = sessions?.find((s) => s.platform === 'instagram');

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Oturum</h2>
        {instagram?.saved ? (
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            Instagram: kayıtlı
          </span>
        ) : (
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
            Instagram: oturum yok
          </span>
        )}
      </div>

      {instagram?.saved ? (
        <p className="text-sm text-slate-400">
          Instagram oturumu kayıtlı
          {instagram.savedAt ? ` (${formatDate(instagram.savedAt)})` : ''}. Tarama
          sırasında oturum hatası alırsanız yeniden giriş yapın.
        </p>
      ) : (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-400">
          <li>
            Aşağıdaki butona tıklayın — SocialScope&apos;un çalıştığı bilgisayarda
            gerçek bir tarayıcı penceresi açılır.
          </li>
          <li>
            Pencerede Instagram&apos;a normal şekilde giriş yapın (iki adımlı
            doğrulama sorun değil).
          </li>
          <li>
            Giriş başarılı olunca pencere kendiliğinden kapanır ve oturum
            kaydedilir — bir daha gerekmez.
          </li>
        </ol>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onLogin}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {instagram?.saved ? 'Yeniden Giriş Yap' : "Instagram'a Giriş Yap"}
        </button>
        <span className="text-xs text-slate-500">
          X (Twitter) girişi 3. aşamada geliyor
        </span>
      </div>

      <p className="text-xs text-slate-500">
        Şifreniz hiçbir yere kaydedilmez; yalnızca tarayıcı çerezleri yerel{' '}
        <code className="text-slate-400">.sessions/</code> klasöründe tutulur.
      </p>
    </section>
  );
}
