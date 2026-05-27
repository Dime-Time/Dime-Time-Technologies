import * as Sentry from "@sentry/react";
import { redactSentryEvent } from "@shared/sentryRedact";

let initialized = false;

/**
 * Initialize Sentry on the React client. No-op unless VITE_SENTRY_DSN is set
 * at build time, so the SDK is completely silent in dev/preview builds
 * without a DSN.
 */
export function initSentry(): void {
  if (initialized) return;
  const dsn = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment:
      ((import.meta as any).env?.VITE_SENTRY_ENVIRONMENT as string | undefined) ||
      ((import.meta as any).env?.MODE as string | undefined) ||
      "production",
    release: (import.meta as any).env?.VITE_SENTRY_RELEASE as string | undefined,
    // Errors only — no performance / replay.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      return redactSentryEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      if (!breadcrumb?.data) return breadcrumb;
      const d = breadcrumb.data as Record<string, unknown>;
      for (const k of ["url", "to", "from"] as const) {
        const v = d[k];
        if (typeof v === "string" && /^https?:\/\//i.test(v)) {
          const qIdx = v.indexOf("?");
          const hIdx = v.indexOf("#");
          let end = v.length;
          if (qIdx >= 0) end = Math.min(end, qIdx);
          if (hIdx >= 0) end = Math.min(end, hIdx);
          d[k] = v.slice(0, end);
        }
      }
      return breadcrumb;
    },
  });
  initialized = true;
}

export function isSentryEnabled(): boolean {
  return initialized;
}

/**
 * Tag the current Sentry scope with a correlationId returned by the server in
 * an error response, so a client-captured exception can be cross-referenced
 * with the server logs / Sentry event for the same request.
 */
export function setCorrelationTag(correlationId: string | undefined | null): void {
  if (!initialized || !correlationId) return;
  try {
    Sentry.getCurrentScope().setTag("correlationId", correlationId);
  } catch {
    // never let Sentry instrumentation break the app
  }
}

export { Sentry };
