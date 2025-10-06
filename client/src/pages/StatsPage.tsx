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
      description: "Plaid, Sila Money, Coinbase, Axos Bank, AWS S3, DynamoDB, Replit Auth, Express Sessions",
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
    <div className="min-h-screen bg-[#918EF4] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8 md:mb-12">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img 
              src={logoImage} 
              alt="Dime Time Logo" 
              className="w-24 h-24 md:w-32 md:h-32 object-contain"
              style={{ 
                filter: `brightness(0) saturate(100%) invert(100%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%)`,
              }}
              data-testid="img-logo"
            />
          </div>
          
          <h1 
            className="text-4xl md:text-6xl font-bold mb-4"
            data-testid="text-stats-title"
          >
            This is Dime Time
          </h1>
          <p 
            className="text-xl md:text-2xl font-light mb-6"
            data-testid="text-tagline"
          >
            Making debt freedom achievable, one dime at a time
          </p>
          
          {/* Status Badges */}
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {statusBadges.map((badge, index) => (
              <Badge
                key={index}
                className="bg-white/20 text-white border-2 border-white text-sm md:text-base px-4 py-2 backdrop-blur-sm"
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
              className="bg-white/10 backdrop-blur-md border-2 border-white p-6 hover:bg-white/20 transition-all duration-300"
              data-testid={`card-stat-${index}`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 bg-white/20 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p 
                    className="text-sm font-medium opacity-90 mb-1"
                    data-testid={`text-stat-label-${index}`}
                  >
                    {stat.label}
                  </p>
                  <p 
                    className="text-3xl md:text-4xl font-bold mb-2"
                    data-testid={`text-stat-value-${index}`}
                  >
                    {stat.value}
                  </p>
                  <p 
                    className="text-xs md:text-sm opacity-80"
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
        <Card className="bg-white/10 backdrop-blur-md border-2 border-white p-6 mb-12">
          <div className="flex items-center gap-3 mb-4">
            <AppWindow className="w-6 h-6 text-blue-300" />
            <h2 className="text-2xl font-bold" data-testid="text-ios-title">
              iOS App Store Status
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm opacity-80 mb-1">Version</p>
              <p className="text-xl font-semibold" data-testid="text-ios-version">
                Version 23
              </p>
            </div>
            <div>
              <p className="text-sm opacity-80 mb-1">Build ID</p>
              <p className="text-sm md:text-base font-mono break-all" data-testid="text-ios-build-id">
                a4121788-97fa-424e-9fcf-bb2c2679edae
              </p>
            </div>
          </div>
          <Badge className="mt-4 bg-green-500 text-white border-0">
            ✅ Successfully Uploaded to App Store
          </Badge>
        </Card>

        {/* QR Code Section */}
        <Card className="bg-white/10 backdrop-blur-md border-2 border-white p-8">
          <div className="text-center">
            <h2 
              className="text-2xl md:text-3xl font-bold mb-4"
              data-testid="text-qr-title"
            >
              Scan to Visit
            </h2>
            <p className="text-sm md:text-base opacity-90 mb-6" data-testid="text-qr-description">
              Scan this QR code with your phone to visit Dime Time
            </p>
            <div className="flex justify-center">
              <QRCode 
                url={websiteUrl} 
                size={250}
                showDownload={true}
              />
            </div>
            <p 
              className="mt-4 text-xs md:text-sm opacity-70 break-all"
              data-testid="text-website-url"
            >
              {websiteUrl}
            </p>
          </div>
        </Card>

        {/* Veteran Business Badge */}
        <div className="flex justify-center mt-8">
          <img 
            src={veteranBadge} 
            alt="Veteran Owned Business" 
            className="w-32 h-32 md:w-40 md:h-40 object-contain"
            data-testid="img-veteran-badge"
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-8 opacity-70">
          <p className="text-sm" data-testid="text-footer">
            Built with precision. Powered by innovation.
          </p>
        </div>
      </div>
    </div>
  );
}
