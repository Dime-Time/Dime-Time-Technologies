import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { LogoWithText } from "@/components/logo";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Status = "idle" | "verifying" | "success" | "error";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    const t = new URLSearchParams(window.location.search).get("token") || "";
    // SECURITY: remove ?token=... from the address bar / browser history /
    // referrer header immediately. Defense-in-depth against the token
    // leaking via analytics page_view (already sanitized in
    // client/lib/analytics.ts) or outbound link Referer headers.
    if (t && typeof window.history?.replaceState === "function") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    return t;
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This page needs a verification token. Open the link from the email we sent you.");
      return;
    }

    let cancelled = false;
    setStatus("verifying");

    (async () => {
      try {
        const res = await fetch(getApiUrl("/api/auth/verify-email"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          credentials: "include",
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          setStatus("error");
          setMessage(body.message || "We couldn't verify this link.");
          return;
        }

        setStatus("success");
        setMessage(body.message || "Email verified.");
        // Refresh the cached user so the in-app banner disappears.
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage("Network error. Please try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="dt-auth min-h-screen bg-gradient-to-b from-[#a8a4f0] to-[#918EF4] flex items-center justify-center px-6 py-12 safe-area-top safe-area-bottom">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-4">
          <LogoWithText size={100} />
        </div>

        {(status === "idle" || status === "verifying") && (
          <div data-testid="text-verifying">
            <Loader2 className="h-10 w-10 text-white animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-1">Verifying your email…</h1>
            <p className="text-white/80 text-sm">This will only take a second.</p>
          </div>
        )}

        {status === "success" && (
          <div data-testid="text-verify-success">
            <CheckCircle2 className="h-12 w-12 text-white mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Email verified</h1>
            <p className="text-white/80 text-sm mb-6">{message}</p>
            <Button
              onClick={() => setLocation("/")}
              variant="ghost"
              className="auth-submit w-full h-12 rounded-xl font-semibold"
              data-testid="button-continue-to-app"
            >
              Continue to app
            </Button>
          </div>
        )}

        {status === "error" && (
          <div data-testid="text-verify-error">
            <XCircle className="h-12 w-12 text-white mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Verification link didn't work</h1>
            <p className="text-white/80 text-sm mb-6">{message}</p>
            <Link
              href="/"
              className="block text-white underline text-sm"
              data-testid="link-back-to-app"
            >
              Back to the app
            </Link>
            <p className="text-white/70 text-xs mt-4">
              Need a new link? Open the app and tap "Resend verification email" from the banner at the top.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
