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
  BarChart3
} from "lucide-react";
import type { Transaction, Debt, Payment } from "@shared/schema";
import { StatusBadge } from "@/components/StatusBadge";
import type { TransactionStatus } from "@shared/transactionStatus";

interface TransferRow {
  id: string;
  type: string;
  amount: string;
  status: TransactionStatus;
  debtId: string | null;
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
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: debts = [] } = useQuery<Debt[]>({
    queryKey: ["/api/debts"],
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const { data: transfers = [] } = useQuery<TransferRow[]>({
    queryKey: ["/api/transfers"],
  });

  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard-summary"],
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

  // Historical debt data for chart (mock data - in real app would come from database)
  const debtChartData = [30500, 29200, 28100, 26800, 25600, 24300, parseFloat(summary?.totalDebt || "23847")];
  const debtChartLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

  // Calculate debt reduction rate
  const originalDebt = debts.reduce((sum, debt) => sum + parseFloat(debt.originalBalance), 0);
  const currentDebt = debts.reduce((sum, debt) => sum + parseFloat(debt.currentBalance), 0);
  const totalPaid = originalDebt - currentDebt;
  const avgMonthlyReduction = totalPaid / 7; // 7 months of data

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Financial Insights</h1>
        <p className="text-slate-600">Understand your spending patterns and debt payoff progress</p>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Avg. Round-up
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-dime-accent">{formatCurrency(averageRoundUp)}</p>
            <p className="text-xs text-slate-500 mt-1">Per transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Debt Reduction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-dime-purple">{formatCurrency(avgMonthlyReduction)}</p>
            <p className="text-xs text-slate-500 mt-1">Per month avg.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Round-up Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {totalSpending > 0 ? ((totalRoundUps / totalSpending) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-xs text-slate-500 mt-1">Of total spending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Award className="w-4 h-4" />
              Total Saved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-dime-lilac">{formatCurrency(totalRoundUps)}</p>
            <p className="text-xs text-slate-500 mt-1">Via round-ups</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Debt Progress Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Debt Reduction Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DebtProgressChart 
              data={debtChartData}
              labels={debtChartLabels}
              className="h-64"
              enableVariation={true}
            />
            <div className="mt-4 p-3 bg-dime-accent/5 rounded-lg border border-dime-accent/10">
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-dime-accent">Great progress!</span> You've reduced your debt by{' '}
                {formatCurrency(totalPaid)} this year, averaging {formatCurrency(avgMonthlyReduction)} per month.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Spending by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Top Spending Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCategories.map(([category, amount], index) => {
                const percentage = (amount / totalSpending) * 100;
                const colors = ['bg-dime-purple', 'bg-dime-accent', 'bg-dime-lilac', 'bg-dime-lavender', 'bg-purple-500'];
                
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">{category}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(amount)}</span>
                        <span className="text-xs text-slate-500 ml-2">{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className={`${colors[index]} h-2 rounded-full transition-all duration-300`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {topCategories.length === 0 && (
              <div className="text-center py-8">
                <PieChart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No spending data available</p>
                <p className="text-sm text-slate-400 mt-1">Start making transactions to see your spending breakdown</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Monthly Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 text-sm font-medium text-slate-600">Month</th>
                  <th className="text-right py-2 text-sm font-medium text-slate-600">Transactions</th>
                  <th className="text-right py-2 text-sm font-medium text-slate-600">Total Spending</th>
                  <th className="text-right py-2 text-sm font-medium text-slate-600">Round-ups</th>
                  <th className="text-right py-2 text-sm font-medium text-slate-600">Avg. Round-up</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(monthlyData).map(([month, data]) => (
                  <tr key={month} className="border-b border-slate-100">
                    <td className="py-3 text-sm font-medium text-slate-900">{month}</td>
                    <td className="py-3 text-sm text-slate-600 text-right">{data.count}</td>
                    <td className="py-3 text-sm text-slate-900 text-right font-medium">
                      {formatCurrency(data.spending)}
                    </td>
                    <td className="py-3 text-sm text-dime-accent text-right font-medium">
                      {formatCurrency(data.roundUps)}
                    </td>
                    <td className="py-3 text-sm text-slate-600 text-right">
                      {formatCurrency(data.count > 0 ? data.roundUps / data.count : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {Object.keys(monthlyData).length === 0 && (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No monthly data available</p>
                <p className="text-sm text-slate-400 mt-1">Transaction history will appear here as you use Dime Time</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Insights and Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-dime-purple/5 border border-dime-purple/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Your Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Debt paid off</span>
                <span className="font-semibold text-dime-accent">{summary?.progressPercentage}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Projected debt-free date</span>
                <span className="font-semibold text-dime-purple">{summary?.debtFreeDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Round-ups collected</span>
                <span className="font-semibold text-dime-lilac">
                  {formatCurrency(totalRoundUps)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {transfers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Recent Transfers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {transfers
                  .slice()
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 5)
                  .map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
                      data-testid={`transfer-row-${t.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-slate-900">
                          {formatCurrency(t.amount)}
                        </span>
                        <StatusBadge status={t.status} timestamp={t.createdAt} />
                      </div>
                      <span className="text-xs text-slate-500 capitalize">
                        {t.type.replace(/_/g, " ")}
                      </span>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card className="bg-dime-accent/5 border border-dime-accent/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Optimization Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-sm">
                <p className="font-medium text-slate-900 mb-1">💡 Boost Your Round-ups</p>
                <p className="text-slate-600">
                  Consider rounding up to the nearest $5 instead of $1 to accelerate debt payoff.
                </p>
              </div>
              <div className="text-sm">
                <p className="font-medium text-slate-900 mb-1">🎯 Focus on High-Interest Debt</p>
                <p className="text-slate-600">
                  Apply extra payments to your highest interest rate debt first to save money.
                </p>
              </div>
              <div className="text-sm">
                <p className="font-medium text-slate-900 mb-1">📊 Track Your Habits</p>
                <p className="text-slate-600">
                  Your top spending category is {topCategories[0]?.[0] || 'N/A'}. Consider budgeting here.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
