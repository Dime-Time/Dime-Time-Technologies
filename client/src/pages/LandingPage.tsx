import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoWithText } from "@/components/logo";
import { DollarSign, TrendingUp, Shield, Smartphone, Clock, BarChart3, Users, Target, Code, Mail } from "lucide-react";
import vaq139Badge from "@assets/generated_images/VAQ-139_Prowler_Reagan_veteran_badge_eb04c29f.png";
import founderPortrait from "@assets/C522B2F1-FBF0-476A-BB44-9A0B1F2E5113_1759744034189.png";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function LandingPage() {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const { toast } = useToast();

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const url = window.location.href;
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 150,
          margin: 2,
          color: {
            dark: '#918EF4',
            light: '#FFFFFF'
          }
        });
        setQrCodeUrl(qrDataUrl);
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    };
    generateQRCode();
  }, []);

  const contactMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; message: string }) => {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message sent!",
        description: "Thank you for contacting us. We'll get back to you soon at tim@dime-time.com",
      });
      setFormData({ name: "", email: "", message: "" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    contactMutation.mutate(formData);
  };

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

          {/* QR Code */}
          {qrCodeUrl && (
            <div className="flex flex-col items-center gap-2 mt-6">
              <img 
                src={qrCodeUrl} 
                alt="Scan to visit website" 
                className="bg-white p-2 rounded-lg"
                data-testid="img-qr-code"
              />
              <p className="text-sm text-white/80" data-testid="text-qr-label">Scan to visit</p>
            </div>
          )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      {/* Contact Form Section */}
      <div className="w-full py-16 px-4 mt-12 bg-white/5">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" data-testid="text-contact-heading">
              Get in Touch
            </h2>
            <p className="text-white/70 mb-2" data-testid="text-contact-email">
              tim@dime-time.com
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Input
                type="text"
                placeholder="Your Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-white/10 border-white/20 text-white placeholder:text-white"
                data-testid="input-contact-name"
              />
            </div>
            <div>
              <Input
                type="email"
                placeholder="Your Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-white/10 border-white/20 text-white placeholder:text-white"
                data-testid="input-contact-email"
              />
            </div>
            <div>
              <Textarea
                placeholder="Your Message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="bg-white/10 border-white/20 text-white placeholder:text-white min-h-[120px]"
                data-testid="textarea-contact-message"
              />
            </div>
            <Button
              type="submit"
              disabled={contactMutation.isPending}
              className="w-full bg-white/10 border border-white/20 text-white hover:bg-white/20 font-semibold"
              data-testid="button-contact-submit"
            >
              {contactMutation.isPending ? "Sending..." : "Send Message"}
            </Button>
          </form>
        </div>
      </div>

      {/* Footer with Founder Portrait and Veteran Badge */}
      <footer className="w-full py-8 px-4 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col items-center justify-center">
          <p className="mb-6 text-center text-white/60">&copy; 2025 Dime Time Technologies. All rights reserved.</p>
          <div className="flex flex-row items-center justify-center gap-12">
            <div className="flex flex-col items-center gap-2">
              <img 
                src={founderPortrait} 
                alt="Founder" 
                className="w-16 h-16 rounded-full object-cover object-[center_30%]"
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
