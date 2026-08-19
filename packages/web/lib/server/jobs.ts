import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import type { JobKind, JobStatus, JobView } from '../api-types';
import { COLLECTOR_DIR, REPO_ROOT } from './paths';

// The control panel triggers the collector's existing CLIs as child
// processes: they already handle sessions, the global scrape lock, graceful
// errors, and debug dumps. Jobs live in memory (globalThis survives dev
// hot-reloads); the database remains the source of truth for results.

interface Job {
  view: JobView;
  child: ChildProcessWithoutNullStreams;
}

const MAX_LOG_LINES = 200;
const MAX_KEPT_JOBS = 20;
const JOB_TIMEOUT_MS = 15 * 60 * 1000;

const store = globalThis as unknown as { __socialscopeJobs?: Map<string, Job> };
const jobs = (store.__socialscopeJobs ??= new Map<string, Job>());

// Run the collector CLIs through tsx directly (no npm.cmd/shell involved,
// which keeps spawning cross-platform and quoting-safe).
const TSX_CLI = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');

export function listJobs(): JobView[] {
  return [...jobs.values()]
    .map((job) => job.view)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getJob(id: string): JobView | null {
  return jobs.get(id)?.view ?? null;
}

export function activeJob(): JobView | null {
  return listJobs().find((job) => job.status === 'running') ?? null;
}

export function startJob(
  kind: JobKind,
  title: string,
  cliArgs: string[],
): { job: JobView } | { error: string } {
  if (activeJob()) {
    return { error: 'Zaten çalışan bir işlem var — önce onun bitmesini bekleyin.' };
  }

  const script = path.join(COLLECTOR_DIR, 'src', 'cli', `${kind}.ts`);
  const child = spawn(process.execPath, [TSX_CLI, script, ...cliArgs], {
    cwd: COLLECTOR_DIR,
    env: { ...process.env },
  });

  const view: JobView = {
    id: randomUUID(),
    kind,
    title,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    lines: [],
  };
  jobs.set(view.id, { view, child });
  pruneOldJobs();

  const appendOutput = (chunk: Buffer): void => {
    for (const line of chunk.toString('utf8').split(/\r?\n/)) {
      const trimmed = line.trimEnd();
      if (trimmed) view.lines.push(trimmed);
    }
    if (view.lines.length > MAX_LOG_LINES) {
      view.lines.splice(0, view.lines.length - MAX_LOG_LINES);
    }
  };
  child.stdout.on('data', appendOutput);
  child.stderr.on('data', appendOutput);

  const timeout = setTimeout(() => {
    if (view.status === 'running') {
      view.lines.push('[zaman aşımı] 15 dakika doldu, işlem sonlandırıldı.');
      child.kill();
    }
  }, JOB_TIMEOUT_MS);
  timeout.unref();

  const finish = (status: JobStatus): void => {
    if (view.status !== 'running') return;
    view.status = status;
    view.finishedAt = new Date().toISOString();
    clearTimeout(timeout);
  };
  child.on('error', (error) => {
    view.lines.push(`[error] ${error.message}`);
    finish('failed');
  });
  child.on('close', (code) => {
    finish(code === 0 ? 'succeeded' : 'failed');
  });

  return { job: view };
}

function pruneOldJobs(): void {
  const finished = listJobs().filter((job) => job.status !== 'running');
  for (const job of finished.slice(MAX_KEPT_JOBS)) {
    jobs.delete(job.id);
  }
}
