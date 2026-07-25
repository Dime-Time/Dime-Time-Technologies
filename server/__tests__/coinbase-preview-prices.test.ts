/**
 * Unit tests for preview-mode crypto pricing (coinbaseService.getSpotPrice).
 *
 * Run locally (no DB, no network — axios is stubbed before the service loads):
 *   npx tsx --test server/__tests__/coinbase-preview-prices.test.ts
 *
 * Covers the "never break or block round-up processing" contract:
 *  1. Cold path: first lookup for a pair fetches the live public price.
 *  2. Fresh cache: repeat lookups within the TTL serve the cache (no refetch).
 *  3. Stale cache: served IMMEDIATELY even when the background refresh fails —
 *     a Coinbase outage must never throw or delay the caller.
 *  4. No cache + fetch failure: degrades to the static fallback price.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";

// Track stubbed calls per URL; installed BEFORE the service module loads so the
// boot-time cache warm-up (BTC/ETH/ADA/SOL) also hits the stub, never the network.
const calls: string[] = [];
let responder: (url: string) => Promise<{ data: any }> = async (url) => {
  throw new Error(`Unexpected axios.get before responder configured: ${url}`);
};

(axios as any).get = async (url: string, _config?: unknown) => {
  calls.push(url);
  return responder(url);
};

const priceResponse = (amount: string) => ({ data: { data: { amount, base: "X", currency: "USD" } } });

let coinbaseService: any;

before(async () => {
  responder = async () => priceResponse("64000.00"); // warm-up succeeds
  ({ coinbaseService } = await import("../services/coinbaseService.js"));
  // Let the constructor's fire-and-forget warm-up settle
  await new Promise((r) => setTimeout(r, 20));
});

test("cold path fetches the live public price once", async () => {
  responder = async () => priceResponse("0.55123");
  const before = calls.filter((u) => u.includes("XRP-USD")).length;
  assert.equal(before, 0, "XRP must not be part of the warm-up set");

  const result = await coinbaseService.getSpotPrice("XRP-USD");
  assert.equal(result.currency, "USD");
  assert.equal(result.amount, "0.551230"); // <$1 keeps 6 decimals
  assert.equal(calls.filter((u) => u.includes("XRP-USD")).length, 1);
});

test("fresh cache serves repeat lookups without refetching", async () => {
  responder = async () => priceResponse("9999.99"); // would be visible if refetched
  const countBefore = calls.filter((u) => u.includes("XRP-USD")).length;

  const result = await coinbaseService.getSpotPrice("XRP-USD");
  assert.equal(result.amount, "0.551230", "must serve the cached price, not refetch");
  assert.equal(calls.filter((u) => u.includes("XRP-USD")).length, countBefore);
});

test("stale cache is served immediately even when the refresh fails", async () => {
  const cache: Map<string, { price: number; fetchedAt: number }> = (coinbaseService as any).spotPriceCache;
  cache.set("XRP-USD", { price: 0.5, fetchedAt: Date.now() - 10 * 60_000 }); // 10 min stale
  responder = async () => {
    throw new Error("simulated Coinbase outage");
  };

  const started = Date.now();
  const result = await coinbaseService.getSpotPrice("XRP-USD");
  const elapsed = Date.now() - started;

  assert.equal(result.amount, "0.500000", "stale price must be served as-is");
  assert.ok(elapsed < 250, `stale serve must not wait on the network (took ${elapsed}ms)`);
  // Background refresh was attempted (and failed) — give it a tick to settle
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(cache.get("XRP-USD")!.price, 0.5, "failed refresh must not corrupt the cache");
});

test("no cache + fetch failure degrades to the static fallback", async () => {
  responder = async () => {
    throw new Error("simulated Coinbase outage");
  };
  const result = await coinbaseService.getSpotPrice("LTC-USD"); // never cached, not warm-listed
  assert.equal(result.amount, "140.00", "must return the static LTC fallback");
});

test("invalid payloads are rejected and fall back safely", async () => {
  responder = async () => ({ data: { data: { amount: "not-a-number" } } });
  const result = await coinbaseService.getSpotPrice("DOGE-USD"); // no static entry → BTC fallback
  assert.equal(result.amount, "43250.00");
});
