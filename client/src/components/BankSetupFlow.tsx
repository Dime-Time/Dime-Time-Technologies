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
import { Slider } from "@/components/ui/slider";
import { 
  ArrowRight, 
  ArrowLeft, 
  CreditCard, 
  Building2, 
  Target, 
  CheckCircle, 
  Loader2,
  Wallet,
  Banknote,
  Bitcoin,
  Percent
} from "lucide-react";
import type { BankAccount, Debt } from "@shared/schema";
import { BetaModeBanner } from "@/components/BetaModeBanner";

type AllocationMode = 'debt' | 'bitcoin' | 'both';

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
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('debt');
  const [debtPercentage, setDebtPercentage] = useState<number>(50); // Percentage going to debt (1-99)
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bankAccounts = [], isLoading: accountsLoading, refetch: refetchAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/plaid/accounts"],
  });

  const { data: debts = [], isLoading: debtsLoading } = useQuery<Debt[]>({
    queryKey: ["/api/debts"],
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: { 
      sourceAccountId: string; 
      targetDebtId: string | null;
      cryptoEnabled: boolean;
      cryptoPercentage: string;
    }) => {
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
      id: "allocation",
      title: "Choose Your Goal",
      subtitle: "How should we use your round-ups?",
      icon: Target,
    },
    {
      id: "target",
      title: "Select Debt to Pay",
      subtitle: "Choose which debt receives your round-ups",
      icon: Banknote,
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
    // Determine crypto settings based on allocation mode
    let cryptoEnabled = false;
    let cryptoPercentage = "0.00";
    let targetDebt: string | null = selectedTargetDebt || null;

    if (allocationMode === 'bitcoin') {
      cryptoEnabled = true;
      cryptoPercentage = "100.00";
      targetDebt = null; // No debt target for bitcoin-only
    } else if (allocationMode === 'both') {
      cryptoEnabled = true;
      cryptoPercentage = (100 - debtPercentage).toFixed(2); // Bitcoin gets the remainder
    }

    // Validate required fields
    if (!selectedSourceAccount) {
      toast({
        title: "Missing Source Account",
        description: "Please select a bank account for round-ups.",
        variant: "destructive",
      });
      return;
    }

    // For debt and both modes, require debt selection
    if ((allocationMode === 'debt' || allocationMode === 'both') && !targetDebt) {
      toast({
        title: "Missing Debt Selection",
        description: "Please select a debt account to pay.",
        variant: "destructive",
      });
      return;
    }

    saveSettingsMutation.mutate({
      sourceAccountId: selectedSourceAccount,
      targetDebtId: targetDebt,
      cryptoEnabled,
      cryptoPercentage,
    });
  };

  // Skip debt selection step if bitcoin-only mode
  const handleNextWithLogic = () => {
    if (currentStep === 2 && allocationMode === 'bitcoin') {
      // Skip debt selection (step 3), go directly to confirm (step 4)
      setCurrentStep(4);
    } else {
      handleNext();
    }
  };

  const handleBackWithLogic = () => {
    if (currentStep === 4 && allocationMode === 'bitcoin') {
      // Skip back over debt selection to allocation
      setCurrentStep(2);
    } else {
      handleBack();
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
            <BetaModeBanner variant="full" showCompliance />
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
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Do you want Dime Time to:
              </h2>
            </div>

            <div className="flex justify-center gap-4 flex-wrap">
              {/* Pay Off Debt Option */}
              <button
                onClick={() => setAllocationMode('debt')}
                className={`flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 transition-all ${
                  allocationMode === 'debt'
                    ? 'border-dime-purple bg-dime-purple text-white shadow-lg scale-105'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-dime-purple/50'
                }`}
                data-testid="option-debt"
              >
                <Banknote className="w-8 h-8 mb-1" />
                <span className="text-xs font-bold text-center leading-tight">Pay Off<br/>Debt!</span>
              </button>

              {/* Buy Bitcoin Option */}
              <button
                onClick={() => setAllocationMode('bitcoin')}
                className={`flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 transition-all ${
                  allocationMode === 'bitcoin'
                    ? 'border-orange-500 bg-orange-500 text-white shadow-lg scale-105'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-orange-300'
                }`}
                data-testid="option-bitcoin"
              >
                <Bitcoin className="w-8 h-8 mb-1" />
                <span className="text-xs font-bold text-center leading-tight">Buy<br/>Bitcoin!</span>
              </button>

              {/* Both Option */}
              <button
                onClick={() => setAllocationMode('both')}
                className={`flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 transition-all ${
                  allocationMode === 'both'
                    ? 'border-green-500 bg-green-500 text-white shadow-lg scale-105'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-green-300'
                }`}
                data-testid="option-both"
              >
                <Percent className="w-8 h-8 mb-1" />
                <span className="text-xs font-bold text-center leading-tight">Both!</span>
              </button>
            </div>

            {/* Coinbase demo mode notice */}
            {(allocationMode === 'bitcoin' || allocationMode === 'both') && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800 text-center">
                  <strong>Demo Mode:</strong> Bitcoin purchases are simulated during the beta. 
                  Real trading will be available when you connect your Coinbase account in a future update.
                </p>
              </div>
            )}

            {/* Percentage Slider - Only show for "Both" option */}
            {allocationMode === 'both' && (
              <div className="mt-8 space-y-4 bg-slate-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-center text-slate-900">
                  Set Your Split
                </h3>
                
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-dime-purple">Debt: {debtPercentage}%</span>
                  <span className="text-orange-500">Bitcoin: {100 - debtPercentage}%</span>
                </div>

                <Slider
                  value={[debtPercentage]}
                  onValueChange={(value) => setDebtPercentage(value[0])}
                  min={1}
                  max={99}
                  step={1}
                  className="w-full"
                  data-testid="slider-percentage"
                />

                <div className="flex justify-between text-xs text-slate-500">
                  <span>1% Debt</span>
                  <span>50/50</span>
                  <span>99% Debt</span>
                </div>

                <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200">
                  <p className="text-sm text-center text-slate-600">
                    For every $1 in round-ups:<br/>
                    <span className="font-semibold text-dime-purple">${(debtPercentage / 100).toFixed(2)}</span> goes to debt • 
                    <span className="font-semibold text-orange-500"> ${((100 - debtPercentage) / 100).toFixed(2)}</span> buys Bitcoin
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 3:
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

      case 4:
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

              {/* Allocation Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {allocationMode === 'debt' && 'Pay Off Debt'}
                        {allocationMode === 'bitcoin' && 'Buy Bitcoin'}
                        {allocationMode === 'both' && 'Split Between Both'}
                      </p>
                      {allocationMode === 'both' && (
                        <p className="text-sm text-slate-600">
                          {debtPercentage}% Debt • {100 - debtPercentage}% Bitcoin
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {allocationMode === 'debt' && <Banknote className="w-6 h-6 text-dime-purple" />}
                      {allocationMode === 'bitcoin' && <Bitcoin className="w-6 h-6 text-orange-500" />}
                      {allocationMode === 'both' && <Percent className="w-6 h-6 text-green-500" />}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Show debt target only if applicable */}
              {(allocationMode === 'debt' || allocationMode === 'both') && (
                <>
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
                </>
              )}
            </div>

            <div className="bg-dime-purple/5 border border-dime-purple/20 rounded-lg p-4">
              <p className="text-sm text-slate-700">
                <strong>How it works:</strong> Every time you make a purchase, we'll round up
                to the nearest dollar and transfer that amount from your{" "}
                {selectedAccount?.institutionName || "bank account"}
                {allocationMode === 'debt' && ` to pay down your ${selectedDebt?.name || "debt"}.`}
                {allocationMode === 'bitcoin' && ` to buy Bitcoin.`}
                {allocationMode === 'both' && ` — ${debtPercentage}% goes to ${selectedDebt?.name || "your debt"} and ${100 - debtPercentage}% buys Bitcoin.`}
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
        return true; // Allocation always has a default selection
      case 3:
        return !!selectedTargetDebt;
      case 4:
        // For bitcoin-only, don't require debt selection
        if (allocationMode === 'bitcoin') {
          return !!selectedSourceAccount;
        }
        return !!selectedSourceAccount && !!selectedTargetDebt;
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
              onClick={handleBackWithLogic}
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
              onClick={handleNextWithLogic}
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
