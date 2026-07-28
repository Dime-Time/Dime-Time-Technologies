import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { RoundUpPausedBanner } from "@/components/RoundUpPausedBanner";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentModal } from "@/components/payment-modal";
import { formatCurrency, formatTime, formatDate, calculateDebtProgress } from "@/lib/calculations";
import { useLocation, Link } from "wouter";
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
  LogOut,
  Settings,
  Lock,
  ChevronRight,
  PieChart,
  Lightbulb
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
  paidOffCount?: number;
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

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'food & drink':  return <Coffee className="w-5 h-5 text-green-600" />;
      case 'transportation': return <Car className="w-5 h-5 text-blue-600" />;
      case 'shopping':
      case 'groceries':     return <ShoppingBag className="w-5 h-5 text-purple-600" />;
      default:              return <DollarSign className="w-5 h-5 text-slate-500" />;
    }
  };

  // ── Render (always — no blocking on network) ───────────────────────────────
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 animate-fade-in-up">
      
      {/* 1. Welcome Section */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Welcome back, <span className="text-dime-purple">{(user as any)?.firstName || 'User'}</span>
          </h1>
          <div className="flex items-center mt-1 text-slate-500 text-xs sm:text-sm font-medium">
            <Lock className="w-3.5 h-3.5 mr-1" />
            Secured by 256-bit encryption
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          className="shrink-0 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full w-10 h-10 transition-colors press-scale"
          data-testid="button-logout"
          title="Log Out"
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <RoundUpPausedBanner />

      {/* 2. Today's/This Month Progress (Hero Card) */}
      <section className="mb-6">
        <Card className="shadow-card border-slate-200/60 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <TrendingUp className="w-32 h-32 text-dime-purple" />
          </div>
          <CardContent className="p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">This Month's Impact</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-bold text-slate-900 tabular-nums tracking-tight">
                    {formatCurrency(activeSummary.thisMonthPayments)}
                  </span>
                  <span className="text-sm font-medium text-slate-500">paid to debt</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-dime-purple/10 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-dime-purple" />
                  </div>
                  <p className="text-sm text-slate-600">
                    Includes <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(activeSummary.thisMonthRoundUps)}</span> from spare change
                  </p>
                </div>
              </div>
              
              {/* 3. Debt Payoff Progress (Ring Visual) */}
              <div className="flex items-center md:justify-end gap-6">
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" className="text-slate-100" strokeWidth="8" />
                    <circle 
                      cx="50" cy="50" r="40" 
                      fill="transparent" 
                      stroke="currentColor" 
                      className="text-dime-purple transition-all duration-1000 ease-out" 
                      strokeWidth="8" 
                      strokeDasharray="251.2" 
                      strokeDashoffset={251.2 - (251.2 * activeSummary.progressPercentage) / 100}
                      strokeLinecap="round" 
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{activeSummary.progressPercentage}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 mb-1">Total Progress</p>
                  {(activeSummary.paidOffCount ?? 0) > 0 ? (
                    <p className="text-xs font-medium text-green-600" data-testid="text-dashboard-paid-off-count">
                      🏆 {activeSummary.paidOffCount} debt{activeSummary.paidOffCount === 1 ? "" : "s"} paid off
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 max-w-[140px] leading-relaxed">You're making steady strides towards becoming debt-free.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 4. Core Metrics Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <Card className="shadow-card border-slate-200/60 hover:shadow-card-hover transition-shadow duration-300 group">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-dime-accent/10 rounded-full flex items-center justify-center">
                <Wallet className="w-5 h-5 text-dime-accent" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight mb-1">{formatCurrency(activeSummary.totalRoundUps)}</p>
            <h3 className="text-xs sm:text-sm font-medium text-slate-500">Round-Up Balance</h3>
          </CardContent>
        </Card>

        <Card className="shadow-card border-slate-200/60 hover:shadow-card-hover transition-shadow duration-300 group">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-red-500" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight mb-1">{formatCurrency(activeSummary.totalDebt)}</p>
            <h3 className="text-xs sm:text-sm font-medium text-slate-500">Total Debt Remaining</h3>
          </CardContent>
        </Card>

        <Card className="shadow-card border-slate-200/60 hover:shadow-card-hover transition-shadow duration-300 group">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight mb-1">{formatCurrency(activeSummary.thisMonthRoundUps)}</p>
            <h3 className="text-xs sm:text-sm font-medium text-slate-500">Saved This Month</h3>
          </CardContent>
        </Card>

        <Card className="shadow-card border-slate-200/60 hover:shadow-card-hover transition-shadow duration-300 group">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-dime-lilac/20 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-dime-purple" />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mb-1 leading-tight">{activeSummary.debtFreeDate}</p>
            <h3 className="text-xs sm:text-sm font-medium text-slate-500">Projected Debt-Free</h3>
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column: Transactions */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* 8. Recent Transactions */}
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-lg font-semibold text-slate-900">Recent Transactions</h2>
              <Link href="/transactions" className="text-sm font-medium text-dime-purple hover:text-dime-purple/80 transition-colors px-2 py-1 press-scale">
                View All
              </Link>
            </div>
            
            <Card className="shadow-card border-slate-200/60 overflow-hidden">
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {recentTransactions.length === 0 && transactionsError ? (
                    <div className="p-6">
                      <EmptyState
                        icon={Receipt}
                        title="Couldn't load transactions"
                        description="Check your connection and try again."
                        ctaLabel="Retry"
                        onCtaClick={() => refetchTransactions()}
                        testIdPrefix="error-transactions"
                      />
                    </div>
                  ) : recentTransactions.length === 0 && transactionsLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-4 sm:p-5" data-testid={`skeleton-transaction-${i}`}>
                        <div className="flex items-center space-x-4">
                          <Skeleton className="w-10 h-10 rounded-full bg-slate-100" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32 bg-slate-200 rounded" />
                            <Skeleton className="h-3 w-20 bg-slate-100 rounded" />
                          </div>
                        </div>
                        <div className="space-y-2 text-right">
                          <Skeleton className="h-4 w-16 ml-auto bg-slate-200 rounded" />
                          <Skeleton className="h-3 w-12 ml-auto bg-slate-100 rounded" />
                        </div>
                      </div>
                    ))
                  ) : recentTransactions.length === 0 && transactionsFetchedAfterMount ? (
                    <div className="p-6">
                      <EmptyState
                        icon={Receipt}
                        title="No transactions yet"
                        description="Connect a bank account to start tracking purchases and rounding up spare change."
                        ctaLabel="Connect a bank"
                        onCtaClick={() => setLocation("/banking")}
                        testIdPrefix="empty-transactions"
                      />
                    </div>
                  ) : (
                    recentTransactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                            {getCategoryIcon(transaction.category)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 line-clamp-1">{transaction.merchant}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatDate(transaction.date)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-slate-900 tabular-nums">-{formatCurrency(transaction.amount)}</p>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            <span className="text-xs font-semibold text-dime-purple tabular-nums">+{formatCurrency(transaction.roundUpAmount)}</span>
                            <StatusBadge status={(transaction as Transaction & { status?: string }).status ?? "completed"} compact />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
          
          {/* Active Debts Sneak Peek */}
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-lg font-semibold text-slate-900">Active Debts</h2>
              <Link href="/debts" className="text-sm font-medium text-dime-purple hover:text-dime-purple/80 transition-colors px-2 py-1 press-scale" data-testid="button-manage-debts">
                Manage
              </Link>
            </div>
            <div className="space-y-3">
              {debts.length === 0 && !debtsFetchedAfterMount ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i} className="shadow-sm border-slate-200/60 p-5" data-testid={`skeleton-debt-${i}`}>
                      <div className="flex justify-between mb-3">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-28 bg-slate-200" />
                          <Skeleton className="h-3 w-16 bg-slate-100" />
                        </div>
                        <Skeleton className="h-5 w-20 bg-slate-200" />
                      </div>
                      <Skeleton className="h-2 w-full bg-slate-100 rounded-full" />
                    </Card>
                  ))
                ) : debts.length === 0 ? (
                  <Card className="shadow-sm border-slate-200/60 p-6">
                    <EmptyState
                      icon={Wallet}
                      title="No debts added"
                      description="Add your credit cards or loans to track payoff progress."
                      ctaLabel="Add a debt"
                      onCtaClick={() => setLocation("/debts")}
                      testIdPrefix="empty-debts"
                    />
                  </Card>
                ) : (
                  debts.slice(0, 2).map((debt) => {
                    const progress = calculateDebtProgress(debt.originalBalance, debt.currentBalance);
                    return (
                      <Card key={debt.id} className="shadow-sm border-slate-200/60 overflow-hidden hover:border-slate-300 transition-colors cursor-pointer press-scale" onClick={() => setLocation("/debts")}>
                        <CardContent className="p-4 sm:p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="text-sm font-semibold text-slate-900">{debt.name}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">{debt.accountNumber}</p>
                            </div>
                            <span className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(debt.currentBalance)}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2 overflow-hidden">
                            <div 
                              className="bg-dime-purple h-full rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[11px] font-medium text-slate-500">
                            <span>{progress}% Paid</span>
                            <span className="text-slate-400">Targeting this next</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
            </div>
          </section>
        </div>

        {/* Sidebar: Quick Actions & Tips */}
        <div className="space-y-6">
          
          {/* 9. Quick Actions (Tappable Cards) */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-4 px-1">Quick Actions</h2>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              <button 
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center justify-between p-4 bg-dime-purple text-white rounded-xl shadow-card hover:bg-dime-purple/90 transition-all press-scale text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold">Make Payment</span>
                </div>
              </button>

              <Link href="/settings" className="flex items-center justify-between p-4 bg-white border border-slate-200/60 rounded-xl shadow-sm hover:shadow-card-hover hover:border-slate-300 transition-all press-scale group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-dime-accent/10 flex items-center justify-center shrink-0">
                    <ArrowUp className="w-4 h-4 text-dime-accent" />
                  </div>
                  <span className="text-sm font-semibold text-slate-900">Boost Round-ups</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
              </Link>

              <Link href="/insights" className="flex items-center justify-between p-4 bg-white border border-slate-200/60 rounded-xl shadow-sm hover:shadow-card-hover hover:border-slate-300 transition-all press-scale group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <PieChart className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-semibold text-slate-900">View Insights</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
              </Link>
              
              <Link href="/settings" className="flex items-center justify-between p-4 bg-white border border-slate-200/60 rounded-xl shadow-sm hover:shadow-card-hover hover:border-slate-300 transition-all press-scale group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <Settings className="w-4 h-4 text-slate-600" />
                  </div>
                  <span className="text-sm font-semibold text-slate-900">Settings</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
              </Link>
            </div>
          </section>

          {/* 10. Daily Tip */}
          <section className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-card relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl pointer-events-none"></div>
            <div className="relative z-10">
              <h3 className="text-sm font-bold text-dime-lilac mb-2 tracking-wide uppercase flex items-center gap-2">
                <Lightbulb className="w-4 h-4" /> Daily Tip
              </h3>
              <p className="text-sm text-slate-200 leading-relaxed mb-5">
                Small increases to your round-ups may help you reduce debt significantly faster over the long term.
              </p>
              <Link href="/settings" className="inline-flex items-center text-xs font-semibold text-white hover:text-dime-lilac transition-colors press-scale">
                Customize Round-ups <ChevronRight className="w-3 h-3 ml-1" />
              </Link>
            </div>
          </section>

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
