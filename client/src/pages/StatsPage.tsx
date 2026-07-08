import { QRCode } from "@/components/QRCode";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Code2, 
  Smartphone, 
  DollarSign, 
  Users, 
  TrendingUp, 
  CheckCircle2,
  AppWindow,
  Globe
} from "lucide-react";
import logoImage from "@assets/D22C55D0-9527-4CE7-863F-F9327653E73E_1756052612472.png";
import veteranBadge from "@assets/generated_images/VAQ-139_Prowler_Reagan_veteran_badge_eb04c29f.png";

export default function StatsPage() {
  // Get the current website URL for the QR code
  const websiteUrl = window.location.origin;

  const stats = [
    {
      icon: Code2,
      label: "Lines of Code",
      value: "22,217",
      description: "Custom production code",
      color: "text-blue-300"
    },
    {
      icon: Globe,
      label: "API Integrations",
      value: "8",
      description: "Plaid, Mercury Banking, Coinbase, Axos Bank, AWS S3, DynamoDB, Replit Auth, Express Sessions",
      color: "text-green-300"
    },
    {
      icon: Smartphone,
      label: "Platforms",
      value: "3",
      description: "Web, iOS, Android",
      color: "text-purple-300"
    },
    {
      icon: DollarSign,
      label: "Revenue Model",
      value: "$93.90",
      description: "Per user/year at scale",
      color: "text-yellow-300"
    },
    {
      icon: TrendingUp,
      label: "Profit Margin",
      value: "85.4%",
      description: "At 1M users",
      color: "text-emerald-300"
    },
    {
      icon: Users,
      label: "Market Size",
      value: "$7.2B",
      description: "77M Americans with debt",
      color: "text-pink-300"
    }
  ];

  const statusBadges = [
    { label: "iOS Live on App Store", icon: CheckCircle2, variant: "success" as const },
    { label: "8 APIs Integrated", icon: CheckCircle2, variant: "success" as const },
    { label: "3 Platforms", icon: AppWindow, variant: "success" as const },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8 md:mb-12">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img 
              src={logoImage} 
              alt="Dime Time Logo" 
              className="w-24 h-24 md:w-32 md:h-32 object-contain"
              style={{ filter: "brightness(0) saturate(100%) invert(56%) sepia(50%) saturate(6328%) hue-rotate(227deg) brightness(101%) contrast(92%)" }}
              data-testid="img-logo"
            />
          </div>
          
          <h1 
            className="text-4xl md:text-6xl font-bold mb-4 text-slate-900"
            data-testid="text-stats-title"
          >
            This is Dime Time
          </h1>
          <p 
            className="text-xl md:text-2xl font-light mb-6 text-slate-600"
            data-testid="text-tagline"
          >
            Making debt freedom achievable, one dime at a time
          </p>
          
          {/* Status Badges */}
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {statusBadges.map((badge, index) => (
              <Badge
                key={index}
                className="bg-white text-dime-purple border border-dime-purple/20 text-sm md:text-base px-4 py-2 shadow-sm"
                data-testid={`badge-status-${index}`}
              >
                <badge.icon className="w-4 h-4 mr-2" />
                {badge.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className="shadow-card hover:shadow-card-hover transition-all duration-300 p-6 bg-card animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
              data-testid={`card-stat-${index}`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 bg-slate-50 rounded-lg ${stat.color.replace('300', '500')}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p 
                    className="text-sm font-medium text-slate-500 mb-1 uppercase tracking-wider"
                    data-testid={`text-stat-label-${index}`}
                  >
                    {stat.label}
                  </p>
                  <p 
                    className="text-3xl md:text-4xl font-bold mb-2 text-slate-900 tabular-nums"
                    data-testid={`text-stat-value-${index}`}
                  >
                    {stat.value}
                  </p>
                  <p 
                    className="text-xs md:text-sm text-slate-600"
                    data-testid={`text-stat-description-${index}`}
                  >
                    {stat.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* iOS App Store Build Info */}
        <Card className="shadow-card p-6 mb-12 bg-card">
          <div className="flex items-center gap-3 mb-4">
            <AppWindow className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-slate-900" data-testid="text-ios-title">
              iOS App Store Status
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">Version</p>
              <p className="text-xl font-semibold text-slate-900 tabular-nums" data-testid="text-ios-version">
                Version 23
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Build ID</p>
              <p className="text-sm md:text-base font-mono break-all text-slate-700 bg-slate-50 p-2 rounded-md border border-slate-100" data-testid="text-ios-build-id">
                a4121788-97fa-424e-9fcf-bb2c2679edae
              </p>
            </div>
          </div>
          <Badge className="mt-4 bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 mr-1 inline-block" /> Successfully Uploaded to App Store
          </Badge>
        </Card>

        {/* QR Code Section */}
        <Card className="shadow-card p-8 bg-card">
          <div className="text-center">
            <h2 
              className="text-2xl md:text-3xl font-bold mb-4 text-slate-900"
              data-testid="text-qr-title"
            >
              Scan to Visit
            </h2>
            <p className="text-sm md:text-base text-slate-600 mb-6" data-testid="text-qr-description">
              Scan this QR code with your phone to visit Dime Time
            </p>
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                <QRCode 
                  url={websiteUrl} 
                  size={250}
                  showDownload={true}
                />
              </div>
            </div>
            <p 
              className="mt-4 text-xs md:text-sm text-dime-accent break-all font-medium"
              data-testid="text-website-url"
            >
              {websiteUrl}
            </p>
          </div>
        </Card>

        {/* Veteran Business Badge */}
        <div className="flex justify-center mt-12 mb-8">
          <img 
            src={veteranBadge} 
            alt="Veteran Owned Business" 
            className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-sm"
            data-testid="img-veteran-badge"
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pb-8">
          <p className="text-sm text-slate-500 font-medium tracking-wide" data-testid="text-footer">
            BUILT WITH PRECISION. POWERED BY INNOVATION.
          </p>
        </div>
      </div>
    </div>
  );
}
