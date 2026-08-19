'use client';

import { useCallback, useEffect, useState } from 'react';

import type { AccountRole, Platform } from '@socialscope/shared';

import { DashboardPanel } from '@/components/DashboardPanel';
import { JobLogCard } from '@/components/JobLogCard';
import { PostsPanel } from '@/components/PostsPanel';
import { ScrapeCard } from '@/components/ScrapeCard';
import { SessionCard } from '@/components/SessionCard';
import type {
  AccountSummary,
  JobView,
  PostWithMetrics,
  SessionInfo,
} from '@/lib/api-types';

const GENERIC_ERROR = 'Sunucuya ulaşılamadı — sayfayı yenileyip tekrar deneyin.';

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ platform: string; username: string } | null>(null);
  const [posts, setPosts] = useState<PostWithMetrics[] | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [sessionsRes, accountsRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/accounts'),
      ]);
      if (sessionsRes.ok) {
        setSessions(((await sessionsRes.json()) as { sessions: SessionInfo[] }).sessions);
      }
      if (accountsRes.ok) {
        const data = (await accountsRes.json()) as {
          accounts: AccountSummary[];
          error?: string;
        };
        setAccounts(data.accounts);
        setSchemaWarning(data.error ?? null);
      }
    } catch {
      setError(GENERIC_ERROR);
    }
  }, []);

  // Initial load: data + reattach to a job that may already be running.
  useEffect(() => {
    void refreshData();
    void (async () => {
      try {
        const res = await fetch('/api/jobs');
        if (!res.ok) return;
        const data = (await res.json()) as { jobs: JobView[]; active: JobView | null };
        setJob(data.active ?? data.jobs[0] ?? null);
      } catch {
        // Job history is a nicety; the page works without it.
      }
    })();
  }, [refreshData]);

  // Poll the active job; refresh data once it finishes.
  useEffect(() => {
    if (job?.status !== 'running') return;
    const interval = setInterval(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/jobs/${job.id}`);
          if (!res.ok) return;
          const data = (await res.json()) as { job: JobView };
          setJob(data.job);
          if (data.job.status !== 'running') void refreshData();
        } catch {
          // Transient polling failure — the next tick retries.
        }
      })();
    }, 2000);
    return () => clearInterval(interval);
  }, [job?.id, job?.status, refreshData]);

  const startJob = useCallback(async (url: string, body: unknown) => {
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { job?: JobView; error?: string };
      if (!res.ok || !data.job) {
        setError(data.error ?? GENERIC_ERROR);
        return;
      }
      setJob(data.job);
    } catch {
      setError(GENERIC_ERROR);
    }
  }, []);

  const loadPosts = useCallback(async (account: { platform: string; username: string }) => {
    setSelected(account);
    setPosts(null);
    try {
      const res = await fetch(
        `/api/posts?platform=${account.platform}&username=${encodeURIComponent(account.username)}`,
      );
      if (!res.ok) {
        setPosts([]);
        return;
      }
      setPosts(((await res.json()) as { posts: PostWithMetrics[] }).posts);
    } catch {
      setPosts([]);
    }
  }, []);

  const addAccount = useCallback(
    async (platform: Platform, username: string, role: AccountRole) => {
      setError(null);
      try {
        const res = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, username, role }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? GENERIC_ERROR);
          return;
        }
        void refreshData();
      } catch {
        setError(GENERIC_ERROR);
      }
    },
    [refreshData],
  );

  const removeAccount = useCallback(
    async (account: AccountSummary) => {
      setError(null);
      try {
        await fetch(
          `/api/accounts?platform=${account.platform}&username=${encodeURIComponent(account.username)}`,
          { method: 'DELETE' },
        );
        if (
          selected?.platform === account.platform &&
          selected.username === account.username
        ) {
          setSelected(null);
          setPosts(null);
        }
        void refreshData();
      } catch {
        setError(GENERIC_ERROR);
      }
    },
    [refreshData, selected],
  );

  const busy = job?.status === 'running';

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">SocialScope</h1>
        <p className="text-slate-400">
          Sosyal medya pazarlama analizi — giriş yapın, hesapları tarayın ve
          verileri buradan takip edin.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <DashboardPanel
        accounts={accounts}
        busy={busy}
        schemaWarning={schemaWarning}
        onAdd={(platform, username, role) => void addAccount(platform, username, role)}
        onRemove={(account) => void removeAccount(account)}
        onScrape={(account) =>
          void startJob('/api/scrape', {
            platform: account.platform,
            username: account.username,
            role: account.role,
            force: false,
          })
        }
        onShowPosts={(account) => void loadPosts(account)}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SessionCard
          sessions={sessions}
          busy={busy}
          onLogin={(platform) => void startJob('/api/login', { platform })}
        />
        <ScrapeCard
          busy={busy}
          onScrape={(platform, username, role, force) =>
            void startJob('/api/scrape', { platform, username, role, force })
          }
        />
      </div>

      {job && <JobLogCard job={job} />}

      {selected && (
        <PostsPanel
          account={selected}
          posts={posts}
          busy={busy}
          onTrack={(post) => void startJob('/api/track', { url: post.url })}
        />
      )}
    </main>
  );
}
