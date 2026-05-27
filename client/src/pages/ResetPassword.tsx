import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/queryClient";
import { LogoWithText } from "@/components/logo";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") || "";
  }, []);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: async (payload: { token: string; password: string }) => {
      const response = await fetch(getApiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Unable to reset password");
      }
      return response.json();
    },
    onSuccess: () => {
      setDone(true);
      toast({ title: "Password updated", description: "You can now sign in with your new password." });
      setTimeout(() => setLocation("/login"), 1800);
    },
    onError: (err: Error) => {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast({ title: "Missing reset token", description: "Open the link from your email.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", description: "Re-enter the same password in both fields.", variant: "destructive" });
      return;
    }
    mutation.mutate({ token, password });
  };

  return (
    <div className="min-h-screen bg-[#a8a4f0] flex items-center justify-center px-4 safe-area-top safe-area-bottom">
      <div className="w-full max-w-md bg-[#918EF4] rounded-3xl p-8">
        <div className="flex justify-center mb-4">
          <LogoWithText size={100} />
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-1">
          Choose a new password
        </h1>
        <p className="text-white/80 text-center mb-8 text-sm">
          Use at least 8 characters. You'll be signed out of any other sessions.
        </p>

        {!token ? (
          <div
            className="bg-white/10 rounded-xl p-4 text-white text-sm text-center"
            data-testid="text-missing-token"
          >
            This page needs a reset token. Open the link from your reset email, or{" "}
            <Link href="/forgot-password" className="underline">request a new link</Link>.
          </div>
        ) : done ? (
          <div className="space-y-4 text-center" data-testid="text-reset-success">
            <div className="bg-white/10 rounded-xl p-4 text-white text-sm">
              Password updated. Redirecting to login…
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="New password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              data-testid="input-new-password"
              className="bg-[#918EF4] border-white/40 text-white placeholder:text-white/60 h-12 rounded-xl"
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              data-testid="input-confirm-password"
              className="bg-[#918EF4] border-white/40 text-white placeholder:text-white/60 h-12 rounded-xl"
            />
            <Button
              type="submit"
              variant="ghost"
              className="w-full text-white hover:bg-white/10 h-12"
              disabled={mutation.isPending}
              data-testid="button-reset-password"
            >
              {mutation.isPending ? "Saving..." : "Reset password"}
            </Button>
          </form>
        )}

        <p className="text-sm text-center mt-6 text-white/80">
          <Link href="/login" className="text-white hover:underline" data-testid="link-back-to-login">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
