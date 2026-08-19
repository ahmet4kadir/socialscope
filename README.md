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

npm run migrate     # create data/socialscope.db with the full schema
npm run login -- --platform instagram             # one-time manual login (saves session)
npm run scrape -- --platform instagram --user <account> --role me
npm run scrape -- --platform instagram --user <rival>   --role competitor

npm run db:status   # inspect tables and row counts
npm run dev         # Next.js dashboard shell at http://localhost:3000
```

Scrapes are throttled by design: max 30 posts per account, 2-6s human-like
delays, one scrape session at a time, and a 6h per-account cache (`--force`
overrides). Set `HEADED=1` to watch the scraper browser work.
