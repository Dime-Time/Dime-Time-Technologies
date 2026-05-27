import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Banknote,
  Repeat,
  Zap,
  LineChart,
  Building2,
  ShieldCheck,
  Menu,
  X,
  Mail,
  ChevronDown,
} from "lucide-react";
import logoUrl from "@/assets/dime-time-app-icon.png";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

const FAQS = [
  {
    q: "What is Dime Time?",
    a: "Dime Time is a financial-technology app that helps you pay down debt and build better money habits by automating small, recurring payments and round-ups from your everyday spending.",
  },
  {
    q: "Is Dime Time a bank?",
    a: "No. Dime Time is a fintech platform, not a bank. Banking services and money movement are provided through regulated financial partners.",
  },
  {
    q: "How does the round-up feature work?",
    a: "When you make an everyday purchase, Dime Time rounds it up to the next dollar and directs the spare change toward the debts you've chosen — so you make progress automatically.",
  },
  {
    q: "Is my financial data secure?",
    a: "Yes. Sensitive data is encrypted in transit (TLS 1.2+) and at rest (AES-256-GCM). Account credentials are hashed, and bank connections are tokenized through trusted infrastructure providers.",
  },
  {
    q: "Does Dime Time cost anything to use?",
    a: "Creating an account is free. Some advanced features may have a small subscription fee, which will always be clearly disclosed before you sign up.",
  },
  {
    q: "How do I cancel or delete my account?",
    a: "You can delete your account anytime from the Settings page inside the app. We'll remove your personal data, subject to the financial-records retention rules required by law.",
  },
];

const CONTACT_EMAIL = "tim@dime-time.com";
const TURNSTILE_SITE_KEY: string | undefined = (import.meta as any).env
  ?.VITE_TURNSTILE_SITE_KEY;
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const { toast } = useToast();

  // Load the Turnstile script + render the widget once mounted.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;

    let cancelled = false;

    const renderWidget = () => {
      if (cancelled) return;
      if (!window.turnstile || !turnstileContainerRef.current) return;
      if (turnstileWidgetIdRef.current) return;
      turnstileWidgetIdRef.current = window.turnstile.render(
        turnstileContainerRef.current,
        {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(null),
          "error-callback": () => setTurnstileToken(null),
          theme: "light",
        }
      );
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.querySelector<HTMLScriptElement>(
        `script[src="${TURNSTILE_SCRIPT_SRC}"]`
      );
      if (!script) {
        script = document.createElement("script");
        script.src = TURNSTILE_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget);
    }

    return () => {
      cancelled = true;
      if (turnstileWidgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch {
          /* noop */
        }
        turnstileWidgetIdRef.current = null;
      }
    };
  }, []);

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast({
        title: "Please fill out all fields",
        variant: "destructive",
      });
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      toast({
        title: "Please complete the captcha",
        description: "Verify you're not a robot before sending.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/contact", {
        name,
        email,
        message,
        ...(turnstileToken ? { turnstileToken } : {}),
      });
      toast({
        title: "Message sent",
        description: "Thanks — we'll get back to you shortly.",
      });
      setName("");
      setEmail("");
      setMessage("");
      setTurnstileToken(null);
      if (turnstileWidgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        } catch {
          /* noop */
        }
      }
    } catch (err) {
      toast({
        title: "Couldn't send message",
        description: `Please email us directly at ${CONTACT_EMAIL}.`,
        variant: "destructive",
      });
      setTurnstileToken(null);
      if (turnstileWidgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        } catch {
          /* noop */
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dt-marketing min-h-screen bg-white text-slate-900 antialiased">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2"
              aria-label="Dime Time home"
            >
              <img
                src={logoUrl}
                alt="Dime Time logo"
                className="h-9 w-9 rounded-lg"
              />
              <span className="text-lg font-semibold text-slate-900">
                Dime Time
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-slate-600 hover:text-dime-purple transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="hidden md:block">
              <Link href="/signup">
                <Button className="bg-dime-purple text-white hover:bg-dime-purple/90">
                  Get Started
                </Button>
              </Link>
            </div>

            <button
              className="md:hidden p-2 text-slate-700"
              aria-label="Toggle menu"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {mobileOpen && (
            <div className="md:hidden border-t border-slate-200 py-4">
              <div className="flex flex-col gap-4">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-sm font-medium text-slate-600 hover:text-dime-purple"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
                <Link href="/signup">
                  <Button className="w-full bg-dime-purple text-white hover:bg-dime-purple/90">
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section id="home" className="px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900">
            Get out of debt, one dime at a time
            <br />
            with <span className="text-dime-purple">Dime Time</span>.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Dime Time helps consumers automate payments, manage ACH transfers,
            and build healthier financial habits through secure digital money
            tools.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-dime-purple text-white hover:bg-dime-purple/90 px-8"
              >
                Get Started
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button
                size="lg"
                variant="outline"
                className="border-dime-purple text-dime-purple hover:bg-dime-purple/5 px-8"
              >
                Learn More
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="px-4 sm:px-6 lg:px-8 py-20 bg-slate-50 border-y border-slate-200"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              How It Works
            </h2>
            <p className="mt-4 text-slate-600">
              Three simple steps to put your money on autopilot.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Connect your bank account securely",
                body: "Link your bank in seconds using bank-grade encryption.",
              },
              {
                step: "2",
                title: "Schedule recurring ACH payments and transfers",
                body: "Set it once and let Dime Time handle the rest.",
              },
              {
                step: "3",
                title: "Track your financial progress",
                body: "See your balances, payments, and progress in one place.",
              },
            ].map(({ step, title, body }) => (
              <div
                key={step}
                className="bg-white rounded-xl border border-slate-200 p-6"
              >
                <div className="w-10 h-10 rounded-full bg-dime-purple text-white flex items-center justify-center font-semibold mb-4">
                  {step}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Features
            </h2>
            <p className="mt-4 text-slate-600">
              Everything you need to move money with confidence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { icon: Banknote, label: "ACH Transfers" },
              { icon: Repeat, label: "Recurring Payments" },
              { icon: Zap, label: "Payment Automation" },
              { icon: LineChart, label: "Financial Tracking" },
              { icon: Building2, label: "Bank Connectivity" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="bg-white rounded-xl border border-slate-200 p-6 text-center hover:border-dime-purple/40 transition-colors"
              >
                <div className="w-12 h-12 mx-auto rounded-lg bg-dime-purple/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-dime-purple" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust / Security ────────────────────────────────────────────── */}
      <section
        id="about"
        className="px-4 sm:px-6 lg:px-8 py-20 bg-slate-50 border-y border-slate-200"
      >
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-dime-purple/10 flex items-center justify-center mb-6">
            <ShieldCheck className="w-7 h-7 text-dime-purple" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
            Built on trusted financial infrastructure
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            Dime Time works with established financial infrastructure providers
            and banking partners to support secure payment processing,
            encrypted banking connections, and responsible money movement.
          </p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section
        id="faq"
        className="px-4 sm:px-6 lg:px-8 py-20"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Frequently Asked Questions
            </h2>
            <p className="mt-4 text-slate-600">
              Everything you need to know about Dime Time.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map(({ q, a }) => (
              <details
                key={q}
                className="group bg-white rounded-xl border border-slate-200 open:border-dime-purple/40"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none px-5 py-4 text-base font-medium text-slate-900">
                  <span>{q}</span>
                  <ChevronDown className="w-5 h-5 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ─────────────────────────────────────────────────────── */}
      <section
        id="contact"
        className="px-4 sm:px-6 lg:px-8 py-20 bg-slate-50 border-y border-slate-200"
      >
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="w-14 h-14 mx-auto rounded-full bg-dime-purple/10 flex items-center justify-center mb-5">
              <Mail className="w-7 h-7 text-dime-purple" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Get in Touch
            </h2>
            <p className="mt-4 text-slate-600">
              Questions, feedback, or partnership inquiries? Send us a message —
              or email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-dime-purple hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </div>

          <form
            onSubmit={handleContactSubmit}
            className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-5"
            data-testid="form-contact"
          >
            <div className="space-y-2">
              <Label htmlFor="contact-name" className="text-sm font-medium text-slate-700">
                Name
              </Label>
              <Input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                data-testid="input-contact-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email" className="text-sm font-medium text-slate-700">
                Email
              </Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                data-testid="input-contact-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message" className="text-sm font-medium text-slate-700">
                Message
              </Label>
              <Textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help?"
                rows={5}
                required
                data-testid="input-contact-message"
              />
            </div>
            {TURNSTILE_SITE_KEY ? (
              <div
                ref={turnstileContainerRef}
                className="flex justify-center"
                data-testid="contact-turnstile"
              />
            ) : null}
            <Button
              type="submit"
              disabled={submitting || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
              className="w-full bg-dime-purple text-white hover:bg-dime-purple/90"
              data-testid="button-contact-submit"
            >
              {submitting ? "Sending…" : "Send Message"}
            </Button>
          </form>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="px-4 sm:px-6 lg:px-8 py-12 bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <Link href="/" className="flex items-center gap-2">
              <img
                src={logoUrl}
                alt="Dime Time logo"
                className="h-8 w-8 rounded-md"
              />
              <span className="font-semibold text-slate-900">Dime Time</span>
            </Link>

            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
              <Link href="/privacy" className="hover:text-dime-purple">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-dime-purple">
                Terms of Service
              </Link>
              <a href="#about" className="hover:text-dime-purple">
                About
              </a>
              <a href="#contact" className="hover:text-dime-purple">
                Contact
              </a>
              <a href="#faq" className="hover:text-dime-purple">
                FAQ
              </a>
            </nav>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 text-center md:text-left">
            <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
              Dime Time is a financial technology platform and is not a bank.
              Banking services and payment infrastructure are provided through
              regulated financial partners.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              © {new Date().getFullYear()} Dime Time. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
