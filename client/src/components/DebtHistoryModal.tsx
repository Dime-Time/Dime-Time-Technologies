import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/calculations";
import type { Debt, Payment } from "@shared/schema";

interface DebtHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: Debt | null;
  payments: Payment[];
}

export function DebtHistoryModal({ open, onOpenChange, debt, payments }: DebtHistoryModalProps) {
  const debtPayments = debt
    ? payments
        .filter((p) => p.debtId === debt.id)
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  const totalPaid = debtPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{debt ? `${debt.name} — Payment History` : "Payment History"}</DialogTitle>
        </DialogHeader>

        {debtPayments.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500" data-testid="text-history-empty">
            No payments recorded for this debt yet.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-600">Total paid</span>
              <span className="text-lg font-semibold text-slate-900">{formatCurrency(totalPaid)}</span>
            </div>

            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {debtPayments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2"
                  data-testid={`history-row-${p.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(p.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {" · "}
                      <span className="capitalize">{p.source.replace(/_/g, " ")}</span>
                    </p>
                  </div>
                  <StatusBadge status={p.status} timestamp={p.date} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
