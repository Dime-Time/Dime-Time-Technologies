import { useState, useCallback, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowRight, 
  ArrowLeft, 
  CreditCard, 
  Building2, 
  Target, 
  CheckCircle, 
  Loader2,
  Wallet,
  Banknote
} from "lucide-react";
import type { BankAccount, Debt } from "@shared/schema";

interface BankSetupFlowProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export default function BankSetupFlow({ onComplete, onSkip }: BankSetupFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSourceAccount, setSelectedSourceAccount] = useState<string>("");
  const [selectedTargetDebt, setSelectedTargetDebt] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bankAccounts = [], isLoading: accountsLoading, refetch: refetchAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/plaid/accounts"],
  });

  const { data: debts = [], isLoading: debtsLoading } = useQuery<Debt[]>({
    queryKey: ["/api/debts"],
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: { sourceAccountId: string; targetDebtId: string }) => {
      const response = await fetch("/api/round-up-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("Failed to save settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/round-up-settings"] });
      toast({
        title: "Setup Complete!",
        description: "Your round-up preferences have been saved.",
      });
      onComplete();
    },
    onError: () => {
      toast({
        title: "Setup Failed",
        description: "Could not save your preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createLinkToken = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/plaid/create-link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setLinkToken(data.linkToken);
      } else {
        throw new Error("Failed to create link token");
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Unable to initialize bank connection. Using demo mode.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaidSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ publicToken }),
        });

        if (response.ok) {
          toast({
            title: "Bank Connected!",
            description: `Successfully linked ${metadata?.institution?.name || "your bank"}`,
          });
          await refetchAccounts();
          setCurrentStep(1);
        } else {
          throw new Error("Failed to exchange token");
        }
      } catch (error) {
        toast({
          title: "Connection Failed",
          description: "Could not link your bank account. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast, refetchAccounts]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: () => console.log("Plaid link exited"),
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  const steps = [
    {
      id: "connect",
      title: "Connect Your Bank",
      subtitle: "Link your checking account for round-ups",
      icon: Building2,
    },
    {
      id: "source",
      title: "Select Source Account",
      subtitle: "Choose which account to pull round-ups from",
      icon: Wallet,
    },
    {
      id: "target",
      title: "Select Debt to Pay",
      subtitle: "Choose which debt receives your round-ups",
      icon: Target,
    },
    {
      id: "confirm",
      title: "Confirm Setup",
      subtitle: "Review and activate your round-up settings",
      icon: CheckCircle,
    },
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    if (selectedSourceAccount && selectedTargetDebt) {
      saveSettingsMutation.mutate({
        sourceAccountId: selectedSourceAccount,
        targetDebtId: selectedTargetDebt,
      });
    }
  };

  const selectedAccount = bankAccounts.find((a) => a.id === selectedSourceAccount);
  const selectedDebt = debts.find((d) => d.id === selectedTargetDebt);
  const checkingAccounts = bankAccounts.filter((a) => 
    a.accountType?.toLowerCase() === "checking" || a.accountType?.toLowerCase() === "depository"
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-dime-purple/10 rounded-full flex items-center justify-center mx-auto">
                <Building2 className="w-10 h-10 text-dime-purple" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Securely Link Your Bank</h3>
                <p className="text-slate-600 mt-2">
                  We use Plaid to securely connect to over 11,000 financial institutions.
                  Your credentials are never stored on our servers.
                </p>
              </div>
            </div>

            {bankAccounts.length > 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">Bank Already Connected!</p>
                    <p className="text-sm text-green-600">
                      You have {bankAccounts.length} account(s) linked. Continue to select your source account.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Button
                  onClick={createLinkToken}
                  disabled={isLoading}
                  className="w-full bg-dime-purple hover:bg-dime-purple/90 text-white py-6"
                  size="lg"
                  data-testid="button-connect-bank"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="w-5 h-5 mr-2" />
                  )}
                  Connect Bank Account
                </Button>
                <p className="text-xs text-center text-slate-500">
                  256-bit encryption • Bank-level security • Read-only access
                </p>
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-900">Select Your Checking Account</h3>
              <p className="text-slate-600 mt-2">
                This account will be used to collect your round-ups
              </p>
            </div>

            {accountsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-dime-purple" />
              </div>
            ) : checkingAccounts.length > 0 ? (
              <RadioGroup
                value={selectedSourceAccount}
                onValueChange={setSelectedSourceAccount}
                className="space-y-3"
              >
                {checkingAccounts.map((account) => (
                  <div
                    key={account.id}
                    className={`relative flex items-center gap-4 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedSourceAccount === account.id
                        ? "border-dime-purple bg-dime-purple/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={() => setSelectedSourceAccount(account.id)}
                    data-testid={`account-option-${account.id}`}
                  >
                    <RadioGroupItem value={account.id} id={account.id} />
                    <div className="flex-1">
                      <Label htmlFor={account.id} className="cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{account.institutionName}</p>
                            <p className="text-sm text-slate-600">{account.accountName}</p>
                          </div>
                          <Badge variant="outline">****{account.mask}</Badge>
                        </div>
                      </Label>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            ) : bankAccounts.length > 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>No checking accounts found. Please connect a checking account.</p>
                <Button
                  onClick={createLinkToken}
                  variant="outline"
                  className="mt-4"
                  data-testid="button-add-account"
                >
                  Add Another Account
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>No accounts connected yet. Go back to connect your bank.</p>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-900">Select Your Debt Account</h3>
              <p className="text-slate-600 mt-2">
                Choose which debt should receive your round-up payments
              </p>
            </div>

            {debtsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-dime-purple" />
              </div>
            ) : debts.length > 0 ? (
              <RadioGroup
                value={selectedTargetDebt}
                onValueChange={setSelectedTargetDebt}
                className="space-y-3"
              >
                {debts.map((debt) => (
                  <div
                    key={debt.id}
                    className={`relative flex items-center gap-4 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedTargetDebt === debt.id
                        ? "border-dime-purple bg-dime-purple/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={() => setSelectedTargetDebt(debt.id)}
                    data-testid={`debt-option-${debt.id}`}
                  >
                    <RadioGroupItem value={debt.id} id={debt.id} />
                    <div className="flex-1">
                      <Label htmlFor={debt.id} className="cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{debt.name}</p>
                            <p className="text-sm text-slate-600">
                              {debt.interestRate}% APR • Min ${debt.minimumPayment}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-dime-purple">
                              ${Number(debt.currentBalance).toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-500">Balance</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>No debts added yet. You can add debts from the dashboard after setup.</p>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Review Your Setup</h3>
              <p className="text-slate-600 mt-2">
                Confirm your round-up configuration
              </p>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Round-ups From
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedAccount ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{selectedAccount.institutionName}</p>
                        <p className="text-sm text-slate-600">{selectedAccount.accountName}</p>
                      </div>
                      <Badge variant="outline">****{selectedAccount.mask}</Badge>
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">No account selected</p>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-center">
                <ArrowRight className="w-6 h-6 text-dime-purple" />
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                    <Banknote className="w-4 h-4" />
                    Paying Debt
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedDebt ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{selectedDebt.name}</p>
                        <p className="text-sm text-slate-600">{selectedDebt.interestRate}% APR</p>
                      </div>
                      <p className="font-bold text-dime-purple">
                        ${Number(selectedDebt.currentBalance).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">No debt selected</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="bg-dime-purple/5 border border-dime-purple/20 rounded-lg p-4">
              <p className="text-sm text-slate-700">
                <strong>How it works:</strong> Every time you make a purchase, we'll round up
                to the nearest dollar and transfer that amount from your{" "}
                {selectedAccount?.institutionName || "bank account"} to pay down your{" "}
                {selectedDebt?.name || "selected debt"}.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return bankAccounts.length > 0;
      case 1:
        return !!selectedSourceAccount;
      case 2:
        return !!selectedTargetDebt;
      case 3:
        return selectedSourceAccount && selectedTargetDebt;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 overflow-y-auto touch-pan-y">
      <div className="max-w-lg mx-auto pt-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm text-slate-500">{steps[currentStep].title}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="mb-6">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              {(() => {
                const Icon = steps[currentStep].icon;
                return (
                  <div className="w-12 h-12 bg-dime-purple/10 rounded-full flex items-center justify-center">
                    <Icon className="w-6 h-6 text-dime-purple" />
                  </div>
                );
              })()}
            </div>
            <CardTitle>{steps[currentStep].title}</CardTitle>
            <CardDescription>{steps[currentStep].subtitle}</CardDescription>
          </CardHeader>
          <CardContent>{renderStepContent()}</CardContent>
        </Card>

        <div className="flex justify-between gap-4">
          {currentStep > 0 ? (
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex items-center gap-2"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={onSkip}
              className="text-slate-500"
              data-testid="button-skip"
            >
              Skip for now
            </Button>
          )}

          {currentStep < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 bg-dime-purple hover:bg-dime-purple/90"
              data-testid="button-next"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={!canProceed() || saveSettingsMutation.isPending}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              data-testid="button-complete-setup"
            >
              {saveSettingsMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Activate Round-ups
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
