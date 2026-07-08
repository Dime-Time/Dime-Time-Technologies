import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  Coins, 
  Gift, 
  Lock,
  BarChart3,
  Wallet,
  Award,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  LineChart
} from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import { apiRequest } from "@/lib/queryClient";
import { EmptyState } from "@/components/EmptyState";

interface TokenInfo {
  symbol: string;
  name: string;
  currentPrice: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  totalSupply: string;
}

interface TokenBalance {
  balance: string;
  stakedAmount: string;
  totalEarned: string;
}

interface TokenReward {
  id: string;
  action: string;
  amount: string;
  transactionHash: string;
  createdAt: string;
}

export default function DimeToken() {
  const [stakingAmount, setStakingAmount] = useState("");
  const [stakingDuration, setStakingDuration] = useState("90");
  const queryClient = useQueryClient();

  // Fetch token information
  const { data: tokenInfo, isLoading: tokenLoading } = useQuery<TokenInfo>({
    queryKey: ['/api/dime-token/info'],
  });

  // Fetch user's token balance
  const { data: tokenBalance, isLoading: balanceLoading } = useQuery<TokenBalance>({
    queryKey: ['/api/dime-token/balance'],
  });

  // Fetch token rewards history
  const { data: rewards, isLoading: rewardsLoading } = useQuery<TokenReward[]>({
    queryKey: ['/api/dime-token/rewards'],
  });

  // Stake tokens mutation
  const stakeMutation = useMutation({
    mutationFn: async (data: { amount: string; duration: number }) => {
      return apiRequest('POST', '/api/dime-token/stake', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dime-token/balance'] });
      setStakingAmount("");
    },
  });

  const handleStake = () => {
    if (!stakingAmount || parseFloat(stakingAmount) <= 0) return;
    
    stakeMutation.mutate({
      amount: stakingAmount,
      duration: parseInt(stakingDuration)
    });
  };

  if (tokenLoading || balanceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
          <div className="text-slate-500 font-medium">Loading Token Info...</div>
        </div>
      </div>
    );
  }

  const priceChangeColor = (tokenInfo?.priceChange24h ?? 0) >= 0 ? 'text-green-600' : 'text-red-600';
  const priceChangeIcon = (tokenInfo?.priceChange24h ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight;
  const PriceIcon = priceChangeIcon;

  return (
    <main className="min-h-[100dvh] pb-20 animate-fade-in-up">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 bg-dime-purple/10 rounded-xl flex items-center justify-center">
                <Coins className="w-6 h-6 text-dime-purple" />
              </div>
              Dime Time Token (DTT)
            </h1>
            <p className="text-slate-600 mt-2 ml-1 text-lg">Your native cryptocurrency that rewards financial progress</p>
          </div>
          <Badge variant="secondary" className="bg-dime-purple/10 text-dime-purple border-dime-purple/20 px-3 py-1 text-sm rounded-full">
            Native Token
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Token Overview */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Token Price Card */}
            <Card className="shadow-card border-slate-200">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                  <LineChart className="w-5 h-5 text-slate-500" />
                  Token Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm font-semibold text-slate-500 mb-1">Current Price</p>
                    <div className="flex items-end gap-2">
                      <p className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                        ${Number(tokenInfo?.currentPrice ?? 0).toFixed(4)}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 mt-1 font-bold ${priceChangeColor}`}>
                      <PriceIcon className="w-4 h-4" />
                      <span className="text-sm tabular-nums">
                        {Math.abs(tokenInfo?.priceChange24h ?? 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-semibold text-slate-500 mb-1">Market Cap</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                      {formatCurrency(tokenInfo?.marketCap ?? 0)}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-semibold text-slate-500 mb-1">24h Volume</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                      {formatCurrency(tokenInfo?.volume24h ?? 0)}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-semibold text-slate-500 mb-1">Total Supply</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                      {parseInt(tokenInfo?.totalSupply ?? '0').toLocaleString()}
                    </p>
                    <p className="text-xs font-semibold text-slate-400 mt-1">DTT Tokens</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Token Rewards Tabs */}
            <Tabs defaultValue="earn" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-slate-100/50 p-1 border">
                <TabsTrigger value="earn" className="text-base py-2.5 data-[state=active]:shadow-sm">Earn DTT</TabsTrigger>
                <TabsTrigger value="stake" className="text-base py-2.5 data-[state=active]:shadow-sm">Stake DTT</TabsTrigger>
                <TabsTrigger value="history" className="text-base py-2.5 data-[state=active]:shadow-sm">History</TabsTrigger>
              </TabsList>
              
              <TabsContent value="earn" className="mt-6 outline-none animate-fade-in">
                <Card className="shadow-card border-slate-200">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                      <Gift className="w-5 h-5 text-green-600" />
                      Earn DTT Rewards
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-5 border border-slate-100 bg-slate-50 rounded-xl hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                            <Coins className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">Round-up Rewards</h4>
                            <p className="text-sm font-semibold text-blue-600 tabular-nums">0.1 DTT per round-up</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-slate-600">Earn tokens every time you round up spare change from your purchases.</p>
                      </div>

                      <div className="p-5 border border-slate-100 bg-slate-50 rounded-xl hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">Debt Payment</h4>
                            <p className="text-sm font-semibold text-green-600 tabular-nums">0.05 DTT per $1 paid</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-slate-600">Get rewarded for every debt payment made through the Dime Time app.</p>
                      </div>

                      <div className="p-5 border border-slate-100 bg-slate-50 rounded-xl hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                            <Award className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">Milestone Bonus</h4>
                            <p className="text-sm font-semibold text-purple-600 tabular-nums">50 DTT per milestone</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-slate-600">Bonus tokens for reaching debt reduction goals and sticking to your plan.</p>
                      </div>

                      <div className="p-5 border border-slate-100 bg-slate-50 rounded-xl hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                            <Calendar className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">Daily Login</h4>
                            <p className="text-sm font-semibold text-orange-600 tabular-nums">1 DTT per day</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-slate-600">Consistent engagement rewards for checking your financial progress.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="stake" className="mt-6 outline-none animate-fade-in">
                <Card className="shadow-card border-slate-200">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                      <Lock className="w-5 h-5 text-dime-purple" />
                      Stake DTT Tokens
                    </CardTitle>
                    <CardDescription className="text-base text-slate-600 font-medium">
                      Lock your tokens to earn high-yield interest over time.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-5 border border-slate-100 bg-white rounded-xl text-center shadow-sm">
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">30 DAYS</p>
                        <p className="text-2xl font-black text-slate-900 tabular-nums">12%</p>
                        <p className="text-xs font-semibold text-green-600 mt-1">APY</p>
                      </div>
                      <div className="p-5 border border-dime-purple/20 bg-dime-purple/5 rounded-xl text-center shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-1 bg-dime-purple"></div>
                        <p className="text-sm font-bold text-dime-purple uppercase tracking-wider mb-2">90 DAYS</p>
                        <p className="text-2xl font-black text-slate-900 tabular-nums">15%</p>
                        <p className="text-xs font-semibold text-green-600 mt-1">APY</p>
                      </div>
                      <div className="p-5 border border-slate-100 bg-white rounded-xl text-center shadow-sm">
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">365 DAYS</p>
                        <p className="text-2xl font-black text-slate-900 tabular-nums">20%</p>
                        <p className="text-xs font-semibold text-green-600 mt-1">APY</p>
                      </div>
                    </div>

                    <div className="space-y-6 p-6 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <Label htmlFor="stake-amount" className="text-base font-bold text-slate-900">Amount to Stake</Label>
                            <span className="text-xs font-bold text-dime-purple bg-dime-purple/10 px-2 py-1 rounded">
                              Max: {tokenBalance?.balance ?? '0'}
                            </span>
                          </div>
                          <Input
                            id="stake-amount"
                            type="number"
                            placeholder="0.00"
                            value={stakingAmount}
                            onChange={(e) => setStakingAmount(e.target.value)}
                            data-testid="input-stake-amount"
                            className="h-12 text-lg tabular-nums bg-white"
                          />
                        </div>

                        <div className="space-y-3">
                          <Label className="text-base font-bold text-slate-900">Staking Duration</Label>
                          <Select value={stakingDuration} onValueChange={setStakingDuration}>
                            <SelectTrigger data-testid="select-stake-duration" className="h-12 text-base bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30" className="py-2.5">30 Days (12% APY)</SelectItem>
                              <SelectItem value="90" className="py-2.5">90 Days (15% APY)</SelectItem>
                              <SelectItem value="365" className="py-2.5">365 Days (20% APY)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button 
                        onClick={handleStake}
                        disabled={!stakingAmount || stakeMutation.isPending || parseFloat(stakingAmount) <= 0}
                        className="w-full h-14 text-lg bg-dime-purple hover:bg-dime-purple/90 text-white press-scale"
                        data-testid="button-stake-tokens"
                      >
                        {stakeMutation.isPending ? "Staking..." : "Stake Tokens Securely"}
                      </Button>
                      <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
                        <ShieldCheck className="w-4 h-4" />
                        Smart contract secured. No early withdrawals.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="mt-6 outline-none animate-fade-in">
                <Card className="shadow-card border-slate-200">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                      <BarChart3 className="w-5 h-5 text-slate-500" />
                      Token Rewards History
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {rewardsLoading ? (
                      <div className="p-8 text-center text-slate-500 font-medium animate-pulse">Loading history...</div>
                    ) : rewards && rewards.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {rewards.map((reward) => (
                          <div key={reward.id} className="flex items-center justify-between p-4 sm:p-6 hover:bg-slate-50/50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center shrink-0">
                                <Gift className="w-5 h-5 text-green-600" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-base capitalize">
                                  {reward.action.replace('_', ' ')}
                                </p>
                                <p className="text-sm font-medium text-slate-500 tabular-nums">
                                  {new Date(reward.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-green-600 text-lg tabular-nums">+{reward.amount} DTT</p>
                              <p className="text-xs font-semibold text-slate-400 tabular-nums">
                                ≈ ${(parseFloat(reward.amount) * (tokenInfo?.currentPrice ?? 0)).toFixed(4)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8">
                        <EmptyState 
                          icon={Gift}
                          title="No rewards earned yet"
                          description="Start paying down debt or collecting round-ups to earn your first DTT tokens!"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Token Balance Sidebar */}
          <div className="space-y-6">
            
            {/* Balance Card */}
            <Card className="shadow-card border-slate-200 overflow-hidden relative">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-dime-purple"></div>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <Wallet className="w-5 h-5 text-dime-purple" />
                  Your DTT Balance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                <div className="text-center">
                  <p className="text-4xl sm:text-5xl font-black text-slate-900 mb-2 tabular-nums tracking-tight">
                    {tokenBalance?.balance ?? '0'}
                  </p>
                  <p className="text-sm font-bold text-dime-purple uppercase tracking-widest">Available DTT</p>
                  <p className="text-sm font-semibold text-slate-500 mt-3 tabular-nums bg-slate-100 inline-block px-3 py-1 rounded-full">
                    ≈ ${((parseFloat(tokenBalance?.balance ?? '0')) * (tokenInfo?.currentPrice ?? 0)).toFixed(2)} USD
                  </p>
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-400" />
                      Staked
                    </span>
                    <span className="font-bold text-slate-900 tabular-nums">{tokenBalance?.stakedAmount ?? '0'} DTT</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-semibold text-green-700 flex items-center gap-2">
                      <Gift className="w-4 h-4 text-green-600" />
                      Total Earned
                    </span>
                    <span className="font-bold text-green-700 tabular-nums">{tokenBalance?.totalEarned ?? '0'} DTT</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trading Pairs */}
            <Card className="shadow-card border-slate-200">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-slate-900">Market Trading Pairs</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  <div className="flex justify-between items-center p-4 sm:p-5">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600">USD</span>
                      <span className="font-bold text-slate-900">DTT / USD</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 tabular-nums">${Number(tokenInfo?.currentPrice ?? 0).toFixed(4)}</p>
                      <p className={`text-xs font-bold ${priceChangeColor} tabular-nums mt-0.5`}>
                        {(tokenInfo?.priceChange24h ?? 0) >= 0 ? '+' : ''}
                        {Number(tokenInfo?.priceChange24h ?? 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 sm:p-5">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center font-bold text-xs text-orange-600">₿</span>
                      <span className="font-bold text-slate-900">DTT / BTC</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 tabular-nums">{((tokenInfo?.currentPrice ?? 0) / 95000).toFixed(8)}</p>
                      <p className={`text-xs font-bold ${priceChangeColor} tabular-nums mt-0.5`}>
                        {(tokenInfo?.priceChange24h ?? 0) >= 0 ? '+' : ''}
                        {Number(tokenInfo?.priceChange24h ?? 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-4 sm:p-5">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-xs text-blue-600">Ξ</span>
                      <span className="font-bold text-slate-900">DTT / ETH</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 tabular-nums">{((tokenInfo?.currentPrice ?? 0) / 3500).toFixed(6)}</p>
                      <p className={`text-xs font-bold ${priceChangeColor} tabular-nums mt-0.5`}>
                        {(tokenInfo?.priceChange24h ?? 0) >= 0 ? '+' : ''}
                        {Number(tokenInfo?.priceChange24h ?? 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </main>
  );
}