import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/queryClient";
import { LogoWithText } from "@/components/logo";
import { saveAuthToken } from "@/lib/authToken";
import { PasswordInput } from "@/components/ui/password-input";
import { markReturningUser } from "@/lib/returningUser";

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!firstName || !lastName || !email || !password) {
      setFormError("Please fill in every field.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(getApiUrl("/api/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Signup failed");
      }

      const data = await response.json();

      if (data?.authToken) {
        await saveAuthToken(data.authToken);
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      markReturningUser();

      toast({
        title: `Welcome to Dime Time, ${firstName}!`,
        description: "Check your email to verify your account.",
      });
      setLocation("/dashboard");
    } catch (err: any) {
      setFormError(err?.message || "Signup failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dt-auth min-h-screen bg-gradient-to-b from-[#a8a4f0] to-[#918EF4] flex items-center justify-center px-6 py-12 safe-area-top safe-area-bottom">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <LogoWithText size={100} />
        </div>

        <h1 className="text-3xl font-bold text-white text-center mb-1">
          Create Account
        </h1>
        <p className="text-white/80 text-center mb-8">
          Start your debt-free journey today
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="First Name"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => { setFirstName(e.target.value); if (formError) setFormError(null); }}
              required
              data-testid="input-firstname"
              className="border-transparent h-12 rounded-xl"
            />
            <Input
              type="text"
              placeholder="Last Name"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => { setLastName(e.target.value); if (formError) setFormError(null); }}
              required
              data-testid="input-lastname"
              className="border-transparent h-12 rounded-xl"
            />
          </div>

          <Input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (formError) setFormError(null); }}
            required
            data-testid="input-email"
            className="border-transparent h-12 rounded-xl"
          />

          <div className="space-y-1">
            <PasswordInput
              placeholder="Password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (formError) setFormError(null); }}
              required
              minLength={8}
              data-testid="input-password"
              className="border-transparent h-12 rounded-xl"
            />
            <p className="text-xs text-white/70 px-1">
              At least 8 characters.
            </p>
          </div>

          {formError && (
            <p
              className="text-sm text-white bg-red-500/30 border border-red-300/60 rounded-md px-3 py-2"
              role="alert"
              data-testid="text-signup-error"
            >
              {formError}
            </p>
          )}

          <Button
            type="submit"
            variant="ghost"
            className="auth-submit w-full h-12 rounded-xl font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isLoading}
            data-testid="button-signup"
          >
            {isLoading ? "Creating account…" : "Create Account"}
          </Button>
        </form>

        <p className="text-sm text-center mt-6 text-white/80">
          Already have an account?{" "}
          <Link href="/login" className="text-white font-semibold hover:underline">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
