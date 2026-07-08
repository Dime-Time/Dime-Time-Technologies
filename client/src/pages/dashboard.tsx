import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { DebtProgressChart } from "@/components/debt-progress-chart";
import { PaymentModal } from "@/components/payment-modal";
import { formatCurrency, formatTime, formatDate, calculateDebtProgress } from "@/lib/calculations";
import { useLocation } from "wouter";
import { 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  Calendar,
  ShoppingBag,
  Car,
  Coffee,
  Plus,
  ArrowUp,
  Receipt,
  Wallet,
  LogOut
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Transaction, Debt } from "@shared/schema";
import {
  getCachedSummary,
  getCachedDebts,
  cacheSummary,
  cacheDebts,
} from "@/lib/dashboardCache";
import { isDemoUser, applyDemoSummary, DEMO_TRANSACTIONS } from "@/lib/demoData";

interface DashboardSummary {
  totalDebt: string;
  totalRoundUps: string;
  thisMonthRoundUps: string;
  thisMonthPayments: string;
  progressPercentage: number;
  debtFreeDate: string;
  debtsCount: number;
}

const EMPTY_SUMMARY: DashboardSummary = {
  totalDebt: "0",
  totalRoundUps: "0",
  thisMonthRoundUps: "0",
  thisMonthPayments: "0",
  progressPercentage: 0,
  debtFreeDate: "—",
  debtsCount: 0,
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const t0 = useRef(performance.now());

  // ── Performance logging ──────────────────────────────────────────────────
  useEffect(() => {
    const elapsed = performance.now() - t0.current;
    console.log(`[DimeTime] dashboard shell rendered in ${elapsed.toFixed(0)}ms`);
  }, []);

  // ── User (already seeded by AuthProvider from cache) ─────────────────────
  const { data: user } = useQuery({ queryKey: ["/api/user"] });
  const { logout } = useAuth();
  const isDemo = isDemoUser(user);

  // ── Dashboard summary — cache-first ───────────────────────────────────────
  const { data: summary, isFetched: summaryFetched } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard-summary"],
    initialData: getCachedSummary<DashboardSummary>(),
    initialDataUpdatedAt: 0,
    select: (data) => (isDemo ? (applyDemoSummary(data) as DashboardSummary) : data),
  });

  // ── Debts — cache-first ───────────────────────────────────────────────────
  const {
    data: debts = [],
    isFetched: debtsFetched,
    isFetchedAfterMount: debtsFetchedAfterMount,
    isError: debtsError,
    refetch: refetchDebts,
  } = useQuery<Debt[]>({
    queryKey: ["/api/debts"],
    initialData: getCachedDebts<Debt[]>(),
    initialDataUpdatedAt: 0,
  });

  // ── Transactions — deferred, non-critical for first paint ─────────────────
  const {
    data: transactions = [],
    isLoading: transactionsLoading,
    isFetchedAfterMount: transactionsFetchedAfterMount,
    isError: transactionsError,
    refetch: refetchTransactions,
  } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    staleTime: 30000,
    select: (data) => (isDemo && (!data || data.length === 0) ? DEMO_TRANSACTIONS : data),
  });

  // ── Persist fresh data to cache ───────────────────────────────────────────
  useEffect(() => {
    // Never persist demo-injected summary values to the (global) dashboard cache,
    // otherwise a later session for a different account could read them back.
    if (summaryFetched && summary && !isDemo) {
      cacheSummary(summary);
      const elapsed = performance.now() - t0.current;
      console.log(`[DimeTime] summary fetched in ${elapsed.toFixed(0)}ms`);
    }
  }, [summary, summaryFetched]);

  useEffect(() => {
    if (debtsFetched && debts.length > 0) {
      cacheDebts(debts);
      const elapsed = performance.now() - t0.current;
      console.log(`[DimeTime] debts fetched in ${elapsed.toFixed(0)}ms`);
    }
  }, [debts, debtsFetched]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const activeSummary = summary ?? EMPTY_SUMMARY;
  const recentTransactions = transactions.slice(0, 4);
  const weekRoundUps = transactions
    .filter(t => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(t.date) >= weekAgo;
    })
    .reduce((sum, t) => sum + parseFloat(t.roundUpAmount), 0);

  const chartData = [
    30500, 29200, 28100, 26800, 25600, 24300,
    parseFloat(activeSummary.totalDebt || "23847"),
    22500, 21200, 19800, 18400, 17000,
  ];
  const chartLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'food & drink':  return <Coffee className="w-5 h-5 text-green-600" />;
      case 'transportation': return <Car className="w-5 h-5 text-blue-600" />;
      case 'shopping':
      case 'groceries':     return <ShoppingBag className="w-5 h-5 text-purple-600" />;
      default:              return <DollarSign className="w-5 h-5 text-gray-600" />;
    }
  };

  // ── Render (always — no blocking on network) ───────────────────────────────
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-8">

      {/* Welcome Section */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome back, <span className="text-dime-purple">{(user as any)?.firstName || 'User'}</span>!
          </h1>
          <p className="text-slate-600">
            You've saved <span className="font-semibold text-dime-accent">{formatCurrency(activeSummary.thisMonthRoundUps)}</span> in round-ups this month{" "}
            and paid down <span className="font-semibold text-dime-purple">{formatCurrency(activeSummary.thisMonthPayments)}</span> in debt.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="shrink-0 text-slate-600 hover:text-slate-900"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-dime-purple/5 rounded-lg border border-dime-purple/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-dime-purple" />
              </div>
              <span className="text-xs text-dime-accent font-medium">+{formatCurrency(activeSummary.thisMonthRoundUps)}</span>
            </div>
            <h3 className="text-sm font-medium text-slate-600 mb-1">Round-Up Balance</h3>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(activeSummary.totalRoundUps)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-500/5 rounded-lg border border-red-500/10 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-red-600" />
              </div>
              <span className="text-xs text-red-600 font-medium">-{formatCurrency(activeSummary.thisMonthPayments)}</span>
            </div>
            <h3 className="text-sm font-medium text-slate-600 mb-1">Total Debt</h3>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(activeSummary.totalDebt)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-dime-accent/5 rounded-lg border border-dime-accent/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-dime-accent" />
              </div>
              <span className="text-xs text-dime-accent font-medium">{activeSummary.progressPercentage}%</span>
            </div>
            <h3 className="text-sm font-medium text-slate-600 mb-1">Progress This Year</h3>
            <p className="text-2xl font-bold text-slate-900">{activeSummary.progressPercentage}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-dime-lilac/5 rounded-lg border border-dime-lilac/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-dime-lilac" />
              </div>
              <span className="text-xs text-slate-600 font-medium">Est.</span>
            </div>
            <h3 className="text-sm font-medium text-slate-600 mb-1">Debt Free Date</h3>
            <p className="text-2xl font-bold text-slate-900">{activeSummary.debtFreeDate}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Transactions & Round-ups */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-900">Recent Transactions</h2>
                <Button variant="ghost" className="text-dime-purple hover:text-dime-purple/80 text-sm font-medium">
                  View All
                </Button>
              </div>

              <div className="space-y-4">
                {recentTransactions.length === 0 && transactionsError ? (
                  <EmptyState
                    icon={Receipt}
                    title="Couldn't load transactions"
                    description="Check your connection and try again."
                    ctaLabel="Retry"
                    onCtaClick={() => refetchTransactions()}
                    testIdPrefix="error-transactions"
                  />
                ) : recentTransactions.length === 0 && transactionsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 bg-dime-lilac/5 rounded-lg border border-dime-lilac/10"
                      data-testid={`skeleton-transaction-${i}`}
                    >
                      <div className="flex items-center space-x-4">
                        <Skeleton className="w-10 h-10 rounded-lg bg-white/20" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32 bg-white/20" />
                          <Skeleton className="h-3 w-24 bg-white/15" />
                        </div>
                      </div>
                      <div className="space-y-2 text-right">
                        <Skeleton className="h-4 w-16 ml-auto bg-white/20" />
                        <Skeleton className="h-3 w-20 ml-auto bg-white/15" />
                      </div>
                    </div>
                  ))
                ) : recentTransactions.length === 0 && transactionsFetchedAfterMount ? (
                  <EmptyState
                    icon={Receipt}
                    title="No transactions yet"
                    description="Connect a bank account to start tracking purchases and rounding up spare change."
                    ctaLabel="Connect a bank"
                    onCtaClick={() => setLocation("/banking")}
                    testIdPrefix="empty-transactions"
                  />
                ) : (
                  recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 bg-dime-lilac/5 rounded-lg border border-dime-lilac/10">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          {getCategoryIcon(transaction.category)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{transaction.merchant}</p>
                          <p className="text-sm text-slate-600">
                            {formatDate(transaction.date)}, {formatTime(transaction.date)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-slate-900">-{formatCurrency(transaction.amount)}</p>
                        <p className="text-sm text-dime-accent">+{formatCurrency(transaction.roundUpAmount)} round-up</p>
                        <div className="mt-1 flex justify-end">
                          {/* Plaid-synced purchases are settled by definition; if the
                              backend later annotates a `status` field on the Transaction
                              row, we surface it; otherwise fall back to the schema reality. */}
                          <StatusBadge
                            status={(transaction as Transaction & { status?: string }).status ?? "completed"}
                            compact
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Round-up Summary */}
              <div className="mt-6 p-4 bg-dime-purple/5 rounded-lg border border-dime-purple/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Round-ups this week</p>
                    <p className="text-lg font-bold text-dime-accent">{formatCurrency(weekRoundUps)}</p>
                  </div>
                  <Button 
                    className="bg-dime-accent text-white hover:bg-dime-accent/90"
                    onClick={() => setShowPaymentModal(true)}
                  >
                    Apply to Debt
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Debt Overview */}
        <div className="space-y-6">
          {/* Debt Progress Chart */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Debt Reduction Progress</h3>
              <DebtProgressChart 
                data={chartData}
                labels={chartLabels}
                className="h-48"
                enableVariation={true}
              />
              <div className="mt-4 text-center">
                <p className="text-sm text-slate-600">
                  You're <span className="font-semibold text-dime-accent">3 months ahead</span> of your original timeline!
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Active Debts */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Active Debts</h3>
                <Button
                  variant="ghost"
                  className="text-dime-purple hover:text-dime-purple/80 text-sm font-medium"
                  onClick={() => setLocation("/debts")}
                  data-testid="button-manage-debts"
                >
                  Manage
                </Button>
              </div>

              <div className="space-y-4">
                {debts.length === 0 && debtsError ? (
                  <EmptyState
                    icon={Wallet}
                    title="Couldn't load debts"
                    description="Check your connection and try again."
                    ctaLabel="Retry"
                    onCtaClick={() => refetchDebts()}
                    testIdPrefix="error-debts"
                  />
                ) : debts.length === 0 && !debtsFetchedAfterMount ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-dime-accent/5 rounded-lg border border-dime-accent/10 p-4 space-y-3"
                      data-testid={`skeleton-debt-${i}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-28 bg-white/20" />
                          <Skeleton className="h-3 w-20 bg-white/15" />
                        </div>
                        <Skeleton className="h-4 w-16 bg-white/20" />
                      </div>
                      <Skeleton className="h-2 w-full rounded-full bg-white/15" />
                    </div>
                  ))
                ) : debts.length === 0 ? (
                  <EmptyState
                    icon={Wallet}
                    title="No debts added"
                    description="Add your credit cards, loans, or other debts to start tracking your payoff progress."
                    ctaLabel="Add a debt"
                    onCtaClick={() => setLocation("/debts")}
                    testIdPrefix="empty-debts"
                  />
                ) : (
                  debts.map((debt) => {
                    const progress = calculateDebtProgress(debt.originalBalance, debt.currentBalance);
                    const monthsLeft = Math.ceil(parseFloat(debt.currentBalance) / parseFloat(debt.minimumPayment));
                    return (
                      <div key={debt.id} className="bg-dime-accent/5 rounded-lg border border-dime-accent/10 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-slate-900">{debt.name}</h4>
                            <p className="text-sm text-slate-600">{debt.accountNumber}</p>
                          </div>
                          <span className="text-sm font-medium text-red-600">{formatCurrency(debt.currentBalance)}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
                          <div 
                            className="bg-gradient-to-r from-dime-purple to-dime-accent h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>{progress}% paid</span>
                          <span>{monthsLeft} months left</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button 
                  className="w-full bg-dime-purple text-white hover:bg-dime-purple/90 flex items-center justify-center space-x-2"
                  onClick={() => setShowPaymentModal(true)}
                >
                  <Plus className="w-5 h-5" />
                  <span>Make Extra Payment</span>
                </Button>
                <Button className="w-full bg-dime-accent text-white hover:bg-dime-accent/90 flex items-center justify-center space-x-2">
                  <ArrowUp className="w-5 h-5" />
                  <span>Boost Round-ups</span>
                </Button>
                <Button variant="outline" className="w-full flex items-center justify-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>View Insights</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Educational Content Section */}
      <div className="mt-12">
        <div className="bg-gradient-to-r from-dime-purple to-dime-lilac rounded-xl p-8 text-white">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold mb-4">💡 Dime Time Tip: Accelerate Your Debt Freedom</h2>
            <p className="text-lg mb-6 opacity-90">
              Small increases to your round-ups may help you reduce debt faster over time.
              Individual results vary based on spending habits and debt balances.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button className="bg-white text-dime-purple hover:bg-slate-50">
                Learn More Strategies
              </Button>
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                Customize Round-ups
              </Button>
            </div>
          </div>
        </div>
      </div>

      <PaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        debts={debts}
        roundUpBalance={parseFloat(activeSummary.totalRoundUps)}
      />
    </main>
  );
}
