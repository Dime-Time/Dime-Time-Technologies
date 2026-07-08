import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, CreditCard, DollarSign } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Debt } from "@shared/schema";
import { BetaModeBanner, ComplianceDisclaimer } from "@/components/BetaModeBanner";

interface AcceleratedPaymentProps {
  debt: Debt;
  className?: string;
}

const QUICK_PAYMENT_AMOUNTS = ["25", "50", "100", "250"];

export function AcceleratedPayment({ debt, className = "" }: AcceleratedPaymentProps) {
  const [selectedAmount, setSelectedAmount] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const acceleratedPaymentMutation = useMutation({
    mutationFn: async ({ debtId, amount }: { debtId: string; amount: string }) => {
      const res = await apiRequest("POST", "/api/accelerated-payment", { debtId, amount });
      return await res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Payment Successful!",
        description: data.message || `Successfully paid $${data.payment?.amount}`,
        variant: "default",
      });
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      setSelectedAmount("");
    },
    onError: (error) => {
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const handleQuickPayment = (amount: string) => {
    acceleratedPaymentMutation.mutate({
      debtId: debt.id,
      amount,
    });
  };

  const handleCustomPayment = () => {
    if (!selectedAmount || parseFloat(selectedAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    acceleratedPaymentMutation.mutate({
      debtId: debt.id,
      amount: selectedAmount,
    });
  };

  const currentBalance = parseFloat(debt.currentBalance);
  const interestRate = parseFloat(debt.interestRate);

  return (
    <Card className={`${className} border-2 border-dashed border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-green-600" />
          <CardTitle className="text-lg">One-Tap Payment Boost</CardTitle>
        </div>
        <CardDescription className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          {debt.name} • {debt.interestRate}% APR
          <Badge variant="secondary" className="ml-auto">
            ${debt.currentBalance}
          </Badge>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <BetaModeBanner variant="compact" />
        <ComplianceDisclaimer />
        {/* Quick Payment Buttons */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Quick Payments</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_PAYMENT_AMOUNTS.map((amount) => {
              const monthsReduced = Math.floor((parseFloat(amount) * 12) / (currentBalance * (interestRate / 100)));
              const isAffordable = parseFloat(amount) <= currentBalance;
              
              return (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  disabled={acceleratedPaymentMutation.isPending || !isAffordable}
                  onClick={() => handleQuickPayment(amount)}
                  className="flex flex-col h-auto p-3 text-left hover:bg-green-100 dark:hover:bg-green-900"
                >
                  <div className="flex items-center gap-1 font-semibold">
                    <DollarSign className="h-3 w-3" />
                    {amount}
                  </div>
                  {isAffordable && (
                    <div className="text-xs text-muted-foreground">
                      Save ~{monthsReduced || 1} month{monthsReduced !== 1 ? 's' : ''}
                    </div>
                  )}
                  {!isAffordable && (
                    <div className="text-xs text-red-500">
                      Exceeds balance
                    </div>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Custom Amount */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Custom Amount</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="number"
                placeholder="Enter amount"
                value={selectedAmount}
                onChange={(e) => setSelectedAmount(e.target.value)}
                min="0.01"
                max={debt.currentBalance}
                step="0.01"
                className="w-full pl-9 pr-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                disabled={acceleratedPaymentMutation.isPending}
              />
            </div>
            <Button
              onClick={handleCustomPayment}
              disabled={acceleratedPaymentMutation.isPending || !selectedAmount}
              size="sm"
              className="px-6"
            >
              {acceleratedPaymentMutation.isPending ? "Processing..." : "Pay"}
            </Button>
          </div>
        </div>

        {/* Benefits Display */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Interest Rate:</span>
            <span className="font-medium text-red-600">{debt.interestRate}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Minimum Payment:</span>
            <span className="font-medium">${debt.minimumPayment}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Due Date:</span>
            <span className="font-medium">{debt.dueDate}th of month</span>
          </div>
        </div>

        {/* Motivational Text */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            💡 Extra payments go directly to principal, saving you interest!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}