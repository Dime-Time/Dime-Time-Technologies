import { useEffect, type ReactNode } from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/navigation";

import {
  initGA,
  setUserId,
  setUserProperties,
  trackLogin,
  setupGlobalErrorTracking,
} from "../lib/analytics";
import { useAnalytics } from "../hooks/use-analytics";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SecurityProvider, useSecurity } from "@/hooks/useSecurity";
import { LockScreen } from "@/components/LockScreen";
import { PinSetup } from "@/components/PinSetup";
import { hasPinSet } from "@/lib/securityStore";
import { migrateTokenStorage } from "@/lib/authToken";

import LandingPage from "@/pages/LandingPage";
import Onboarding from "@/pages/Onboarding";

import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Debts from "@/pages/debts";
import Crypto from "@/pages/crypto";
import Insights from "@/pages/insights";
import Banking from "@/pages/banking";
import BankSetupFlow from "@/components/BankSetupFlow";
import QRCodePage from "@/pages/qr";
import Settings from "@/pages/settings";
import Notifications from "@/pages/notifications";
import Legal from "@/pages/legal";
import Signup from "@/pages/signup";
import Login from "@/pages/Login";
import ComingSoon from "@/pages/ComingSoon";
import DimeToken from "@/pages/dime-token";
import BusinessAnalytics from "@/pages/business-analytics";
import StatsPage from "@/pages/StatsPage";
import NotFound from "@/pages/not-found";

/**
 * Layout for authenticated users:
 * - Respects iOS safe areas (Dynamic Island / notch / home indicator)
 * - Keeps navigation pinned at the bottom
 * - Main content scrolls independently
 */
function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-dime-lilac flex flex-col safe-area-top safe-area-bottom">
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {children}
      </main>
      <nav className="sticky bottom-0 left-0 right-0 safe-area-bottom">
        <Navigation />
      </nav>
    </div>
  );
}

/**
 * Layout for login / signup / auth flows that do not need bottom navigation.
 */
function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-dime-lilac flex flex-col safe-area-top safe-area-bottom">
      <main className="flex-1 flex items-center justify-center px-4">
        {children}
      </main>
    </div>
  );
}

/**
 * Loading screen while auth state initializes.
 */
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#918EF4] flex items-center justify-center safe-area-top safe-area-bottom">
      <div className="text-white text-xl">Loading...</div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isLocked, needsPinSetup, setNeedsPinSetup, unlock, hasPinConfigured } = useSecurity();

  // Pageview tracking, route changes, etc.
  useAnalytics();

  // Initialize user-level analytics when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const internalUserId = user.id || `user_${Date.now()}`;
      setUserId(internalUserId);

      trackLogin("replit_auth");

      setUserProperties({
        user_type: "authenticated",
        signup_month: new Date().toISOString().slice(0, 7), // YYYY-MM
        has_bank_connected: false,
        crypto_enabled: true,
        subscription_tier: "free",
      });

      // Check if user needs PIN setup (first time after signup, no PIN set yet)
      if (!hasPinConfigured && !hasPinSet()) {
        // Don't force PIN setup immediately, let user explore first
        // They can set it up in Settings later
      }
    }
  }, [isAuthenticated, user, hasPinConfigured]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Show lock screen if app is locked
  if (isAuthenticated && isLocked && hasPinConfigured) {
    return <LockScreen onUnlock={unlock} />;
  }

  // Show PIN setup if needed (e.g., prompted from settings)
  if (isAuthenticated && needsPinSetup) {
    return (
      <PinSetup
        onComplete={() => setNeedsPinSetup(false)}
        onSkip={() => setNeedsPinSetup(false)}
      />
    );
  }

  return (
    <Switch>
      {/* Root route: authenticated -> dashboard, unauth -> marketing landing page */}
      <Route path="/">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <Dashboard />
          </AuthenticatedLayout>
        ) : (
          <LandingPage />
        )}
      </Route>

      {/* Explicit login route */}
      <Route path="/login">
        <AuthScreen>
          <Login />
        </AuthScreen>
      </Route>

      {/* Conference / marketing landing */}
      <Route path="/conference" component={LandingPage} />

      {/* Optional onboarding flow if you choose to use it */}
      <Route path="/onboarding">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <Onboarding />
          </AuthenticatedLayout>
        ) : (
          <AuthScreen>
            <Login />
          </AuthScreen>
        )}
      </Route>

      {/* Main authenticated app surfaces */}
      <Route path="/dashboard">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <Dashboard />
          </AuthenticatedLayout>
        ) : (
          <LandingPage />
        )}
      </Route>

      <Route path="/transactions">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <Transactions />
          </AuthenticatedLayout>
        ) : (
          <LandingPage />
        )}
      </Route>

      <Route path="/debts">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <Debts />
          </AuthenticatedLayout>
        ) : (
          <LandingPage />
        )}
      </Route>

      <Route path="/crypto">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <Crypto />
          </AuthenticatedLayout>
        ) : (
          <LandingPage />
        )}
      </Route>

      <Route path="/insights">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <Insights />
          </AuthenticatedLayout>
        ) : (
          <LandingPage />
        )}
      </Route>

      <Route path="/banking">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <Banking />
          </AuthenticatedLayout>
        ) : (
          <LandingPage />
        )}
      </Route>

      <Route path="/qr">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <QRCodePage />
          </AuthenticatedLayout>
        ) : (
          <LandingPage />
        )}
      </Route>

      <Route path="/settings">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <Settings />
          </AuthenticatedLayout>
        ) : (
          <LandingPage />
        )}
      </Route>

      <Route path="/notifications">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <Notifications />
          </AuthenticatedLayout>
        ) : (
          <LandingPage />
        )}
      </Route>

      <Route path="/legal">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <Legal />
          </AuthenticatedLayout>
        ) : (
          <LandingPage />
        )}
      </Route>

      {/* Signup is open so new users can register */}
      <Route path="/signup">
        <AuthScreen>
          <Signup />
        </AuthScreen>
      </Route>

      {/* Bank setup wizard: full-screen, no bottom nav */}
      <Route path="/bank-setup">
        {isAuthenticated ? (
          <div className="min-h-screen bg-dime-lilac safe-area-top safe-area-bottom">
            <main className="flex-1 px-4 pt-4 pb-4">
              <BankSetupFlow
                onComplete={() => (window.location.href = "/dashboard")}
                onSkip={() => (window.location.href = "/dashboard")}
              />
            </main>
          </div>
        ) : (
          <AuthScreen>
            <Login />
          </AuthScreen>
        )}
      </Route>

      <Route path="/dime-token">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <DimeToken />
          </AuthenticatedLayout>
        ) : (
          <LandingPage />
        )}
      </Route>

      <Route path="/business-analytics">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <BusinessAnalytics />
          </AuthenticatedLayout>
        ) : (
          <LandingPage />
        )}
      </Route>

      <Route path="/stats">
        {isAuthenticated ? (
          <AuthenticatedLayout>
            <StatsPage />
          </AuthenticatedLayout>
        ) : (
          <LandingPage />
        )}
      </Route>

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Initialize GA and migrate token storage once at app load
  useEffect(() => {
    initGA();
    setupGlobalErrorTracking();
    // Migrate any unencrypted tokens to encrypted storage
    migrateTokenStorage().catch(console.warn);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SecurityProvider>
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </SecurityProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
