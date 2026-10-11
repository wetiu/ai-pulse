# AI Pulse

A fully automatic, zero-cost AI news site for people who build with AI.
It rebuilds itself every day, forever, with no servers and no paid services.

## What it covers

Only AI news, ranked by importance, weighted toward four focus areas:

1. **Game Dev** - AI in game engines, studios, tooling and production
2. **Web Dev** - AI for browsers, frontends, frameworks and hosting
3. **App Dev** - AI for iOS/Android, SDKs and on-device models
4. **Art & Creative** - AI in 3D, VFX, illustration, design and creative tooling
5. **AI Business** - funding, launches, acquisitions, partnerships, market moves

Everything else lands in `Models & Labs`, `Open Source` or `Research` and stays
in the minority (roughly 2 focus stories for every 1 other story). Pure-research
feeds are pinned to `Research` so a paper can never pose as a builder story.

## What the build produces

- `index.html` - ranked, searchable, filterable, installable (PWA), dark/light
- `archive/` - one page per day, plus an archive index (history = SEO)
- `feed.xml` - RSS 2.0 feed
- `data.json` - the whole ranked dataset, topic-tagged
- `manifest.webmanifest` + `sw.js` - add-to-home-screen / offline shell
- `sitemap.xml`, `robots.txt`, Open Graph + Twitter cards, real icons

## How it works

- `build.mjs` fetches ~48 curated feeds (zero npm dependencies, Node built-in
  `fetch`), then for each story:
  - **filters** - drops anything with no AI signal, plus deal/coupon noise
  - **classifies** - assigns one of the seven topics
  - **scores importance** - source weight + AI relevance + announcement keywords
    (launch, raises, acquires, open-sources, breakthrough...), then ranks
- `.github/workflows/daily.yml` builds once a day on GitHub's free runners,
  commits the refreshed data, and publishes `public/` to GitHub Pages.
- Because the workflow commits every day, GitHub never disables the schedule for
  inactivity, so it keeps running on its own.

## One-time setup (about 3 minutes)

1. Create a **public** GitHub repo and push this folder to it:

   ```bash
   cd ai-news
   git init -b main
   git add -A && git commit -m "AI Pulse initial"
   gh repo create ai-pulse --public --source=. --push
   ```

2. In the repo: **Settings -> Pages -> Build and deployment -> Source** =
   **GitHub Actions**.

3. In the repo: **Actions** tab -> enable workflows, open *Update AI Pulse*, and
   click **Run workflow** once to publish immediately.

Your site goes live at `https://<user>.github.io/ai-pulse/`, updates daily, and
can be added to a phone home screen as an app.

## Local preview

```bash
node build.mjs                      # regenerate public/
python3 -m http.server 8137 --directory public
```

## Customizing

- **Sources:** edit `FEEDS` (each entry has `topic`, `weight`, `native`).
- **What counts as AI:** `AI_SIGNAL`; **topics:** `TOPIC_RULES`;
  **importance:** `IMPORTANT_WORDS`.
- **Balance:** `FOCUS` plus the non-focus cap in `main()`.
- **Ads:** `ADS_ENABLED` (see `MONETIZATION.md`).
- **Branding:** `SITE_NAME`, `SITE_TAGLINE`.
- **Schedule:** the `cron:` line in `.github/workflows/daily.yml` (UTC).

## Making money

See `MONETIZATION.md`. Short version: turn on affiliate links today, apply to an
ad network once traffic is steady, and pitch dev-tool sponsors directly - the
`/sponsor/` page and ad slots are already built.

## Chat digest (`notify.mjs`)

Picks the most important recent stories and formats them for a chat message.
Round-robins across the four focus areas so no single topic swamps the output.

```bash
node notify.mjs                          # last 24h, top 5
node notify.mjs --hours 72 --limit 8
node notify.mjs --topic "Game Dev"
node notify.mjs --json                   # machine-readable
```

Pipe it into a channel once one is connected, e.g.
`openclaw message send --channel telegram --target <chatId> --message "$(node notify.mjs)"`.

## Why this is free and durable

- GitHub Actions minutes are free for public repos; a ~2 minute daily job is
  far below any limit.
- GitHub Pages hosting is free for public repos.
- No database, no API keys, no LLM calls, no paid tiers - nothing to expire.
