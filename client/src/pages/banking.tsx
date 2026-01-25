import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlaidLink } from "@/components/PlaidLink";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, DollarSign, CreditCard, AlertCircle } from "lucide-react";
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

  const refreshDataMutation = useMutation({
    mutationFn: async () => {
      // Invalidate all Plaid-related queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['/api/plaid/accounts'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/plaid/balances'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/plaid/transactions'] });
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

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banking</h1>
          <p className="text-gray-600">Connect and manage your bank accounts</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refreshDataMutation.mutate()}
            disabled={refreshDataMutation.isPending}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshDataMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <PlaidLink onSuccess={handlePlaidSuccess} />
        </div>
      </div>

      {!bankAccounts?.length && !isLoading && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No bank accounts connected yet. Use the "Connect Bank Account" button to link your accounts securely through Plaid.
          </AlertDescription>
        </Alert>
      )}

      {/* Connected Accounts */}
      {bankAccounts?.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bankAccounts.map((account: any) => {
            const accountBalance = balances?.find((bal: any) => bal.account_id === account.accountId);
            
            return (
              <Card key={account.id} data-testid={`account-card-${account.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{account.accountName}</CardTitle>
                    <Badge variant={account.isActive ? "default" : "secondary"}>
                      {account.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    {account.accountType} • ****{account.mask}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Current Balance</span>
                      <span className="font-semibold" data-testid={`balance-${account.id}`}>
                        ${accountBalance?.balances?.current?.toFixed(2) || 'N/A'}
                      </span>
                    </div>
                    {accountBalance?.balances?.available && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Available</span>
                        <span className="text-sm">
                          ${accountBalance.balances.available.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="pt-2">
                      <Badge variant="outline" className="text-xs">
                        {account.institutionName}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recent Transactions */}
      {transactions?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Recent Transactions
            </CardTitle>
            <CardDescription>
              Latest transactions from your connected accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3" data-testid="transactions-list">
              {transactions.slice(0, 10).map((transaction: any, index: number) => (
                <div
                  key={transaction.transaction_id || index}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  data-testid={`transaction-${index}`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {transaction.merchant_name || transaction.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(transaction.date).toLocaleDateString()} • {transaction.account_id?.slice(-4)}
                    </div>
                    {transaction.category && (
                      <div className="flex gap-1 mt-1">
                        {transaction.category.slice(0, 2).map((cat: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${transaction.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
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
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading banking data...</span>
        </div>
      )}
    </div>
  );
}