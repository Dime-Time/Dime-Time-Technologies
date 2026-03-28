import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/queryClient";
import { LogoWithText } from "@/components/logo";
import { saveAuthToken } from "@/lib/authToken";

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password) return;

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

      toast({ title: `Welcome to Dime Time, ${firstName}!` });
      setLocation("/dashboard");
    } catch (err: any) {
      toast({
        title: "Signup failed",
        description: err.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#a8a4f0] flex items-center justify-center px-4 safe-area-top safe-area-bottom">
      <div className="w-full max-w-md bg-[#918EF4] rounded-3xl p-8">
        <div className="flex justify-center mb-4">
          <LogoWithText size={100} />
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-1">
          Create Account
        </h1>
        <p className="text-white/80 text-center mb-8">
          Start your debt-free journey today
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="First Name"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="bg-[#918EF4] border-white/40 text-white placeholder:text-white/60 h-12 rounded-xl"
            />
            <Input
              type="text"
              placeholder="Last Name"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="bg-[#918EF4] border-white/40 text-white placeholder:text-white/60 h-12 rounded-xl"
            />
          </div>

          <Input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-[#918EF4] border-white/40 text-white placeholder:text-white/60 h-12 rounded-xl"
          />

          <Input
            type="password"
            placeholder="Password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-[#918EF4] border-white/40 text-white placeholder:text-white/60 h-12 rounded-xl"
          />

          <Button
            type="submit"
            variant="ghost"
            className="w-full text-white hover:bg-white/10 h-12"
            disabled={isLoading}
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <p className="text-sm text-center mt-6 text-white/80">
          Already have an account?{" "}
          <Link href="/login" className="text-white hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
