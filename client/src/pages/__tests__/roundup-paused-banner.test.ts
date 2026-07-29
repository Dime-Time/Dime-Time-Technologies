/**
 * Regression guard for RoundUpPausedBanner visibility rules.
 *
 * The banner (dashboard + transactions) must render ONLY when:
 *   ENABLE_SUBSCRIPTIONS flag is on AND the user is NOT entitled AND
 *   round-ups are enabled.
 * It must stay hidden when the flag is off, when the user is a paying
 * subscriber (entitled), or when round-ups are disabled. Showing it to
 * subscribers — or hiding it from an unsubscribed user with round-ups on —
 * is the regression this test catches.
 *
 * Runs under `tsx --test` with happy-dom, a mocked global fetch feeding the
 * AuthProvider `/api/user` bootstrap (source of the `_flags` envelope that
 * useFlag reads), and a QueryClient default queryFn serving the banner's
 * /api/subscription and /api/round-up-settings queries.
 */
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { register as registerModuleHook } from "node:module";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Stub Vite-only `@assets/...` imports so app modules load under tsx.
registerModuleHook(new URL("./asset-stub-loader.mjs", import.meta.url));

GlobalRegistrator.register({ url: "https://dime-time.test/" });
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import * as React from "react";
// tsx compiles app .tsx files with the classic JSX transform — React must be
// global BEFORE the components are loaded.
(globalThis as Record<string, unknown>).React = React;

const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { DEFAULT_FLAGS } = await import("@shared/flags");
const { AuthProvider } = await import("../../hooks/useAuth");
const { RoundUpPausedBanner } = await import("../../components/RoundUpPausedBanner");

const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
  GlobalRegistrator.unregister();
});

interface Scenario {
  subscriptionsFlag: boolean;
  entitled: boolean;
  roundUpsEnabled: boolean;
}

/**
 * Mock fetch for the AuthProvider's /api/user bootstrap, which carries the
 * `_flags` envelope that useFlag("ENABLE_SUBSCRIPTIONS") reads.
 */
function mockUserFetch(scenario: Scenario) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/user")) {
      return new Response(
        JSON.stringify({
          id: "u1",
          email: "user@example.com",
          firstName: "Pat",
          lastName: "Doe",
          profileImageUrl: null,
          emailVerifiedAt: null,
          createdAt: null,
          updatedAt: null,
          _flags: { ...DEFAULT_FLAGS, ENABLE_SUBSCRIPTIONS: scenario.subscriptionsFlag },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  }) as typeof fetch;
}

let container: HTMLElement;
let root: ReturnType<typeof createRoot> | null = null;

beforeEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
  // AuthProvider seeds from a localStorage user cache — keep runs isolated.
  window.localStorage.clear();
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  window.history.replaceState({}, "", "/");
});

async function renderBanner(scenario: Scenario) {
  mockUserFetch(scenario);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        // Serves the banner's own queries (the /api/user query supplies its
        // own queryFn inside AuthProvider and never reaches this).
        queryFn: async ({ queryKey }) => {
          const key = String(queryKey[0]);
          if (key === "/api/subscription") {
            return { entitled: scenario.entitled };
          }
          if (key === "/api/round-up-settings") {
            return { isEnabled: scenario.roundUpsEnabled };
          }
          throw new Error(`unexpected query in test: ${key}`);
        },
      },
    },
  });

  root = createRoot(container);
  await act(async () => {
    root!.render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(AuthProvider, null, React.createElement(RoundUpPausedBanner)),
      ),
    );
    // Let the /api/user bootstrap + dependent queries settle.
    await new Promise((r) => setTimeout(r, 30));
  });
}

function banner(): Element | null {
  return container.querySelector('[data-testid="banner-roundups-paused"]');
}

test("flag off → banner hidden even for unsubscribed users with round-ups on", async () => {
  await renderBanner({ subscriptionsFlag: false, entitled: false, roundUpsEnabled: true });
  assert.equal(banner(), null);
});

test("entitled subscriber → banner hidden", async () => {
  await renderBanner({ subscriptionsFlag: true, entitled: true, roundUpsEnabled: true });
  assert.equal(banner(), null);
});

test("round-ups disabled → banner hidden even when unsubscribed", async () => {
  await renderBanner({ subscriptionsFlag: true, entitled: false, roundUpsEnabled: false });
  assert.equal(banner(), null);
});

test("flag on + not entitled + round-ups on → banner visible with /subscription link", async () => {
  await renderBanner({ subscriptionsFlag: true, entitled: false, roundUpsEnabled: true });
  const el = banner();
  assert.ok(el, "banner must render for an unsubscribed user with round-ups enabled");
  assert.match(el!.textContent ?? "", /Round-ups paused/);

  const link = container.querySelector('a[href="/subscription"]');
  assert.ok(link, "banner must link to /subscription");
  assert.ok(
    link!.querySelector('[data-testid="button-resume-roundups"]'),
    "subscribe button must live inside the /subscription link",
  );
});
