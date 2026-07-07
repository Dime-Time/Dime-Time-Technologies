import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Debt } from "@shared/schema";

interface EditDebtModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: Debt | null;
}

export function EditDebtModal({ open, onOpenChange, debt }: EditDebtModalProps) {
  const [name, setName] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open && debt) {
      setName(debt.name);
      setCurrentBalance(debt.currentBalance);
      setInterestRate(debt.interestRate);
      setMinimumPayment(debt.minimumPayment);
      setDueDate(String(debt.dueDate));
      setAccountNumber(debt.accountNumber === "—" ? "" : debt.accountNumber);
    }
  }, [open, debt]);

  const editDebtMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      currentBalance: string;
      interestRate: string;
      minimumPayment: string;
      dueDate: number;
      accountNumber: string;
    }) => {
      return apiRequest("PATCH", `/api/debts/${debt!.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Debt Updated",
        description: "Your changes have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-summary"] });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Couldn't Update Debt",
        description: "There was an error saving your changes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debt) return;
    const day = parseInt(dueDate, 10);

    if (
      !name.trim() ||
      !currentBalance ||
      parseFloat(currentBalance) <= 0 ||
      !interestRate ||
      parseFloat(interestRate) < 0 ||
      !minimumPayment ||
      parseFloat(minimumPayment) < 0 ||
      !day ||
      day < 1 ||
      day > 31
    ) {
      toast({
        title: "Check Your Details",
        description:
          "Please enter a name, balance, interest rate, minimum payment, and a due date between 1 and 31.",
        variant: "destructive",
      });
      return;
    }

    editDebtMutation.mutate({
      name: name.trim(),
      currentBalance: parseFloat(currentBalance).toFixed(2),
      interestRate: parseFloat(interestRate).toFixed(2),
      minimumPayment: parseFloat(minimumPayment).toFixed(2),
      dueDate: day,
      accountNumber: accountNumber.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Debt</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-debt-name">Debt Name</Label>
            <Input
              id="edit-debt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Credit Card, Student Loan"
              data-testid="input-edit-debt-name"
            />
          </div>

          <div>
            <Label htmlFor="edit-debt-balance">Current Balance</Label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-500">$</span>
              <Input
                id="edit-debt-balance"
                type="number"
                step="0.01"
                min="0.01"
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
                className="pl-8"
                placeholder="0.00"
                data-testid="input-edit-debt-balance"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-debt-rate">Interest Rate (%)</Label>
              <Input
                id="edit-debt-rate"
                type="number"
                step="0.01"
                min="0"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="0.00"
                data-testid="input-edit-debt-rate"
              />
            </div>
            <div>
              <Label htmlFor="edit-debt-min">Min. Payment</Label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500">$</span>
                <Input
                  id="edit-debt-min"
                  type="number"
                  step="0.01"
                  min="0"
                  value={minimumPayment}
                  onChange={(e) => setMinimumPayment(e.target.value)}
                  className="pl-8"
                  placeholder="0.00"
                  data-testid="input-edit-debt-min"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-debt-due">Due Day (1-31)</Label>
              <Input
                id="edit-debt-due"
                type="number"
                min="1"
                max="31"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="e.g. 15"
                data-testid="input-edit-debt-due"
              />
            </div>
            <div>
              <Label htmlFor="edit-debt-account">Account (optional)</Label>
              <Input
                id="edit-debt-account"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Last 4 digits"
                data-testid="input-edit-debt-account"
              />
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
              disabled={editDebtMutation.isPending}
              data-testid="button-save-debt"
            >
              {editDebtMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
