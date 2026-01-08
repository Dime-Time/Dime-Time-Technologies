import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    onSuccess: (data) => {
      // Save auth token for native apps (persists across app restarts)
      if (data?.authToken) {
        saveAuthToken(data.authToken);
      }

      // Refetch current user so the app immediately sees the new session
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });

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
    <div className="min-h-screen bg-dime-lilac flex items-center justify-center px-4 safe-area-top safe-area-bottom">
      <Card className="w-full max-w-md bg-dime-background/90 border-white/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <LogoWithText />
          </div>
          <CardTitle>Welcome Back</CardTitle>
          <CardDescription>Login to your Dime Time account</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-email"
            />
            <Input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="input-password"
            />
            <Button
              type="submit"
              className="w-full bg-dime-purple hover:bg-dime-purple/90"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? "Logging in..." : "Login"}
            </Button>
          </form>

          <p className="text-sm text-center mt-4 text-white/80">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-dime-lavender underline-offset-2 hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
