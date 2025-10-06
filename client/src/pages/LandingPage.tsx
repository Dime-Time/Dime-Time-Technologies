import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoWithText } from "@/components/logo";
import { DollarSign, TrendingUp, Shield, Smartphone, Clock, BarChart3, Users, Target, Code } from "lucide-react";
import vaq139Badge from "@assets/generated_images/VAQ-139_Prowler_Reagan_veteran_badge_eb04c29f.png";
import founderPortrait from "@assets/C522B2F1-FBF0-476A-BB44-9A0B1F2E5113_1759744034189.png";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#918EF4] text-white flex flex-col">
      {/* Header - No button anymore */}
      <header className="w-full py-6 px-4">
        <div className="max-w-6xl mx-auto">
        </div>
      </header>

      {/* Hero Section with Centered Logo */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
        <div className="flex flex-col items-center justify-center space-y-8">
          {/* Centered Official Logo */}
          <div className="flex items-center justify-center scale-150 md:scale-200">
            <LogoWithText />
          </div>
          
          {/* Hello World Text */}
          <h1 className="text-4xl md:text-5xl font-bold text-white text-center" data-testid="text-hello-world">
            "Hello World!"
          </h1>
        </div>

        {/* Features Grid */}
        <div className="max-w-6xl mx-auto mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="bg-white/10 border-white/20 backdrop-blur-sm" data-testid="card-feature-roundup">
            <CardHeader>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-white">Round-Up Technology</CardTitle>
              <CardDescription className="text-white/70">
                Automatically collect spare change from every purchase and apply it to your debt.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white/10 border-white/20 backdrop-blur-sm" data-testid="card-feature-analytics">
            <CardHeader>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-white">Smart Analytics</CardTitle>
              <CardDescription className="text-white/70">
                Track your progress with detailed insights and debt-free projections.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white/10 border-white/20 backdrop-blur-sm" data-testid="card-feature-security">
            <CardHeader>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-white">Bank-Level Security</CardTitle>
              <CardDescription className="text-white/70">
                Your financial data is protected with enterprise-grade security.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white/10 border-white/20 backdrop-blur-sm" data-testid="card-feature-mobile">
            <CardHeader>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-white">Mobile Apps</CardTitle>
              <CardDescription className="text-white/70">
                Access Dime Time on iOS and Android for debt management on the go.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white/10 border-white/20 backdrop-blur-sm" data-testid="card-feature-payments">
            <CardHeader>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-white">Automated Payments</CardTitle>
              <CardDescription className="text-white/70">
                Weekly automated payments to accelerate your debt reduction journey.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white/10 border-white/20 backdrop-blur-sm" data-testid="card-feature-crypto">
            <CardHeader>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-white">Crypto Options</CardTitle>
              <CardDescription className="text-white/70">
                Optionally invest round-ups in cryptocurrency for potential growth.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Business Projections Section */}
        <div className="max-w-6xl mx-auto mt-20">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-8" data-testid="text-business-projections">
            Business Projections
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm" data-testid="card-stat-revenue">
              <CardHeader>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-white">Revenue at Scale</CardTitle>
                <CardContent className="px-0 pt-2">
                  <ul className="text-white/70 space-y-1 text-sm">
                    <li>• $93.90M annual revenue at 1M users</li>
                    <li>• 85.4% profit margin</li>
                    <li>• $93.90 revenue per user/year</li>
                    <li>• Path to $100M in 3 years</li>
                  </ul>
                </CardContent>
              </CardHeader>
            </Card>

            <Card className="bg-white/10 border-white/20 backdrop-blur-sm" data-testid="card-stat-market">
              <CardHeader>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-white">Target Market</CardTitle>
                <CardContent className="px-0 pt-2">
                  <ul className="text-white/70 space-y-1 text-sm">
                    <li>• 77M Americans with credit card debt</li>
                    <li>• $6,200 average debt per person</li>
                    <li>• 20-40M potential users</li>
                    <li>• 88% fintech adoption rate</li>
                  </ul>
                </CardContent>
              </CardHeader>
            </Card>

            <Card className="bg-white/10 border-white/20 backdrop-blur-sm" data-testid="card-stat-growth">
              <CardHeader>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-white">Growth Strategy</CardTitle>
                <CardContent className="px-0 pt-2">
                  <ul className="text-white/70 space-y-1 text-sm">
                    <li>• Year 1: 50K users (~$4.4M revenue)</li>
                    <li>• Year 2: 400K users (~$35M revenue)</li>
                    <li>• Year 3: 1.14M users ($100M target)</li>
                    <li>• 31,667 new users/month average</li>
                  </ul>
                </CardContent>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Development Stats Section */}
        <div className="max-w-6xl mx-auto mt-20">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-8" data-testid="text-development-stats">
            Development Achievement
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm" data-testid="card-stat-tech">
              <CardHeader>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                  <Code className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-white">Technology Stack</CardTitle>
                <CardContent className="px-0 pt-2">
                  <ul className="text-white/70 space-y-1 text-sm">
                    <li>• React.js + TypeScript frontend</li>
                    <li>• Node.js Express backend</li>
                    <li>• PostgreSQL database with Drizzle ORM</li>
                    <li>• iOS & Android via Capacitor</li>
                    <li>• Tailwind CSS + shadcn/ui components</li>
                  </ul>
                </CardContent>
              </CardHeader>
            </Card>

            <Card className="bg-white/10 border-white/20 backdrop-blur-sm" data-testid="card-stat-integrations">
              <CardHeader>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-white">Live Integrations</CardTitle>
                <CardContent className="px-0 pt-2">
                  <ul className="text-white/70 space-y-1 text-sm">
                    <li>• Plaid API for bank connections</li>
                    <li>• Sila Money ACH payment processing</li>
                    <li>• Coinbase cryptocurrency trading</li>
                    <li>• Replit authentication system</li>
                    <li>• Ready for App Store submission</li>
                  </ul>
                </CardContent>
              </CardHeader>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer with Founder Portrait and Veteran Badge */}
      <footer className="w-full py-8 px-4 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col items-center justify-center">
          <p className="mb-6 text-center text-white/60">&copy; 2025 Dime Time. All rights reserved.</p>
          <div className="flex flex-row items-center justify-center gap-12">
            <div className="flex flex-col items-center gap-2">
              <img 
                src={founderPortrait} 
                alt="Founder" 
                className="w-16 h-16 rounded-full object-cover"
                data-testid="img-founder-portrait"
              />
              <p className="text-sm text-white/80 font-semibold" data-testid="text-founder">Founder</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <img 
                src={vaq139Badge} 
                alt="VAQ-139 Veteran Owned Business" 
                className="w-16 h-16"
                data-testid="img-veteran-badge"
              />
              <p className="text-sm text-white/80 font-semibold" data-testid="text-veteran-owned">Veteran Owned Business</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
