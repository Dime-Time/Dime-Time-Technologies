import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/calculations";
import type { Debt } from "@shared/schema";
import { BetaModeBanner, ComplianceDisclaimer } from "@/components/BetaModeBanner";
import { Banknote } from "lucide-react";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debts: Debt[];
  roundUpBalance: number;
  initialDebtId?: string;
}

export function PaymentModal({ open, onOpenChange, debts, roundUpBalance, initialDebtId }: PaymentModalProps) {
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [amount, setAmount] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) setSelectedDebtId(initialDebtId ?? "");
  }, [open, initialDebtId]);

  const paymentMutation = useMutation({
    mutationFn: async (data: { debtId: string; amount: string; source: string }) => {
      return apiRequest("POST", "/api/payments", data);
    },
    onSuccess: () => {
      toast({
        title: "Payment Processed",
        description: "Your payment has been successfully processed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      onOpenChange(false);
      setAmount("");
      setSelectedDebtId("");
    },
    onError: () => {
      toast({
        title: "Payment Failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtId || !amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Payment",
        description: "Please select a debt and enter a valid amount.",
        variant: "destructive",
      });
      return;
    }

    paymentMutation.mutate({
      debtId: selectedDebtId,
      amount,
      source: "manual",
    });
  };

  const handleQuickAmount = (quickAmount: number) => {
    setAmount(quickAmount.toString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-0 shadow-xl rounded-2xl overflow-hidden p-0">
        <div className="h-2 w-full bg-dime-purple"></div>
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
              <Banknote className="w-6 h-6 text-dime-purple" /> Make Payment
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <BetaModeBanner variant="compact" />
              <ComplianceDisclaimer />
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="debt-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Target Debt Account</Label>
                <Select value={selectedDebtId} onValueChange={setSelectedDebtId}>
                  <SelectTrigger className="h-12 bg-slate-50 border-slate-200 focus:bg-white text-base font-semibold">
                    <SelectValue placeholder="Choose a debt" />
                  </SelectTrigger>
                  <SelectContent>
                    {debts.map((debt) => (
                      <SelectItem key={debt.id} value={debt.id} className="font-medium">
                        {debt.name} <span className="text-slate-400 ml-1">— {formatCurrency(debt.currentBalance)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="amount" className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Payment Amount</Label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400 font-bold">$</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-8 h-12 bg-slate-50 border-slate-200 focus:bg-white text-lg font-bold tabular-nums"
                    placeholder="0.00"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleQuickAmount(roundUpBalance)}
                    className="bg-dime-purple/5 border-dime-purple/20 text-dime-purple hover:bg-dime-purple/10 font-bold tabular-nums shadow-sm"
                  >
                    Send All {formatCurrency(roundUpBalance)}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => handleQuickAmount(50)} className="font-bold tabular-nums text-slate-600 bg-white shadow-sm border-slate-200 hover:bg-slate-50 hover:text-slate-900">$50</Button>
                  <Button type="button" variant="outline" onClick={() => handleQuickAmount(100)} className="font-bold tabular-nums text-slate-600 bg-white shadow-sm border-slate-200 hover:bg-slate-50 hover:text-slate-900">$100</Button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2 mt-6 border-t border-slate-100">
              <Button type="button" variant="outline" className="flex-1 h-12 font-bold text-slate-700 bg-white shadow-sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 h-12 bg-dime-purple hover:bg-dime-purple/90 text-white font-bold press-scale shadow-sm" disabled={paymentMutation.isPending}>
                {paymentMutation.isPending ? "Processing..." : "Pay Now"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}