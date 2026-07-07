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

  // Pre-select the debt the user clicked "Make Payment" on (blank when opened
  // from the top-level button).
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Make Extra Payment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <BetaModeBanner variant="compact" />
          <ComplianceDisclaimer />
          <div>
            <Label htmlFor="debt-select">Select Debt Account</Label>
            <Select value={selectedDebtId} onValueChange={setSelectedDebtId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a debt account" />
              </SelectTrigger>
              <SelectContent>
                {debts.map((debt) => (
                  <SelectItem key={debt.id} value={debt.id}>
                    {debt.name} - {formatCurrency(debt.currentBalance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount">Payment Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-500">$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8"
                placeholder="0.00"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAmount(roundUpBalance)}
                className="text-xs"
              >
                Use Round-ups ({formatCurrency(roundUpBalance)})
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAmount(50)}
                className="text-xs"
              >
                $50
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAmount(100)}
                className="text-xs"
              >
                $100
              </Button>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-dime-purple hover:bg-dime-purple/90"
              disabled={paymentMutation.isPending}
            >
              {paymentMutation.isPending ? "Processing..." : "Process Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
