import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getApiErrorMessage } from "@/lib/queryClient";
import { Mail, X } from "lucide-react";

const DISMISSED_KEY = "dimetime.verifyEmail.dismissedAt";
const DISMISS_HOURS = 4;

/**
 * In-app banner prompting the user to verify their email. Visible only to
 * signed-in users whose `emailVerifiedAt` is null. User can dismiss it for
 * a few hours so it isn't naggy across navigation.
 */
export function EmailVerificationBanner() {
  const { user } = useAuth() as { user: (any & { emailVerifiedAt?: string | null }) | null };
  const { toast } = useToast();

  const initiallyDismissed = (() => {
    if (typeof window === "undefined") return false;
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_HOURS * 60 * 60 * 1000;
  })();

  const [dismissed, setDismissed] = useState(initiallyDismissed);

  const resendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/send-verification", {});
    },
    onSuccess: () => {
      toast({
        title: "Verification email sent",
        description: `We sent a new link to ${user?.email ?? "your email"}. It expires in 24 hours.`,
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

  if (!user) return null;
  if (user.emailVerifiedAt) return null;
  if (dismissed) return null;

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    }
    setDismissed(true);
  };

  return (
    <div
      className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-3"
      data-testid="banner-verify-email"
      role="status"
    >
      <div className="max-w-2xl mx-auto flex items-start gap-3">
        <Mail className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0 text-sm">
          <p className="font-semibold leading-tight">Verify your email</p>
          <p className="leading-snug">
            Confirm <span className="font-medium break-all">{user.email}</span> to secure your account and receive payment notifications.
          </p>
          <button
            type="button"
            onClick={() => resendMutation.mutate()}
            disabled={resendMutation.isPending}
            className="mt-1 text-amber-900 underline font-medium disabled:opacity-60"
            data-testid="button-resend-verification"
          >
            {resendMutation.isPending ? "Sending…" : "Resend verification email"}
          </button>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={handleDismiss}
          className="text-amber-700 hover:text-amber-900 flex-shrink-0"
          data-testid="button-dismiss-verify-banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
