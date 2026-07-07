import { Link, useLocation } from "wouter";
import {
  Home,
  TrendingUp,
  Menu,
  User,
  Bitcoin,
  QrCode,
  Bell,
  Settings,
  Landmark,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/logo";

export function Navigation() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/debts", label: "Debts", icon: CreditCard },
    { href: "/banking", label: "Banking", icon: Landmark },
    { href: "/crypto", label: "Crypto", icon: Bitcoin },
    { href: "/insights", label: "Insights", icon: TrendingUp },
  ];

  return (
    <>
      {/* Top Navigation (respects Dynamic Island via safe-area-top) */}
      <nav className="safe-area-top shadow-sm border-b border-white/20 sticky top-0 z-50 bg-dime-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 min-h-[56px]">
            {/* Brand / Logo */}
            <div className="flex items-center justify-center space-x-3">
              <div className="mt-1">
                <Logo size={32} clean={true} />
              </div>
              <span className="text-xl font-black text-white">
                Dime Time
              </span>
            </div>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`font-medium transition-colors ${
                    location === item.href
                      ? "text-white font-bold"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Right-side actions (notifications, settings, QR, profile, menu) */}
            <div className="flex items-center space-x-4">
              <Link href="/notifications">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/70 hover:text-white relative h-11 w-11 min-h-[44px] min-w-[44px]"
                  data-testid="button-notifications"
                >
                  <Bell className="w-6 h-6" />
                </Button>
              </Link>

              <Link href="/settings">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/70 hover:text-white h-11 w-11 min-h-[44px] min-w-[44px]"
                  data-testid="button-settings"
                >
                  <Settings className="w-6 h-6" />
                </Button>
              </Link>

              <Link href="/qr">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/70 hover:text-white h-11 w-11 min-h-[44px] min-w-[44px]"
                  data-testid="button-qr"
                >
                  <QrCode className="w-6 h-6" />
                </Button>
              </Link>

              {/* Profile avatar placeholder */}
              <div
                className="w-11 h-11 min-h-[44px] min-w-[44px] bg-white/20 rounded-full flex items-center justify-center"
                data-testid="button-profile"
              >
                <User className="w-5 h-5 text-white" />
              </div>

              {/* Mobile menu trigger */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-11 w-11 min-h-[44px] min-w-[44px]"
                    data-testid="button-menu"
                  >
                    <Menu className="w-6 h-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="bg-dime-background">
                  <div className="flex flex-col space-y-4 mt-8">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const active = location === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                            active
                              ? "bg-white/20 text-white"
                              : "text-white/70 hover:bg-white/10"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      );
                    })}

                    <div className="border-t border-white/20 pt-4 mt-4">
                      <Link
                        href="/notifications"
                        className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                          location === "/notifications"
                            ? "bg-white/20 text-white"
                            : "text-white/70 hover:bg-white/10"
                        }`}
                      >
                        <Bell className="w-5 h-5" />
                        <span className="font-medium">Notifications</span>
                      </Link>

                      <Link
                        href="/settings"
                        className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                          location === "/settings"
                            ? "bg-white/20 text-white"
                            : "text-white/70 hover:bg-white/10"
                        }`}
                      >
                        <Settings className="w-5 h-5" />
                        <span className="font-medium">Settings</span>
                      </Link>

                      <Link
                        href="/qr"
                        className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                          location === "/qr"
                            ? "bg-white/20 text-white"
                            : "text-white/70 hover:bg-white/10"
                        }`}
                      >
                        <QrCode className="w-5 h-5" />
                        <span className="font-medium">QR Code</span>
                      </Link>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

      {/* Bottom Navigation (mobile) – respects home indicator via safe-area-bottom */}
      <nav className="safe-area-bottom md:hidden fixed bottom-0 left-0 right-0 border-t border-white/20 px-1 z-50 bg-dime-background">
        <div className="flex justify-around items-center max-w-screen-xl mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-3 px-2 min-h-[56px] transition-colors ${
                  active ? "text-white" : "text-white/70"
                }`}
              >
                <Icon className="w-6 h-6 mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
