'use client';

import type { JobView } from '@/lib/api-types';
import { humanizeJob } from '@/lib/humanize-job';

interface Props {
  job: JobView;
  /** Technical view also shows the raw collector output. */
  technical: boolean;
}

const STATUS_STYLES: Record<JobView['status'], { label: string; className: string }> = {
  running: {
    label: 'Çalışıyor…',
    className: 'bg-amber-500/10 text-amber-400 animate-pulse',
  },
  succeeded: { label: 'Tamamlandı', className: 'bg-emerald-500/10 text-emerald-400' },
  failed: { label: 'Başarısız', className: 'bg-rose-500/10 text-rose-400' },
};

const TONE_ICONS = { progress: '⏳', success: '✓', error: '✕' } as const;

export function JobLogCard({ job, technical }: Props) {
  const status = STATUS_STYLES[job.status];
  const friendly = humanizeJob(job);

  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{job.title}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div className="flex items-start gap-3 rounded-lg bg-slate-950 px-4 py-3">
        <span
          className={
            friendly.tone === 'success'
              ? 'text-emerald-400'
              : friendly.tone === 'error'
                ? 'text-rose-400'
                : 'text-amber-400'
          }
        >
          {TONE_ICONS[friendly.tone]}
        </span>
        <div>
          <p className="text-sm font-medium text-slate-200">{friendly.message}</p>
          {friendly.detail && (
            <p className="mt-0.5 text-sm text-slate-500">{friendly.detail}</p>
          )}
        </div>
      </div>

      {technical &&
        (job.lines.length > 0 ? (
          <pre className="max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-400">
            {job.lines.join('\n')}
          </pre>
        ) : (
          <p className="text-sm text-slate-500">Teknik çıktı bekleniyor…</p>
        ))}
    </section>
  );
}
