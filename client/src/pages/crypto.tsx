import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { 
  Bitcoin, 
  TrendingUp, 
  DollarSign, 
  Settings,
  Coins,
  ArrowUpRight,
  Wallet,
  ShieldCheck,
  LineChart
} from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
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
    <main className="min-h-[100dvh] pb-20 animate-fade-in-up">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 bg-dime-purple/10 rounded-xl flex items-center justify-center">
                <Bitcoin className="w-6 h-6 text-dime-purple" />
              </div>
              Crypto Round-ups
            </h1>
            <p className="text-slate-600 mt-2 ml-1 text-lg">Practice investing spare change in crypto — live prices, simulated purchases</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 press-scale border-slate-200 text-slate-700 bg-white"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>

        {/* Preview notice — purchases are simulated until the real Coinbase integration ships */}
        <div
          className="mb-8 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
          data-testid="banner-crypto-preview"
        >
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              Crypto is in Preview
              <Badge variant="secondary" className="border border-amber-200 bg-amber-100 text-amber-800">
                Simulated
              </Badge>
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">
              Prices are live market prices, but purchases here are practice only — no real money is
              moved and no real crypto is bought. A direct connection to your own Coinbase account is
              in the works.
            </p>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <Card className="mb-8 shadow-card animate-fade-in-up border-dime-purple/10">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-slate-900 text-xl">
                <Settings className="w-5 h-5 text-slate-500" />
                Crypto Round-up Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="space-y-1">
                  <Label htmlFor="crypto-enabled" className="text-base font-bold text-slate-900 cursor-pointer">Enable Crypto Round-ups</Label>
                  <p className="text-sm font-medium text-slate-500">
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
                <div className="space-y-8 animate-fade-in">
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <Label className="text-base font-bold text-slate-900">Crypto Allocation</Label>
                      <span className="text-lg font-bold text-dime-purple tabular-nums">{cryptoPercentage}%</span>
                    </div>
                    <p className="text-sm font-medium text-slate-500 -mt-2">
                      Percentage of round-ups to invest in crypto (remaining goes to debt payments)
                    </p>
                    <Slider
                      value={[cryptoPercentage]}
                      onValueChange={([value]) => 
                        handleSettingsUpdate({ cryptoPercentage: value.toString() })
                      }
                      max={100}
                      step={5}
                      className="w-full py-2"
                    />
                    <div className="flex justify-between text-xs font-semibold text-slate-400">
                      <span>0% (All to debt)</span>
                      <span>50%</span>
                      <span>100% (All to crypto)</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-bold text-slate-900">Preferred Cryptocurrency</Label>
                    <Select
                      value={settings?.preferredCrypto || 'BTC'}
                      onValueChange={(value) => handleSettingsUpdate({ preferredCrypto: value })}
                    >
                      <SelectTrigger className="w-full sm:max-w-xs h-12 text-base">
                        <SelectValue placeholder="Choose cryptocurrency" />
                      </SelectTrigger>
                      <SelectContent>
                        {cryptoOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="py-2.5">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-sm">
                                {option.icon}
                              </span>
                              <span className="font-medium">{option.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100">
                    <div className="flex gap-3 mb-3">
                      <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                      <h4 className="font-bold text-slate-900">How it works</h4>
                    </div>
                    <ul className="text-sm font-medium text-slate-600 space-y-2 ml-8 list-disc pl-2">
                      <li>Round-ups are automatically split between debt payments and crypto</li>
                      <li>Crypto purchases are made through Coinbase's secure API</li>
                      <li>You maintain full control and can change allocation anytime</li>
                      <li>View your crypto portfolio growth alongside debt reduction</li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Coinbase Connection Status */}
        <CoinbaseStatus />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <Card className="shadow-card border-slate-200">
            <CardContent className="p-5 sm:p-6 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-dime-purple/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-dime-purple" />
                </div>
                <Badge variant="secondary" className={settings?.cryptoEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}>
                  {settings?.cryptoEnabled ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-1">Total Invested</p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                  {formatCurrency(cryptoSummary?.totalInvested || "0")}
                </p>
                <p className="text-xs font-medium text-slate-400 mt-1">Via round-ups</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-slate-200">
            <CardContent className="p-5 sm:p-6 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                  <LineChart className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{cryptoPercentage}% allocation</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-1">Total Purchases</p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                  {cryptoSummary?.totalPurchases || 0}
                </p>
                <p className="text-xs font-medium text-slate-400 mt-1">Completed orders</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-slate-200">
            <CardContent className="p-5 sm:p-6 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                  <Bitcoin className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-1">Portfolio Assets</p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                  {cryptoSummary?.portfolio?.length || 0}
                </p>
                <p className="text-xs font-medium text-slate-400 mt-1">Cryptocurrencies held</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-slate-200">
            <CardContent className="p-5 sm:p-6 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
                </div>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Coinbase</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-1">Last Purchase</p>
                <p className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums truncate">
                  {cryptoSummary?.lastPurchase 
                    ? new Date(cryptoSummary.lastPurchase).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'No purchases'
                  }
                </p>
                <p className="text-xs font-medium text-slate-400 mt-1">Recent activity</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Portfolio Overview */}
          <Card className="shadow-card border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="flex items-center gap-2 text-xl">
                <TrendingUp className="w-5 h-5 text-dime-purple" />
                Crypto Portfolio
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {cryptoSummary?.portfolio && cryptoSummary.portfolio.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {cryptoSummary.portfolio.map((coin) => {
                    const cryptoOption = cryptoOptions.find(opt => opt.value === coin.symbol);
                    return (
                      <div key={coin.symbol} className="flex items-center justify-between p-4 sm:p-6 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-xl font-bold text-slate-700">
                              {cryptoOption?.icon || coin.symbol[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-lg">{cryptoOption?.label.split(' ')[0] || coin.symbol}</p>
                            <p className="text-sm font-medium text-slate-500">
                              {coin.purchaseCount} purchase{coin.purchaseCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900 text-lg tabular-nums">
                            {formatCurrency(coin.totalInvested)}
                          </p>
                          <p className="text-sm font-semibold text-slate-500 tabular-nums">
                            {coin.totalCrypto.toFixed(8)} {coin.symbol}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8">
                  <EmptyState
                    icon={LineChart}
                    title="No crypto assets yet"
                    description={settings?.cryptoEnabled 
                      ? "Make your first purchase via round-ups to see your portfolio grow."
                      : "Enable crypto round-ups in Settings to start building your portfolio."
                    }
                    testIdPrefix="empty-crypto-portfolio"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Purchases */}
          <Card className="shadow-card border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Coins className="w-5 h-5 text-dime-accent" />
                Recent Purchases
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {cryptoPurchases.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {cryptoPurchases.slice(0, 5).map((purchase) => {
                    const cryptoOption = cryptoOptions.find(opt => opt.value === purchase.cryptoSymbol);
                    return (
                      <div key={purchase.id} className="flex items-center justify-between p-4 sm:p-6 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-slate-700">
                              {cryptoOption?.icon || purchase.cryptoSymbol[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-base font-bold text-slate-900">
                              {purchase.cryptoSymbol} Purchase
                            </p>
                            <p className="text-sm font-medium text-slate-500 tabular-nums">
                              {new Date(purchase.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-slate-900 tabular-nums">
                            {formatCurrency(purchase.amountUsd)}
                          </p>
                          <div className="mt-1">
                            <StatusBadge status={purchase.status} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8">
                  <EmptyState
                    icon={Coins}
                    title="No recent purchases"
                    description="Your crypto purchase history will appear here as round-ups are converted."
                    testIdPrefix="empty-crypto-purchases"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Educational Content */}
        <div className="mt-8">
          <Card className="bg-slate-50 border-slate-200 shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-dime-purple/10 rounded-full flex items-center justify-center">
                  <span className="text-lg">💡</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900">About Crypto Round-ups</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 font-bold text-slate-900 text-lg">
                    <ShieldCheck className="w-5 h-5 text-slate-400" />
                    Security & Control
                  </h4>
                  <ul className="text-base font-medium text-slate-600 space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="text-dime-purple mt-0.5">•</span>
                      <span>Purchases made through Coinbase's secure API</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-dime-purple mt-0.5">•</span>
                      <span>You maintain full ownership of your crypto</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-dime-purple mt-0.5">•</span>
                      <span>Change allocation or disable at any time</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-dime-purple mt-0.5">•</span>
                      <span>No minimum purchase amounts</span>
                    </li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 font-bold text-slate-900 text-lg">
                    <TrendingUp className="w-5 h-5 text-slate-400" />
                    Smart Investing
                  </h4>
                  <ul className="text-base font-medium text-slate-600 space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="text-dime-purple mt-0.5">•</span>
                      <span>Dollar-cost averaging with spare change</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-dime-purple mt-0.5">•</span>
                      <span>Balanced approach: debt reduction + investing</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-dime-purple mt-0.5">•</span>
                      <span>Start small and build over time</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-dime-purple mt-0.5">•</span>
                      <span>Track performance alongside debt progress</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}