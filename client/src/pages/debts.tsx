import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription as DialogDesc,
  DialogFooter,
} from "@/components/ui/dialog";
import { PaymentModal } from "@/components/payment-modal";
import { AddDebtModal } from "@/components/AddDebtModal";
import { EditDebtModal } from "@/components/EditDebtModal";
import { DebtHistoryModal } from "@/components/DebtHistoryModal";
import { ImportDebtsModal } from "@/components/ImportDebtsModal";
import { AcceleratedPayment } from "@/components/AcceleratedPayment";
import { formatCurrency, calculateDebtProgress, estimatePayoffMonths } from "@/lib/calculations";
import { CreditCard, TrendingDown, Calendar, Plus, DollarSign, Download, Pencil, Trash2, Zap, LayoutList } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { StripeAchPayButton } from "@/components/StripeAchPayButton";
import { useFlag } from "@/hooks/useFlag";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Debt, Payment } from "@shared/schema";

type DashboardSummary = {
  totalDebt: string;
  totalRoundUps: string;
  thisMonthRoundUps: string;
  thisMonthPayments: string;
  progressPercentage: number;
  debtFreeDate: string;
  debtsCount: number;
};

export default function Debts() {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddDebtModal, setShowAddDebtModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [paymentDebtId, setPaymentDebtId] = useState<string | undefined>(undefined);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [historyDebt, setHistoryDebt] = useState<Debt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);
  const debtImportEnabled = useFlag("ENABLE_DEBT_IMPORT");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: debts = [], isLoading } = useQuery<Debt[]>({
    queryKey: ["/api/debts"],
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard-summary"],
  });

  const roundUpBalance = summary ? parseFloat(summary.totalRoundUps) : 0;

  const deleteDebtMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/debts/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Debt Removed",
        description: "The debt has been removed. Your payment history is preserved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-summary"] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({
        title: "Couldn't Remove Debt",
        description: "There was an error removing this debt. Please try again.",
        variant: "destructive",
      });
    },
  });

  const openPaymentModal = (debtId?: string) => {
    setPaymentDebtId(debtId);
    setShowPaymentModal(true);
  };

  const totalDebt = debts.reduce((sum, debt) => sum + parseFloat(debt.currentBalance), 0);
  const totalOriginalDebt = debts.reduce((sum, debt) => sum + parseFloat(debt.originalBalance), 0);
  const totalMinimumPayments = debts.reduce((sum, debt) => sum + parseFloat(debt.minimumPayment), 0);
  const overallProgress = totalOriginalDebt > 0 ? ((totalOriginalDebt - totalDebt) / totalOriginalDebt) * 100 : 0;

  const thisMonthPayments = payments
    .filter(payment => {
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      return new Date(payment.date) >= thisMonth;
    })
    .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-1">Debt Management</h1>
          <p className="text-slate-600 font-medium">Track and crush your debt payoff journey</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {debtImportEnabled && (
            <Button
              variant="outline"
              onClick={() => setShowImportModal(true)}
              data-testid="button-import-debts"
              className="bg-white shadow-sm hover:bg-slate-50 font-semibold"
            >
              <Download className="w-4 h-4 mr-2" />
              Import
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowAddDebtModal(true)}
            data-testid="button-add-debt"
            className="bg-white shadow-sm hover:bg-slate-50 font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Manual
          </Button>
          <Button
            className="bg-dime-purple hover:bg-dime-purple/90 text-white font-semibold shadow-sm press-scale"
            onClick={() => openPaymentModal()}
            data-testid="button-make-payment"
          >
            Make Payment
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up">
        <Card className="shadow-card border-0 ring-1 ring-slate-100 bg-white">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Total Debt
            </div>
            <p className="text-2xl md:text-3xl font-bold text-slate-900 tabular-nums">{formatCurrency(totalDebt)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0 ring-1 ring-slate-100 bg-white relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100">
            <div className="h-full bg-dime-purple" style={{ width: `${overallProgress}%` }}></div>
          </div>
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" /> Progress
            </div>
            <p className="text-2xl md:text-3xl font-bold text-dime-purple tabular-nums">{overallProgress.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0 ring-1 ring-slate-100 bg-white">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Min. Due
            </div>
            <p className="text-2xl md:text-3xl font-bold text-slate-900 tabular-nums">{formatCurrency(totalMinimumPayments)}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Monthly</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0 ring-1 ring-slate-100 bg-white">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Paid This Month
            </div>
            <p className="text-2xl md:text-3xl font-bold text-emerald-600 tabular-nums">{formatCurrency(thisMonthPayments)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Debt Cards */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-2 px-1">
          <LayoutList className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-bold text-slate-900">Your Debts</h2>
        </div>
        
        {isLoading && debts.length === 0 ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} data-testid={`skeleton-debt-card-${i}`} className="border-0 shadow-card">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-10 w-32" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : debts.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50 shadow-none">
            <CardContent className="p-12">
              <EmptyState
                icon={CreditCard}
                title="No debts yet"
                description="Add your first debt to start tracking your payoff progress and watch your balances drop."
                ctaLabel="Add Your First Debt"
                onCtaClick={() => setShowAddDebtModal(true)}
                testIdPrefix="empty-debts-page"
              />
            </CardContent>
          </Card>
        ) : (
          debts.map((debt, index) => {
            const progress = calculateDebtProgress(debt.originalBalance, debt.currentBalance);
            const monthsLeft = estimatePayoffMonths(debt.currentBalance, parseFloat(debt.minimumPayment));
            const debtPayments = payments.filter(p => p.debtId === debt.id);
            const totalPaid = parseFloat(debt.originalBalance) - parseFloat(debt.currentBalance);
            
            return (
              <Card key={debt.id} className="overflow-hidden shadow-card border-0 ring-1 ring-slate-200 animate-fade-in-up transition-shadow hover:shadow-card-hover" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardHeader className="bg-slate-50/80 border-b border-slate-100 pb-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">{debt.name}</CardTitle>
                        {debt.source === "imported" && (
                          <Badge
                            variant="secondary"
                            className="bg-dime-purple/10 text-dime-purple text-[10px] uppercase tracking-wider font-bold hover:bg-dime-purple/20 shadow-none border-0"
                            data-testid={`badge-imported-${debt.id}`}
                          >
                            Imported
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-500 mt-1.5 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" />
                        {debt.institutionName ? `${debt.institutionName} • ` : ""}
                        •••• {debt.accountNumber?.slice(-4) || "----"}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Current Balance</div>
                      <div className="text-3xl font-bold text-slate-900 tabular-nums leading-none">
                        {formatCurrency(debt.currentBalance)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">APR</h4>
                      <p className="text-xl font-bold text-slate-900 tabular-nums">{debt.interestRate}%</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Min Payment</h4>
                      <p className="text-xl font-bold text-slate-900 tabular-nums">{formatCurrency(debt.minimumPayment)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Due Date</h4>
                      <p className="text-xl font-bold text-slate-900">{debt.dueDate}<span className="text-sm text-slate-500 font-medium ml-1">of month</span></p>
                    </div>
                    <div className="bg-dime-purple/5 rounded-xl p-4 border border-dime-purple/10">
                      <h4 className="text-xs font-bold text-dime-purple uppercase tracking-wider mb-1">Est. Payoff</h4>
                      <p className="text-xl font-bold text-dime-purple tabular-nums">{monthsLeft} <span className="text-sm font-medium">mo</span></p>
                    </div>
                  </div>

                  <div className="mb-8 max-w-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-dime-purple" /> Payoff Progress
                      </h4>
                      <span className="text-sm font-bold text-dime-purple tabular-nums">{progress}%</span>
                    </div>
                    <Progress value={progress} className="mb-3 h-2.5 bg-slate-100" />
                    <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <span>Paid {formatCurrency(totalPaid)}</span>
                      <span>Left {formatCurrency(debt.currentBalance)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
                    <Button 
                      className="bg-dime-purple hover:bg-dime-purple/90 text-white font-semibold shadow-sm press-scale px-6"
                      onClick={() => openPaymentModal(debt.id)}
                      data-testid={`button-make-payment-${debt.id}`}
                    >
                      Make Payment
                    </Button>
                    <StripeAchPayButton debt={debt} />
                    <Button
                      variant="outline"
                      className="bg-white font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                      onClick={() => setHistoryDebt(debt)}
                      data-testid={`button-view-history-${debt.id}`}
                    >
                      History
                    </Button>
                    <div className="flex-1"></div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditDebt(debt)}
                      aria-label="Edit debt"
                      className="text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                      data-testid={`button-edit-debt-${debt.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(debt)}
                      aria-label="Delete debt"
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                      data-testid={`button-delete-debt-${debt.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Recent Payments — last 3 with canonical status badge */}
                  {debtPayments.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Recent Payments</h4>
                      <ul className="space-y-2">
                        {debtPayments
                          .slice()
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .slice(0, 3)
                          .map((p) => (
                            <li
                              key={p.id}
                              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3"
                              data-testid={`payment-row-${p.id}`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-sm font-bold text-slate-900 tabular-nums">
                                  {formatCurrency(p.amount)}
                                </span>
                                <StatusBadge status={p.status} timestamp={p.date} />
                              </div>
                              <span className="text-xs font-medium text-slate-500 capitalize">
                                {p.source.replace(/_/g, " ")}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {/* One-Tap Accelerated Payment - Add some top margin to separate it */}
                  <div className="mt-6">
                    <AcceleratedPayment debt={debt} />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Debt Strategy Tips */}
      <div className="pt-6">
        <Card className="bg-gradient-to-br from-dime-purple/5 to-white border border-dime-purple/10 shadow-sm">
          <CardContent className="p-6 md:p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-dime-purple fill-dime-purple/20" /> Debt Payoff Strategies
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-600">1</div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1.5">Debt Avalanche</h4>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    Pay minimums on all debts, then put extra money toward the highest interest rate debt first. Saves the most money over time.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-600">2</div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1.5">Debt Snowball</h4>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    Pay minimums on all debts, then target the smallest balance first. Provides quick psychological wins and momentum.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <PaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        debts={debts}
        roundUpBalance={roundUpBalance}
        initialDebtId={paymentDebtId}
      />

      <AddDebtModal
        open={showAddDebtModal}
        onOpenChange={setShowAddDebtModal}
      />

      <EditDebtModal
        open={!!editDebt}
        onOpenChange={(open) => !open && setEditDebt(null)}
        debt={editDebt}
      />

      <DebtHistoryModal
        open={!!historyDebt}
        onOpenChange={(open) => !open && setHistoryDebt(null)}
        debt={historyDebt}
        payments={payments}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="h-2 w-full bg-red-500"></div>
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-xl font-bold">Remove this debt?</DialogTitle>
            <DialogDesc className="text-base text-slate-600 mt-2">
              {deleteTarget
                ? `"${deleteTarget.name}" will be removed from your list. Your payment history is kept, but the debt will no longer appear or count toward your totals.`
                : ""}
            </DialogDesc>
          </DialogHeader>
          <DialogFooter className="px-6 pb-6 pt-4 flex gap-3 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              data-testid="button-cancel-delete"
              className="font-semibold text-slate-700 w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white font-semibold w-full sm:w-auto shadow-sm"
              disabled={deleteDebtMutation.isPending}
              onClick={() => deleteTarget && deleteDebtMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete"
            >
              {deleteDebtMutation.isPending ? "Removing..." : "Remove Debt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {debtImportEnabled && (
        <ImportDebtsModal
          open={showImportModal}
          onOpenChange={setShowImportModal}
        />
      )}
    </main>
  );
}