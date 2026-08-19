'use client';

import type { JobView } from '@/lib/api-types';

interface Props {
  job: JobView;
}

const STATUS_STYLES: Record<JobView['status'], { label: string; className: string }> = {
  running: {
    label: 'Çalışıyor…',
    className: 'bg-amber-500/10 text-amber-400 animate-pulse',
  },
  succeeded: { label: 'Tamamlandı', className: 'bg-emerald-500/10 text-emerald-400' },
  failed: { label: 'Başarısız', className: 'bg-rose-500/10 text-rose-400' },
};

export function JobLogCard({ job }: Props) {
  const status = STATUS_STYLES[job.status];

  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{job.title}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
      </div>

      {job.lines.length > 0 ? (
        <pre className="max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">
          {job.lines.join('\n')}
        </pre>
      ) : (
        <p className="text-sm text-slate-500">Çıktı bekleniyor…</p>
      )}
    </section>
  );
}
