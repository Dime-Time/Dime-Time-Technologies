import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { PlaidLink } from "@/components/PlaidLink";
import { StripeConnectButton } from "@/components/StripeConnectButton";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, DollarSign, CreditCard, Building2, ArrowUpRight, ArrowDownRight, ShieldCheck, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Banking() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bankAccounts = [], isLoading: accountsLoading } = useQuery<any[]>({
    queryKey: ['/api/plaid/accounts'],
  });

  const { data: balances = [], isLoading: balancesLoading } = useQuery<any[]>({
    queryKey: ['/api/plaid/balances'],
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<any[]>({
    queryKey: ['/api/plaid/transactions'],
  });

  const { data: mercuryStatus } = useQuery<any>({
    queryKey: ['/api/mercury/status'],
    retry: false,
  });

  const { data: mercuryTxData } = useQuery<any>({
    queryKey: ['/api/mercury/transactions'],
    retry: false,
    enabled: mercuryStatus?.configured === true,
  });

  const refreshDataMutation = useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/plaid/accounts'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/plaid/balances'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/plaid/transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/mercury/status'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/mercury/transactions'] });
    },
    onSuccess: () => {
      toast({
        title: "Data Refreshed",
        description: "Your banking data has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh banking data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePlaidSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/plaid/accounts'] });
    queryClient.invalidateQueries({ queryKey: ['/api/plaid/balances'] });
    queryClient.invalidateQueries({ queryKey: ['/api/plaid/transactions'] });
  };

  const isLoading = accountsLoading || balancesLoading || transactionsLoading;
  const mercuryTransactions: any[] = mercuryTxData?.transactions || [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Banking</h1>
          <p className="text-slate-600 mt-1">Connect and manage your bank accounts</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => refreshDataMutation.mutate()}
            disabled={refreshDataMutation.isPending}
            className="flex items-center gap-2 press-scale bg-white shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshDataMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {bankAccounts?.length > 0 && <PlaidLink onSuccess={handlePlaidSuccess} />}
          <StripeConnectButton />
        </div>
      </div>

      {/* Dime Time LLC — Mercury Business Account */}
      {mercuryStatus?.configured && (
        <Card className="border-dime-purple/20 bg-gradient-to-br from-white to-dime-purple/[0.02] shadow-card animate-fade-in-up">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-dime-purple/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-dime-purple" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900">Dime Time LLC</CardTitle>
                  <CardDescription className="text-slate-500 font-medium mt-0.5">
                    Mercury Checking •••• {mercuryStatus.accountNumber?.slice(-4) || '----'}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="bg-dime-purple/10 text-dime-purple font-semibold hover:bg-dime-purple/20">Business</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Available Balance</p>
                <p className="text-3xl font-bold text-dime-purple tabular-nums">{mercuryStatus.formattedBalance}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Current Balance</p>
                <p className="text-3xl font-bold text-slate-900 tabular-nums">${mercuryStatus.currentBalance?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-2 rounded-md">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              Round-up collections and debt payments flow through this account securely
            </div>

            {mercuryTransactions.length > 0 && (
              <div className="mt-8 space-y-3">
                <p className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Recent Activity</p>
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                  {mercuryTransactions.slice(0, 5).map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.amount >= 0 ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                          {tx.amount >= 0 ? (
                            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-slate-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{tx.counterpartyName || 'Transfer'}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            <StatusBadge status={tx.status} compact />
                          </div>
                        </div>
                      </div>
                      <span className={`font-bold tabular-nums ${tx.amount >= 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Zero State Onboarding */}
      {!bankAccounts?.length && !isLoading && (
        <Card className="shadow-card-hover border-0 ring-1 ring-slate-200 animate-fade-in-up overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Building2 className="w-64 h-64 text-dime-purple transform rotate-12 translate-x-1/4 -translate-y-1/4" />
          </div>
          <CardContent className="p-8 md:p-12 flex flex-col items-center text-center relative z-10">
            <div className="w-20 h-20 bg-gradient-to-br from-dime-purple/20 to-dime-lilac/20 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <Building2 className="w-10 h-10 text-dime-purple" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Connect Your First Bank</h2>
            <p className="text-slate-600 max-w-md mb-10 text-lg leading-relaxed">
              Link your checking account securely to start rounding up your spare change and accelerating your debt payoff.
            </p>
            
            <div className="flex flex-col gap-5 text-left max-w-md w-full mb-10">
              <div className="flex items-center gap-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 text-dime-purple">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Automatic Round-Ups</div>
                  <div className="text-sm text-slate-500 mt-0.5">Spare change from purchases is saved</div>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 text-dime-purple">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Faster Debt Payoff</div>
                  <div className="text-sm text-slate-500 mt-0.5">Your savings automatically pay down your debts</div>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 text-dime-purple">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Bank-Level Security</div>
                  <div className="text-sm text-slate-500 mt-0.5">256-bit encryption, secured by Plaid</div>
                </div>
              </div>
            </div>
            
            <div className="press-scale">
              <PlaidLink onSuccess={handlePlaidSuccess} />
            </div>
            <p className="text-xs text-slate-400 mt-4 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Secured by Plaid
            </p>
          </CardContent>
        </Card>
      )}

      {/* Connected Personal Accounts */}
      {bankAccounts?.length > 0 && (
        <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-lg font-bold text-slate-900 mb-4 tracking-tight">Your Connected Accounts</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bankAccounts.map((account: any) => {
              const accountBalance = balances?.find((bal: any) => bal.account_id === account.accountId);
              return (
                <Card key={account.id} data-testid={`account-card-${account.id}`} className="shadow-card hover:shadow-card-hover transition-shadow duration-200">
                  <CardHeader className="pb-3 border-b border-slate-50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold text-slate-900 truncate pr-2">{account.accountName}</CardTitle>
                      <Badge variant={account.isActive ? "default" : "secondary"} className={account.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 shadow-none border-0" : ""}>
                        {account.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1.5 text-slate-500 mt-1 font-medium">
                      <CreditCard className="w-3.5 h-3.5" />
                      {account.accountType} •••• {account.mask}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Current Balance</span>
                        <span className="text-2xl font-bold text-slate-900 tabular-nums block" data-testid={`balance-${account.id}`}>
                          ${accountBalance?.balances?.current?.toFixed(2) || 'N/A'}
                        </span>
                      </div>
                      {accountBalance?.balances?.available && (
                        <div className="flex justify-between items-center bg-slate-50 rounded-md p-2 px-3">
                          <span className="text-xs font-medium text-slate-600">Available</span>
                          <span className="text-sm font-bold text-slate-900 tabular-nums">
                            ${accountBalance.balances.available.toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="pt-2 flex justify-end">
                        <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded">
                          {account.institutionName}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Personal Transactions */}
      {transactions?.length > 0 && (
        <Card className="shadow-card animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">Recent Transactions</CardTitle>
                <CardDescription className="text-slate-500 font-medium">
                  Latest activity from your connected accounts
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100" data-testid="transactions-list">
              {transactions.slice(0, 10).map((transaction: any, index: number) => (
                <div
                  key={transaction.transaction_id || index}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  data-testid={`transaction-${index}`}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="font-semibold text-slate-900 text-sm truncate">
                      {transaction.merchant_name || transaction.name}
                    </div>
                    <div className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-2">
                      <span>{new Date(transaction.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <span>•••• {transaction.account_id?.slice(-4)}</span>
                    </div>
                    {transaction.category && (
                      <div className="flex gap-1.5 mt-2">
                        {transaction.category.slice(0, 2).map((cat: string, i: number) => (
                          <span key={i} className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-bold tabular-nums text-base ${transaction.amount > 0 ? 'text-slate-900' : 'text-emerald-600'}`}>
                      {transaction.amount > 0 ? '-' : '+'}${Math.abs(transaction.amount).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
            <RefreshCw className="w-6 h-6 animate-spin text-dime-purple" />
          </div>
          <span className="text-slate-500 font-medium">Syncing secure data...</span>
        </div>
      )}
    </div>
  );
}