import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/navigation";
import { useEffect } from "react";
import { initGA, setUserId, setUserProperties, trackLogin, setupGlobalErrorTracking } from "../lib/analytics";
import { useAnalytics } from "../hooks/use-analytics";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import LandingPage from "@/pages/LandingPage";
import Onboarding from "@/pages/Onboarding";

import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Debts from "@/pages/debts";
import Crypto from "@/pages/crypto";
import Insights from "@/pages/insights";
import Banking from "@/pages/banking";
import QRCodePage from "@/pages/qr";
import Settings from "@/pages/settings";
import Notifications from "@/pages/notifications";
import Legal from "@/pages/legal";
import Signup from "@/pages/signup";
import Login from "@/pages/Login";
import DimeToken from "@/pages/dime-token";
import BusinessAnalytics from "@/pages/business-analytics";
import StatsPage from "@/pages/StatsPage";
import NotFound from "@/pages/not-found";

function Router() {
  // Track page views and user interactions
  useAnalytics();
  
  return (
    <Switch>
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/debts" component={Debts} />
      <Route path="/crypto" component={Crypto} />
      <Route path="/insights" component={Insights} />
      <Route path="/banking" component={Banking} />
      <Route path="/qr" component={QRCodePage} />
      <Route path="/settings" component={Settings} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/legal" component={Legal} />
      <Route path="/signup" component={Signup} />
      <Route path="/dime-token" component={DimeToken} />
      <Route path="/business-analytics" component={BusinessAnalytics} />
      <Route path="/stats" component={StatsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Initialize Google Analytics when app loads
  useEffect(() => {
    console.log('Initializing Google Analytics for Dime Time...');
    initGA();
    setupGlobalErrorTracking();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-dime-lilac">
            <AppContent />
            <Toaster />
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Track user authentication and set user properties
  useEffect(() => {
    if (isAuthenticated && user) {
      // Set user ID (using internal UUID, not PII)
      const internalUserId = user.id || `user_${Date.now()}`;
      setUserId(internalUserId);
      
      // Track successful login
      trackLogin('replit_auth');
      
      // Set user properties for audience segmentation
      setUserProperties({
        user_type: 'authenticated',
        signup_month: new Date().toISOString().slice(0, 7), // YYYY-MM format for privacy
        has_bank_connected: false, // You can update this based on actual data
        crypto_enabled: true, // Update based on user preferences
        subscription_tier: 'free' // Update based on actual subscription
      });
    }
  }, [isAuthenticated, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#918EF4] flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated, otherwise redirect to dashboard
  return (
    <Switch>
      <Route path="/" >
        {isAuthenticated ? (
          // Redirect authenticated users to dashboard
          <>
            <Navigation />
            <Dashboard />
          </>
        ) : (
          <Login />
        )}
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/conference" component={LandingPage} />
      <Route path="/dashboard">
        {isAuthenticated ? (
          <>
            <Navigation />
            <Dashboard />
          </>
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/transactions">
        {isAuthenticated ? (
          <>
            <Navigation />
            <Transactions />
          </>
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/debts">
        {isAuthenticated ? (
          <>
            <Navigation />
            <Debts />
          </>
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/crypto">
        {isAuthenticated ? (
          <>
            <Navigation />
            <Crypto />
          </>
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/insights">
        {isAuthenticated ? (
          <>
            <Navigation />
            <Insights />
          </>
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/banking">
        {isAuthenticated ? (
          <>
            <Navigation />
            <Banking />
          </>
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/qr">
        {isAuthenticated ? (
          <>
            <Navigation />
            <QRCodePage />
          </>
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/settings">
        {isAuthenticated ? (
          <>
            <Navigation />
            <Settings />
          </>
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/notifications">
        {isAuthenticated ? (
          <>
            <Navigation />
            <Notifications />
          </>
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/legal">
        {isAuthenticated ? (
          <>
            <Navigation />
            <Legal />
          </>
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/signup" component={Signup} />
      <Route path="/dime-token">
        {isAuthenticated ? (
          <>
            <Navigation />
            <DimeToken />
          </>
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/business-analytics">
        {isAuthenticated ? (
          <>
            <Navigation />
            <BusinessAnalytics />
          </>
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/stats">
        {isAuthenticated ? (
          <>
            <Navigation />
            <StatsPage />
          </>
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default App;
