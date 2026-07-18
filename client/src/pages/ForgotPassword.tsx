import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, getApiErrorMessage } from "@/lib/queryClient";
import { LogoWithText } from "@/components/logo";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (payload: { email: string }) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password", payload);
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err: unknown) => {
      toast({
        title: "Couldn't send reset link",
        description: getApiErrorMessage(
          err,
          "We couldn't send the reset email right now. Please try again in a few minutes.",
        ),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    mutation.mutate({ email });
  };

  return (
    <div className="dt-auth min-h-screen bg-gradient-to-b from-[#a8a4f0] to-[#918EF4] flex items-center justify-center px-6 py-12 safe-area-top safe-area-bottom">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <LogoWithText size={100} />
        </div>

        <h1 className="text-3xl font-bold text-white text-center mb-1">
          Forgot password?
        </h1>
        <p className="text-white/80 text-center mb-8 text-sm">
          Enter the email you signed up with and we'll send you a secure reset link.
        </p>

        {submitted ? (
          <div className="space-y-4 text-center" data-testid="text-forgot-password-success">
            <div className="bg-white/10 rounded-xl p-4 text-white text-sm leading-relaxed">
              If an account exists for <span className="font-semibold">{email}</span>, a reset link has been sent.
              The link expires in 60 minutes.
            </div>
            <p className="text-white/70 text-xs">
              Didn't receive it? Check your spam folder or try again in a few minutes.
            </p>
            <Link
              href="/login"
              className="block text-white underline text-sm"
              data-testid="link-back-to-login-success"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-email"
              className="border-transparent h-12 rounded-xl"
            />
            <Button
              type="submit"
              variant="ghost"
              className="auth-submit w-full h-12 rounded-xl font-semibold"
              disabled={mutation.isPending}
              data-testid="button-send-reset-link"
            >
              {mutation.isPending ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="text-sm text-center mt-6 text-white/80">
          Remembered it?{" "}
          <Link href="/login" className="text-white hover:underline" data-testid="link-back-to-login">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
