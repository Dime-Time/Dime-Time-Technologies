import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/queryClient";
import { LogoWithText } from "@/components/logo";
import { saveAuthToken } from "@/lib/authToken";
import { PasswordInput } from "@/components/ui/password-input";
import { isReturningUser, markReturningUser } from "@/lib/returningUser";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formError, setFormError] = useState<string | null>(null);
  const [returning] = useState(() => isReturningUser());

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await fetch(getApiUrl("/api/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Invalid credentials");
      }

      return response.json();
    },
    onSuccess: async (data) => {
      if (data?.authToken) {
        await saveAuthToken(data.authToken);
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: returning ? "Welcome back" : "Welcome to Dime Time" });
      markReturningUser();
      setLocation("/dashboard");
    },
    onError: () => {
      setFormError("Invalid email or password. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!email || !password) {
      setFormError("Please enter your email and password.");
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="dt-auth min-h-screen bg-gradient-to-b from-[#a8a4f0] to-[#918EF4] flex items-center justify-center px-6 py-12 safe-area-top safe-area-bottom">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <LogoWithText size={100} />
        </div>

        <h1 className="text-3xl font-bold text-white text-center mb-1" data-testid="text-login-heading">
          {returning ? "Welcome Back" : "Welcome"}
        </h1>
        <p className="text-white/80 text-center mb-8">
          Log in to your Dime Time account
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
          <PasswordInput
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (formError) setFormError(null); }}
            required
            data-testid="input-password"
            className="border-transparent h-12 rounded-xl"
          />
          {formError && (
            <p
              className="text-sm text-white bg-red-500/30 border border-red-300/60 rounded-md px-3 py-2"
              role="alert"
              data-testid="text-login-error"
            >
              {formError}
            </p>
          )}
          <Button
            type="submit"
            variant="ghost"
            className="auth-submit w-full h-12 rounded-xl font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loginMutation.isPending}
            data-testid="button-login"
          >
            {loginMutation.isPending ? "Logging in…" : "Log In"}
          </Button>

          <div className="text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-white/80 hover:text-white hover:underline"
              data-testid="link-forgot-password"
            >
              Forgot password?
            </Link>
          </div>
        </form>

        <p className="text-sm text-center mt-6 text-white/80">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-white font-semibold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
