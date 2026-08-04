import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getApiErrorMessage, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Mail, RefreshCw, LogOut } from "lucide-react";

/**
 * Full-screen recovery surface shown (in place of app content) when
 * REQUIRE_EMAIL_VERIFICATION is ON and the signed-in user's email is not
 * verified. Never a blank page, redirect loop, or raw 403: the user can
 * resend the link, re-check status, reach support/legal pages, or log out.
 */
export function VerificationRequired() {
  const { user } = useAuth() as { user: (any & { email?: string | null }) | null };
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);

  const resendMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/auth/send-verification", {}),
    onSuccess: () => {
      toast({
        title: "Verification email sent",
        description: `We sent a new link to ${user?.email ?? "your email"}. Check spam or promotions if you don't see it.`,
      });
    },
    onError: (err) => {
      toast({
        title: "Couldn't send email",
        description: getApiErrorMessage(err, "Please try again in a moment."),
        variant: "destructive",
      });
    },
  });

  const checkStatus = async () => {
    setChecking(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    } finally {
      setTimeout(() => setChecking(false), 800);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background" data-testid="screen-verification-required">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">Verify your email to continue</h1>
        <p className="text-muted-foreground">
          We sent a verification link to{" "}
          <span className="font-medium">{user?.email ?? "your email"}</span>. Tap the
          link in that email, then come back here. The link expires in 24 hours.
        </p>
        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={() => resendMutation.mutate()}
            disabled={resendMutation.isPending}
            data-testid="button-verification-required-resend"
          >
            {resendMutation.isPending ? "Sending…" : "Resend verification email"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={checkStatus}
            disabled={checking}
            data-testid="button-verification-required-refresh"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            I've verified — check again
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => { window.location.href = "/api/logout"; }}
            data-testid="button-verification-required-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Wrong address or stuck?{" "}
          <a href="/support" className="underline">Contact support</a> ·{" "}
          <a href="/privacy" className="underline">Privacy</a> ·{" "}
          <a href="/terms" className="underline">Terms</a>
        </p>
      </div>
    </div>
  );
}
