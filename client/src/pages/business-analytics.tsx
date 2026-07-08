import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Target, 
  BarChart3,
  PieChart,
  LineChart,
  Calendar,
  Zap,
  Trophy,
  ArrowUp,
  ArrowRight,
  CreditCard,
  AlertTriangle
} from "lucide-react";

export default function BusinessAnalytics() {
  return (
    <div className="min-h-screen p-6 pt-24 bg-background animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Business Analytics & Forecasting</h1>
            <p className="text-slate-600">Market analysis, revenue projections, and growth strategy for Dime Time</p>
          </div>
          <Badge className="bg-slate-100 text-dime-purple border border-slate-200 shadow-sm px-3 py-1">
            Strategic Analysis
          </Badge>
        </div>

        {/* Revenue Model Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-2 shadow-card hover:shadow-card-hover transition-all bg-card border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50">
              <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                Revenue Model
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <h3 className="font-semibold text-slate-700 mb-1 text-xs uppercase tracking-wider">Subscription Revenue</h3>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">$35.88</p>
                  <p className="text-xs text-slate-500 font-medium">per user/year</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <h3 className="font-semibold text-slate-700 mb-1 text-xs uppercase tracking-wider">Interest Revenue</h3>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">$52.00</p>
                  <p className="text-xs text-slate-500 font-medium">per user/year (4% APY)</p>
                </div>
              </div>
              <div className="p-5 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-semibold text-slate-700 mb-1 text-xs uppercase tracking-wider">Total Revenue Per User</h3>
                <p className="text-3xl font-bold text-dime-accent tabular-nums">$87.88</p>
                <p className="text-xs text-slate-500 font-medium mt-1">annual recurring revenue</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card hover:shadow-card-hover transition-all bg-card border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50">
              <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
                <Target className="w-5 h-5 text-blue-500" />
                Market Size
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                <p className="text-sm font-medium text-slate-600">Americans with Debt</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">77M</p>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                <p className="text-sm font-medium text-slate-600">Avg Debt Per Person</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">$6,200</p>
              </div>
              <div className="flex justify-between items-center pt-1">
                <p className="text-sm font-bold text-slate-700">Target Market</p>
                <p className="text-xl font-bold text-dime-accent tabular-nums">20-40M</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card hover:shadow-card-hover transition-all bg-card border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50">
              <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
                <Trophy className="w-5 h-5 text-amber-500" />
                Competitive Edge
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1 pb-3 border-b border-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Our APY</span>
                  <span className="font-bold text-emerald-600 tabular-nums">4.0%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Competitors</span>
                  <span className="text-sm font-medium text-slate-500 tabular-nums">0.1%</span>
                </div>
              </div>
              
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Our Price</span>
                  <span className="font-bold text-blue-600 tabular-nums">$2.99/mo</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Competitors</span>
                  <span className="text-sm font-medium text-slate-500 tabular-nums">$5-10/mo</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Growth Projections */}
        <Card className="shadow-card bg-card border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50">
            <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
              <LineChart className="w-5 h-5 text-dime-accent" />
              3-Year Growth Projection to $100M Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-200 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center border border-blue-100">
                    <Calendar className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className="font-bold text-slate-900">Year 1: Foundation</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-3xl font-bold text-slate-900 tabular-nums">50K</p>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">users</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-800 tabular-nums">$4.4M</p>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">revenue</p>
                  </div>
                </div>
                <div className="mt-5 text-sm text-slate-600 font-medium">
                  Launch, early adopters, product refinement
                </div>
              </div>
              
              <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-purple-200 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center border border-purple-100">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                  </div>
                  <h3 className="font-bold text-slate-900">Year 2: Scale</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-3xl font-bold text-slate-900 tabular-nums">400K</p>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">users</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-800 tabular-nums">$35M</p>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">revenue</p>
                  </div>
                </div>
                <div className="mt-5 text-sm text-slate-600 font-medium">
                  Aggressive marketing, geographic expansion
                </div>
              </div>
              
              <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-colors relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 opacity-50 z-0"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
                      <Target className="w-5 h-5 text-emerald-500" />
                    </div>
                    <h3 className="font-bold text-slate-900">Year 3: Dominance</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-3xl font-bold text-slate-900 tabular-nums">1.14M</p>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">users</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-slate-800 tabular-nums">$100M</p>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">revenue target</p>
                    </div>
                  </div>
                  <div className="mt-5 text-sm text-slate-600 font-medium">
                    National coverage, enterprise partnerships
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                  <ArrowUp className="w-5 h-5 text-slate-700" />
                </div>
                <span className="font-semibold text-slate-800">Required Growth Rate</span>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-2xl font-bold text-slate-900 tabular-nums">31,667</p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">new users per month average</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profit Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card bg-card border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50">
              <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
                <PieChart className="w-5 h-5 text-emerald-500" />
                Profit Margins at 1M Users
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Gross Revenue</span>
                  <span className="text-xl font-bold text-slate-900 tabular-nums">$87.88M</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Operating Costs</span>
                  <span className="text-xl font-bold text-rose-600 tabular-nums">$13.7M</span>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between items-center p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                    <span className="font-bold text-slate-900 text-lg">Net Profit</span>
                    <span className="text-3xl font-bold text-emerald-600 tabular-nums">$74.18M</span>
                  </div>
                </div>
              </div>
              
              <div className="p-5 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Profit Margin</span>
                  <span className="text-4xl font-black text-dime-accent tabular-nums">84%</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card bg-card border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50">
              <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                Competitive Benchmarks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div>
                <h4 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Round-up App Success</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-600">Acorns</span>
                    <Badge className="bg-slate-100 text-slate-800 border-none shadow-sm">10M+ users</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-600">Qapital</span>
                    <Badge className="bg-slate-100 text-slate-800 border-none shadow-sm">6M+ users</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-600">Digit</span>
                    <Badge className="bg-slate-100 text-slate-800 border-none shadow-sm">7M+ users</Badge>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Direct Competitors</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-600">Tally (shutdown)</span>
                    <Badge className="bg-slate-100 text-slate-500 border-none shadow-sm">500K users</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-600">PocketGuard</span>
                    <Badge className="bg-slate-100 text-slate-800 border-none shadow-sm">3M users</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Marketing Strategy */}
        <Card className="shadow-card bg-card border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50">
            <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
              <Zap className="w-5 h-5 text-amber-500" />
              TikTok Marketing Strategy
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="font-bold text-slate-800 mb-4">Campaign Concept</h4>
                <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 shadow-sm mb-5 relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-dime-accent rounded-l-xl"></div>
                  <p className="text-slate-800 font-medium italic">
                    "AI-generated animals holding phones saying 'Get out of debt one dime at a time with Dime Time' + App Store download button"
                  </p>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <h5 className="font-bold text-slate-700 mb-2">Why This Works:</h5>
                    <ul className="text-sm font-medium text-slate-600 space-y-2">
                      <li className="flex gap-2 items-start"><ArrowRight className="w-4 h-4 text-dime-accent shrink-0 mt-0.5" /> AI animals trending on TikTok (high shareability)</li>
                      <li className="flex gap-2 items-start"><ArrowRight className="w-4 h-4 text-dime-accent shrink-0 mt-0.5" /> Simple, memorable hook: "One dime at a time"</li>
                      <li className="flex gap-2 items-start"><ArrowRight className="w-4 h-4 text-dime-accent shrink-0 mt-0.5" /> Direct CTA removes all friction</li>
                      <li className="flex gap-2 items-start"><ArrowRight className="w-4 h-4 text-dime-accent shrink-0 mt-0.5" /> Target audience (18-35) has highest debt rates</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-bold text-slate-800 mb-4">Expected Performance</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                    <span className="font-medium text-slate-600">Conversion Rate</span>
                    <span className="font-bold text-slate-900 tabular-nums">2-5%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                    <span className="font-medium text-slate-600">Cost Per User</span>
                    <span className="font-bold text-emerald-600 tabular-nums">$2-10</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                    <span className="font-medium text-slate-600">Viral Potential</span>
                    <span className="font-bold text-blue-600 tabular-nums">10M+ views</span>
                  </div>
                </div>
                
                <div className="mt-6 p-5 bg-gradient-to-br from-dime-accent/10 to-transparent rounded-xl border border-dime-accent/20 text-center sm:text-left">
                  <h5 className="font-bold text-slate-800 mb-1 text-sm uppercase tracking-wider">Q1 Projection</h5>
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-2">
                    <p className="text-4xl font-black text-dime-accent tabular-nums">50K+</p>
                    <p className="text-sm font-medium text-slate-600">users from TikTok campaign</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Success Metrics */}
        <Card className="shadow-card bg-card border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50">
            <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
              <Target className="w-5 h-5 text-indigo-500" />
              Key Success Metrics & Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
                <h4 className="font-bold text-slate-700 mb-2 text-sm uppercase tracking-wider">Acquisition Cost</h4>
                <p className="text-3xl font-black text-slate-900 tabular-nums mb-1">&lt; $25</p>
                <p className="text-xs font-medium text-slate-500">per user target</p>
              </div>
              
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
                <h4 className="font-bold text-slate-700 mb-2 text-sm uppercase tracking-wider">Retention Rate</h4>
                <p className="text-3xl font-black text-emerald-600 tabular-nums mb-1">85%+</p>
                <p className="text-xs font-medium text-slate-500">monthly retention</p>
              </div>
              
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
                <h4 className="font-bold text-slate-700 mb-2 text-sm uppercase tracking-wider">Funding Needed</h4>
                <p className="text-3xl font-black text-blue-600 tabular-nums mb-1">$15-25M</p>
                <p className="text-xs font-medium text-slate-500">3-year growth plan</p>
              </div>
              
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
                <h4 className="font-bold text-slate-700 mb-2 text-sm uppercase tracking-wider">Team Scale</h4>
                <p className="text-3xl font-black text-slate-900 tabular-nums mb-1">50+</p>
                <p className="text-xs font-medium text-slate-500">employees by Year 2</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phase 2: Debt Consolidation Expansion */}
        <Card className="shadow-card bg-card border-slate-200 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-dime-purple via-dime-accent to-blue-500"></div>
          <CardHeader className="border-b border-slate-100 bg-slate-50">
            <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
              <CreditCard className="w-5 h-5 text-dime-accent" />
              Phase 2: Debt Consolidation Lending (Year 2-3)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Market Opportunity */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Market Opportunity</h3>
                <div className="space-y-4">
                  <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider">Target Market</h4>
                    <ul className="text-sm font-medium text-slate-600 space-y-2">
                      <li className="flex gap-2 items-start"><span className="text-dime-accent mt-0.5">•</span> 24.6M Americans with personal loans</li>
                      <li className="flex gap-2 items-start"><span className="text-dime-accent mt-0.5">•</span> $1T+ credit card debt at 20-30% APR</li>
                      <li className="flex gap-2 items-start"><span className="text-dime-accent mt-0.5">•</span> 48.7% of loans are for debt consolidation</li>
                      <li className="flex gap-2 items-start"><span className="text-dime-accent mt-0.5">•</span> Average consolidation: $15,000</li>
                    </ul>
                  </div>
                  
                  <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider">Competitive Advantage</h4>
                    <ul className="text-sm font-medium text-slate-600 space-y-2">
                      <li className="flex gap-2 items-start"><span className="text-emerald-500 mt-0.5">✓</span> 10% APR vs 15.95-23.43% competitors</li>
                      <li className="flex gap-2 items-start"><span className="text-emerald-500 mt-0.5">✓</span> Push notification targeting</li>
                      <li className="flex gap-2 items-start"><span className="text-emerald-500 mt-0.5">✓</span> Existing user trust & data</li>
                      <li className="flex gap-2 items-start"><span className="text-emerald-500 mt-0.5">✓</span> Integrated debt reduction platform</li>
                    </ul>
                  </div>
                  
                  <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 w-16 h-16 bg-blue-50 rounded-tl-full opacity-50"></div>
                    <h4 className="font-bold text-slate-900 mb-2 text-sm uppercase tracking-wider relative z-10">Revenue Model</h4>
                    <p className="text-sm font-medium text-slate-600 mb-3 relative z-10">
                      Interest rate arbitrage: Borrow at 5%, lend at 10%
                    </p>
                    <div className="text-xs font-bold text-slate-500 bg-slate-50 p-2 rounded relative z-10">
                      Example: $750M loan portfolio = $37.5M annual profit
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Revenue Projections */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Lending Projections</h3>
                <div className="space-y-4">
                  <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                      <span className="font-bold text-slate-900">Year 2: Pilot</span>
                      <Badge className="bg-slate-100 text-slate-700 shadow-none border-slate-200">10K Users</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Loan Portfolio</p>
                        <p className="text-xl font-bold text-slate-900 tabular-nums">$150M</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Annual Profit</p>
                        <p className="text-xl font-bold text-emerald-600 tabular-nums">$7.5M</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                      <span className="font-bold text-slate-900">Year 3: Scale</span>
                      <Badge className="bg-slate-100 text-slate-700 shadow-none border-slate-200">50K Users</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Loan Portfolio</p>
                        <p className="text-xl font-bold text-slate-900 tabular-nums">$750M</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Annual Profit</p>
                        <p className="text-xl font-bold text-emerald-600 tabular-nums">$37.5M</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-dime-accent">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                      <span className="font-bold text-slate-900">Year 4: National</span>
                      <Badge className="bg-slate-100 text-slate-700 shadow-none border-slate-200">100K Users</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Loan Portfolio</p>
                        <p className="text-2xl font-black text-slate-900 tabular-nums">$1.5B</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Annual Profit</p>
                        <p className="text-2xl font-black text-emerald-600 tabular-nums">$75M</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 p-5 bg-orange-50 rounded-xl border border-orange-100">
              <h4 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                Implementation Requirements
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div>
                  <p className="font-bold text-orange-800 mb-2 uppercase tracking-wider text-xs">Regulatory</p>
                  <ul className="font-medium text-orange-800/80 space-y-1.5">
                    <li className="flex gap-2 items-start"><span className="text-orange-500">•</span> Consumer lending licenses (40+ states)</li>
                    <li className="flex gap-2 items-start"><span className="text-orange-500">•</span> 6-12 month approval process</li>
                    <li className="flex gap-2 items-start"><span className="text-orange-500">•</span> $500K-1M compliance setup</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-orange-800 mb-2 uppercase tracking-wider text-xs">Capital</p>
                  <ul className="font-medium text-orange-800/80 space-y-1.5">
                    <li className="flex gap-2 items-start"><span className="text-orange-500">•</span> $10-50M initial lending capital</li>
                    <li className="flex gap-2 items-start"><span className="text-orange-500">•</span> Bank partnership for funding</li>
                    <li className="flex gap-2 items-start"><span className="text-orange-500">•</span> Securitization for growth</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-orange-800 mb-2 uppercase tracking-wider text-xs">Timeline</p>
                  <ul className="font-medium text-orange-800/80 space-y-1.5">
                    <li className="flex gap-2 items-start"><span className="text-orange-500">•</span> Year 2: Licensing & pilot launch</li>
                    <li className="flex gap-2 items-start"><span className="text-orange-500">•</span> Year 3: Multi-state expansion</li>
                    <li className="flex gap-2 items-start"><span className="text-orange-500">•</span> Year 4: National rollout</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App Store Launch Timeline Comparison */}
        <Card className="shadow-card bg-card border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50">
            <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
              <Calendar className="w-5 h-5 text-indigo-500" />
              App Store Launch Timeline - Two Approaches
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Fast Track Approach */}
              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
                    <Zap className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Fast Track: Individual</h3>
                  <Badge className="bg-emerald-500 text-white border-none shadow-sm ml-auto">
                    Recommended
                  </Badge>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm relative z-10">
                    <div className="absolute left-[-16px] top-1/2 w-4 h-0.5 bg-slate-200"></div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900">Week 1 (This Week)</span>
                      <span className="text-sm text-slate-500 font-bold tabular-nums bg-slate-100 px-2 py-0.5 rounded">$99</span>
                    </div>
                    <ul className="text-sm font-medium text-slate-600 space-y-1.5 ml-1">
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Apply for Individual Developer Account</li>
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Axos Bank setup call (Tuesday)</li>
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Start AI animal video creation</li>
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Finalize legal agreements and user flow</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm relative z-10">
                    <div className="absolute left-[-16px] top-1/2 w-4 h-0.5 bg-slate-200"></div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900">Week 2-3</span>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Setup</span>
                    </div>
                    <ul className="text-sm font-medium text-slate-600 space-y-1.5 ml-1">
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Account approved within 24-48 hours</li>
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Upload app with legal compliance</li>
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Submit for TestFlight beta testing</li>
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Test user agreement flow</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm relative z-10">
                    <div className="absolute left-[-16px] top-1/2 w-4 h-0.5 bg-slate-200"></div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-emerald-900">Week 4 (Launch)</span>
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded">Go Live</span>
                    </div>
                    <ul className="text-sm font-medium text-emerald-800/80 space-y-1.5 ml-1">
                      <li className="flex gap-2 items-start"><span className="text-emerald-500">•</span> App Store review (2-7 days)</li>
                      <li className="flex gap-2 items-start"><span className="text-emerald-500">•</span> Launch TikTok marketing campaign</li>
                      <li className="flex gap-2 items-start"><span className="text-emerald-500">•</span> Begin user acquisition</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mt-6 relative z-10">
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Pros</h4>
                    <ul className="text-sm font-medium text-slate-600 space-y-1 mb-4">
                      <li className="flex gap-2 items-start"><span className="text-emerald-500">✓</span> Fastest path to market (4 weeks)</li>
                      <li className="flex gap-2 items-start"><span className="text-emerald-500">✓</span> No DUNS number required</li>
                      <li className="flex gap-2 items-start"><span className="text-emerald-500">✓</span> Immediate beta testing capability</li>
                      <li className="flex gap-2 items-start"><span className="text-emerald-500">✓</span> Can start marketing immediately</li>
                    </ul>
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Cons</h4>
                    <ul className="text-sm font-medium text-slate-600 space-y-1">
                      <li className="flex gap-2 items-start"><span className="text-rose-500">✗</span> Shows personal name instead of "Dime Time"</li>
                      <li className="flex gap-2 items-start"><span className="text-rose-500">✗</span> Need to transfer later to business account</li>
                    </ul>
                  </div>
                  {/* Timeline connector line */}
                  <div className="absolute left-0 top-[88px] bottom-[300px] w-0.5 bg-slate-200 ml-4 hidden sm:block"></div>
                </div>
              </div>
              
              {/* Business Account Approach */}
              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
                    <Target className="w-5 h-5 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Business Account Path</h3>
                  <Badge className="bg-slate-100 text-slate-500 border-none shadow-sm ml-auto">
                    Longer Term
                  </Badge>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm relative z-10">
                    <div className="absolute left-[-16px] top-1/2 w-4 h-0.5 bg-slate-200"></div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900">Month 1-2</span>
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">DUNS Fix</span>
                    </div>
                    <ul className="text-sm font-medium text-slate-600 space-y-1.5 ml-1">
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Contact Dun & Bradstreet for appeal</li>
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Gather additional business documentation</li>
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Establish trade references</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm relative z-10">
                    <div className="absolute left-[-16px] top-1/2 w-4 h-0.5 bg-slate-200"></div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900">Month 3-6</span>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Credit Building</span>
                    </div>
                    <ul className="text-sm font-medium text-slate-600 space-y-1.5 ml-1">
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Build business credit history</li>
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Wait for DUNS reapproval</li>
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Continue operating on individual account</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm relative z-10">
                    <div className="absolute left-[-16px] top-1/2 w-4 h-0.5 bg-slate-200"></div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900">Month 6+ (Transfer)</span>
                      <span className="text-sm text-slate-500 font-bold tabular-nums bg-slate-100 px-2 py-0.5 rounded">$299</span>
                    </div>
                    <ul className="text-sm font-medium text-slate-600 space-y-1.5 ml-1">
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Apply for Business Developer Account</li>
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Transfer app to business account</li>
                      <li className="flex gap-2 items-start"><span className="text-slate-400">•</span> Rebrand as "Dime Time" company</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mt-6 relative z-10">
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Pros</h4>
                    <ul className="text-sm font-medium text-slate-600 space-y-1 mb-4">
                      <li className="flex gap-2 items-start"><span className="text-emerald-500">✓</span> Professional business branding</li>
                      <li className="flex gap-2 items-start"><span className="text-emerald-500">✓</span> Corporate developer benefits</li>
                      <li className="flex gap-2 items-start"><span className="text-emerald-500">✓</span> Better for investor presentations</li>
                    </ul>
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Cons</h4>
                    <ul className="text-sm font-medium text-slate-600 space-y-1">
                      <li className="flex gap-2 items-start"><span className="text-rose-500">✗</span> 6+ month delay to launch</li>
                      <li className="flex gap-2 items-start"><span className="text-rose-500">✗</span> DUNS approval uncertainty</li>
                      <li className="flex gap-2 items-start"><span className="text-rose-500">✗</span> Missed early market opportunity</li>
                      <li className="flex gap-2 items-start"><span className="text-rose-500">✗</span> Higher cost ($299 vs $99)</li>
                    </ul>
                  </div>
                  {/* Timeline connector line */}
                  <div className="absolute left-0 top-[88px] bottom-[300px] w-0.5 bg-slate-200 ml-4 hidden sm:block"></div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 p-6 bg-slate-900 rounded-xl border border-slate-800 text-white shadow-lg">
              <h4 className="font-bold text-white mb-3 flex items-center gap-2 text-lg">
                <span className="text-xl">💡</span> Recommended Strategy
              </h4>
              <p className="text-slate-300 mb-5 font-medium leading-relaxed">
                Start with <strong className="text-white">Individual Account</strong> to launch quickly, then upgrade to Business Account once DUNS issues are resolved. This hybrid approach gets you to market fast while building toward professional branding.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  <p className="text-2xl font-black text-white mb-1">4 weeks</p>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">to App Store launch</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  <p className="text-2xl font-black text-white mb-1">6-12 mos</p>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">to business rebrand</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  <p className="text-2xl font-black text-emerald-400 tabular-nums mb-1">$0</p>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">revenue lost waiting</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
