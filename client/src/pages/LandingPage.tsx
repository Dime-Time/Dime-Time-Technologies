import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight, Shield, Zap, TrendingDown, BarChart3,
  Lock, ChevronRight, Bitcoin, CreditCard, CheckCircle2,
  Menu, X
} from "lucide-react";
import appDashboardImage from "@assets/generated_images/App_dashboard_screenshot_29cdedbe.png";
import logoImg from "@assets/9C86D612-C9E4-448E-8F8B-CC8F618BAE03_1756051233947.png";

function NavLink({ label, href }: { label: string; href: string }) {
  const scroll = () => {
    const el = document.getElementById(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <button onClick={scroll} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
      {label}
    </button>
  );
}

export default function LandingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [betaSuccess, setBetaSuccess] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    name: string;
    email: string;
    phone?: string;
  }>();

  const betaMutation = useMutation({
    mutationFn: (data: { name: string; email: string; phone?: string }) =>
      apiRequest("POST", "/api/contact", {
        name: data.name,
        email: data.email,
        message: `Landing page beta signup${data.phone ? ` | Phone: ${data.phone}` : ""}`,
      }),
    onSuccess: () => { setBetaSuccess(true); reset(); },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again or email us directly.",
        variant: "destructive",
      });
    },
  });

  const onBetaSubmit = (data: { name: string; email: string; phone?: string }) => {
    betaMutation.mutate(data);
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans antialiased overflow-x-hidden">

      {/* ─── Navigation ──────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0f]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#918EF4] flex items-center justify-center">
              <img src={logoImg} alt="Dime Time" className="w-6 h-6 object-contain" />
            </div>
            <span className="font-bold text-white tracking-tight text-lg">Dime Time</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <NavLink label="How It Works" href="how-it-works" />
            <NavLink label="Features" href="features" />
            <NavLink label="Security" href="security" />
            <NavLink label="Investors" href="investors" />
          </nav>

          {/* Desktop CTAs — acquisition focused, no Sign In */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => scrollTo("investors")}
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors px-4 py-2"
            >
              Investor Info
            </button>
            <button
              onClick={() => scrollTo("beta")}
              className="text-sm font-semibold bg-[#918EF4] hover:bg-[#7b78e0] text-white px-5 py-2 rounded-lg transition-colors"
            >
              Join Beta
            </button>
          </div>

          <button
            className="md:hidden text-gray-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#0a0a0f] px-6 py-4 flex flex-col gap-4">
            {[
              { id: "how-it-works", label: "How It Works" },
              { id: "features", label: "Features" },
              { id: "security", label: "Security" },
              { id: "investors", label: "Investors" },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="text-sm text-gray-400 text-left"
              >
                {label}
              </button>
            ))}
            <div className="flex gap-3 pt-2 border-t border-white/5">
              <button
                onClick={() => scrollTo("investors")}
                className="flex-1 text-sm text-gray-400 border border-white/10 rounded-lg py-2"
              >
                Investor Info
              </button>
              <button
                onClick={() => scrollTo("beta")}
                className="flex-1 text-sm font-semibold bg-[#918EF4] text-white rounded-lg py-2"
              >
                Join Beta
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ─── Hero ────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#918EF4]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-[#6366f1]/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 border border-[#918EF4]/30 bg-[#918EF4]/10 text-[#a5a3f7] text-xs font-semibold px-4 py-2 rounded-full mb-8 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[#918EF4] animate-pulse" />
            Patent Filing in Preparation · Now in Beta
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6">
            Turn Everyday Purchases Into
            <br />
            <span className="text-[#918EF4]">Debt Paydown</span> and
            <br />
            <span className="text-[#918EF4]">Bitcoin Accumulation.</span>
          </h1>

          <p className="text-gray-400 text-xl md:text-2xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Dime Time automatically rounds up card purchases and routes spare change toward debt repayment and Bitcoin purchases based on your chosen allocation.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
            <button
              onClick={() => scrollTo("beta")}
              className="inline-flex items-center justify-center gap-2 bg-[#918EF4] hover:bg-[#7b78e0] text-white font-semibold px-8 py-4 rounded-xl text-base transition-all hover:shadow-[0_0_30px_rgba(145,142,244,0.4)]"
            >
              Join the Beta
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollTo("investors")}
              className="inline-flex items-center justify-center gap-2 border border-white/10 hover:border-white/25 text-gray-300 hover:text-white font-semibold px-8 py-4 rounded-xl text-base transition-all"
            >
              Investor Information
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Product preview */}
          <div className="relative max-w-2xl mx-auto">
            <div className="absolute inset-0 bg-[#918EF4]/20 rounded-3xl blur-3xl" />
            <div className="relative border border-white/10 rounded-3xl overflow-hidden bg-[#0f0f1a] shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#0d0d18]">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                <div className="mx-auto text-xs text-gray-600 font-mono">dime-time.com/dashboard</div>
              </div>
              <img src={appDashboardImage} alt="Dime Time Dashboard" className="w-full h-auto" />
            </div>

            {/* Floating allocation card */}
            <div className="absolute -right-4 md:-right-12 top-1/3 bg-[#13131f] border border-white/10 rounded-2xl p-4 shadow-2xl w-44 hidden sm:block">
              <div className="text-xs text-gray-500 mb-3 font-medium">Round-Up Allocation</div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">Debt</span>
                    <span className="text-[#918EF4] font-semibold">80%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#918EF4] rounded-full" style={{ width: "80%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">Bitcoin</span>
                    <span className="text-orange-400 font-semibold">20%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-400 rounded-full" style={{ width: "20%" }} />
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-500">
                Last round-up: <span className="text-white font-medium">$0.63</span>
              </div>
            </div>

            {/* Floating transaction card */}
            <div className="absolute -left-4 md:-left-12 bottom-1/4 bg-[#13131f] border border-white/10 rounded-2xl p-4 shadow-2xl w-44 hidden sm:block">
              <div className="text-xs text-gray-500 mb-2 font-medium">Latest Round-Up</div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-[#918EF4]/20 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-3.5 h-3.5 text-[#918EF4]" />
                </div>
                <div>
                  <div className="text-xs text-white font-medium">Purchase</div>
                  <div className="text-[10px] text-gray-500">$4.37 → $5.00</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#918EF4]">+$0.63</span>
                <span className="text-green-400 text-[10px]">Processed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Trust Bar ───────────────────────────────────────────────── */}
      <div className="border-y border-white/5 bg-[#0d0d18] py-6 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-12 text-gray-600 text-sm font-medium">
          <span>Built with</span>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {["Plaid Connectivity", "Coinbase Integration", "Encrypted Data Handling", "Secure Web Sessions"].map((name) => (
              <span key={name} className="text-gray-400 text-sm font-semibold">{name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── How It Works ────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 px-6 bg-[#0a0a0f]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#918EF4] text-sm font-semibold uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Three steps. Fully automated.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-10 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-px bg-gradient-to-r from-transparent via-[#918EF4]/30 to-transparent" />
            {[
              {
                num: "01",
                icon: <Shield className="w-5 h-5 text-[#918EF4]" />,
                title: "Connect Your Account",
                desc: "Securely link your bank account. Your credentials stay with your bank — Dime Time only reads transaction data to identify qualifying purchases.",
              },
              {
                num: "02",
                icon: <Zap className="w-5 h-5 text-[#918EF4]" />,
                title: "Every Purchase Rounds Up",
                desc: "Each qualifying transaction is rounded to the next dollar. The difference — your spare change — is collected and queued for allocation.",
              },
              {
                num: "03",
                icon: <TrendingDown className="w-5 h-5 text-[#918EF4]" />,
                title: "Spare Change Goes to Work",
                desc: "Your round-up is split according to your chosen allocation: a portion toward debt repayment and the remainder toward Bitcoin purchases.",
              },
            ].map((step) => (
              <div key={step.num} className="relative bg-[#0f0f1a] border border-white/5 rounded-2xl p-8 hover:border-[#918EF4]/20 transition-all">
                <div className="absolute top-6 right-6 text-4xl font-black text-white/3 select-none">{step.num}</div>
                <div className="w-10 h-10 rounded-xl bg-[#918EF4]/10 flex items-center justify-center mb-5">{step.icon}</div>
                <h3 className="text-lg font-bold mb-3 text-white">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Why Dime Time ───────────────────────────────────────────── */}
      <section className="py-28 px-6 bg-[#0d0d18]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[#918EF4] text-sm font-semibold uppercase tracking-widest mb-4">Why Dime Time</p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
                Put Every Purchase To Work.
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-6">
                Most round-up apps move spare change into savings. Dime Time takes a different approach by routing round-ups toward debt repayment and Bitcoin accumulation.
              </p>
              <p className="text-gray-400 text-lg leading-relaxed mb-8">
                Instead of letting spare change sit idle, users can apply each round-up toward paying down liabilities while also building digital asset exposure through automated allocation.
              </p>
              <div className="space-y-3">
                {[
                  "No manual transfers required",
                  "Works automatically with everyday purchases",
                  "Adjustable allocation between debt repayment and Bitcoin",
                  "Built around a proprietary round-up allocation model",
                ].map((point) => (
                  <div key={point} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#918EF4] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-sm">{point}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Allocation visual */}
            <div className="bg-[#0a0a0f] border border-white/5 rounded-3xl p-8">
              <div className="text-sm text-gray-500 mb-6 font-medium">Example Allocation — $0.63 round-up</div>
              <div className="flex gap-3 mb-8">
                <div className="flex-1 bg-[#918EF4]/10 border border-[#918EF4]/20 rounded-2xl p-5 text-center">
                  <TrendingDown className="w-6 h-6 text-[#918EF4] mx-auto mb-3" />
                  <div className="text-3xl font-bold text-[#918EF4] mb-1">80%</div>
                  <div className="text-xs text-gray-400">$0.50</div>
                  <div className="text-xs text-gray-500 mt-1">→ Debt Repayment</div>
                </div>
                <div className="flex-1 bg-orange-500/5 border border-orange-500/20 rounded-2xl p-5 text-center">
                  <Bitcoin className="w-6 h-6 text-orange-400 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-orange-400 mb-1">20%</div>
                  <div className="text-xs text-gray-400">$0.13</div>
                  <div className="text-xs text-gray-500 mt-1">→ Bitcoin</div>
                </div>
              </div>
              <div className="h-3 rounded-full overflow-hidden flex gap-0.5 mb-4">
                <div className="h-full bg-[#918EF4] rounded-l-full" style={{ width: "80%" }} />
                <div className="h-full bg-orange-400 rounded-r-full" style={{ width: "20%" }} />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>← Debt Repayment</span>
                <span>Bitcoin →</span>
              </div>
              <div className="mt-6 pt-6 border-t border-white/5 text-xs text-gray-500 text-center">
                Allocation is fully adjustable. You set the split.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────────────── */}
      <section id="features" className="py-28 px-6 bg-[#0a0a0f]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#918EF4] text-sm font-semibold uppercase tracking-widest mb-3">Platform Features</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Built for serious financial progress.</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: <TrendingDown className="w-5 h-5 text-[#918EF4]" />,
                title: "Automated Debt Repayment",
                desc: "Every qualifying round-up can be directed toward debt paydown automatically, reducing the need for manual transfers or extra financial admin.",
              },
              {
                icon: <Bitcoin className="w-5 h-5 text-orange-400" />,
                title: "Bitcoin Allocation",
                desc: "A configurable percentage of each round-up can be used for Bitcoin purchases, allowing users to build exposure gradually through everyday spending.",
              },
              {
                icon: <Zap className="w-5 h-5 text-yellow-400" />,
                title: "Flexible Allocation Controls",
                desc: "Choose how each round-up is divided between debt repayment and Bitcoin purchases. Adjust your allocation at any time.",
              },
              {
                icon: <CreditCard className="w-5 h-5 text-blue-400" />,
                title: "Transaction-Based Automation",
                desc: "Round-ups are triggered by qualifying purchases, turning routine card activity into a consistent automated allocation workflow.",
              },
              {
                icon: <BarChart3 className="w-5 h-5 text-green-400" />,
                title: "Progress Tracking",
                desc: "Users can monitor cumulative round-ups, projected debt impact, and Bitcoin accumulation over time within the product experience.",
              },
              {
                icon: <Lock className="w-5 h-5 text-purple-400" />,
                title: "Secure Financial Connectivity",
                desc: "Built with modern financial connectivity and secure authentication practices designed for consumer fintech applications.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group bg-[#0f0f1a] border border-white/5 rounded-2xl p-6 hover:border-[#918EF4]/20 hover:bg-[#111120] transition-all cursor-default"
              >
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center mb-4">{f.icon}</div>
                <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Security ────────────────────────────────────────────────── */}
      <section id="security" className="py-28 px-6 bg-[#0d0d18]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#918EF4] text-sm font-semibold uppercase tracking-widest mb-3">Security & Trust</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Privacy-first. Security-forward.</h2>
            <p className="text-gray-400 text-lg mt-4 max-w-2xl mx-auto">
              We handle financial data with the same rigor as established fintech institutions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: <Shield className="w-6 h-6 text-[#918EF4]" />,
                title: "Secure Connectivity",
                desc: "Financial account connections are handled through trusted connectivity providers built for modern fintech applications.",
              },
              {
                icon: <Lock className="w-6 h-6 text-[#918EF4]" />,
                title: "Encrypted Data Handling",
                desc: "Sensitive data is transmitted and stored using modern encryption and access-control practices appropriate for financial software.",
              },
              {
                icon: <CheckCircle2 className="w-6 h-6 text-[#918EF4]" />,
                title: "Privacy-Conscious Design",
                desc: "Dime Time is being built with a focus on data minimization, controlled access, and responsible handling of user financial information.",
              },
              {
                icon: <Zap className="w-6 h-6 text-[#918EF4]" />,
                title: "Security-Oriented Architecture",
                desc: "The platform is designed with authentication, secure session handling, and operational safeguards intended to support reliable financial workflows.",
              },
            ].map((t) => (
              <div key={t.title} className="flex gap-5 bg-[#0a0a0f] border border-white/5 rounded-2xl p-6">
                <div className="w-12 h-12 rounded-xl bg-[#918EF4]/10 flex items-center justify-center flex-shrink-0">{t.icon}</div>
                <div>
                  <h3 className="text-base font-bold text-white mb-2">{t.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Vision ──────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#0a0a0f] border-y border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-5xl mb-6 opacity-60">❝</div>
          <blockquote className="text-2xl md:text-3xl font-medium text-gray-200 leading-relaxed mb-6">
            Dime Time helps turn everyday spending into automated financial action by routing spare change toward debt repayment and Bitcoin accumulation.
          </blockquote>
          <div className="text-gray-500 text-sm font-medium">Company Mission Statement</div>
        </div>
      </section>

      {/* ─── Investors ───────────────────────────────────────────────── */}
      <section id="investors" className="py-28 px-6 bg-[#0d0d18]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[#918EF4] text-sm font-semibold uppercase tracking-widest mb-4">For Investors</p>
              <h2 className="text-4xl font-bold tracking-tight mb-6 leading-tight">
                Built for a large consumer pain point.
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Dime Time is an early-stage consumer fintech platform focused on automated round-up allocations for debt repayment and Bitcoin purchases.
              </p>
              <p className="text-gray-400 leading-relaxed mb-8">
                We are developing the product for users who want a more intentional use of spare change than traditional savings-based round-up apps provide.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { label: "Stage", value: "Pre-Seed" },
                  { label: "Status", value: "Beta Active" },
                  { label: "IP", value: "Filing in Preparation" },
                  { label: "Founded", value: "2025" },
                ].map((item) => (
                  <div key={item.label} className="bg-[#0a0a0f] border border-white/5 rounded-xl p-4">
                    <div className="text-gray-500 text-xs mb-1">{item.label}</div>
                    <div className="text-white font-semibold">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="mailto:invest@dime-time.com?subject=Investor Deck Request"
                  className="inline-flex items-center justify-center gap-2 bg-[#918EF4] hover:bg-[#7b78e0] text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all"
                >
                  Request Investor Deck
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="mailto:founder@dime-time.com?subject=Founder Contact"
                  className="inline-flex items-center justify-center gap-2 border border-white/10 hover:border-white/25 text-gray-300 hover:text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all"
                >
                  Contact the Founder
                </a>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { metric: "Patent Filing in Preparation", detail: "Dynamic Dual-Split Round-Up Microallocation System — USPTO provisional filing in preparation" },
                { metric: "Live on TestFlight", detail: "iOS app built and distributed to beta testers via Apple TestFlight" },
                { metric: "Built with Plaid Connectivity", detail: "Dime Time is being developed with Plaid connectivity for linked account workflows." },
                { metric: "Veteran-Owned", detail: "Proudly built and operated by a U.S. military veteran" },
              ].map((item) => (
                <div key={item.metric} className="bg-[#0a0a0f] border border-white/5 rounded-2xl p-5 flex gap-4">
                  <div className="w-2 flex-shrink-0 flex flex-col items-center pt-1">
                    <div className="w-2 h-2 rounded-full bg-[#918EF4]" />
                    <div className="w-px flex-1 bg-[#918EF4]/20 mt-2" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm mb-1">{item.metric}</div>
                    <div className="text-gray-500 text-xs leading-relaxed">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Beta Signup ─────────────────────────────────────────────── */}
      <section id="beta" className="py-28 px-6 bg-[#0a0a0f] relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[300px] bg-[#918EF4]/8 rounded-full blur-[100px]" />
        </div>
        <div className="relative z-10 max-w-xl mx-auto text-center">
          <p className="text-[#918EF4] text-sm font-semibold uppercase tracking-widest mb-4">Early Access</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Join the Beta.</h2>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed">
            Be among the first to experience automated debt repayment and Bitcoin accumulation through Dime Time.
          </p>

          {betaSuccess ? (
            <div className="bg-[#918EF4]/10 border border-[#918EF4]/30 rounded-2xl p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-[#918EF4] mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">You're on the list.</h3>
              <p className="text-gray-400 text-sm">We'll be in touch when early access opens.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onBetaSubmit)} className="bg-[#0f0f1a] border border-white/5 rounded-2xl p-8 text-left space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">Full Name <span className="text-red-400">*</span></label>
                <input
                  {...register("name", { required: true })}
                  placeholder="Jane Smith"
                  className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#918EF4]/50 transition-colors"
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">Name is required</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">Email Address <span className="text-red-400">*</span></label>
                <input
                  {...register("email", { required: true, pattern: /^\S+@\S+$/i })}
                  type="email"
                  placeholder="jane@example.com"
                  className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#918EF4]/50 transition-colors"
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">Valid email is required</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">Phone <span className="text-gray-600 font-normal">(optional)</span></label>
                <input
                  {...register("phone")}
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#918EF4]/50 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={betaMutation.isPending}
                className="w-full bg-[#918EF4] hover:bg-[#7b78e0] disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl text-sm transition-all mt-2"
              >
                {betaMutation.isPending ? "Submitting..." : "Request Early Access"}
              </button>
              <p className="text-xs text-gray-600 text-center">
                Request early access and we'll reach out when beta capacity opens.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#0d0d18] py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#918EF4] flex items-center justify-center">
                  <img src={logoImg} alt="Dime Time" className="w-5 h-5 object-contain" />
                </div>
                <span className="font-bold text-white tracking-tight">Dime Time</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs mb-5">
                Automated debt repayment and Bitcoin accumulation through a proprietary round-up allocation model.
              </p>
              <a href="mailto:hello@dime-time.com" className="text-[#918EF4] text-sm hover:underline">hello@dime-time.com</a>
            </div>

            <div>
              <div className="text-white font-semibold text-sm mb-4">Product</div>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><button onClick={() => scrollTo("how-it-works")} className="hover:text-gray-300 transition-colors">How It Works</button></li>
                <li><button onClick={() => scrollTo("features")} className="hover:text-gray-300 transition-colors">Features</button></li>
                <li><button onClick={() => scrollTo("security")} className="hover:text-gray-300 transition-colors">Security</button></li>
                <li><button onClick={() => scrollTo("beta")} className="hover:text-gray-300 transition-colors">Join Beta</button></li>
              </ul>
            </div>

            <div>
              <div className="text-white font-semibold text-sm mb-4">Company</div>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><button onClick={() => scrollTo("investors")} className="hover:text-gray-300 transition-colors">Investors</button></li>
                <li><a href="mailto:founder@dime-time.com" className="hover:text-gray-300 transition-colors">Contact</a></li>
                <li><button onClick={() => navigate("/login")} className="hover:text-gray-300 transition-colors">Sign In</button></li>
                {/* TODO: Separate /privacy and /terms routes when distinct legal pages are created */}
                <li><button onClick={() => navigate("/legal")} className="hover:text-gray-300 transition-colors">Privacy Policy</button></li>
                <li><button onClick={() => navigate("/legal")} className="hover:text-gray-300 transition-colors">Terms of Service</button></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-600">
            <div>&copy; {new Date().getFullYear()} Dime Time Technologies. All rights reserved.</div>
            <div className="flex items-center gap-4">
              <span className="text-[#918EF4]/70">Patent Filing in Preparation</span>
              <span>·</span>
              <span>Veteran-Owned Business</span>
              <span>·</span>
              <a href="https://dime-time.com" className="hover:text-gray-400 transition-colors">dime-time.com</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
