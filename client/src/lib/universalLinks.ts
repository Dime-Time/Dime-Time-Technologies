/**
 * Native universal-link handling (iOS Associated Domains).
 *
 * When iOS opens the app via https://dime-time.com/... (most importantly the
 * Plaid OAuth return link https://dime-time.com/plaid/oauth?oauth_state_id=...),
 * Capacitor delivers the URL through:
 *   - the `appUrlOpen` event when the app is already running or backgrounded
 *   - `App.getLaunchUrl()` when the app was cold-started by the link
 *
 * We translate the https URL into an in-app wouter navigation so the bundled
 * SPA (served from capacitor://localhost) lands on the right route with the
 * original query string intact. The Plaid resume page reconstructs the
 * https:// redirect URI from pathname+search (see plaid-oauth.tsx).
 *
 * No-op on the web build — the browser already navigates natively.
 */
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { navigate } from "wouter/use-browser-location";

const APP_LINK_HOSTS = new Set(["dime-time.com", "www.dime-time.com"]);

function toInternalPath(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    if (!APP_LINK_HOSTS.has(url.hostname)) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

function handleIncomingUrl(rawUrl: string | null | undefined): void {
  if (!rawUrl) return;
  const path = toInternalPath(rawUrl);
  if (!path) return;
  // Duplicate-callback guard: if a second OAuth callback arrives while the
  // resume page is already mounted, don't re-navigate — the page's submitted
  // ref + cleared state already handle the duplicate safely.
  if (
    path.startsWith("/plaid/oauth") &&
    window.location.pathname.startsWith("/plaid/oauth")
  ) {
    return;
  }
  navigate(path);
}

let initialized = false;

/** Register universal-link listeners exactly once, at app startup. */
export function initUniversalLinks(): void {
  if (initialized || !Capacitor.isNativePlatform()) return;
  initialized = true;

  // App already running / backgrounded.
  void CapacitorApp.addListener("appUrlOpen", (event) => {
    handleIncomingUrl(event.url);
  });

  // App cold-started by the link. getLaunchUrl resolves after the WebView
  // boots, so navigating here lands on the route as soon as React mounts.
  void CapacitorApp.getLaunchUrl()
    .then((result) => handleIncomingUrl(result?.url))
    .catch(() => {
      // No launch URL — normal cold start.
    });
}
