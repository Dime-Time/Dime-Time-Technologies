import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { 
  Bitcoin, 
  TrendingUp, 
  DollarSign, 
  Settings,
  Coins,
  ArrowUpRight,
  Wallet
} from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import { apiRequest } from "@/lib/queryClient";
import { CoinbaseStatus } from "@/components/CoinbaseStatus";
import { trackCryptoInvestment, trackFeatureUsage, trackUserMilestone } from "../../lib/analytics";

interface CryptoPurchase {
  id: string;
  cryptoSymbol: string;
  amountUsd: string;
  cryptoAmount: string;
  purchasePrice: string;
  status: string;
  createdAt: string;
}

interface RoundUpSettings {
  id: string;
  userId: string;
  isEnabled: boolean;
  multiplier: string;
  autoApplyThreshold: string;
  cryptoEnabled: boolean;
  cryptoPercentage: string;
  preferredCrypto: string;
}

interface CryptoSummary {
  portfolio: Array<{
    symbol: string;
    totalInvested: number;
    totalCrypto: number;
    averagePrice: number;
    purchaseCount: number;
  }>;
  totalInvested: string;
  totalPurchases: number;
  lastPurchase: string | null;
}

export default function CryptoPage() {
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);

  // Fetch crypto purchases
  const { data: cryptoPurchases = [] } = useQuery<CryptoPurchase[]>({
    queryKey: ['/api/crypto-purchases'],
  });

  // Fetch crypto summary
  const { data: cryptoSummary } = useQuery<CryptoSummary>({
    queryKey: ['/api/crypto-summary'],
  });

  // Fetch round-up settings
  const { data: settings } = useQuery<RoundUpSettings>({
    queryKey: ['/api/round-up-settings'],
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<RoundUpSettings>) => {
      const response = await fetch('/api/round-up-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/round-up-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crypto-summary'] });
    },
  });

  const handleSettingsUpdate = (updates: Partial<RoundUpSettings>) => {
    if (!settings) return;
    
    // Track crypto settings changes
    if (updates.cryptoEnabled !== undefined) {
      trackFeatureUsage('crypto', updates.cryptoEnabled ? 'enabled' : 'disabled');
      if (updates.cryptoEnabled) {
        trackUserMilestone('crypto_enabled');
      }
    }
    
    if (updates.cryptoPercentage !== undefined) {
      trackFeatureUsage('crypto', 'percentage_changed');
      const percentage = parseFloat(updates.cryptoPercentage);
      if (percentage > 0) {
        trackUserMilestone('crypto_percentage_set', percentage);
      }
    }
    
    if (updates.preferredCrypto !== undefined) {
      trackFeatureUsage('crypto', 'currency_changed');
      trackCryptoInvestment(0, updates.preferredCrypto.toLowerCase());
    }
    
    updateSettingsMutation.mutate({
      ...settings,
      ...updates,
    });
  };

  const cryptoOptions = [
    { value: 'BTC', label: 'Bitcoin (BTC)', icon: '₿' },
    { value: 'ETH', label: 'Ethereum (ETH)', icon: 'Ξ' },
    { value: 'ADA', label: 'Cardano (ADA)', icon: '₳' },
    { value: 'SOL', label: 'Solana (SOL)', icon: '◎' },
  ];

  const cryptoPercentage = settings ? parseFloat(settings.cryptoPercentage) : 0;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Crypto Round-ups</h1>
          <p className="text-slate-600">Invest spare change in cryptocurrency through Coinbase</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Settings
        </Button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Crypto Round-up Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="crypto-enabled">Enable Crypto Round-ups</Label>
                <p className="text-sm text-slate-500">
                  Automatically invest a portion of your round-ups in cryptocurrency
                </p>
              </div>
              <Switch
                id="crypto-enabled"
                checked={settings?.cryptoEnabled || false}
                onCheckedChange={(checked) => handleSettingsUpdate({ cryptoEnabled: checked })}
              />
            </div>

            {settings?.cryptoEnabled && (
              <>
                <div className="space-y-3">
                  <Label>Crypto Allocation: {cryptoPercentage}%</Label>
                  <p className="text-sm text-slate-500">
                    Percentage of round-ups to invest in crypto (remaining goes to debt payments)
                  </p>
                  <Slider
                    value={[cryptoPercentage]}
                    onValueChange={([value]) => 
                      handleSettingsUpdate({ cryptoPercentage: value.toString() })
                    }
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>0% (All to debt)</span>
                    <span>50%</span>
                    <span>100% (All to crypto)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Preferred Cryptocurrency</Label>
                  <Select
                    value={settings?.preferredCrypto || 'BTC'}
                    onValueChange={(value) => handleSettingsUpdate({ preferredCrypto: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose cryptocurrency" />
                    </SelectTrigger>
                    <SelectContent>
                      {cryptoOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <span>{option.icon}</span>
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 bg-dime-purple/5 rounded-lg border border-dime-purple/10">
                  <h4 className="font-medium text-slate-900 mb-2">How it works</h4>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>• Round-ups are automatically split between debt payments and crypto</li>
                    <li>• Crypto purchases are made through Coinbase's API</li>
                    <li>• You maintain full control and can change allocation anytime</li>
                    <li>• View your crypto portfolio growth alongside debt reduction</li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Coinbase Connection Status */}
      <CoinbaseStatus />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-dime-purple/5 rounded-lg border border-dime-purple/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-dime-purple" />
              </div>
              <Badge variant="secondary" className="text-dime-accent">
                {settings?.cryptoEnabled ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <h3 className="text-sm font-medium text-slate-600 mb-1">Total Invested</h3>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(cryptoSummary?.totalInvested || "0")}
            </p>
            <p className="text-xs text-slate-500 mt-1">Via round-ups</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-dime-accent/5 rounded-lg border border-dime-accent/10 flex items-center justify-center">
                <Coins className="w-6 h-6 text-dime-accent" />
              </div>
              <span className="text-xs text-slate-600">{cryptoPercentage}% allocation</span>
            </div>
            <h3 className="text-sm font-medium text-slate-600 mb-1">Total Purchases</h3>
            <p className="text-2xl font-bold text-slate-900">
              {cryptoSummary?.totalPurchases || 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">Completed orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-dime-lilac/5 rounded-lg border border-dime-lilac/10 flex items-center justify-center">
                <Bitcoin className="w-6 h-6 text-dime-lilac" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-dime-accent" />
            </div>
            <h3 className="text-sm font-medium text-slate-600 mb-1">Portfolio</h3>
            <p className="text-2xl font-bold text-slate-900">
              {cryptoSummary?.portfolio?.length || 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">Cryptocurrencies</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-dime-lavender/5 rounded-lg border border-dime-lavender/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-dime-lavender" />
              </div>
              <span className="text-xs text-slate-600">Coinbase</span>
            </div>
            <h3 className="text-sm font-medium text-slate-600 mb-1">Last Purchase</h3>
            <p className="text-lg font-bold text-slate-900">
              {cryptoSummary?.lastPurchase 
                ? new Date(cryptoSummary.lastPurchase).toLocaleDateString()
                : 'No purchases'
              }
            </p>
            <p className="text-xs text-slate-500 mt-1">Recent activity</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Portfolio Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Crypto Portfolio
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cryptoSummary?.portfolio && cryptoSummary.portfolio.length > 0 ? (
              <div className="space-y-4">
                {cryptoSummary.portfolio.map((coin) => {
                  const cryptoOption = cryptoOptions.find(opt => opt.value === coin.symbol);
                  return (
                    <div key={coin.symbol} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-dime-purple/5 rounded-full border border-dime-purple/10 flex items-center justify-center">
                          <span className="text-lg font-bold text-dime-purple">
                            {cryptoOption?.icon || coin.symbol[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{coin.symbol}</p>
                          <p className="text-sm text-slate-500">
                            {coin.purchaseCount} purchase{coin.purchaseCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-slate-900">
                          {formatCurrency(coin.totalInvested)}
                        </p>
                        <p className="text-sm text-slate-500">
                          {coin.totalCrypto.toFixed(8)} {coin.symbol}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Bitcoin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No crypto purchases yet</h3>
                <p className="text-slate-500">
                  {settings?.cryptoEnabled 
                    ? "Make your first purchase to see your portfolio here"
                    : "Enable crypto round-ups to start building your portfolio"
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Purchases */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5" />
              Recent Purchases
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cryptoPurchases.length > 0 ? (
              <div className="space-y-4">
                {cryptoPurchases.slice(0, 5).map((purchase) => (
                  <div key={purchase.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-dime-accent/5 rounded-full border border-dime-accent/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-dime-accent">
                          {purchase.cryptoSymbol}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {purchase.cryptoSymbol} Purchase
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(purchase.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">
                        {formatCurrency(purchase.amountUsd)}
                      </p>
                      <div className="flex items-center gap-1">
                        <StatusBadge status={purchase.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Coins className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No purchases yet</h3>
                <p className="text-slate-500">
                  Your crypto purchase history will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Educational Content */}
      <div className="mt-8">
        <Card className="bg-dime-purple/5 border border-dime-purple/10">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">💡 About Crypto Round-ups</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-slate-900 mb-2">🔒 Security & Control</h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Purchases made through Coinbase's secure API</li>
                  <li>• You maintain full ownership of your crypto</li>
                  <li>• Change or disable at any time</li>
                  <li>• No minimum purchase amounts</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-slate-900 mb-2">📈 Smart Investing</h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Dollar-cost averaging with spare change</li>
                  <li>• Balanced approach: debt reduction + investing</li>
                  <li>• Start small and build over time</li>
                  <li>• Track performance alongside debt progress</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}