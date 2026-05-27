import { useEffect, useRef, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
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
import { migrateTokenStorage, hasStoredToken } from "@/lib/authToken";

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
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Signup from "@/pages/signup";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import ComingSoon from "@/pages/ComingSoon";
import DimeToken from "@/pages/dime-token";
import BusinessAnalytics from "@/pages/business-analytics";
import StatsPage from "@/pages/StatsPage";
import NotFound from "@/pages/not-found";

function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-dime-lilac flex flex-col safe-area-top safe-area-bottom">
      <EmailVerificationBanner />
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {children}
      </main>
      <nav className="sticky bottom-0 left-0 right-0 safe-area-bottom">
        <Navigation />
      </nav>
    </div>
  );
}

function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-dime-lilac flex flex-col safe-area-top safe-area-bottom">
      <main className="flex-1 flex items-center justify-center px-4">
        {children}
      </main>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isLocked, needsPinSetup, setNeedsPinSetup, unlock, hasPinConfigured } = useSecurity();
  const isNative = Capacitor.isNativePlatform();
  const paintRef = useRef(performance.now());

  // Log first visible paint on every render cycle
  useEffect(() => {
    const elapsed = performance.now() - paintRef.current;
    console.log(`[DimeTime] first paint in ${elapsed.toFixed(0)}ms`);
  }, []);

  useAnalytics();

  useEffect(() => {
    if (isAuthenticated && user) {
      const internalUserId = user.id || `user_${Date.now()}`;
      setUserId(internalUserId);
      trackLogin("replit_auth");
      setUserProperties({
        user_type: "authenticated",
        signup_month: new Date().toISOString().slice(0, 7),
        has_bank_connected: false,
        crypto_enabled: true,
        subscription_tier: "free",
      });

      if (!hasPinConfigured && !hasPinSet()) {
        // PIN setup deferred — user can enable in Settings
      }
    }
  }, [isAuthenticated, user, hasPinConfigured]);

  // ── Optimistic auth ──────────────────────────────────────────────────────
  // If isLoading is still true (no cached user data resolved yet), we use
  // hasStoredToken() as a synchronous signal:
  //   • Token present  → optimistically render as authenticated (dashboard shows
  //     with cached/empty data while /api/user validates in background)
  //   • No token       → render as unauthenticated immediately (login/landing)
  //
  // This eliminates the blank LoadingScreen in all real-world scenarios.
  // If the background /api/user call returns 401, isAuthenticated becomes false
  // and the user is redirected to login automatically.
  const effectivelyAuthenticated = isAuthenticated || (isLoading && hasStoredToken());

  const UnauthenticatedRoot = isNative ? (
    <AuthScreen><Login /></AuthScreen>
  ) : (
    <LandingPage />
  );

  // Lock screen (PIN) takes priority over everything else when authenticated
  if (effectivelyAuthenticated && isLocked && hasPinConfigured) {
    return <LockScreen onUnlock={unlock} />;
  }

  // PIN setup prompt
  if (effectivelyAuthenticated && needsPinSetup) {
    return (
      <PinSetup
        onComplete={() => setNeedsPinSetup(false)}
        onSkip={() => setNeedsPinSetup(false)}
      />
    );
  }

  return (
    <Switch>
      <Route path="/">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><Dashboard /></AuthenticatedLayout>
        ) : (
          UnauthenticatedRoot
        )}
      </Route>

      <Route path="/login">
        <AuthScreen><Login /></AuthScreen>
      </Route>

      <Route path="/conference" component={LandingPage} />

      <Route path="/onboarding">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><Onboarding /></AuthenticatedLayout>
        ) : (
          <AuthScreen><Login /></AuthScreen>
        )}
      </Route>

      <Route path="/dashboard">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><Dashboard /></AuthenticatedLayout>
        ) : (
          UnauthenticatedRoot
        )}
      </Route>

      <Route path="/transactions">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><Transactions /></AuthenticatedLayout>
        ) : (
          UnauthenticatedRoot
        )}
      </Route>

      <Route path="/debts">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><Debts /></AuthenticatedLayout>
        ) : (
          UnauthenticatedRoot
        )}
      </Route>

      <Route path="/crypto">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><Crypto /></AuthenticatedLayout>
        ) : (
          UnauthenticatedRoot
        )}
      </Route>

      <Route path="/insights">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><Insights /></AuthenticatedLayout>
        ) : (
          UnauthenticatedRoot
        )}
      </Route>

      <Route path="/banking">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><Banking /></AuthenticatedLayout>
        ) : (
          UnauthenticatedRoot
        )}
      </Route>

      <Route path="/qr">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><QRCodePage /></AuthenticatedLayout>
        ) : (
          UnauthenticatedRoot
        )}
      </Route>

      <Route path="/settings">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><Settings /></AuthenticatedLayout>
        ) : (
          UnauthenticatedRoot
        )}
      </Route>

      <Route path="/notifications">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><Notifications /></AuthenticatedLayout>
        ) : (
          UnauthenticatedRoot
        )}
      </Route>

      <Route path="/legal">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><Legal /></AuthenticatedLayout>
        ) : (
          UnauthenticatedRoot
        )}
      </Route>

      <Route path="/signup">
        <AuthScreen><Signup /></AuthScreen>
      </Route>

      <Route path="/forgot-password">
        <AuthScreen><ForgotPassword /></AuthScreen>
      </Route>

      <Route path="/reset-password">
        <AuthScreen><ResetPassword /></AuthScreen>
      </Route>

      <Route path="/verify-email">
        <AuthScreen><VerifyEmail /></AuthScreen>
      </Route>

      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />

      <Route path="/bank-setup">
        {effectivelyAuthenticated ? (
          <div className="min-h-screen bg-dime-lilac safe-area-top safe-area-bottom">
            <main className="flex-1 px-4 pt-4 pb-4">
              <BankSetupFlow
                onComplete={() => (window.location.href = "/dashboard")}
                onSkip={() => (window.location.href = "/dashboard")}
              />
            </main>
          </div>
        ) : (
          <AuthScreen><Login /></AuthScreen>
        )}
      </Route>

      <Route path="/dime-token">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><DimeToken /></AuthenticatedLayout>
        ) : (
          UnauthenticatedRoot
        )}
      </Route>

      <Route path="/business-analytics">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><BusinessAnalytics /></AuthenticatedLayout>
        ) : (
          UnauthenticatedRoot
        )}
      </Route>

      <Route path="/stats">
        {effectivelyAuthenticated ? (
          <AuthenticatedLayout><StatsPage /></AuthenticatedLayout>
        ) : (
          UnauthenticatedRoot
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    console.log(`[DimeTime] app bootstrap started at ${performance.now().toFixed(0)}ms`);
    initGA();
    setupGlobalErrorTracking();
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
