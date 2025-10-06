import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoWithText } from "@/components/logo";
import { DollarSign, TrendingUp, Shield, Smartphone, Clock } from "lucide-react";
import vaq139Badge from "@assets/generated_images/VAQ-139_Prowler_Reagan_veteran_badge_eb04c29f.png";

export default function LandingPage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-[#918EF4] text-white flex flex-col">
      {/* Header */}
      <header className="w-full py-6 px-4">
        <div className="max-w-6xl mx-auto flex justify-end">
          <Button 
            onClick={handleLogin}
            className="bg-white text-[#918EF4] hover:bg-white/90"
            data-testid="button-login"
          >
            Get Started
          </Button>
        </div>
      </header>

      {/* Hero Section with Centered Logo */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
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
      </main>

      {/* Footer with Veteran Badge */}
      <footer className="w-full py-8 px-4 text-center text-white/60">
        <p className="mb-4">&copy; 2025 Dime Time. All rights reserved.</p>
        <div className="flex flex-col items-center gap-2">
          <img 
            src={vaq139Badge} 
            alt="VAQ-139 Veteran Owned Business" 
            className="w-16 h-16"
            data-testid="img-veteran-badge"
          />
          <p className="text-sm text-white/80 font-semibold" data-testid="text-veteran-owned">Veteran Owned Business</p>
        </div>
      </footer>
    </div>
  );
}
