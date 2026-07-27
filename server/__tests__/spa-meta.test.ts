// ── SPA public-page metadata injection ───────────────────────────────────
//
// /privacy, /terms and /delete-account are SPA routes; in production the
// server swaps each page's own title/description/canonical into the built
// shell so crawlers don't see the homepage's metadata on all three URLs.
// These tests run applySpaMeta against the REAL client/index.html so any
// shell change that breaks an anchor fails loudly here.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { applySpaMeta, SPA_META_PAGES } from "../spaMeta";

const shell = fs.readFileSync(
  path.resolve(process.cwd(), "client", "index.html"),
  "utf-8",
);

const HOMEPAGE_TITLE = "Dime Time | Round-Up App to Pay Off Debt With Spare Change";

test("shell sanity: homepage title and anchors exist in client/index.html", () => {
  assert.ok(shell.includes(`<title>${HOMEPAGE_TITLE}</title>`));
  assert.ok(/<meta name="description"[^>]*>/.test(shell));
  assert.ok(/<link rel="canonical"[^>]*>/.test(shell));
  assert.ok(/<meta name="robots"[^>]*>/.test(shell));
});

for (const [route, meta] of Object.entries(SPA_META_PAGES)) {
  test(`${route}: title, description, canonical and og:url are swapped in`, () => {
    const out = applySpaMeta(shell, meta);
    assert.ok(out.includes(`<title>${meta.title}</title>`), "own <title>");
    assert.ok(!out.includes(`<title>${HOMEPAGE_TITLE}</title>`), "homepage <title> gone");
    assert.ok(out.includes(`content="${meta.description}"`), "own description");
    assert.ok(out.includes(`href="${meta.canonical}"`), "own canonical");
    assert.ok(out.includes(`<meta property="og:url" content="${meta.canonical}" />`), "own og:url");
    // The SPA must still boot: root div and entry script untouched.
    assert.ok(out.includes('<div id="root"></div>'));
  });
}

test("/delete-account is noindexed; /privacy and /terms stay indexable", () => {
  const del = applySpaMeta(shell, SPA_META_PAGES["/delete-account"]);
  assert.ok(del.includes('<meta name="robots" content="noindex, follow" />'));
  assert.ok(!del.includes('content="index, follow"'));

  for (const route of ["/privacy", "/terms"] as const) {
    const out = applySpaMeta(shell, SPA_META_PAGES[route]);
    assert.ok(out.includes('content="index, follow"'), `${route} keeps index, follow`);
    assert.ok(!out.includes("noindex"), `${route} is not noindexed`);
  }
});

test("missing anchors never throw — html passes through", () => {
  const bare = "<html><head></head><body></body></html>";
  assert.equal(applySpaMeta(bare, SPA_META_PAGES["/privacy"]), bare);
});
