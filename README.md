# SocialScope

Social media marketing analysis tool: scrapes posts from your own and
competitor accounts (Instagram / X), tracks new posts' performance with hourly
snapshots, computes engagement metrics, and uses Claude to generate
competitor comparisons and actionable recommendations.

> **Status: work in progress.** Stage 2 of 10 (Instagram scraper + login
> flow). The full README — architecture diagram, setup workflow, screenshots,
> data model — lands with the final stage.
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

1. **Giriş** — click "Instagram'a Giriş Yap": a real browser window opens on
   the machine running SocialScope; log in manually (2FA works), the session
   is saved locally and reused from then on. No password ever touches the app.
2. **Tarama** — enter a username, pick the role (my account / competitor),
   start the scrape, and watch the collector's log live.
3. **Veriler** — scraped accounts and their posts (with latest like/comment/
   view counts) are listed right below.

CLI equivalents exist for scripting: `npm run login -- --platform instagram`,
`npm run scrape -- --platform instagram --user <account> --role me`, and
`npm run db:status`.

Scrapes are throttled by design: max 30 posts per account, 2-6s human-like
delays, one scrape session at a time (also enforced across the web UI and
CLI), and a 6h per-account cache (`--force` overrides). Set `HEADED=1` to
watch the scraper browser work.
