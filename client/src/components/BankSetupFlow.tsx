import { useState, useCallback, useEffect, useRef } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { 
  ArrowRight, 
  CreditCard, 
  Building2, 
  Target, 
  CheckCircle, 
  Loader2,
  Wallet,
  Banknote,
  Bitcoin,
  Percent,
  ShieldCheck
} from "lucide-react";
import type { BankAccount, Debt } from "@shared/schema";
import { BetaModeBanner } from "@/components/BetaModeBanner";
import { formatCurrency } from "@/lib/calculations";

type AllocationMode = 'debt' | 'bitcoin' | 'both';

interface BankSetupFlowProps {
  onComplete: () => void;
  onSkip?: () => void;
}

// Dedicated launcher, mounted fresh per link token (same pattern as
// ImportDebtsModal). Guards open() with a ref because react-plaid-link's
// `open` is not referentially stable — an unguarded [ready, open] effect can
// stack a duplicate Link iframe (frozen inputs + Plaid's "embedded more than
// once" warning). Mounting per token also avoids the stale-handler race where
// an effect sees the new token with the previous instance's ready/open.
function PlaidLinkAutoLauncher({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  onSuccess: (publicToken: string, metadata: any) => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (publicToken, metadata) => onSuccess(publicToken, metadata),
    onExit: () => onExit(),
  });

  const openedRef = useRef(false);
  useEffect(() => {
    if (ready && !openedRef.current) {
      openedRef.current = true;
      open();
    }
  }, [ready, open]);

  return null;
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
      setLinkToken(null);
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

  const handlePlaidExit = useCallback(() => {
    // Clear the token so the launcher unmounts; the next "Connect with Plaid"
    // click mints a fresh token and a fresh launcher.
    setLinkToken(null);
  }, []);

  const steps = [
    { id: "connect", title: "Connect", subtitle: "Link your bank" },
    { id: "source", title: "Source", subtitle: "Choose checking" },
    { id: "allocation", title: "Goal", subtitle: "Set destination" },
    { id: "target", title: "Target", subtitle: "Select debt" },
    { id: "confirm", title: "Confirm", subtitle: "Review setup" },
  ];

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
    let cryptoEnabled = false;
    let cryptoPercentage = "0.00";
    let targetDebt: string | null = selectedTargetDebt || null;

    if (allocationMode === 'bitcoin') {
      cryptoEnabled = true;
      cryptoPercentage = "100.00";
      targetDebt = null;
    } else if (allocationMode === 'both') {
      cryptoEnabled = true;
      cryptoPercentage = (100 - debtPercentage).toFixed(2);
    }

    if (!selectedSourceAccount) {
      toast({ title: "Missing Source", description: "Please select a bank account.", variant: "destructive" });
      return;
    }

    if ((allocationMode === 'debt' || allocationMode === 'both') && !targetDebt) {
      toast({ title: "Missing Target", description: "Please select a debt account.", variant: "destructive" });
      return;
    }

    saveSettingsMutation.mutate({
      sourceAccountId: selectedSourceAccount,
      targetDebtId: targetDebt,
      cryptoEnabled,
      cryptoPercentage,
    });
  };

  const handleNextWithLogic = () => {
    if (currentStep === 2 && allocationMode === 'bitcoin') {
      setCurrentStep(4);
    } else {
      handleNext();
    }
  };

  const handleBackWithLogic = () => {
    if (currentStep === 4 && allocationMode === 'bitcoin') {
      setCurrentStep(2);
    } else {
      handleBack();
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

  const selectedAccount = bankAccounts.find((a) => a.id === selectedSourceAccount);
  const selectedDebt = debts.find((d) => d.id === selectedTargetDebt);
  const checkingAccounts = bankAccounts.filter((a) => 
    a.accountType?.toLowerCase() === "checking" || a.accountType?.toLowerCase() === "depository"
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-8 py-4 animate-fade-in">
            <BetaModeBanner variant="full" showCompliance />
            <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-dime-purple/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Building2 className="w-12 h-12 text-dime-purple" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Connect Your Bank</h3>
              <p className="text-slate-600 text-lg max-w-sm mx-auto">
                Securely link your primary checking account to begin automating your round-ups.
              </p>
            </div>

            {bankAccounts.length > 0 ? (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Bank Connected!</p>
                    <p className="text-sm font-medium text-slate-600">
                      You have {bankAccounts.length} account(s) linked. Ready for the next step.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5 max-w-sm mx-auto pt-4">
                <Button
                  onClick={createLinkToken}
                  disabled={isLoading}
                  className="w-full bg-dime-purple hover:bg-dime-purple/90 text-white font-bold h-14 text-lg shadow-sm press-scale rounded-xl"
                  data-testid="button-connect-bank"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="w-5 h-5 mr-2" />
                  )}
                  Connect with Plaid
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" /> 256-bit encryption • Read-only
                </div>
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-6 py-4 animate-fade-in">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Select Source Account</h3>
              <p className="text-slate-600 mt-2 font-medium">Which checking account should we monitor for round-ups?</p>
            </div>

            {accountsLoading ? (
              <div className="flex justify-center py-12">
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
                    className={`relative flex items-center gap-4 p-5 rounded-xl border-2 transition-all cursor-pointer shadow-sm ${
                      selectedSourceAccount === account.id
                        ? "border-dime-purple bg-dime-purple/5"
                        : "border-slate-100 bg-white hover:border-slate-200"
                    }`}
                    onClick={() => setSelectedSourceAccount(account.id)}
                    data-testid={`account-option-${account.id}`}
                  >
                    <RadioGroupItem value={account.id} id={account.id} className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor={account.id} className="cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-900 text-lg">{account.institutionName}</p>
                            <p className="font-medium text-slate-500">{account.accountName}</p>
                          </div>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold tabular-nums">
                            •••• {account.mask}
                          </Badge>
                        </div>
                      </Label>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            ) : bankAccounts.length > 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-slate-600 font-medium">No checking accounts found.</p>
                <Button onClick={createLinkToken} variant="outline" className="mt-4 bg-white shadow-sm font-semibold text-slate-700" data-testid="button-add-account">
                  Connect Another Account
                </Button>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 font-medium">
                <p>No accounts connected. Please go back.</p>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-8 py-4 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Set Your Goal</h2>
              <p className="text-slate-600 mt-2 font-medium">Where should your round-up money go?</p>
            </div>

            <div className="grid grid-cols-3 gap-3 md:gap-6">
              <button
                data-testid="option-debt"
                onClick={() => setAllocationMode('debt')}
                className={`flex flex-col items-center justify-center p-4 md:p-6 rounded-2xl border-2 transition-all press-scale ${
                  allocationMode === 'debt'
                    ? 'border-dime-purple bg-dime-purple shadow-md shadow-dime-purple/20'
                    : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${allocationMode === 'debt' ? 'bg-white/20' : 'bg-slate-100'}`}>
                  <Banknote className={`w-6 h-6 ${allocationMode === 'debt' ? 'text-white' : 'text-slate-600'}`} />
                </div>
                <span className={`text-sm md:text-base font-bold leading-tight ${allocationMode === 'debt' ? 'text-white' : 'text-slate-900'}`}>Pay Off<br/>Debt</span>
              </button>

              <button
                data-testid="option-bitcoin"
                onClick={() => setAllocationMode('bitcoin')}
                className={`flex flex-col items-center justify-center p-4 md:p-6 rounded-2xl border-2 transition-all press-scale ${
                  allocationMode === 'bitcoin'
                    ? 'border-[#F7931A] bg-[#F7931A] shadow-md shadow-[#F7931A]/20'
                    : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${allocationMode === 'bitcoin' ? 'bg-white/20' : 'bg-slate-100'}`}>
                  <Bitcoin className={`w-6 h-6 ${allocationMode === 'bitcoin' ? 'text-white' : 'text-slate-600'}`} />
                </div>
                <span className={`text-sm md:text-base font-bold leading-tight ${allocationMode === 'bitcoin' ? 'text-white' : 'text-slate-900'}`}>Buy<br/>Bitcoin</span>
              </button>

              <button
                data-testid="option-both"
                onClick={() => setAllocationMode('both')}
                className={`flex flex-col items-center justify-center p-4 md:p-6 rounded-2xl border-2 transition-all press-scale ${
                  allocationMode === 'both'
                    ? 'border-emerald-500 bg-emerald-500 shadow-md shadow-emerald-500/20'
                    : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${allocationMode === 'both' ? 'bg-white/20' : 'bg-slate-100'}`}>
                  <Percent className={`w-6 h-6 ${allocationMode === 'both' ? 'text-white' : 'text-slate-600'}`} />
                </div>
                <span className={`text-sm md:text-base font-bold leading-tight ${allocationMode === 'both' ? 'text-white' : 'text-slate-900'}`}>Split<br/>Both</span>
              </button>
            </div>

            {allocationMode === 'both' && (
              <div className="mt-8 bg-slate-50 border border-slate-100 rounded-2xl p-6 animate-fade-in-up">
                <h3 className="text-lg font-bold text-slate-900 mb-6 text-center">Set Your Allocation</h3>
                
                <div className="flex justify-between font-bold text-lg mb-4">
                  <span className="text-dime-purple">{debtPercentage}% Debt</span>
                  <span className="text-[#F7931A]">{100 - debtPercentage}% BTC</span>
                </div>

                <Slider
                  value={[debtPercentage]}
                  onValueChange={(value) => setDebtPercentage(value[0])}
                  min={1} max={99} step={1}
                  className="w-full mb-6"
                  data-testid="slider-percentage"
                />

                <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                  <p className="text-sm font-medium text-slate-600 text-center">
                    For every $1.00 collected:<br/>
                    <span className="font-bold text-dime-purple">${(debtPercentage / 100).toFixed(2)}</span> to debt • 
                    <span className="font-bold text-[#F7931A]"> ${((100 - debtPercentage) / 100).toFixed(2)}</span> to Bitcoin
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 py-4 animate-fade-in">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Select Target Debt</h3>
              <p className="text-slate-600 mt-2 font-medium">Which balance do you want to attack first?</p>
            </div>

            {debtsLoading ? (
              <div className="flex justify-center py-12">
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
                    className={`relative flex items-center gap-4 p-5 rounded-xl border-2 transition-all cursor-pointer shadow-sm ${
                      selectedTargetDebt === debt.id
                        ? "border-dime-purple bg-dime-purple/5"
                        : "border-slate-100 bg-white hover:border-slate-200"
                    }`}
                    onClick={() => setSelectedTargetDebt(debt.id)}
                    data-testid={`debt-option-${debt.id}`}
                  >
                    <RadioGroupItem value={debt.id} id={debt.id} className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor={debt.id} className="cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-900 text-lg">{debt.name}</p>
                            <p className="font-medium text-slate-500 text-sm mt-0.5">
                              {debt.interestRate}% APR • Min {formatCurrency(debt.minimumPayment)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-900 text-xl tabular-nums">
                              {formatCurrency(debt.currentBalance)}
                            </p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-slate-600 font-medium">No debts found. You can add them later.</p>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 py-4 animate-fade-in">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Review & Confirm</h3>
              <p className="text-slate-600 mt-2 font-medium">Make sure everything looks correct</p>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Pulling Round-ups From</div>
                {selectedAccount ? (
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-lg">{selectedAccount.institutionName}</span>
                    <span className="font-semibold text-slate-500 tabular-nums">•••• {selectedAccount.mask}</span>
                  </div>
                ) : (
                  <p className="text-slate-500">None</p>
                )}
              </div>

              <div className="flex justify-center py-2">
                <ArrowRight className="w-6 h-6 text-slate-300" />
              </div>

              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Sending To</div>
                
                {allocationMode === 'debt' && selectedDebt && (
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-lg">{selectedDebt.name}</span>
                    <Badge className="bg-dime-purple font-bold">100%</Badge>
                  </div>
                )}
                
                {allocationMode === 'bitcoin' && (
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-lg">Bitcoin Wallet</span>
                    <Badge className="bg-[#F7931A] font-bold">100%</Badge>
                  </div>
                )}

                {allocationMode === 'both' && (
                  <div className="space-y-3">
                    {selectedDebt && (
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{selectedDebt.name}</span>
                        <Badge className="bg-dime-purple font-bold">{debtPercentage}%</Badge>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Bitcoin Wallet</span>
                      <Badge className="bg-[#F7931A] font-bold">{100 - debtPercentage}%</Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      {linkToken && (
        <PlaidLinkAutoLauncher
          key={linkToken}
          token={linkToken}
          onSuccess={handlePlaidSuccess}
          onExit={handlePlaidExit}
        />
      )}
    <Card className="max-w-2xl mx-auto shadow-card border-0 ring-1 ring-slate-100 bg-white">
      <CardHeader className="border-b border-slate-50 pb-6">
        <div className="flex justify-between mb-2 px-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{steps[currentStep].title}</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-dime-purple transition-all duration-500 ease-out"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      
      <CardContent className="p-6 md:p-8">
        {renderStepContent()}

        <div className="flex gap-3 pt-8 mt-4 border-t border-slate-50">
          {currentStep > 0 ? (
            <Button variant="outline" onClick={handleBackWithLogic} className="flex-1 bg-white font-semibold text-slate-700 shadow-sm" data-testid="button-back">
              Back
            </Button>
          ) : (
            onSkip && (
              <Button variant="outline" onClick={onSkip} className="flex-1 bg-white font-semibold text-slate-700 shadow-sm" data-testid="button-skip">
                Skip for now
              </Button>
            )
          )}

          {currentStep === 0 && bankAccounts.length > 0 && (
            <Button onClick={handleNext} disabled={!canProceed()} className="flex-1 bg-dime-purple hover:bg-dime-purple/90 text-white font-bold shadow-sm press-scale" data-testid="button-next">
              Continue
            </Button>
          )}

          {currentStep > 0 && currentStep < steps.length - 1 && (
            <Button onClick={handleNextWithLogic} disabled={!canProceed()} className="flex-1 bg-dime-purple hover:bg-dime-purple/90 text-white font-bold shadow-sm press-scale" data-testid="button-next">
              Continue
            </Button>
          )}

          {currentStep === steps.length - 1 && (
            <Button 
              onClick={handleComplete} 
              disabled={!canProceed() || saveSettingsMutation.isPending}
              className="flex-1 bg-dime-purple hover:bg-dime-purple/90 text-white font-bold shadow-sm press-scale"
              data-testid="button-complete-setup"
            >
              {saveSettingsMutation.isPending ? "Saving..." : "Complete Setup"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
    </>
  );
}