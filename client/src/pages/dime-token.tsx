import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ArrowDownRight
} from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import { apiRequest } from "@/lib/queryClient";

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
    return <div className="p-6">Loading token information...</div>;
  }

  const priceChangeColor = (tokenInfo?.priceChange24h ?? 0) >= 0 ? 'text-green-600' : 'text-red-600';
  const priceChangeIcon = (tokenInfo?.priceChange24h ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight;
  const PriceIcon = priceChangeIcon;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dime Time Token (DTT)</h1>
          <p className="text-white/80">Your native cryptocurrency that rewards financial progress</p>
        </div>
        <Badge variant="secondary" className="bg-dime-purple/5 text-dime-purple border border-dime-purple/10">
          Native Token
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Token Overview */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Token Price Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-dime-purple" />
                Token Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-white/60 mb-1">Current Price</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-white">${Number(tokenInfo?.currentPrice ?? 0).toFixed(4)}</p>
                    <div className={`flex items-center gap-1 ${priceChangeColor}`}>
                      <PriceIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {Math.abs(tokenInfo?.priceChange24h ?? 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-white/60 mb-1">Market Cap</p>
                  <p className="text-xl font-semibold text-white">{formatCurrency(tokenInfo?.marketCap ?? 0)}</p>
                </div>
                
                <div>
                  <p className="text-sm text-white/60 mb-1">24h Volume</p>
                  <p className="text-xl font-semibold text-white">{formatCurrency(tokenInfo?.volume24h ?? 0)}</p>
                </div>
                
                <div>
                  <p className="text-sm text-white/60 mb-1">Total Supply</p>
                  <p className="text-xl font-semibold text-white">
                    {parseInt(tokenInfo?.totalSupply ?? '0').toLocaleString()} DTT
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Token Rewards Tabs */}
          <Tabs defaultValue="earn" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="earn">Earn DTT</TabsTrigger>
              <TabsTrigger value="stake">Stake DTT</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="earn" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-green-600" />
                    Earn DTT Rewards
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Coins className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">Round-up Rewards</h4>
                          <p className="text-sm text-white/60">0.1 DTT per round-up</p>
                        </div>
                      </div>
                      <p className="text-xs text-white/50">Earn tokens every time you round up spare change</p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">Debt Payment Rewards</h4>
                          <p className="text-sm text-white/60">0.05 DTT per $1 paid</p>
                        </div>
                      </div>
                      <p className="text-xs text-white/50">Get rewarded for every debt payment made</p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <Award className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">Milestone Rewards</h4>
                          <p className="text-sm text-white/60">50 DTT per milestone</p>
                        </div>
                      </div>
                      <p className="text-xs text-white/50">Bonus tokens for reaching debt reduction goals</p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-orange-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">Daily Login</h4>
                          <p className="text-sm text-white/60">1 DTT per day</p>
                        </div>
                      </div>
                      <p className="text-xs text-white/50">Consistent engagement rewards</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stake" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-dime-purple" />
                    Stake DTT Tokens
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg text-center">
                      <p className="text-sm text-slate-500">30 Days</p>
                      <p className="text-xl font-bold text-dime-purple">12% APY</p>
                    </div>
                    <div className="p-4 border rounded-lg text-center">
                      <p className="text-sm text-slate-500">90 Days</p>
                      <p className="text-xl font-bold text-dime-purple">15% APY</p>
                    </div>
                    <div className="p-4 border rounded-lg text-center">
                      <p className="text-sm text-slate-500">365 Days</p>
                      <p className="text-xl font-bold text-dime-purple">20% APY</p>
                    </div>
                  </div>

                  <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="stake-amount">Amount to Stake</Label>
                        <Input
                          id="stake-amount"
                          type="number"
                          placeholder="0.00"
                          value={stakingAmount}
                          onChange={(e) => setStakingAmount(e.target.value)}
                          data-testid="input-stake-amount"
                        />
                        <p className="text-xs text-slate-500">
                          Available: {tokenBalance?.balance ?? '0'} DTT
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Staking Duration</Label>
                        <Select value={stakingDuration} onValueChange={setStakingDuration}>
                          <SelectTrigger data-testid="select-stake-duration">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 Days (12% APY)</SelectItem>
                            <SelectItem value="90">90 Days (15% APY)</SelectItem>
                            <SelectItem value="365">365 Days (20% APY)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button 
                      onClick={handleStake}
                      disabled={!stakingAmount || stakeMutation.isPending}
                      className="w-full bg-dime-purple hover:bg-dime-purple/90"
                      data-testid="button-stake-tokens"
                    >
                      {stakeMutation.isPending ? "Staking..." : "Stake Tokens"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Token Rewards History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rewardsLoading ? (
                    <p>Loading rewards history...</p>
                  ) : rewards && rewards.length > 0 ? (
                    <div className="space-y-3">
                      {rewards.map((reward) => (
                        <div key={reward.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <Gift className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium capitalize">{reward.action.replace('_', ' ')}</p>
                              <p className="text-sm text-slate-500">
                                {new Date(reward.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">+{reward.amount} DTT</p>
                            <p className="text-xs text-slate-500">≈ ${(parseFloat(reward.amount) * (tokenInfo?.currentPrice ?? 0)).toFixed(4)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Gift className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">No rewards earned yet</p>
                      <p className="text-sm text-slate-400">Start using the app to earn DTT tokens!</p>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Your DTT Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-dime-purple mb-1">
                  {tokenBalance?.balance ?? '0'} DTT
                </p>
                <p className="text-sm text-slate-500">
                  ≈ ${((parseFloat(tokenBalance?.balance ?? '0')) * (tokenInfo?.currentPrice ?? 0)).toFixed(2)}
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Staked Amount</span>
                  <span className="font-medium">{tokenBalance?.stakedAmount ?? '0'} DTT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Total Earned</span>
                  <span className="font-medium text-green-600">{tokenBalance?.totalEarned ?? '0'} DTT</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trading Pairs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Trading Pairs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">DTT/USD</span>
                <div className="text-right">
                  <p className="font-bold">${Number(tokenInfo?.currentPrice ?? 0).toFixed(4)}</p>
                  <p className={`text-xs ${priceChangeColor}`}>
                    {(tokenInfo?.priceChange24h ?? 0) >= 0 ? '+' : ''}
                    {Number(tokenInfo?.priceChange24h ?? 0).toFixed(2)}%
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-medium">DTT/BTC</span>
                <div className="text-right">
                  <p className="font-bold">{((tokenInfo?.currentPrice ?? 0) / 95000).toFixed(8)}</p>
                  <p className={`text-xs ${priceChangeColor}`}>
                    {(tokenInfo?.priceChange24h ?? 0) >= 0 ? '+' : ''}
                    {Number(tokenInfo?.priceChange24h ?? 0).toFixed(2)}%
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-medium">DTT/ETH</span>
                <div className="text-right">
                  <p className="font-bold">{((tokenInfo?.currentPrice ?? 0) / 3500).toFixed(6)}</p>
                  <p className={`text-xs ${priceChangeColor}`}>
                    {(tokenInfo?.priceChange24h ?? 0) >= 0 ? '+' : ''}
                    {Number(tokenInfo?.priceChange24h ?? 0).toFixed(2)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </main>
  );
}