/**
 * Shared Sentry redaction helpers used by both the Node server SDK and the
 * React browser SDK. Wired up as a `beforeSend` hook in `server/lib/sentry.ts`
 * and `client/src/lib/sentry.ts`.
 *
 * Guarantees (enforced by `server/lib/__tests__/sentry-redact.test.ts`):
 *   1. Query strings and URL fragments are stripped from `request.url`,
 *      `breadcrumbs[].data.url`, and any string value that looks like an
 *      http(s) URL inside `extra`, `contexts`, or `request.data`.
 *   2. Any field whose key matches /token|password|secret|api[_-]?key|
 *      authorization|cookie|plaid[_-]?access[_-]?token|access[_-]?token|
 *      refresh[_-]?token/i is replaced with the literal string "[Filtered]".
 *   3. Authorization / Cookie / Set-Cookie request headers are filtered.
 *   4. The reset/verify token surface — `/verify-email` and `/reset-password`
 *      and their POST endpoints — additionally has `token=...` query params
 *      scrubbed from any captured `message` or `exception.value` string.
 */

const SECRET_KEY_RX =
  /token|password|secret|api[_-]?key|authorization|cookie|plaid[_-]?access[_-]?token|access[_-]?token|refresh[_-]?token/i;

const SECRET_QUERY_PARAM_RX =
  /([?&])(token|password|secret|access[_-]?token|refresh[_-]?token|api[_-]?key)=([^&\s"'#]+)/gi;

const SENSITIVE_HEADER_RX = /^(authorization|cookie|set-cookie)$/i;

const SENSITIVE_PATH_RX = /\/(verify-email|reset-password)/i;

/** Strip query string AND fragment from a URL string. */
export function stripUrlQueryAndFragment(url: string | undefined | null): string | undefined | null {
  if (url == null) return url;
  if (typeof url !== "string") return url;
  const qIdx = url.indexOf("?");
  const hIdx = url.indexOf("#");
  let end = url.length;
  if (qIdx >= 0) end = Math.min(end, qIdx);
  if (hIdx >= 0) end = Math.min(end, hIdx);
  return url.slice(0, end);
}

/** Scrub `token=...` (and other secret-looking query params) from a free-form string. */
export function scrubSecretQueryParams(s: string | undefined | null): string | undefined | null {
  if (typeof s !== "string") return s;
  return s.replace(SECRET_QUERY_PARAM_RX, "$1$2=[Filtered]");
}

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

/**
 * Recursively walk an arbitrary object and:
 *   - replace any value whose KEY matches `SECRET_KEY_RX` with "[Filtered]"
 *   - strip query/fragment from any string value that looks like a URL
 *   - scrub `token=...` from any string value
 */
export function redactObjectDeep<T>(input: T, depth = 0): T {
  if (input == null || depth > 8) return input;
  if (Array.isArray(input)) {
    return (input.map((v) => redactObjectDeep(v, depth + 1)) as unknown) as T;
  }
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (SECRET_KEY_RX.test(k)) {
        out[k] = "[Filtered]";
        continue;
      }
      if (typeof v === "string") {
        out[k] = looksLikeUrl(v)
          ? stripUrlQueryAndFragment(scrubSecretQueryParams(v) as string)
          : scrubSecretQueryParams(v);
      } else {
        out[k] = redactObjectDeep(v, depth + 1);
      }
    }
    return out as T;
  }
  if (typeof input === "string") {
    return (looksLikeUrl(input)
      ? stripUrlQueryAndFragment(scrubSecretQueryParams(input) as string)
      : scrubSecretQueryParams(input)) as unknown as T;
  }
  return input;
}

/**
 * `beforeSend` redactor — accepts a Sentry-shaped event and returns a sanitized
 * copy. Typed as `any` because the Node and Browser SDKs ship slightly
 * different `Event` types and we want one redactor to satisfy both.
 */
export function redactSentryEvent<E extends Record<string, any> | null | undefined>(event: E): E {
  if (!event) return event;

  // request.* — URL, query, headers, body
  if (event.request) {
    if (typeof event.request.url === "string") {
      event.request.url = stripUrlQueryAndFragment(event.request.url);
    }
    if ("query_string" in event.request) {
      event.request.query_string = "[Filtered]";
    }
    if (event.request.headers && typeof event.request.headers === "object") {
      for (const k of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADER_RX.test(k)) {
          event.request.headers[k] = "[Filtered]";
        }
      }
    }
    if (event.request.data !== undefined) {
      event.request.data = redactObjectDeep(event.request.data);
    }
    if (event.request.cookies !== undefined) {
      event.request.cookies = "[Filtered]";
    }
  }

  // breadcrumbs
  if (Array.isArray(event.breadcrumbs)) {
    for (const b of event.breadcrumbs) {
      if (!b || typeof b !== "object") continue;
      if (b.data && typeof b.data === "object") {
        if (typeof b.data.url === "string") {
          b.data.url = stripUrlQueryAndFragment(b.data.url);
        }
        if (typeof b.data.to === "string") {
          b.data.to = stripUrlQueryAndFragment(b.data.to);
        }
        if (typeof b.data.from === "string") {
          b.data.from = stripUrlQueryAndFragment(b.data.from);
        }
        b.data = redactObjectDeep(b.data);
      }
      if (typeof b.message === "string") {
        b.message = scrubSecretQueryParams(b.message);
      }
    }
  }

  if (event.extra) event.extra = redactObjectDeep(event.extra);
  if (event.contexts) event.contexts = redactObjectDeep(event.contexts);
  if (event.tags) event.tags = redactObjectDeep(event.tags);
  if (event.user && typeof event.user === "object") {
    // Strip sensitive header-y fields the SDK sometimes attaches to user.
    if ("ip_address" in event.user) {
      // keep ip_address if Sentry already chose to send it — but ensure it
      // isn't a stringified URL with secrets
      if (typeof event.user.ip_address === "string") {
        event.user.ip_address = scrubSecretQueryParams(event.user.ip_address);
      }
    }
  }

  // Scrub free-form messages and exception values.
  if (typeof event.message === "string") {
    event.message = scrubSecretQueryParams(event.message);
  }
  if (event.exception?.values && Array.isArray(event.exception.values)) {
    for (const ex of event.exception.values) {
      if (typeof ex?.value === "string") {
        ex.value = scrubSecretQueryParams(ex.value);
      }
    }
  }

  // Hard assertion for the token-bearing surfaces.
  const url: string | undefined =
    typeof event.request?.url === "string" ? event.request.url : undefined;
  if (url && SENSITIVE_PATH_RX.test(url)) {
    // request.url was already cropped at "?" above; this is belt-and-braces.
    if (url.includes("?")) {
      event.request.url = stripUrlQueryAndFragment(url);
    }
  }

  return event;
}
