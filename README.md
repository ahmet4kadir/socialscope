# SocialScope

Social media marketing analysis tool: scrapes posts from your own and
competitor accounts (Instagram / X), tracks new posts' performance with hourly
snapshots, computes engagement metrics, and uses Claude to generate
competitor comparisons and actionable recommendations.

> **Status: work in progress.** Stage 9 of 10 (scrapers, control panel,
> tracker, metrics, analysis/comparison/recommendation dashboards, tracking
> views, campaigns, goals). The full README — architecture diagram, setup
> workflow, screenshots, data model — lands with the final stage.
>
> Scraping is for educational/analysis purposes: use a throwaway account at
> low volume.

## Structure

```
packages/
  shared/      Shared TypeScript types (normalized post shape, DB row types)
  collector/   Playwright scrapers + time-series tracker + SQLite migrations
  web/         Next.js dashboard (read-only over the SQLite file)
```

## Quick start (current stage)

```
npm install
npx playwright install chromium --no-shell        # one-time browser download
npm run migrate                                   # create data/socialscope.db
npm run dev                                       # control panel at http://localhost:3000
```

Everything else happens in the control panel (Turkish UI):

1. **Giriş** — click a platform's login button (Instagram or X): a real
   browser window opens on the machine running SocialScope; log in manually
   (2FA works), the session is saved locally and reused from then on. No
   password ever touches the app. On a **headless server** (no display),
   don't log in there — instead log in on your own machine, click **İndir**
   to download the session file, then **Yükle** it on the server's panel. The
   server never opens a browser for login.
2. **Tarama** — pick a platform, enter a username, pick the role (my account
   / competitor), start the scrape, and watch the collector's log live.
3. **Genel Bakış** — saved accounts as overview cards (post count, average
   likes/comments, last sweep) with one-click re-scrape, post lists with
   thumbnails, and add/remove.

CLI equivalents exist for scripting: `npm run login -- --platform instagram|x`,
`npm run scrape -- --platform instagram|x --user <account> --role me`, and
`npm run db:status`.

### Time-series tracking

```
npm run tracker                       # long-running local process (node-cron)
npm run track -- --url <post_url>     # manually enroll any post
```

The tracker sweeps every registered account every 6h and auto-enrolls fresh
posts (&lt;48h old) on your own accounts. Each tracked post gets hourly
snapshots (±10 min jitter) for its first 24h of tracking, then 6-hourly
snapshots, stopping automatically at 48h. Posts can also be enrolled from the
dashboard ("Takibe Al" on any post) — the tracker process must be running for
the schedule to execute. Platforms without a saved session are skipped
gracefully.

Every account sweep also records a **follower/following/post-count snapshot**,
so follower growth is tracked over time and shown on the dashboard cards
(current count plus the change since the last sweep).

Scrapes are throttled by design: max 30 posts per account, 2-6s human-like
delays, one scrape session at a time (also enforced across the web UI and
CLI), and a 6h per-account cache (`--force` overrides). Set `HEADED=1` to
watch the scraper browser work.
