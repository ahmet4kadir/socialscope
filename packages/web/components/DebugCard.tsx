'use client';

import { useCallback, useEffect, useState } from 'react';

import type { DebugDump } from '@/app/api/debug/route';
import { formatDateTime } from '@/lib/format';

// Shown only in the technical view: lets the operator see the scraper's
// screenshot + HTML dumps from a headless server, where /app/debug is
// otherwise unreachable.
export function DebugCard({ refreshKey }: { refreshKey: string }) {
  const [dumps, setDumps] = useState<DebugDump[]>([]);
  const [openBase, setOpenBase] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/debug');
      const data = (await res.json()) as { dumps?: DebugDump[] };
      setDumps(data.dumps ?? []);
      setOpenBase((current) => current ?? data.dumps?.[0]?.base ?? null);
    } catch {
      setDumps([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (dumps.length === 0) return null;

  const open = dumps.find((dump) => dump.base === openBase) ?? dumps[0]!;

  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Hata ayıklama kayıtları</h2>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-slate-400 hover:text-emerald-400"
        >
          Yenile
        </button>
      </div>
      <p className="text-sm text-slate-500">
        Tarama başarısız olduğunda kaydedilen ekran görüntüsü ve sayfa içeriği.
        Sunucunun o an ne gördüğünü buradan inceleyebilirsiniz.
      </p>

      <select
        value={open.base}
        onChange={(event) => setOpenBase(event.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
      >
        {dumps.map((dump) => (
          <option key={dump.base} value={dump.base}>
            {dump.label} · {dump.createdAt ? formatDateTime(dump.createdAt) : dump.base}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap gap-3 text-sm">
        {open.hasHtml && (
          <a
            href={`/api/debug/${open.base}.html`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-700 px-3 py-1.5 font-medium text-slate-300 transition hover:border-emerald-500 hover:text-emerald-400"
          >
            HTML kaynağını aç ↗
          </a>
        )}
      </div>

      {open.hasScreenshot && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/debug/${open.base}.png`}
          alt="Tarama ekran görüntüsü"
          className="w-full rounded-lg border border-slate-800"
        />
      )}
    </section>
  );
}
