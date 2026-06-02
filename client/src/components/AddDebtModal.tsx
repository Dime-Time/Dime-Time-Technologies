import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AddDebtModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddDebtModal({ open, onOpenChange }: AddDebtModalProps) {
  const [name, setName] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resetForm = () => {
    setName("");
    setCurrentBalance("");
    setInterestRate("");
    setMinimumPayment("");
    setDueDate("");
    setAccountNumber("");
  };

  const addDebtMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      currentBalance: string;
      originalBalance: string;
      interestRate: string;
      minimumPayment: string;
      dueDate: number;
      accountNumber: string;
    }) => {
      return apiRequest("POST", "/api/debts", data);
    },
    onSuccess: () => {
      toast({
        title: "Debt Added",
        description: "Your debt is now being tracked.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-summary"] });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Couldn't Add Debt",
        description: "There was an error adding your debt. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

    addDebtMutation.mutate({
      name: name.trim(),
      currentBalance: parseFloat(currentBalance).toFixed(2),
      originalBalance: parseFloat(currentBalance).toFixed(2),
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
          <DialogTitle>Add a Debt</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="debt-name">Debt Name</Label>
            <Input
              id="debt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Credit Card, Student Loan"
              data-testid="input-debt-name"
            />
          </div>

          <div>
            <Label htmlFor="debt-balance">Current Balance</Label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-500">$</span>
              <Input
                id="debt-balance"
                type="number"
                step="0.01"
                min="0.01"
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
                className="pl-8"
                placeholder="0.00"
                data-testid="input-debt-balance"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="debt-rate">Interest Rate (%)</Label>
              <Input
                id="debt-rate"
                type="number"
                step="0.01"
                min="0"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="0.00"
                data-testid="input-debt-rate"
              />
            </div>
            <div>
              <Label htmlFor="debt-min">Min. Payment</Label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500">$</span>
                <Input
                  id="debt-min"
                  type="number"
                  step="0.01"
                  min="0"
                  value={minimumPayment}
                  onChange={(e) => setMinimumPayment(e.target.value)}
                  className="pl-8"
                  placeholder="0.00"
                  data-testid="input-debt-min"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="debt-due">Due Day (1-31)</Label>
              <Input
                id="debt-due"
                type="number"
                min="1"
                max="31"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="e.g. 15"
                data-testid="input-debt-due"
              />
            </div>
            <div>
              <Label htmlFor="debt-account">Account (optional)</Label>
              <Input
                id="debt-account"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Last 4 digits"
                data-testid="input-debt-account"
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
              disabled={addDebtMutation.isPending}
              data-testid="button-submit-debt"
            >
              {addDebtMutation.isPending ? "Adding..." : "Add Debt"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
