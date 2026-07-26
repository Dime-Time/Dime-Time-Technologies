/**
 * Guards the "Deleted debt" fallback in the insights Recent Transfers list.
 *
 * Permanent deletion intentionally leaves the transfer ledger untouched for
 * audit integrity, so a transfer can reference a debt that no longer exists.
 * The destination line must:
 *   (a) show the debt name for a transfer pointing at an ACTIVE debt,
 *   (b) show the debt name for a transfer pointing at an ARCHIVED debt,
 *   (c) show "Deleted debt" for a transfer pointing at a nonexistent debtId,
 * without crashing or blanking the row.
 *
 * Rendered via react-dom/server (no DOM needed) with a prefilled React Query
 * cache, so it runs under `tsx --test` like the other client tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// tsx compiles the app's .tsx files with the classic JSX transform (no
// auto-injected `import React`), so expose React globally BEFORE loading
// the page component, then import it dynamically.
(globalThis as Record<string, unknown>).React = React;
const { default: Insights } = await import("../insights");
const { createElement } = React;

const now = "2026-07-20T12:00:00.000Z";

function makeDebt(id: string, name: string) {
  return {
    id,
    userId: "u1",
    name,
    currentBalance: "500.00",
    originalBalance: "1000.00",
    interestRate: "19.99",
    minimumPayment: "25.00",
    dueDate: 15,
    debtType: "credit_card",
    paidOffAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function makeTransfer(id: string, debtId: string, createdAt: string) {
  return {
    id,
    type: "round_up_transfer",
    amount: "12.34",
    status: "completed",
    debtId,
    fundingAccount: { institutionName: "Test Bank", last4: "4321" },
    errorCode: null,
    errorMessage: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function renderInsights() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        // Never hit the network in this test; all data is preseeded below.
        queryFn: () => {
          throw new Error("unexpected fetch in test");
        },
      },
    },
  });

  queryClient.setQueryData(["/api/user"], { id: "u1", email: "user@example.com" });
  queryClient.setQueryData(["/api/transactions"], []);
  queryClient.setQueryData(["/api/payments"], []);
  queryClient.setQueryData(["/api/dashboard-summary"], {
    totalDebt: "500.00",
    totalRoundUps: "0.00",
    thisMonthRoundUps: "0.00",
    thisMonthPayments: "0.00",
    progressPercentage: 50,
    debtFreeDate: "Jan 2028",
  });
  queryClient.setQueryData(["/api/debts"], [makeDebt("debt-active", "Active Visa")]);
  queryClient.setQueryData(
    ["/api/debts/archived"],
    [makeDebt("debt-archived", "Archived Loan")],
  );
  queryClient.setQueryData(
    ["/api/transfers"],
    [
      makeTransfer("t-active", "debt-active", "2026-07-19T12:00:00.000Z"),
      makeTransfer("t-archived", "debt-archived", "2026-07-18T12:00:00.000Z"),
      makeTransfer("t-deleted", "debt-that-no-longer-exists", "2026-07-17T12:00:00.000Z"),
    ],
  );

  return renderToString(
    createElement(QueryClientProvider, { client: queryClient }, createElement(Insights)),
  );
}

function detailLine(html: string, transferId: string): string {
  const marker = `data-testid="transfer-detail-${transferId}"`;
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `destination line for ${transferId} must render`);
  const open = html.indexOf(">", start);
  const close = html.indexOf("</div>", open);
  return html.slice(open + 1, close);
}

test("transfer row for an active debt shows the debt name", () => {
  const html = renderInsights();
  const line = detailLine(html, "t-active");
  assert.match(line, /Active Visa/);
  assert.doesNotMatch(line, /Deleted debt/);
});

test("transfer row for an archived debt resolves the archived name", () => {
  const html = renderInsights();
  const line = detailLine(html, "t-archived");
  assert.match(line, /Archived Loan/);
  assert.doesNotMatch(line, /Deleted debt/);
});

test("transfer row for a nonexistent debt falls back to 'Deleted debt'", () => {
  const html = renderInsights();
  // The row itself must render (no crash, no dropped row)…
  assert.match(html, /data-testid="transfer-row-t-deleted"/);
  // …and the destination line must not be blank: funding + fallback label.
  const line = detailLine(html, "t-deleted");
  assert.match(line, /Deleted debt/);
  assert.match(line, /Test Bank/);
});
