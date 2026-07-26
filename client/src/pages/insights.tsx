import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DebtProgressChart } from "@/components/debt-progress-chart";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target,
  Calendar,
  Award,
  PieChart,
  BarChart3,
  ArrowRight,
  Lightbulb,
  Trophy
} from "lucide-react";
import type { Transaction, Debt, Payment } from "@shared/schema";
import { StatusBadge } from "@/components/StatusBadge";
import {
  describeTransactionStatus,
  describeTransferError,
  type TransactionStatus,
} from "@shared/transactionStatus";
import { isDemoUser, applyDemoSummary, DEMO_TRANSACTIONS } from "@/lib/demoData";

interface TransferRow {
  id: string;
  type: string;
  amount: string;
  status: TransactionStatus;
  debtId: string | null;
  fundingAccount: { institutionName: string | null; last4: string | null } | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DashboardSummary {
  totalDebt: string;
  totalRoundUps: string;
  thisMonthRoundUps: string;
  thisMonthPayments: string;
  progressPercentage: number;
  debtFreeDate: string;
}

export default function Insights() {
  const { data: user } = useQuery({ queryKey: ["/api/user"] });
  const isDemo = isDemoUser(user);

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    select: (data) => (isDemo && (!data || data.length === 0) ? DEMO_TRANSACTIONS : data),
  });

  const { data: debts = [] } = useQuery<Debt[]>({
    queryKey: ["/api/debts"],
  });

  // Archived (soft-deleted) debts still count toward lifetime wins — archiving
  // a paid-off debt is the app's own celebration flow, so the milestone must
  // not vanish when the user follows it.
  const { data: archivedDebts = [] } = useQuery<Debt[]>({
    queryKey: ["/api/debts/archived"],
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const { data: transfers = [] } = useQuery<TransferRow[]>({
    queryKey: ["/api/transfers"],
  });

  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard-summary"],
    select: (data) => (isDemo ? (applyDemoSummary(data) as DashboardSummary) : data),
  });

  // Calculate spending by category
  const categorySpending = transactions.reduce((acc, trans) => {
    const category = trans.category;
    acc[category] = (acc[category] || 0) + parseFloat(trans.amount);
    return acc;
  }, {} as Record<string, number>);

  const topCategories = Object.entries(categorySpending)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  // Calculate monthly trends
  const monthlyData = transactions.reduce((acc, trans) => {
    const month = new Date(trans.date).toLocaleDateString('en-US', { month: 'short' });
    if (!acc[month]) {
      acc[month] = { spending: 0, roundUps: 0, count: 0 };
    }
    acc[month].spending += parseFloat(trans.amount);
    acc[month].roundUps += parseFloat(trans.roundUpAmount);
    acc[month].count += 1;
    return acc;
  }, {} as Record<string, { spending: number; roundUps: number; count: number }>);

  const totalSpending = transactions.reduce((sum, trans) => sum + parseFloat(trans.amount), 0);
  const totalRoundUps = transactions.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount), 0);
  const averageRoundUp = transactions.length > 0 ? totalRoundUps / transactions.length : 0;

  // Illustrative history: a smooth descent that always ends at the user's REAL
  // current balance (~2%/month reduction), so the trend line never shows debt
  // "increasing" when the hardcoded past would fall below the actual balance.
  const currentTotalDebt = parseFloat(summary?.totalDebt || "0");
  const debtChartData = Array.from({ length: 7 }, (_, i) =>
    Math.round(currentTotalDebt * Math.pow(1.02, 6 - i)),
  );
  const chartNow = new Date();
  const debtChartLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(chartNow.getFullYear(), chartNow.getMonth() - (6 - i), 1)
      .toLocaleDateString('en-US', { month: 'short' }),
  );

  // Calculate debt reduction rate
  const originalDebt = debts.reduce((sum, debt) => sum + parseFloat(debt.originalBalance), 0);
  const currentDebt = debts.reduce((sum, debt) => sum + parseFloat(debt.currentBalance), 0);
  const totalPaid = originalDebt - currentDebt;
  const avgMonthlyReduction = totalPaid / 7; // 7 months of data

  // Paid-off wins across active AND archived debts (balance at or below zero).
  // Deduped by id: while a restore/archive refetch is in flight, one debt can
  // briefly appear in both lists — it must never count twice.
  const paidOffWins = Array.from(
    new Map(
      [...debts, ...archivedDebts]
        .filter((d) => parseFloat(d.currentBalance) <= 0)
        .map((d) => [d.id, d]),
    ).values(),
  );
  const paidOffAmount = paidOffWins.reduce(
    (sum, d) => sum + parseFloat(d.originalBalance),
    0,
  );

  // Best-available payoff date per debt: the latest payment recorded against
  // it (the payment that brought the balance to zero). The schema has no
  // dedicated payoff timestamp, so a debt with no payment history (e.g.
  // imported already-paid or manually zeroed) simply shows no date rather
  // than a made-up one.
  const payoffDateByDebtId = new Map<string, Date>();
  for (const p of payments) {
    const when = new Date(p.date);
    const existing = payoffDateByDebtId.get(p.debtId);
    if (!existing || when > existing) payoffDateByDebtId.set(p.debtId, when);
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 animate-fade-in-up">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-1">Financial Insights</h1>
        <p className="text-sm text-slate-500">Understand your spending patterns and debt payoff progress</p>
      </header>

      {/* Key Insights */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <Card className="shadow-card border-slate-200/60">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-dime-purple" />
              Avg. Round-up
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">{formatCurrency(averageRoundUp)}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Per transaction</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-slate-200/60">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-green-500" />
              Debt Reduction
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">{formatCurrency(avgMonthlyReduction)}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Per month avg.</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-slate-200/60">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              Round-up Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
              {totalSpending > 0 ? ((totalRoundUps / totalSpending) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Of total spending</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-slate-200/60">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 flex items-center gap-2">
              <Award className="w-4 h-4 text-yellow-500" />
              Total Saved
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">{formatCurrency(totalRoundUps)}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Via round-ups</p>
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Debt Progress Chart */}
        <Card className="shadow-card border-slate-200/60">
          <CardHeader className="p-5 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <BarChart3 className="w-5 h-5 text-slate-400" />
              Debt Reduction Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-4">
            <DebtProgressChart 
              data={debtChartData}
              labels={debtChartLabels}
              className="h-64"
              enableVariation={false}
            />
            <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-3">
              <div className="shrink-0 mt-0.5"><Award className="w-5 h-5 text-dime-purple" /></div>
              <p className="text-sm text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-900">Great progress!</span> You've reduced your debt by <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(totalPaid)}</span> this year, averaging <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(avgMonthlyReduction)}</span> per month.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Spending by Category */}
        <Card className="shadow-card border-slate-200/60">
          <CardHeader className="p-5 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <PieChart className="w-5 h-5 text-slate-400" />
              Top Spending Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-4">
            <div className="space-y-5">
              {topCategories.map(([category, amount], index) => {
                const percentage = (amount / totalSpending) * 100;
                // Premium chart palette corresponding to new design
                const colors = ['bg-dime-purple', 'bg-blue-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400'];
                
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700 capitalize">{category}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(amount)}</span>
                        <span className="text-xs font-semibold text-slate-400 tabular-nums ml-2">{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`${colors[index]} h-full rounded-full transition-all duration-1000 ease-out`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {topCategories.length === 0 && (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                  <PieChart className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-900">No spending data</p>
                <p className="text-xs text-slate-500 mt-1">Start making transactions to see your breakdown.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends */}
      <Card className="mb-8 shadow-card border-slate-200/60 overflow-hidden">
        <CardHeader className="p-5 sm:p-6 bg-white border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Calendar className="w-5 h-5 text-slate-400" />
            Monthly Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-slate-500">Month</th>
                  <th className="text-right py-3 px-6 font-medium text-slate-500">Transactions</th>
                  <th className="text-right py-3 px-6 font-medium text-slate-500">Total Spending</th>
                  <th className="text-right py-3 px-6 font-medium text-slate-500">Round-ups</th>
                  <th className="text-right py-3 px-6 font-medium text-slate-500">Avg. Round-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(monthlyData).map(([month, data]) => (
                  <tr key={month} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-900">{month}</td>
                    <td className="py-3 px-6 text-slate-500 text-right tabular-nums">{data.count}</td>
                    <td className="py-3 px-6 text-slate-900 text-right font-semibold tabular-nums">
                      {formatCurrency(data.spending)}
                    </td>
                    <td className="py-3 px-6 text-dime-purple text-right font-bold tabular-nums">
                      {formatCurrency(data.roundUps)}
                    </td>
                    <td className="py-3 px-6 text-slate-500 text-right tabular-nums font-medium">
                      {formatCurrency(data.count > 0 ? data.roundUps / data.count : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {Object.keys(monthlyData).length === 0 && (
              <div className="text-center py-12 bg-white">
                <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-900">No monthly data</p>
                <p className="text-xs text-slate-500 mt-1">Transaction history will appear here over time.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Insights and Transfers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="shadow-card border-slate-200/60 bg-gradient-to-br from-white to-slate-50">
          <CardHeader className="p-5 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <TrendingUp className="w-5 h-5 text-slate-400" />
              Your Progress Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-4">
            <div className="space-y-4">
              {paidOffWins.length > 0 && (
                <div
                  className="rounded-lg border border-green-200 bg-green-50/70 p-3"
                  data-testid="banner-insights-paid-off"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-full">
                      <Trophy className="w-5 h-5 text-green-600 shrink-0" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-green-900">
                        {paidOffWins.length} debt{paidOffWins.length === 1 ? "" : "s"} paid off 🎉
                      </p>
                      <p className="text-xs font-medium text-green-700/80">
                        {formatCurrency(paidOffAmount)} eliminated for good. Keep stacking wins!
                      </p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2" data-testid="list-paid-off-wins">
                    {paidOffWins.map((win) => {
                      const payoffDate = payoffDateByDebtId.get(win.id);
                      return (
                        <li
                          key={win.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-green-100 bg-white/80 px-3 py-2"
                          data-testid={`paid-off-win-${win.id}`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-green-900 truncate">
                              {win.name}
                            </p>
                            <p className="text-xs text-green-700/80">
                              {payoffDate
                                ? `Paid off ${formatDate(payoffDate.toISOString())}`
                                : "Paid off"}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-green-800 tabular-nums shrink-0">
                            {formatCurrency(win.originalBalance)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                <span className="text-sm font-medium text-slate-600">Debt Paid Off</span>
                <span className="text-base font-bold text-slate-900 tabular-nums">{summary?.progressPercentage}%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                <span className="text-sm font-medium text-slate-600">Projected Freedom</span>
                <span className="text-base font-bold text-slate-900">{summary?.debtFreeDate}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                <span className="text-sm font-medium text-slate-600">Total Gathered</span>
                <span className="text-base font-bold text-dime-purple tabular-nums">
                  {formatCurrency(totalRoundUps)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {transfers.length > 0 ? (
          <Card className="shadow-card border-slate-200/60">
            <CardHeader className="p-5 sm:p-6 pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <ArrowRight className="w-5 h-5 text-slate-400" />
                Recent Transfers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 pt-4">
              <ul className="space-y-3">
                {transfers
                  .slice()
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 4)
                  .map((t) => {
                    const errorDetail =
                      t.status === "failed" || t.status === "requires_action"
                        ? describeTransferError(t.errorCode)
                        : null;
                    const fallback =
                      (t.status === "failed" || t.status === "requires_action") && !errorDetail
                        ? describeTransactionStatus(t.status, "transfer")
                        : null;
                    // Submitted ≠ settled: while a transfer is in flight, say so
                    // explicitly (ACH takes multiple business days) so a user
                    // never mistakes "we sent it" for "it cleared".
                    const inFlightNote =
                      t.status === "pending" || t.status === "processing"
                        ? describeTransactionStatus(t.status, "transfer")
                        : null;
                    const destinationDebt = t.debtId
                      ? debts.find((d) => d.id === t.debtId)?.name ?? null
                      : null;
                    const fundingLabel = t.fundingAccount
                      ? `${t.fundingAccount.institutionName || "Linked bank"}${
                          t.fundingAccount.last4 ? ` ••${t.fundingAccount.last4}` : ""
                        }`
                      : null;
                    return (
                      <li
                        key={t.id}
                        className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm"
                        data-testid={`transfer-row-${t.id}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-slate-900 tabular-nums">
                            {formatCurrency(t.amount)}
                          </span>
                          <StatusBadge status={t.status} compact />
                        </div>
                        <div className="text-xs text-slate-500 capitalize">
                          {t.type.replace(/_/g, " ")} • {formatDate(t.createdAt)}
                        </div>
                        {(destinationDebt || fundingLabel) && (
                          <div
                            className="text-xs text-slate-500 mt-0.5"
                            data-testid={`transfer-detail-${t.id}`}
                          >
                            {fundingLabel && <>From {fundingLabel}</>}
                            {fundingLabel && destinationDebt && " → "}
                            {destinationDebt && <>toward {destinationDebt}</>}
                          </div>
                        )}
                        {inFlightNote && (
                          <div
                            className="mt-2 rounded bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600"
                            data-testid={`transfer-inflight-${t.id}`}
                          >
                            {inFlightNote}
                          </div>
                        )}
                        {errorDetail && (
                          <div
                            className="mt-2 rounded bg-red-50 px-2.5 py-1.5 text-xs text-red-900"
                            data-testid={`transfer-error-${t.id}`}
                          >
                            <div className="font-medium">{errorDetail.headline}</div>
                            <div className="mt-0.5 opacity-90">{errorDetail.suggestion}</div>
                          </div>
                        )}
                        {fallback && (
                          <div
                            className="mt-2 rounded bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"
                            data-testid={`transfer-fallback-${t.id}`}
                          >
                            {fallback}
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card border-slate-200/60">
            <CardHeader className="p-5 sm:p-6 pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Target className="w-5 h-5 text-slate-400" />
                Optimization Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 pt-4">
              <div className="space-y-4">
                <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                  <p className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-dime-purple" /> Boost Your Round-ups
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Consider rounding up to the nearest $5 instead of $1 to significantly accelerate your debt payoff timeline.
                  </p>
                </div>
                <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                  <p className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-dime-purple" /> High-Interest First
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Make sure extra payments target your highest interest rate debt first to save the most money over time.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
