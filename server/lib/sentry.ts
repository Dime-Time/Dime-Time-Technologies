/**
 * Sentry server init — LAZY. When SENTRY_DSN is unset, the @sentry/node SDK
 * is never imported, so the only runtime cost is this tiny shim. When the
 * DSN is set, the SDK is loaded once via dynamic import() and cached.
 */
import type { Express } from "express";
import { redactSentryEvent } from "@shared/sentryRedact";

type SentryNodeModule = typeof import("@sentry/node");

let sentryModule: SentryNodeModule | null = null;
let initialized = false;

export async function initSentry(): Promise<void> {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const Sentry = (await import("@sentry/node")) as SentryNodeModule;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version || undefined,
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
  sentryModule = Sentry;
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

/** Tag the current isolation scope with a correlationId. No-op when disabled. */
export function setCorrelationTag(correlationId: string | undefined | null): void {
  if (!initialized || !sentryModule || !correlationId) return;
  try {
    sentryModule.getIsolationScope().setTag("correlationId", correlationId);
  } catch {
    // never let Sentry instrumentation break a request
  }
}

/** Install Sentry's Express error handler. No-op when disabled. */
export function setupExpressErrorHandler(app: Express): void {
  if (!initialized || !sentryModule) return;
  try {
    sentryModule.setupExpressErrorHandler(app);
  } catch {
    // never let Sentry instrumentation block startup
  }
}
