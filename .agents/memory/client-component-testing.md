---
name: Client component testing under tsx --test
description: How to write interactive React component tests without vitest/jsdom in this repo
---

The test runner is plain `tsx --test` (node:test), no vitest/RTL. Two patterns exist for client component tests in `client/src/pages/__tests__/`:

1. **Static render**: `react-dom/server` `renderToString` with a prefilled React Query cache (insights tests).
2. **Interactive**: `happy-dom` `GlobalRegistrator` + `react-dom/client` + `act`, mocked `globalThis.fetch`, native-value-setter + `input` event for controlled inputs, dispatching a cancelable `submit` event on the form (auth error-message tests).

**Gotchas:**
- Set `(globalThis as any).React = React` BEFORE dynamically importing page components (classic JSX transform).
- Vite-only `@assets/...` and image imports crash node — register `client/src/pages/__tests__/asset-stub-loader.mjs` via `node:module` `register()` at the top of the test file.
- Toast-based error surfaces: capture via a probe component using `useToast` rather than rendering the Radix Toaster.
- ForgotPassword distinguishes network failures by `err instanceof TypeError` — mock fetch must reject with a `TypeError` for the network case.
- After any npm install, scrub `package-firewall.replit.local` URLs from package-lock.json (CI portability).
