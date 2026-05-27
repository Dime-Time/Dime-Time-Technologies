/**
 * Tests for the shared Sentry `beforeSend` redactor.
 *
 * Run locally:
 *   npx tsx --test server/lib/__tests__/sentry-redact.test.ts
 *
 * These assertions enforce the redaction guarantees documented in
 * `shared/sentryRedact.ts`. Per task #15, the `/verify-email` and
 * `/reset-password` surface MUST never have `?token=...` leave the process,
 * which is explicitly asserted below.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { redactSentryEvent, stripUrlQueryAndFragment, redactObjectDeep } from "../../../shared/sentryRedact";

test("stripUrlQueryAndFragment removes both ? and #", () => {
  assert.equal(
    stripUrlQueryAndFragment("https://dime-time.com/verify-email?token=abc123"),
    "https://dime-time.com/verify-email",
  );
  assert.equal(
    stripUrlQueryAndFragment("https://dime-time.com/reset-password#token=abc"),
    "https://dime-time.com/reset-password",
  );
  assert.equal(stripUrlQueryAndFragment("https://x.com/a"), "https://x.com/a");
});

test("redactObjectDeep filters secret-named fields case-insensitively", () => {
  const out = redactObjectDeep({
    Authorization: "Bearer xyz",
    plaidAccessToken: "access-prod-secret",
    refresh_token: "rt-secret",
    apiKey: "sk_live_xxx",
    nested: { password: "hunter2", safe: "ok" },
    list: [{ Secret: "s" }, { keep: 1 }],
  });
  assert.equal((out as any).Authorization, "[Filtered]");
  assert.equal((out as any).plaidAccessToken, "[Filtered]");
  assert.equal((out as any).refresh_token, "[Filtered]");
  assert.equal((out as any).apiKey, "[Filtered]");
  assert.equal((out as any).nested.password, "[Filtered]");
  assert.equal((out as any).nested.safe, "ok");
  assert.equal((out as any).list[0].Secret, "[Filtered]");
  assert.equal((out as any).list[1].keep, 1);
});

test("redactSentryEvent strips request.url query+fragment", () => {
  const event: any = {
    request: { url: "https://dime-time.com/verify-email?token=raw-token-abc#x" },
  };
  const out = redactSentryEvent(event);
  assert.equal(out.request.url, "https://dime-time.com/verify-email");
  assert.ok(!String(out.request.url).includes("token="));
  assert.ok(!String(out.request.url).includes("?"));
  assert.ok(!String(out.request.url).includes("#"));
});

test("redactSentryEvent strips Authorization / Cookie / Set-Cookie headers (any case)", () => {
  const event: any = {
    request: {
      url: "https://dime-time.com/api/user",
      headers: {
        Authorization: "Bearer abc",
        cookie: "sid=xyz",
        "Set-Cookie": "sid=xyz; Path=/",
        "Content-Type": "application/json",
      },
    },
  };
  const out = redactSentryEvent(event);
  assert.equal(out.request.headers.Authorization, "[Filtered]");
  assert.equal(out.request.headers.cookie, "[Filtered]");
  assert.equal(out.request.headers["Set-Cookie"], "[Filtered]");
  assert.equal(out.request.headers["Content-Type"], "application/json");
});

test("redactSentryEvent scrubs breadcrumbs[].data.url query strings", () => {
  const event: any = {
    breadcrumbs: [
      { category: "navigation", data: { from: "/x", to: "/reset-password?token=secret#y" } },
      { category: "fetch", data: { url: "https://dime-time.com/verify-email?token=zzz" } },
    ],
  };
  const out = redactSentryEvent(event);
  assert.equal(out.breadcrumbs[0].data.to, "/reset-password");
  assert.equal(out.breadcrumbs[1].data.url, "https://dime-time.com/verify-email");
});

test("redactSentryEvent filters secret-named keys inside extra and contexts", () => {
  const event: any = {
    extra: {
      plaidAccessToken: "access-prod-abc",
      ok: "value",
      nested: { Authorization: "Bearer x" },
    },
    contexts: { auth: { apiKey: "sk_live_x" } },
  };
  const out = redactSentryEvent(event);
  assert.equal(out.extra.plaidAccessToken, "[Filtered]");
  assert.equal(out.extra.ok, "value");
  assert.equal(out.extra.nested.Authorization, "[Filtered]");
  assert.equal(out.contexts.auth.apiKey, "[Filtered]");
});

test("redactSentryEvent scrubs token=... from messages and exception values", () => {
  const event: any = {
    message: "redirect to https://dime-time.com/reset-password?token=secretABC failed",
    exception: {
      values: [
        { type: "Error", value: "fetch failed: /verify-email?token=zzz returned 500" },
      ],
    },
  };
  const out = redactSentryEvent(event);
  assert.ok(!out.message.includes("secretABC"), `message still leaked secret: ${out.message}`);
  assert.ok(out.message.includes("token=[Filtered]"));
  assert.ok(!out.exception.values[0].value.includes("zzz"));
  assert.ok(out.exception.values[0].value.includes("token=[Filtered]"));
});

test("EXPLICIT ASSERTION: /verify-email and /reset-password never carry a query string", () => {
  // This is the hard requirement from task #15 — must remain enforced.
  const surfaces = [
    "https://dime-time.com/verify-email?token=abc",
    "https://dime-time.com/reset-password?token=abc&foo=bar",
    "https://dime-time.com/api/auth/reset-password?token=abc",
  ];
  for (const url of surfaces) {
    const out = redactSentryEvent({ request: { url } }) as any;
    assert.ok(
      !String(out.request.url).includes("?"),
      `redacted url for ${url} still contains '?': ${out.request.url}`,
    );
    assert.ok(
      !String(out.request.url).toLowerCase().includes("token="),
      `redacted url for ${url} still contains 'token=': ${out.request.url}`,
    );
  }
});

test("redactSentryEvent is a no-op for falsy events", () => {
  assert.equal(redactSentryEvent(null as any), null);
  assert.equal(redactSentryEvent(undefined as any), undefined);
});
