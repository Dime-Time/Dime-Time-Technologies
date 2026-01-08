import { useState } from "react";
import { AccountCreationFlow } from "@/components/AccountCreationFlow";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle } from "lucide-react";
import OnboardingFlow from "@/components/OnboardingFlow";
import { useQueryClient } from "@tanstack/react-query";
import { saveAuthToken } from "@/lib/authToken";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [showAccountFlow, setShowAccountFlow] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const queryClient = useQueryClient();

  const handleAccountCreated = async (data: any) => {
    setUserData(data);
    setAccountCreated(true);
    setShowAccountFlow(false);

    // If backend returns an auth token, persist it for native apps
    if (data?.authToken) {
      saveAuthToken(data.authToken);
    }

    // Refresh the user cache so /api/user reflects the new session
    await queryClient.invalidateQueries({ queryKey: ["/api/user"] });

    // Start onboarding flow after brief success message
    setTimeout(() => {
      setShowOnboarding(true);
    }, 1500);
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);

    // Final cache refresh to ensure user data is fully loaded
    await queryClient.invalidateQueries({ queryKey: ["/api/user"] });

    // Redirect into bank setup inside the SPA
    setTimeout(() => {
      setLocation("/bank-setup");
    }, 500);
  };

  // Success state between account creation and onboarding
  if (accountCreated && !showOnboarding) {
    return (
      <div className="min-h-screen bg-dime-lilac flex items-center justify-center p-4 safe-area-top safe-area-bottom">
        <Card className="w-full max-w-md text-center bg-dime-background/90 border-white/20">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-xl">
              Account Created Successfully!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-white/80">
              Welcome to Dime Time, {userData?.firstName}! Let&apos;s get you
              started on your debt-free journey.
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-white/70">
              <div className="w-2 h-2 bg-dime-purple rounded-full animate-pulse"></div>
              <div
                className="w-2 h-2 bg-dime-purple rounded-full animate-pulse"
                style={{ animationDelay: "0.2s" }}
              ></div>
              <div
                className="w-2 h-2 bg-dime-purple rounded-full animate-pulse"
                style={{ animationDelay: "0.4s" }}
              ></div>
              <span className="ml-2">
                Preparing your personalized setup...
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dime-lilac overflow-y-auto h-screen safe-area-top safe-area-bottom">
      <div className="container mx-auto px-4 py-8">
        {/* Back to Home */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        {/* Hero copy */}
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">
              Join Dime Time
            </h1>
            <p className="text-lg mb-8 text-white/80">
              Transform your financial future with intelligent debt reduction
              and round-up investments.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-dime-background/90 border-white/20">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-dime-purple/20 rounded-lg border border-dime-purple/40 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">💰</span>
                </div>
                <h3 className="font-semibold mb-2">Smart Round-ups</h3>
                <p className="text-sm text-white/80">
                  Automatically invest spare change in crypto or debt payments.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-dime-background/90 border-white/20">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-dime-purple/20 rounded-lg border border-dime-purple/40 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="font-semibold mb-2">Debt Tracking</h3>
                <p className="text-sm text-white/80">
                  Monitor progress and get personalized debt-free projections.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-dime-background/90 border-white/20">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-dime-purple/20 rounded-lg border border-dime-purple/40 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔒</span>
                </div>
                <h3 className="font-semibold mb-2">Bank-Level Security</h3>
                <p className="text-sm text-white/80">
                  Your financial data is protected with enterprise-grade
                  encryption.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Call to action */}
          <Button
            onClick={() => setShowAccountFlow(true)}
            size="lg"
            className="bg-dime-purple hover:bg-dime-purple/90 text-lg px-8 py-3"
            data-testid="button-start-signup"
          >
            Create Free Account
          </Button>

          <p className="text-sm mt-4 text-white/80">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-dime-lavender underline-offset-2 hover:underline"
            >
              Sign in here
            </Link>
          </p>
        </div>

        {/* Account creation modal / flow */}
        {showAccountFlow && (
          <AccountCreationFlow
            onAccountCreated={handleAccountCreated}
            onCancel={() => setShowAccountFlow(false)}
          />
        )}

        {/* Onboarding flow shown after account creation */}
        {showOnboarding && userData && (
          <OnboardingFlow
            userName={userData.firstName}
            onComplete={handleOnboardingComplete}
          />
        )}
      </div>
    </div>
  );
}
