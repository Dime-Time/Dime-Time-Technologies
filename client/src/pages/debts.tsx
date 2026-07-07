import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PaymentModal } from "@/components/payment-modal";
import { AddDebtModal } from "@/components/AddDebtModal";
import { EditDebtModal } from "@/components/EditDebtModal";
import { DebtHistoryModal } from "@/components/DebtHistoryModal";
import { ImportDebtsModal } from "@/components/ImportDebtsModal";
import { AcceleratedPayment } from "@/components/AcceleratedPayment";
import { formatCurrency, calculateDebtProgress, estimatePayoffMonths } from "@/lib/calculations";
import { CreditCard, TrendingDown, Calendar, Plus, DollarSign, Download, Pencil, Trash2 } from "lucide-react";
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Debt Management</h1>
          <p className="text-slate-600">Track and manage your debt payoff journey</p>
        </div>
        <div className="flex gap-2">
          {debtImportEnabled && (
            <Button
              variant="outline"
              onClick={() => setShowImportModal(true)}
              data-testid="button-import-debts"
            >
              <Download className="w-4 h-4 mr-2" />
              Import Debts
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowAddDebtModal(true)}
            data-testid="button-add-debt"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Debt
          </Button>
          <Button
            className="bg-dime-purple hover:bg-dime-purple/90"
            onClick={() => openPaymentModal()}
            data-testid="button-make-payment"
          >
            Make Payment
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Total Debt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDebt)}</p>
            <p className="text-xs text-slate-500 mt-1">
              Down from {formatCurrency(totalOriginalDebt)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-dime-accent">{overallProgress.toFixed(1)}%</p>
            <Progress value={overallProgress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Min. Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalMinimumPayments)}</p>
            <p className="text-xs text-slate-500 mt-1">Per month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-dime-purple">{formatCurrency(thisMonthPayments)}</p>
            <p className="text-xs text-slate-500 mt-1">Payments made</p>
          </CardContent>
        </Card>
      </div>

      {/* Debt Cards */}
      <div className="space-y-6">
        {isLoading && debts.length === 0 ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} data-testid={`skeleton-debt-card-${i}`}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="grid grid-cols-3 gap-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : debts.length === 0 ? (
          <Card>
            <CardContent className="p-2">
              <EmptyState
                icon={CreditCard}
                title="No debts yet"
                description="Add your first debt to start tracking your payoff progress."
                ctaLabel="Add Debt Account"
                onCtaClick={() => setShowAddDebtModal(true)}
                testIdPrefix="empty-debts-page"
              />
            </CardContent>
          </Card>
        ) : (
          debts.map((debt) => {
            const progress = calculateDebtProgress(debt.originalBalance, debt.currentBalance);
            const monthsLeft = estimatePayoffMonths(debt.currentBalance, parseFloat(debt.minimumPayment));
            const debtPayments = payments.filter(p => p.debtId === debt.id);
            const totalPaid = parseFloat(debt.originalBalance) - parseFloat(debt.currentBalance);
            
            return (
              <Card key={debt.id} className="overflow-hidden">
                <CardHeader className="bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl text-slate-900">{debt.name}</CardTitle>
                        {debt.source === "imported" && (
                          <Badge
                            variant="secondary"
                            className="bg-dime-purple/10 text-dime-purple hover:bg-dime-purple/10"
                            data-testid={`badge-imported-${debt.id}`}
                          >
                            Imported
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-600 mt-1">
                        {debt.accountNumber}
                        {debt.institutionName ? ` · ${debt.institutionName}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(debt.currentBalance)}</p>
                      <p className="text-sm text-slate-500">of {formatCurrency(debt.originalBalance)}</p>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                      <h4 className="text-sm font-medium text-slate-600 mb-1">Interest Rate</h4>
                      <p className="text-lg font-semibold text-slate-900">{debt.interestRate}%</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-600 mb-1">Minimum Payment</h4>
                      <p className="text-lg font-semibold text-slate-900">{formatCurrency(debt.minimumPayment)}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-600 mb-1">Due Date</h4>
                      <p className="text-lg font-semibold text-slate-900">{debt.dueDate}th of month</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-slate-600">Payoff Progress</h4>
                      <span className="text-sm font-medium text-dime-green">{progress}% complete</span>
                    </div>
                    <Progress value={progress} className="mb-2" />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Paid: {formatCurrency(totalPaid)}</span>
                      <span>Remaining: {formatCurrency(debt.currentBalance)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-dime-purple/5 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-slate-600 mb-1">Estimated Payoff</h4>
                      <p className="text-lg font-semibold text-dime-purple">{monthsLeft} months</p>
                      <p className="text-xs text-slate-500">At minimum payments</p>
                    </div>
                    <div className="bg-dime-accent/5 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-slate-600 mb-1">Total Payments</h4>
                      <p className="text-lg font-semibold text-dime-accent">{debtPayments.length}</p>
                      <p className="text-xs text-slate-500">This year</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mb-6">
                    <Button 
                      className="flex-1 bg-dime-purple hover:bg-dime-purple/90"
                      onClick={() => openPaymentModal(debt.id)}
                      data-testid={`button-make-payment-${debt.id}`}
                    >
                      Make Payment
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setHistoryDebt(debt)}
                      data-testid={`button-view-history-${debt.id}`}
                    >
                      View History
                    </Button>
                    <StripeAchPayButton debt={debt} />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setEditDebt(debt)}
                      aria-label="Edit debt"
                      data-testid={`button-edit-debt-${debt.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setDeleteTarget(debt)}
                      aria-label="Delete debt"
                      className="text-red-600 hover:text-red-700"
                      data-testid={`button-delete-debt-${debt.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Recent Payments — last 3 with canonical status badge */}
                  {debtPayments.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-slate-600 mb-2">Recent Payments</h4>
                      <ul className="space-y-2">
                        {debtPayments
                          .slice()
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .slice(0, 3)
                          .map((p) => (
                            <li
                              key={p.id}
                              className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2"
                              data-testid={`payment-row-${p.id}`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-sm font-medium text-slate-900">
                                  {formatCurrency(p.amount)}
                                </span>
                                <StatusBadge status={p.status} timestamp={p.date} />
                              </div>
                              <span className="text-xs text-slate-500 capitalize">
                                {p.source.replace(/_/g, " ")}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {/* One-Tap Accelerated Payment */}
                  <AcceleratedPayment debt={debt} />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Debt Strategy Tips */}
      <div className="mt-8">
        <Card className="bg-gradient-to-r from-dime-purple/5 to-dime-lilac/5 border-dime-purple/20">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">💡 Debt Payoff Strategies</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-slate-900 mb-2">Debt Avalanche</h4>
                <p className="text-sm text-slate-600">
                  Pay minimums on all debts, then put extra money toward the highest interest rate debt first. 
                  This saves the most money on interest over time.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-slate-900 mb-2">Debt Snowball</h4>
                <p className="text-sm text-slate-600">
                  Pay minimums on all debts, then put extra money toward the smallest balance first. 
                  This provides psychological wins and momentum.
                </p>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this debt?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" will be removed from your list. Your payment history is kept, but the debt will no longer appear or count toward your totals.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
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
