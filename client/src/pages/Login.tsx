import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/queryClient";
import { LogoWithText } from "@/components/logo";
import { saveAuthToken } from "@/lib/authToken";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      toast({ title: "Welcome back!" });
      setLocation("/dashboard");
    },
    onError: () => {
      toast({
        title: "Login failed",
        description: "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-[#a8a4f0] flex items-center justify-center px-4 safe-area-top safe-area-bottom">
      <div className="w-full max-w-md bg-[#918EF4] rounded-3xl p-8">
        <div className="flex justify-center mb-4">
          <LogoWithText size={100} />
        </div>
        
        <h1 className="text-2xl font-bold text-white text-center mb-1">
          Welcome Back
        </h1>
        <p className="text-white/80 text-center mb-8">
          Login to your Dime Time account
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            data-testid="input-email"
            className="bg-[#918EF4] border-white/40 text-white placeholder:text-white/60 h-12 rounded-xl"
          />
          <Input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            data-testid="input-password"
            className="bg-[#918EF4] border-white/40 text-white placeholder:text-white/60 h-12 rounded-xl"
          />
          <Button
            type="submit"
            variant="ghost"
            className="w-full text-white hover:bg-white/10 h-12"
            disabled={loginMutation.isPending}
            data-testid="button-login"
          >
            {loginMutation.isPending ? "Logging in..." : "Login"}
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
          <Link href="/signup" className="text-white hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
