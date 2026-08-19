'use client';

import { useRef, useState } from 'react';

import type { Platform } from '@socialscope/shared';

import type { SessionInfo } from '@/lib/api-types';

interface Props {
  sessions: SessionInfo[] | null;
  busy: boolean;
  onLogin: (platform: Platform) => void;
  onRefresh: () => void;
  onError: (message: string) => void;
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

export function SessionCard({ sessions, busy, onLogin, onRefresh, onError }: Props) {
  const [uploading, setUploading] = useState<Platform | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function uploadSession(platform: Platform, file: File): Promise<void> {
    setUploading(platform);
    try {
      const text = await file.text();
      const res = await fetch(`/api/sessions/${platform}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        onError(data.error ?? 'Oturum dosyası yüklenemedi.');
        return;
      }
      onRefresh();
    } catch {
      onError('Oturum dosyası yüklenemedi.');
    } finally {
      setUploading(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">Oturum</h2>

      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-400">
        <li>
          <strong className="text-slate-300">Bu bilgisayarda:</strong> Giriş
          butonuna tıklayın — gerçek bir tarayıcı açılır, hesabınıza giriş
          yaparsınız (2FA sorun değil), oturum kaydedilir.
        </li>
        <li>
          <strong className="text-slate-300">Sunucuya taşımak için:</strong>{' '}
          oturumu &quot;İndir&quot; ile bu makineden alın, sunucudaki panelde
          &quot;Yükle&quot; ile aktarın — sunucuda tarayıcıya gerek kalmaz.
        </li>
      </ol>

      <div className="space-y-2">
        {(sessions ?? []).map((session) => (
          <div
            key={session.platform}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
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

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onLogin(session.platform)}
                disabled={busy}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {session.saved ? 'Yeniden Giriş' : 'Giriş Yap'}
              </button>

              {session.saved && (
                <a
                  href={`/api/sessions/${session.platform}/file`}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-emerald-500 hover:text-emerald-400"
                >
                  İndir
                </a>
              )}

              <button
                type="button"
                onClick={() => fileInputs.current[session.platform]?.click()}
                disabled={uploading !== null}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-emerald-500 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploading === session.platform ? 'Yükleniyor…' : 'Yükle'}
              </button>
              <input
                ref={(el) => {
                  fileInputs.current[session.platform] = el;
                }}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void uploadSession(session.platform, file);
                }}
              />
            </div>
          </div>
        ))}
        {sessions === null && <p className="text-sm text-slate-500">Yükleniyor…</p>}
      </div>

      <p className="text-xs text-slate-500">
        Şifreniz hiçbir yere kaydedilmez; yalnızca tarayıcı çerezleri yerel{' '}
        <code className="text-slate-400">.sessions/</code> klasöründe tutulur.
        Oturum dosyasını gizli tutun — hesabınıza erişim sağlar.
      </p>
    </section>
  );
}
