import { useState } from "react";
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
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CircleLogo } from "@/components/logo";
import { useAuth } from "@/hooks/useAuth";

export function Navigation() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);
  const isActive = (href: string) =>
    location === href || (href === "/dashboard" && location === "/");

  const navItems = [
    { href: "/dashboard", label: "Home", icon: Home },
    { href: "/debts", label: "Debts", icon: CreditCard },
    { href: "/banking", label: "Banking", icon: Landmark },
    { href: "/crypto", label: "Crypto", icon: Bitcoin },
    { href: "/insights", label: "Insights", icon: TrendingUp },
  ];

  return (
    <>
      {/* Top Navigation (respects Dynamic Island via safe-area-top) */}
      <nav className="safe-area-top border-b border-border sticky top-0 z-50 bg-card/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 min-h-[56px]">
            {/* Brand / Logo */}
            <div className="flex items-center pl-1 space-x-3.5">
              <CircleLogo size={44} className="shadow-sm" />
              <span className="text-xl font-bold text-slate-900 tracking-tight">
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
                    isActive(item.href)
                      ? "text-dime-accent font-semibold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Right-side actions (notifications, settings, QR, profile, menu).
                On mobile only bell + menu render — Settings lives in the bottom
                tab bar and everything else is inside the hamburger sheet. */}
            <div className="flex items-center space-x-1 md:space-x-4">
              <Link href="/notifications">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-500 hover:text-slate-900 relative h-11 w-11 min-h-[44px] min-w-[44px]"
                  data-testid="button-notifications"
                  aria-label="Notifications"
                >
                  <Bell className="w-6 h-6" />
                </Button>
              </Link>

              <Link href="/settings" className="hidden md:block">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-500 hover:text-slate-900 h-11 w-11 min-h-[44px] min-w-[44px]"
                  data-testid="button-settings"
                  aria-label="Settings"
                >
                  <Settings className="w-6 h-6" />
                </Button>
              </Link>

              <Link href="/qr" className="hidden md:block">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-500 hover:text-slate-900 h-11 w-11 min-h-[44px] min-w-[44px]"
                  data-testid="button-qr"
                  aria-label="QR code"
                >
                  <QrCode className="w-6 h-6" />
                </Button>
              </Link>

              {isAdmin && (
                <Link href="/admin" className="hidden md:block">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-500 hover:text-slate-900 h-11 w-11 min-h-[44px] min-w-[44px]"
                    data-testid="button-admin"
                  aria-label="Admin"
                  >
                    <ShieldCheck className="w-6 h-6" />
                  </Button>
                </Link>
              )}

              {/* Profile avatar placeholder */}
              <div
                className="hidden md:flex w-11 h-11 min-h-[44px] min-w-[44px] bg-accent rounded-full items-center justify-center"
                data-testid="button-profile"
              >
                <User className="w-5 h-5 text-dime-accent" />
              </div>

              {/* Mobile menu trigger */}
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden text-slate-500 hover:text-slate-900 h-11 w-11 min-h-[44px] min-w-[44px]"
                    data-testid="button-menu"
                  aria-label="Menu"
                  >
                    <Menu className="w-6 h-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="bg-card">
                  <div className="flex flex-col space-y-4 mt-8">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeMenu}
                          className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                            active
                              ? "bg-accent text-dime-accent font-semibold"
                              : "text-slate-600 hover:bg-muted"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      );
                    })}

                    <div className="border-t border-border pt-4 mt-4">
                      <Link
                        href="/notifications"
                        onClick={closeMenu}
                        className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                          location === "/notifications"
                            ? "bg-accent text-dime-accent font-semibold"
                            : "text-slate-600 hover:bg-muted"
                        }`}
                      >
                        <Bell className="w-5 h-5" />
                        <span className="font-medium">Notifications</span>
                      </Link>

                      <Link
                        href="/settings"
                        onClick={closeMenu}
                        className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                          location === "/settings"
                            ? "bg-accent text-dime-accent font-semibold"
                            : "text-slate-600 hover:bg-muted"
                        }`}
                      >
                        <Settings className="w-5 h-5" />
                        <span className="font-medium">Settings</span>
                      </Link>

                      <Link
                        href="/qr"
                        onClick={closeMenu}
                        className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                          location === "/qr"
                            ? "bg-accent text-dime-accent font-semibold"
                            : "text-slate-600 hover:bg-muted"
                        }`}
                      >
                        <QrCode className="w-5 h-5" />
                        <span className="font-medium">QR Code</span>
                      </Link>

                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={closeMenu}
                          className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                            location === "/admin"
                              ? "bg-accent text-dime-accent font-semibold"
                              : "text-slate-600 hover:bg-muted"
                          }`}
                        >
                          <ShieldCheck className="w-5 h-5" />
                          <span className="font-medium">Admin</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

      {/* Bottom Navigation (mobile) – respects home indicator via safe-area-bottom */}
      <nav className="safe-area-bottom md:hidden fixed bottom-0 left-0 right-0 border-t border-border px-1 z-50 bg-card/95 backdrop-blur-sm">
        <div className="flex justify-around items-center max-w-screen-xl mx-auto">
          {[...navItems, { href: "/settings", label: "Settings", icon: Settings }].map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-3 px-1 min-h-[56px] transition-colors ${
                  active ? "text-dime-accent" : "text-slate-400"
                }`}
                data-testid={`tab-${item.label.toLowerCase()}`}
              >
                <Icon className="w-6 h-6 mb-1" />
                <span className={`text-[11px] ${active ? "font-semibold" : "font-medium"}`}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
