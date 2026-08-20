'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Giriş başarısız.');
        return;
      }
      window.location.href = '/';
    } catch {
      setError('Sunucuya ulaşılamadı.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (password !== '') void submit();
        }}
      >
        <div>
          <h1 className="text-xl font-bold">SocialScope</h1>
          <p className="mt-1 text-sm text-slate-400">
            Devam etmek için panel şifresini girin.
          </p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Şifre"
          autoFocus
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
        />

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={busy || password === ''}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Kontrol ediliyor…' : 'Giriş Yap'}
        </button>
      </form>
    </main>
  );
}
