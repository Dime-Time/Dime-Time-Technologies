/**
 * Sentry client init — LAZY. When VITE_SENTRY_DSN is unset (sourced from the
 * server-side SENTRY_DSN secret at build time — see vite.config.ts), the
 * @sentry/react SDK is never imported, so the production bundle does not
 * include it and the runtime cost is this tiny shim.
 */
import { redactSentryEvent } from "@shared/sentryRedact";

type SentryReactModule = typeof import("@sentry/react");

let sentryModule: SentryReactModule | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

function readDsn(): string | undefined {
  return (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;
}

export function initSentry(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (initialized) return;
    const dsn = readDsn();
    if (!dsn) return;
    const Sentry = (await import("@sentry/react")) as SentryReactModule;
    Sentry.init({
      dsn,
      environment:
        ((import.meta as any).env?.VITE_SENTRY_ENVIRONMENT as string | undefined) ||
        ((import.meta as any).env?.MODE as string | undefined) ||
        "production",
      release: (import.meta as any).env?.VITE_SENTRY_RELEASE as string | undefined,
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
    sentryModule = Sentry;
    initialized = true;
  })();
  return initPromise;
}

export function isSentryEnabled(): boolean {
  return initialized;
}

/** Tag the current Sentry scope with a server-supplied correlationId. No-op when disabled. */
export function setCorrelationTag(correlationId: string | undefined | null): void {
  if (!initialized || !sentryModule || !correlationId) return;
  try {
    sentryModule.getCurrentScope().setTag("correlationId", correlationId);
  } catch {
    // never let Sentry instrumentation break the app
  }
}
