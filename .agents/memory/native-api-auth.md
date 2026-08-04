---
name: Native API auth — apiRequest only
description: Why every client /api call must go through apiRequest, never raw fetch (native Bearer token).
---

**Rule:** All client-side `/api/*` calls must use `apiRequest()` / the shared query client from `client/src/lib/queryClient.ts`. Never use raw `fetch("/api/...")` in components or pages.

**Why:** On native (Capacitor), the WebView origin is not dime-time.com, so the session cookie is NOT sent cross-origin. `apiRequest`/`getQueryFn` attach `Authorization: Bearer <token>` on native platforms; raw fetch does not → the request arrives unauthenticated → 401 → generic failure toasts. On web the session cookie masks the bug completely, so it only surfaces on real devices (founder hit it: round-up toggle "Failed to update settings" on iPhone while the page's GETs — via the query client — worked fine).

**How to apply:** When adding or reviewing any client mutation/effect that talks to the API, grep for `fetch("/api` / `fetch('/api` in `client/src` — it must stay at zero matches. `apiRequest` throws `ApiError` (with `.status`) on non-2xx, so no `response.ok` branching is needed; error handling belongs in try/catch or mutation `onError`.

Also note: server route catch blocks should log the error (`console.error`) before returning 500 — a silent catch made this bug expensive to trace.
