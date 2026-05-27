import * as Sentry from "@sentry/node";
import { redactSentryEvent } from "@shared/sentryRedact";

let initialized = false;

/**
 * Initialize Sentry on the Node server. No-op if SENTRY_DSN is unset, so the
 * SDK is completely silent in dev / local environments unless the operator
 * opts in. Safe to call multiple times.
 */
export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version || undefined,
    // Errors only for this pass — no performance / profiling / replay.
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      return redactSentryEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      if (!breadcrumb) return breadcrumb;
      if (breadcrumb.data && typeof breadcrumb.data === "object") {
        for (const k of ["url", "to", "from"] as const) {
          const v = (breadcrumb.data as Record<string, unknown>)[k];
          if (typeof v === "string") {
            (breadcrumb.data as Record<string, unknown>)[k] = stripIfUrl(v);
          }
        }
      }
      return breadcrumb;
    },
  });
  initialized = true;
}

function stripIfUrl(s: string): string {
  if (!/^https?:\/\//i.test(s)) return s;
  const qIdx = s.indexOf("?");
  const hIdx = s.indexOf("#");
  let end = s.length;
  if (qIdx >= 0) end = Math.min(end, qIdx);
  if (hIdx >= 0) end = Math.min(end, hIdx);
  return s.slice(0, end);
}

export function isSentryEnabled(): boolean {
  return initialized;
}

/**
 * Tag the current isolation scope (request-bound) with a correlationId so
 * server errors captured during the request carry the same id our structured
 * logs already include.
 */
export function setCorrelationTag(correlationId: string | undefined | null): void {
  if (!initialized || !correlationId) return;
  try {
    Sentry.getIsolationScope().setTag("correlationId", correlationId);
  } catch {
    // never let Sentry instrumentation break a request
  }
}

export { Sentry };
