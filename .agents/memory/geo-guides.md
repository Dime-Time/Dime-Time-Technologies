---
name: GEO guides & crawler files architecture
description: Why marketing guides are static HTML served by Express (not SPA routes) and how robots/sitemap must be served
---

# GEO guide pages and crawler files

- AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do NOT execute JavaScript, so any content meant for AI/search visibility must be served as complete static HTML — never as SPA routes.
- Guides live in `server/guides/*.html` and are served by whitelist-mapped Express routes registered at the top of `registerRoutes` (before the Vite dev middleware / prod SPA catch-all, so they win).
- **Gotcha:** the SPA catch-all swallows root `public/` files — before the explicit `express.static(public/)` mount, `/robots.txt` and `/sitemap.xml` returned the SPA's index.html to crawlers. Any new crawler-facing file must be reachable through that static mount and verified with `curl` content-type checks.
- **Gotcha:** mounting `express.static(public/)` exposes EVERYTHING in `public/` — stale files there become publicly crawlable (two outdated legal HTML docs had to be deleted). Audit `public/` contents whenever adding files.
- Content rules for guides: every statistic named-source cited, payoff numbers computed (not invented), compliance disclaimer verbatim in every footer, no partner logos, no subscription pricing claims (subscriptions not live in prod).

**Why:** GEO visibility (ChatGPT/Claude/Perplexity citing dime-time.com for debt questions) was a founder request 2026-07-14; JS-invisible content and broken robots/sitemap silently defeat it.

**How to apply:** when adding marketing/SEO content, add static HTML under `server/guides/`, register the slug in the whitelist map in `server/routes.ts`, add it to `public/sitemap.xml`, and curl-verify content types.

## SEO fix batch (2026-07-27)
- The homepage `<title>` string is TRIPLE-coupled: `client/index.html`, the unmount-restore in privacy/terms/delete-account pages, and the spa-meta tests all assert the exact string. Change all in lockstep or tests fail.
- SPA public pages (/privacy, /terms, /delete-account) get crawler-correct meta via PROD-ONLY server-side tag swapping — dev preview intentionally shows the default shell, so verify this only on the published site (curl the prod URL), never in dev.
- /delete-account is deliberately noindexed but must stay LIVE (app-store compliance).
- Social share card = `public/og-image.png` (1200×630), referenced by every page; regenerate with ImageMagick (`magick`, DejaVu fonts available in this env) — don't reference the square app icon as og:image.
