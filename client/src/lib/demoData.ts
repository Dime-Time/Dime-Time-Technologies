/**
 * Demo / App Store review dataset.
 *
 * The iOS build talks to the PRODUCTION API. The dedicated App Store review
 * account (see DEMO_EMAIL) has real debts entered but no linked bank, so every
 * round-up / spending analytic computes to $0.00. Apple reviewers (and our own
 * marketing screenshots) need a populated, realistic app.
 *
 * This module ships a deterministic, internally-consistent sample dataset that
 * is injected CLIENT-SIDE *only* for the review account and *only* when the real
 * API returns no data — real data always takes precedence. Nothing here moves
 * money or touches the server; it is purely presentational sample content.
 */
import type { Transaction } from "@shared/schema";

/** Lowercased email of the dedicated App Store review / demo account. */
const DEMO_EMAIL = "tim@dime-time.com";

export function isDemoUser(user: unknown): boolean {
  const email = (user as { email?: string } | null | undefined)?.email;
  return typeof email === "string" && email.trim().toLowerCase() === DEMO_EMAIL;
}

export interface DemoSummary {
  totalDebt: string;
  totalRoundUps: string;
  thisMonthRoundUps: string;
  thisMonthPayments: string;
  progressPercentage: number;
  debtFreeDate: string;
  debtsCount: number;
}

// ── Deterministic PRNG so the dataset is identical on every render/build ──────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface CategorySpec {
  category: string;
  weight: number; // relative frequency
  merchants: string[];
  min: number;
  max: number;
}

// Dining is intentionally the heaviest category so it surfaces as the user's
// top spending category in Insights.
const CATEGORIES: CategorySpec[] = [
  {
    category: "Dining & Restaurants",
    weight: 34,
    merchants: ["Chipotle", "Olive Garden", "The Cheesecake Factory", "Panera Bread", "Shake Shack", "Sushi House", "Thai Garden", "Local Bistro"],
    min: 12,
    max: 90,
  },
  {
    category: "Groceries",
    weight: 18,
    merchants: ["Whole Foods", "Trader Joe's", "Safeway", "Kroger", "Costco", "Aldi"],
    min: 12,
    max: 95,
  },
  {
    category: "Coffee Shops",
    weight: 16,
    merchants: ["Starbucks", "Dunkin'", "Peet's Coffee", "Blue Bottle", "Local Roasters"],
    min: 3,
    max: 12,
  },
  {
    category: "Transportation",
    weight: 12,
    merchants: ["Uber", "Lyft", "Shell", "Chevron", "Metro Transit"],
    min: 6,
    max: 60,
  },
  {
    category: "Shopping",
    weight: 11,
    merchants: ["Amazon", "Target", "Best Buy", "Nike", "Apple Store"],
    min: 12,
    max: 120,
  },
  {
    category: "Entertainment",
    weight: 6,
    merchants: ["AMC Theatres", "Spotify", "Steam", "Ticketmaster"],
    min: 9,
    max: 65,
  },
  {
    category: "Subscriptions",
    weight: 3,
    merchants: ["Netflix", "Hulu", "Disney+", "Adobe", "iCloud"],
    min: 6,
    max: 30,
  },
];

// Calibration targets (realistic and internally consistent):
//   Total Saved (sum of round-ups)  ≈ $512.34
//   Average round-up per purchase   ≈ $0.87  → N ≈ 589 transactions
//   Round-up rate (round-ups/spend) ≈ 3.8%   → total spending ≈ $13,482
const TX_COUNT = 589;
const TARGET_TOTAL_ROUNDUPS = 512.34;
const TARGET_TOTAL_SPENDING = 13482.6;
const HISTORY_DAYS = 540; // ~18 months of history
const DAY_MS = 86_400_000;

function buildTransactions(): Transaction[] {
  const rng = mulberry32(20260602);
  const totalWeight = CATEGORIES.reduce((s, c) => s + c.weight, 0);
  const now = Date.now();

  const rows: Array<{
    merchant: string;
    category: string;
    amount: number;
    roundUp: number;
    time: number;
  }> = [];

  let amountSum = 0;
  let roundUpSum = 0;

  for (let i = 0; i < TX_COUNT; i++) {
    // Weighted category pick
    let pick = rng() * totalWeight;
    let spec = CATEGORIES[0];
    for (const c of CATEGORIES) {
      if (pick < c.weight) {
        spec = c;
        break;
      }
      pick -= c.weight;
    }

    const merchant = spec.merchants[Math.floor(rng() * spec.merchants.length)];
    const amount = spec.min + rng() * (spec.max - spec.min);
    const roundUp = 0.1 + rng() * 1.6; // avg ~0.9, scaled to exact below

    // Recency bias (exponent > 1 clusters transactions toward "today") so the
    // current month and current week are populated rather than near-empty.
    const dayOffset = Math.floor(HISTORY_DAYS * Math.pow(rng(), 1.8));
    const time = now - dayOffset * DAY_MS - Math.floor(rng() * DAY_MS);

    amountSum += amount;
    roundUpSum += roundUp;
    rows.push({ merchant, category: spec.category, amount, roundUp, time });
  }

  // Scale to hit exact aggregate targets, then fix rounding residue on row 0.
  const amountScale = TARGET_TOTAL_SPENDING / amountSum;
  const roundUpScale = TARGET_TOTAL_ROUNDUPS / roundUpSum;

  let amountAccum = 0;
  let roundUpAccum = 0;
  const scaled = rows.map((r) => {
    const amount = Math.round(r.amount * amountScale * 100) / 100;
    const roundUp = Math.round(r.roundUp * roundUpScale * 100) / 100;
    amountAccum += amount;
    roundUpAccum += roundUp;
    return { ...r, amount, roundUp };
  });

  scaled[0].amount = Math.round((scaled[0].amount + (TARGET_TOTAL_SPENDING - amountAccum)) * 100) / 100;
  scaled[0].roundUp = Math.round((scaled[0].roundUp + (TARGET_TOTAL_ROUNDUPS - roundUpAccum)) * 100) / 100;

  // Newest first so dashboard "Recent Transactions" shows current activity.
  scaled.sort((a, b) => b.time - a.time);

  return scaled.map((r, idx) => ({
    id: `demo-${idx}`,
    userId: "demo",
    merchant: r.merchant,
    category: r.category,
    amount: r.amount.toFixed(2),
    roundUpAmount: r.roundUp.toFixed(2),
    date: new Date(r.time),
    description: null,
  })) as Transaction[];
}

export const DEMO_TRANSACTIONS: Transaction[] = buildTransactions();

// Current-calendar-month round-up total, derived from the same dataset so the
// dashboard summary and the transactions page agree automatically.
const startOfMonth = (() => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
})();

const DEMO_THIS_MONTH_ROUNDUPS = DEMO_TRANSACTIONS.filter(
  (t) => new Date(t.date).getTime() >= startOfMonth,
).reduce((sum, t) => sum + parseFloat(t.roundUpAmount), 0);

/**
 * Merge demo round-up figures into the server summary for the review account.
 * Real (non-zero) values are never overwritten — demo numbers only fill the
 * empty round-up fields, while real debt/progress fields pass through untouched.
 */
export function applyDemoSummary<T extends Partial<DemoSummary>>(summary: T | undefined): T | undefined {
  if (!summary) return summary;
  const isZero = (v: unknown) => v == null || parseFloat(String(v)) === 0;
  // Real data ALWAYS wins. Only inject demo figures when the account shows no
  // round-up/payment activity whatsoever — if any of these is non-zero it is
  // genuine data and the whole summary passes through untouched.
  const hasNoActivity =
    isZero(summary.totalRoundUps) &&
    isZero(summary.thisMonthRoundUps) &&
    isZero(summary.thisMonthPayments);
  if (!hasNoActivity) return summary;
  return {
    ...summary,
    // Current unapplied round-up pot (a distinct concept from lifetime saved).
    totalRoundUps: "42.18",
    thisMonthRoundUps: DEMO_THIS_MONTH_ROUNDUPS.toFixed(2),
    thisMonthPayments: "180.00",
  };
}
