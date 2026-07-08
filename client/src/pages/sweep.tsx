import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Building2, 
  ArrowRight,
  Coins,
  Clock,
  Lock,
  Landmark
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function SweepAccountPage() {
  const { toast } = useToast();
  
  const { data: sweepSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ["/api/sweep/summary"],
    retry: false,
  });

  const { data: deposits = [], isLoading: depositsLoading } = useQuery({
    queryKey: ["/api/sweep/deposits"],
    retry: false,
  });

  const { data: dispersals = [], isLoading: dispersalsLoading } = useQuery({
    queryKey: ["/api/sweep/dispersals"],
    retry: false,
  });

  const triggerDispersal = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/sweep/disperse", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to trigger dispersal");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Dispersal Triggered",
        description: "Weekly debt payments have been processed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sweep/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sweep/dispersals"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process weekly dispersals",
        variant: "destructive",
      });
    },
  });

  if (summaryLoading || depositsLoading || dispersalsLoading) {
    return (
      <main className="min-h-[100dvh] pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="flex flex-col items-center gap-4 animate-pulse">
              <div className="w-16 h-16 bg-slate-200 rounded-full"></div>
              <div className="text-slate-500 font-bold">Loading Vault Data...</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!sweepSummary) {
    return (
      <main className="min-h-[100dvh] pb-20 animate-fade-in-up">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Card className="shadow-card border-slate-200 overflow-hidden relative">
            <div className="absolute top-0 inset-x-0 h-2 bg-dime-purple"></div>
            <CardContent className="p-10 sm:p-16 text-center">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100">
                <Landmark className="w-12 h-12 text-slate-400" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-4">
                JP Morgan Chase Sweep Account
              </h2>
              <p className="text-lg font-medium text-slate-600 mb-10 max-w-lg mx-auto leading-relaxed">
                Set up an FDIC-insured sweep account to safely hold your round-ups, earn interest, and automatically fund your debt payments.
              </p>
              <Button className="h-14 px-8 text-lg font-bold bg-dime-purple hover:bg-dime-purple/90 text-white press-scale shadow-sm">
                Open Sweep Account Securely
              </Button>
              <div className="flex items-center justify-center gap-2 mt-6 text-sm font-semibold text-slate-500">
                <Lock className="w-4 h-4" />
                256-bit Bank-Level Encryption
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const nextFridayDate = new Date(sweepSummary.nextDispersalDate);
  const daysUntilDispersal = Math.ceil((nextFridayDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <main className="min-h-[100dvh] pb-20 animate-fade-in-up">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-dime-purple/10 rounded-xl flex items-center justify-center">
              <Landmark className="w-6 h-6 text-dime-purple" />
            </div>
            <h1 className="text-3xl font-black text-slate-900">
              JPMC Sweep Account
            </h1>
          </div>
          <p className="text-slate-600 font-medium text-lg ml-15 pl-14">
            Your round-ups earn interest safely before weekly dispersal.
          </p>
        </div>

        {/* Account Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <Card className="shadow-card border-slate-200">
            <CardContent className="p-5 sm:p-6 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-dime-purple/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-dime-purple" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-1">Current Vault Balance</p>
                <p className="text-3xl sm:text-4xl font-black text-slate-900 tabular-nums tracking-tight">
                  ${sweepSummary.currentBalance.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-slate-200">
            <CardContent className="p-5 sm:p-6 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-1">Interest Earned YTD</p>
                <p className="text-2xl sm:text-3xl font-black text-green-700 tabular-nums tracking-tight">
                  ${sweepSummary.interestEarned.toFixed(4)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-slate-200">
            <CardContent className="p-5 sm:p-6 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-1">Weekly Projection</p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                  ${sweepSummary.weeklyProjection.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-slate-200">
            <CardContent className="p-5 sm:p-6 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                </div>
                <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-none font-bold">
                  {nextFridayDate.toLocaleDateString(undefined, { weekday: 'short' })}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-1">Next Auto-Dispersal</p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                  In {Math.max(0, daysUntilDispersal)} {daysUntilDispersal === 1 ? 'day' : 'days'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Details & Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card className="shadow-card border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
              <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                <Building2 className="w-5 h-5 text-slate-500" />
                Account Details
              </CardTitle>
              <CardDescription className="text-base font-medium text-slate-600">
                FDIC-insured hold account at JP Morgan Chase
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                <div className="flex justify-between items-center p-5 sm:p-6">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Account Number</span>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-mono font-semibold text-slate-900">••••{sweepSummary.account.accountNumber.slice(-4)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-5 sm:p-6">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Routing Number</span>
                  <span className="text-lg font-mono font-semibold text-slate-900">{sweepSummary.account.routingNumber}</span>
                </div>
                <div className="flex justify-between items-center p-5 sm:p-6">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Interest Rate</span>
                  <span className="text-lg font-black text-green-700 tabular-nums bg-green-50 px-3 py-1 rounded-md">
                    {(parseFloat(sweepSummary.account.interestRate) * 100).toFixed(2)}% APY
                  </span>
                </div>
                <div className="flex justify-between items-center p-5 sm:p-6 bg-slate-50/50">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Status</span>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="font-bold text-green-700">Active</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
              <CardTitle className="text-xl text-slate-900">Dispersal Management</CardTitle>
              <CardDescription className="text-base font-medium text-slate-600">
                Control when your vaulted funds pay down debt
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div>
                <div className="flex justify-between items-end mb-3">
                  <span className="font-bold text-slate-900">Auto-Dispersal Progress</span>
                  <span className="font-bold text-dime-purple tabular-nums">{Math.max(0, 7 - daysUntilDispersal)}/7 Days</span>
                </div>
                <Progress 
                  value={Math.max(0, (7 - daysUntilDispersal) / 7 * 100)} 
                  className="h-3 bg-slate-100"
                />
                <p className="text-sm font-semibold text-slate-500 mt-3 text-center">
                  Funds automatically transfer to priority debt every Friday.
                </p>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <Button 
                  onClick={() => triggerDispersal.mutate()}
                  disabled={triggerDispersal.isPending || sweepSummary.currentBalance < 5}
                  className="w-full h-14 text-lg font-bold bg-slate-900 hover:bg-slate-800 text-white press-scale shadow-sm disabled:opacity-50"
                >
                  {triggerDispersal.isPending ? (
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 animate-spin text-slate-300" />
                      Processing Transfer...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-5 h-5 text-slate-300" />
                      Pay Debt Now (Early Dispersal)
                    </div>
                  )}
                </Button>
                <div className="text-sm font-semibold text-slate-500 text-center mt-4 flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4" />
                  {sweepSummary.currentBalance < 5 
                    ? "Requires $5.00 minimum vault balance." 
                    : `Will immediately transfer $${sweepSummary.currentBalance.toFixed(2)} to debt.`
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="shadow-card border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-xl text-slate-900">Recent Vault Deposits</CardTitle>
            <CardDescription className="text-base font-medium text-slate-600">
              Your collected round-ups moving into the sweep account.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {deposits.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                  <Coins className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-lg font-bold text-slate-900 mb-1">No vault deposits yet</p>
                <p className="font-medium text-slate-500">Make purchases with linked cards to start sweeping change.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {deposits.slice(0, 8).map((deposit: any) => (
                  <div key={deposit.id} className="flex items-center justify-between p-4 sm:p-6 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-dime-purple/10 rounded-full flex items-center justify-center shrink-0">
                        <Coins className="w-5 h-5 text-dime-purple" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-slate-900">
                          Round-up Sweep
                        </p>
                        <p className="text-sm font-semibold text-slate-500 tabular-nums mt-0.5">
                          {new Date(deposit.depositDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900 tabular-nums">
                        +${parseFloat(deposit.roundUpAmount).toFixed(2)}
                      </p>
                      <p className="text-xs font-bold text-green-600 tabular-nums mt-1 bg-green-50 px-2 py-0.5 rounded inline-block">
                        +${parseFloat(deposit.interestEarned).toFixed(4)} Yield
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}