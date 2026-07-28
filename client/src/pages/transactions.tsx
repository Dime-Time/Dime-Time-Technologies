import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { RoundUpPausedBanner } from "@/components/RoundUpPausedBanner";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, formatTime } from "@/lib/calculations";
import { Coffee, Car, ShoppingBag, DollarSign, Plus, Receipt, History } from "lucide-react";
import { useLocation } from "wouter";
import type { Transaction } from "@shared/schema";
import { isDemoUser, DEMO_TRANSACTIONS } from "@/lib/demoData";

export default function Transactions() {
  const [, setLocation] = useLocation();
  const { data: user } = useQuery({ queryKey: ["/api/user"] });
  const isDemo = isDemoUser(user);
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    select: (data) => (isDemo && (!data || data.length === 0) ? DEMO_TRANSACTIONS : data),
  });

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'food & drink':
        return <Coffee className="w-5 h-5 text-emerald-600" />;
      case 'transportation':
        return <Car className="w-5 h-5 text-sky-600" />;
      case 'shopping':
      case 'groceries':
        return <ShoppingBag className="w-5 h-5 text-dime-purple" />;
      default:
        return <DollarSign className="w-5 h-5 text-slate-500" />;
    }
  };

  const getCategoryBg = (category: string) => {
    switch (category.toLowerCase()) {
      case 'food & drink':
        return "bg-emerald-100";
      case 'transportation':
        return "bg-sky-100";
      case 'shopping':
      case 'groceries':
        return "bg-dime-purple/10";
      default:
        return "bg-slate-100";
    }
  };

  const totalRoundUps = transactions.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount), 0);
  const thisMonthRoundUps = transactions
    .filter(trans => {
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      return new Date(trans.date) >= thisMonth;
    })
    .reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount), 0);

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-1">Transactions</h1>
          <p className="text-slate-600 font-medium">Track your purchases and spare-change savings</p>
        </div>
        <Button className="bg-dime-purple hover:bg-dime-purple/90 text-white font-semibold shadow-sm press-scale">
          <Plus className="w-4 h-4 mr-2" />
          Add Manual
        </Button>
      </div>

      <RoundUpPausedBanner />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-fade-in-up">
        <Card className="shadow-card border-0 ring-1 ring-slate-100 bg-white">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Total Saved
            </div>
            <p className="text-3xl font-bold text-emerald-600 tabular-nums">{formatCurrency(totalRoundUps)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0 ring-1 ring-slate-100 bg-white">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> This Month
            </div>
            <p className="text-3xl font-bold text-dime-purple tabular-nums">{formatCurrency(thisMonthRoundUps)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0 ring-1 ring-slate-100 bg-white col-span-2 md:col-span-1">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" /> Total Purchases
            </div>
            <p className="text-3xl font-bold text-slate-900 tabular-nums">{transactions.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card className="shadow-card border-0 ring-1 ring-slate-100 bg-white overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <CardTitle className="text-lg font-bold text-slate-900">Recent Activity</CardTitle>
          <CardDescription className="text-slate-500 font-medium">Your latest purchases and generated round-ups</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {isLoading && transactions.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-5"
                  data-testid={`skeleton-transaction-row-${i}`}
                >
                  <div className="flex items-center space-x-4">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </div>
                  <div className="space-y-2 text-right">
                    <Skeleton className="h-5 w-20 ml-auto" />
                    <Skeleton className="h-4 w-24 ml-auto" />
                  </div>
                </div>
              ))
            ) : transactions.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={Receipt}
                  title="No transactions yet"
                  description="Connect a bank account to start tracking purchases and automatically rounding up spare change."
                  ctaLabel="Connect a bank"
                  onCtaClick={() => setLocation("/banking")}
                  testIdPrefix="empty-transactions-page"
                />
              </div>
            ) : (
              transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${getCategoryBg(transaction.category)}`}>
                      {getCategoryIcon(transaction.category)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-slate-900 text-base truncate">{transaction.merchant}</p>
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-bold bg-slate-100 text-slate-600 shadow-none border-0 hidden sm:inline-flex">
                          {transaction.category}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                        <span>{formatDate(transaction.date)}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span>{formatTime(transaction.date)}</span>
                      </p>
                      {transaction.description && (
                        <p className="text-xs font-medium text-slate-400 mt-1 truncate">{transaction.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-900 text-lg tabular-nums">
                      -{formatCurrency(transaction.amount)}
                    </p>
                    <div className="flex items-center justify-end gap-1 text-sm font-bold text-dime-purple mt-0.5">
                      <Plus className="w-3.5 h-3.5" />
                      <span className="tabular-nums">{formatCurrency(transaction.roundUpAmount)} saved</span>
                    </div>
                    <div className="mt-2 flex justify-end">
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
        </CardContent>
      </Card>

      {/* Round-up Explanation */}
      <div className="pt-4">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-0 shadow-card text-white overflow-hidden relative">
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-1/4 translate-y-1/4">
            <DollarSign className="w-64 h-64" />
          </div>
          <CardContent className="p-8 md:p-10 relative z-10">
            <div className="max-w-2xl">
              <h3 className="text-2xl font-bold mb-3 tracking-tight">How Round-Ups Work</h3>
              <p className="text-slate-300 mb-8 text-lg leading-relaxed">
                Every purchase is automatically rounded up to the nearest dollar. We collect that spare change 
                and securely apply it to your chosen debts to accelerate your path to financial freedom.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10">
                  <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Example 1</div>
                  <div className="flex items-center justify-between font-bold text-lg">
                    <span>$4.67 coffee</span>
                    <span className="text-emerald-400">+$0.33</span>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10">
                  <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Example 2</div>
                  <div className="flex items-center justify-between font-bold text-lg">
                    <span>$37.42 gas</span>
                    <span className="text-emerald-400">+$0.58</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}