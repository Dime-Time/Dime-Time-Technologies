# SEO Strategy — Dime Time

## Site summary
Dime Time is a fintech debt-reduction app (iOS/Android + web) at https://dime-time.com. The marketing homepage is a React SPA at `/`. Pre-rendered SSR guide articles are served under `/guides/**` for crawler visibility. Legal pages (`/privacy`, `/terms`) are SPA-rendered React components. The delete-account page (`/delete-account`) must remain live for app store compliance.

## In scope
- Marketing homepage (`/`)
- SSR guide pages (`/guides`, `/guides/*`)
- Legal pages (`/privacy`, `/terms`) — SPA-rendered, crawlable but lower priority
- `robots.txt`, `sitemap.xml`
- Favicon, Open Graph, structured data

## Out of scope
- Authenticated app routes (`/dashboard`, `/debts`, `/transactions`, `/settings`, `/banking`, `/crypto`, `/insights`, `/subscription`, `/onboarding`, `/notifications`, `/qr`)
- Admin panel (`/admin`)
- Internal tools, API endpoints

## Target audience
- US consumers carrying credit card or other consumer debt
- People searching for debt payoff strategies, round-up apps, spare change apps

## Primary keywords
- round-up app for debt, spare change debt payoff, how to pay off credit card debt, debt reduction app

## Rendering mode
- Homepage (`/`): **SPA** (React/Wouter) — metadata baked into `client/index.html` shell is all crawlers see
- Guides (`/guides/**`): **SSR** (pre-rendered static HTML served by Express)
- Privacy/Terms: **SPA** (React components)

## Dismissed categories
- (None yet)
