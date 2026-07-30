/**
 * Regression guard for the dashboard duplicate-debt notice's PER-PAIR
 * dismissal (Task 90 behavior).
 *
 * The notice must:
 *   1. Show when duplicate pairs exist.
 *   2. Hide only the pairs that existed at dismissal time (keys persisted in
 *      sessionStorage under "dashboardDuplicateNoticeDismissedPairs").
 *   3. REAPPEAR when a NEW pair shows up later in the same session.
 *   4. Stay hidden when every current pair has been dismissed.
 * A refactor of dashboard.tsx back to all-or-nothing dismissal breaks 3 —
 * that is the regression this test catches.
 *
 * Runs under `tsx --test` with happy-dom, a mocked global fetch feeding the
 * AuthProvider `/api/user` bootstrap, and a QueryClient default queryFn
 * serving the dashboard's queries.
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
const { Router } = await import("wouter");
const { DEFAULT_FLAGS } = await import("@shared/flags");
const { AuthProvider } = await import("../../hooks/useAuth");
const Dashboard = (await import("../dashboard")).default;
import type { DuplicateDebtPair } from "@shared/debtDuplicates";
import type { Debt } from "@shared/schema";

const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
  GlobalRegistrator.unregister();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function debt(id: string, source: "manual" | "imported"): Debt {
  return {
    id,
    userId: "u1",
    name: source === "manual" ? "JP Morgan Credit Card" : "CREDIT CARD",
    source,
  } as unknown as Debt;
}

const PAIR_A: DuplicateDebtPair = {
  manualDebtId: "m1",
  importedDebtId: "i1",
  reason: "Account numbers end in the same four digits",
};
const PAIR_B: DuplicateDebtPair = {
  manualDebtId: "m2",
  importedDebtId: "i2",
  reason: "Similar name or institution with a close balance",
};

const DEBTS: Debt[] = [debt("m1", "manual"), debt("i1", "imported"), debt("m2", "manual"), debt("i2", "imported")];

function mockUserFetch() {
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
          _flags: { ...DEFAULT_FLAGS },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  }) as typeof fetch;
}

let container: HTMLElement;
let root: ReturnType<typeof createRoot> | null = null;
let queryClient: InstanceType<typeof QueryClient>;

beforeEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  window.history.replaceState({}, "", "/");
});

async function renderDashboard(pairs: DuplicateDebtPair[]) {
  mockUserFetch();
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        queryFn: async ({ queryKey }) => {
          const key = String(queryKey[0]);
          switch (key) {
            case "/api/debts/duplicates":
              return pairs;
            case "/api/debts":
              return DEBTS;
            case "/api/transactions":
              return [];
            case "/api/round-up-settings":
              return { isEnabled: false };
            case "/api/subscription":
              return { entitled: true };
            case "/api/dashboard-summary":
              return {
                totalDebt: "0",
                totalRoundUps: "0",
                thisMonthRoundUps: "0",
                thisMonthPayments: "0",
                progressPercentage: 0,
                debtFreeDate: "—",
                debtsCount: 4,
              };
            default:
              // Anything else the page pulls in is irrelevant to the notice.
              return {};
          }
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
        React.createElement(
          AuthProvider,
          null,
          React.createElement(Router, null, React.createElement(Dashboard)),
        ),
      ),
    );
    await new Promise((r) => setTimeout(r, 50));
  });
  // A second act tick lets the late-resolving queries (duplicates arrives
  // after the first commit) flush their re-render.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 150));
  });
}

function notice(): Element | null {
  return container.querySelector('[data-testid="banner-duplicate-debts"]');
}

async function clickDismiss() {
  const btn = container.querySelector(
    '[data-testid="button-dismiss-duplicate-notice"]',
  ) as HTMLButtonElement | null;
  assert.ok(btn, "dismiss button must be present");
  await act(async () => {
    btn!.click();
    await new Promise((r) => setTimeout(r, 10));
  });
}

/** Simulate new server data arriving mid-session (e.g. another bank import). */
async function pushPairs(pairs: DuplicateDebtPair[]) {
  await act(async () => {
    queryClient.setQueryData(["/api/debts/duplicates"], pairs);
    await new Promise((r) => setTimeout(r, 10));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("notice shows for existing pairs and dismissal hides them (persisted per-pair)", async () => {
  await renderDashboard([PAIR_A]);
  assert.ok(notice(), "notice must render when a duplicate pair exists");
  assert.match(notice()!.textContent ?? "", /1 debt may be a duplicate/);

  await clickDismiss();
  assert.equal(notice(), null, "dismissal must hide the current pair");

  // Pair keys — not a boolean — must be what's persisted.
  const raw = window.sessionStorage.getItem("dashboardDuplicateNoticeDismissedPairs");
  assert.deepEqual(JSON.parse(raw ?? "[]"), ["m1:i1"]);
});

test("a NEW pair appearing later in the same session brings the notice back", async () => {
  await renderDashboard([PAIR_A]);
  await clickDismiss();
  assert.equal(notice(), null);

  // Another bank import produces a second, previously unseen pair.
  await pushPairs([PAIR_A, PAIR_B]);
  const el = notice();
  assert.ok(el, "notice must REAPPEAR for a pair the user never dismissed");
  assert.match(el!.textContent ?? "", /1 debt may be a duplicate/, "only the new pair counts");
});

test("when every current pair was dismissed, nothing shows — across a remount in the same session", async () => {
  await renderDashboard([PAIR_A, PAIR_B]);
  assert.match(notice()!.textContent ?? "", /2 debts may be duplicates/);
  await clickDismiss();
  assert.equal(notice(), null, "dismissing hides all pairs current at that moment");

  // Remount (navigation back to dashboard in the same session) — the
  // sessionStorage keys keep the same pairs hidden.
  await act(async () => {
    root!.unmount();
  });
  root = null;
  container.innerHTML = "";
  await renderDashboard([PAIR_A, PAIR_B]);
  assert.equal(notice(), null, "dismissed pairs stay hidden after a remount in the same session");
});
