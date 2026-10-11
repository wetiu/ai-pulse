# Making money from AI Pulse

Everything below starts free. Realistically: traffic first, money second - but
the site is already shaped so that turning revenue on is a config change, not a
rebuild.

## The switch that already exists

In `build.mjs`, set `ADS_ENABLED = true`. That renders two reserved slots on the
homepage (top banner + in-feed). Then paste your ad network's script into
`renderIndex()` where the `.ad-slot` divs are emitted. Nothing else changes.

## Why this site can monetise at all

- It is a **developer audience** - the highest-value ad category there is.
- It is **vertical** (AI + game/web/app dev), not general news.
- It has **RSS + JSON**, so syndication and API buyers are possible later.
- It is **static**, so it costs nothing to serve no matter how much traffic hits.

## Options, cheapest to most lucrative

### 1. Direct sponsorships (best fit, no minimum traffic)
The `/sponsor/` page is already built. Add your contact email and approach dev
tool companies directly - hosting, CI, GPU clouds, IDEs, game engines, AI APIs.
A sponsored card in a niche dev feed can be worth more than thousands of ad
impressions. This is how small dev newsletters make real money.

### 2. EthicalAds (privacy-friendly, free to join)
Built for developer sites, no cookies, no GDPR mess. Apply at ethicalads.io.

### 3. Google AdSense (largest network, easiest approval path)
Free to join, pays per impression. Two practical notes:
- Approval is much smoother on a **custom domain** than on `*.github.io`.
- Add the verification script to `<head>`, then place ad units in the slots.

### 4. Carbon Ads / BuySellAds
Dev-focused networks. They have traffic minimums, so revisit these once you
have real numbers.

### 5. Affiliate links
Your topics make this natural: GPU clouds, AI API credits, dev tools, game
engines, hosting. Swap an outbound link for an affiliate link in `build.mjs` or
add a "Tools we use" block. Zero cost, no approval, works from day one.

### 6. Newsletter (the highest-margin path)
You already generate `feed.xml`. Free tiers exist (Buttondown, Substack). A
digest of the day's top stories for a niche dev list sells sponsorships at 10-100x
the CPM of display ads.

### 7. Paid API / data access
`data.json` and the daily `archive/*.json` are already a clean, ranked, tagged AI
news feed. People sell access to far less structured data than this.

## Honest sequence

1. Publish, and get the daily habit going (this is the hard part).
2. Turn on affiliate links - instant, no approval.
3. Apply to AdSense or EthicalAds once you have steady visitors.
4. Pitch 2-3 direct sponsors with your traffic numbers.
5. Only then consider a paid domain (~$10/yr) - it lifts ad approval rates and
   makes the site look like a business.

## What is still free

Hosting (GitHub Pages), the daily rebuild (GitHub Actions), the data, the build
system and the archives. Ads only replace reserved space - they add no cost.
