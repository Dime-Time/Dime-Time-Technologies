import { useLocation } from "wouter";
import { LogoWithText } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingDown, Zap, Shield, Smartphone, CreditCard, Bitcoin, BarChart3, ChevronDown } from "lucide-react";
import appDashboardImage from "@assets/generated_images/App_dashboard_screenshot_29cdedbe.png";
import marketingAnimalImage from "@assets/generated_images/Professional_porcupine_Dime_Time_marketing_bd119a00.png";
import veteranBadgeImage from "@assets/generated_images/Veteran_owned_business_badge_eee1cd07.png";

export default function LandingPage() {
  const [, navigate] = useLocation();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* ── Nav ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-[#918EF4] rounded-xl p-1">
              <LogoWithText size={32} />
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <button onClick={() => scrollToSection("how-it-works")} className="hover:text-[#918EF4] transition-colors">How It Works</button>
            <button onClick={() => scrollToSection("features")} className="hover:text-[#918EF4] transition-colors">Features</button>
            <button onClick={() => scrollToSection("technology")} className="hover:text-[#918EF4] transition-colors">Technology</button>
            <button onClick={() => scrollToSection("about")} className="hover:text-[#918EF4] transition-colors">About</button>
          </nav>
          <Button
            onClick={() => navigate("/login")}
            className="bg-[#918EF4] hover:bg-[#7a77d4] text-white font-semibold px-6 rounded-full"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="min-h-screen bg-gradient-to-br from-[#918EF4] via-[#7a77d4] to-[#5a56a8] flex flex-col items-center justify-center text-center px-6 pt-16 relative overflow-hidden">
        {/* Background circles */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          <div className="mb-8">
            <LogoWithText size={120} />
          </div>

          <div className="inline-flex items-center gap-2 bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-full mb-6">
            <Zap className="w-4 h-4" />
            Patent-Pending Round-Up Technology
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
            Get out of debt<br />
            <span className="text-white/80">one dime at a time.</span>
          </h1>

          <p className="text-xl md:text-2xl text-white/80 max-w-2xl mb-10 leading-relaxed">
            Dime Time automatically rounds up your everyday purchases and puts your spare change to work — paying down debt and building crypto wealth simultaneously.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-center mb-12">
            <Button
              onClick={() => navigate("/login")}
              className="bg-white text-[#918EF4] hover:bg-gray-100 font-bold px-8 py-4 h-auto text-lg rounded-full shadow-lg"
            >
              Sign In to Your Account
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="text-white/80 hover:text-white font-medium flex items-center gap-2 transition-colors"
            >
              Learn how it works
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-8 max-w-lg w-full">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">$0.63</div>
              <div className="text-white/60 text-sm mt-1">avg. round-up</div>
            </div>
            <div className="text-center border-x border-white/20">
              <div className="text-3xl font-bold text-white">2-Way</div>
              <div className="text-white/60 text-sm mt-1">debt + crypto split</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">100%</div>
              <div className="text-white/60 text-sm mt-1">automated</div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/50" />
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#918EF4] font-semibold text-sm uppercase tracking-widest">How It Works</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-4">Three steps to financial freedom</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">Dime Time works silently in the background. You spend normally — we handle the rest.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: <CreditCard className="w-8 h-8 text-[#918EF4]" />,
                title: "Connect Your Bank",
                desc: "Securely link your bank account using Plaid's bank-grade encryption. We read your transactions — we never move money without your permission."
              },
              {
                step: "02",
                icon: <Zap className="w-8 h-8 text-[#918EF4]" />,
                title: "We Round Up Every Purchase",
                desc: "Every time you spend $4.37, we collect $0.63. That spare change gets split between your debt payments and crypto — automatically."
              },
              {
                step: "03",
                icon: <TrendingDown className="w-8 h-8 text-[#918EF4]" />,
                title: "Watch Your Debt Disappear",
                desc: "Round-ups stack up fast. See your debt-free date move closer every week as micro-payments chip away at your balances."
              }
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 relative">
                <div className="absolute top-6 right-6 text-5xl font-black text-gray-50">{item.step}</div>
                <div className="bg-purple-50 w-14 h-14 rounded-xl flex items-center justify-center mb-5">
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Round-up visual example */}
          <div className="mt-16 bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100">
            <h3 className="text-2xl font-bold text-center mb-8">See it in action</h3>
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-6 mb-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Purchase at Starbucks</div>
                  <div className="text-2xl font-bold">$4.37</div>
                </div>
                <div className="text-gray-300 text-3xl">→</div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">Rounded up to</div>
                  <div className="text-2xl font-bold">$5.00</div>
                </div>
                <div className="text-gray-300 text-3xl">→</div>
                <div>
                  <div className="text-sm text-[#918EF4] mb-1 font-medium">Round-up collected</div>
                  <div className="text-2xl font-bold text-[#918EF4]">$0.63</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-50 rounded-xl p-5 text-center">
                  <TrendingDown className="w-6 h-6 text-[#918EF4] mx-auto mb-2" />
                  <div className="font-bold text-lg text-[#918EF4]">$0.40</div>
                  <div className="text-sm text-gray-500">→ Debt Payment (63%)</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-5 text-center">
                  <Bitcoin className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                  <div className="font-bold text-lg text-orange-400">$0.23</div>
                  <div className="text-sm text-gray-500">→ Bitcoin Purchase (37%)</div>
                </div>
              </div>
              <p className="text-center text-sm text-gray-400 mt-4">Split percentages are fully customizable — you choose how to allocate your round-ups.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#918EF4] font-semibold text-sm uppercase tracking-widest">Features</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-4">Everything you need to win with money</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <TrendingDown className="w-6 h-6 text-[#918EF4]" />,
                title: "Debt Tracking",
                desc: "See all your debts in one place — credit cards, personal loans, student loans. Track balances, interest rates, and minimum payments."
              },
              {
                icon: <Zap className="w-6 h-6 text-[#918EF4]" />,
                title: "Round-Up Engine",
                desc: "Our patent-pending technology collects spare change from every purchase and puts it to work immediately — no manual transfers needed."
              },
              {
                icon: <CreditCard className="w-6 h-6 text-[#918EF4]" />,
                title: "Bank Integration",
                desc: "Powered by Plaid — the same technology used by leading fintech apps. Your credentials are never stored on our servers."
              },
              {
                icon: <Bitcoin className="w-6 h-6 text-[#918EF4]" />,
                title: "Crypto Round-Ups",
                desc: "A portion of every round-up can automatically purchase Bitcoin through Coinbase. Build a crypto portfolio while paying off debt."
              },
              {
                icon: <BarChart3 className="w-6 h-6 text-[#918EF4]" />,
                title: "Smart Analytics",
                desc: "See your debt-free date, projected savings, and payment history. Understand exactly how your micro-payments add up over time."
              },
              {
                icon: <Shield className="w-6 h-6 text-[#918EF4]" />,
                title: "Bank-Grade Security",
                desc: "Bcrypt encryption, AES-GCM token storage, rate limiting, and a 4-digit PIN lock. Your data is protected at every layer."
              }
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-gray-100 hover:border-[#918EF4]/30 hover:shadow-md transition-all group">
                <div className="bg-purple-50 group-hover:bg-[#918EF4] w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors">
                  <div className="group-hover:text-white transition-colors">{f.icon}</div>
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── App Preview ── */}
      <section className="py-24 px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-[#918EF4] font-semibold text-sm uppercase tracking-widest">The App</span>
              <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 leading-tight">
                Built for your phone.<br />Designed to be simple.
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-8">
                Dime Time is a native iOS and Android app. Clean, intuitive design with a personalized dashboard that shows you exactly where you stand — debts, round-ups collected, and your crypto portfolio all in one place.
              </p>
              <ul className="space-y-3">
                {[
                  "Real-time transaction monitoring",
                  "One-tap accelerated debt payments",
                  "Customizable round-up split percentages",
                  "Face ID / PIN security lock",
                  "Full transaction history and receipts"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-700">
                    <div className="w-5 h-5 bg-[#918EF4] rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex items-center gap-4">
                <div className="bg-gray-100 text-gray-500 px-6 py-3 rounded-full font-semibold flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Coming to App Store
                </div>
                <div className="bg-gray-100 text-gray-500 px-6 py-3 rounded-full font-semibold flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Coming to Google Play
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-[#918EF4]/20 rounded-3xl blur-3xl transform scale-95" />
                <img
                  src={appDashboardImage}
                  alt="Dime Time App Dashboard"
                  className="relative rounded-3xl shadow-2xl w-full max-w-sm border border-gray-100"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Technology ── */}
      <section id="technology" className="py-24 px-6 bg-[#918EF4]">
        <div className="max-w-6xl mx-auto text-center">
          <span className="text-white/60 font-semibold text-sm uppercase tracking-widest">Patent-Pending</span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mt-3 mb-6">
            Dynamic Dual-Split Round-Up<br />Microallocation System
          </h2>
          <p className="text-white/80 text-xl max-w-3xl mx-auto mb-12 leading-relaxed">
            Dime Time's core technology is the first system that proportionally distributes round-up residuals across multiple financial destinations simultaneously — debt, crypto, savings — using static, dynamic, or algorithmically recalculated weights.
          </p>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { label: "Multi-Destination", desc: "Round-ups split across debt, crypto, and savings in a single transaction" },
              { label: "Fully Configurable", desc: "Any percentage split from 0% to 100% — integer, decimal, or dynamic" },
              { label: "Idempotency Protected", desc: "Every financial transaction is protected against duplicate execution" }
            ].map((t) => (
              <div key={t.label} className="bg-white/10 backdrop-blur rounded-2xl p-6 text-left">
                <div className="text-white font-bold text-lg mb-2">{t.label}</div>
                <div className="text-white/70 text-sm leading-relaxed">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section id="about" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="flex justify-center">
              <img
                src={marketingAnimalImage}
                alt="Dime Time"
                className="w-full max-w-sm rounded-3xl shadow-xl"
              />
            </div>
            <div>
              <span className="text-[#918EF4] font-semibold text-sm uppercase tracking-widest">About Dime Time</span>
              <h2 className="text-4xl font-bold mt-3 mb-6 leading-tight">
                Built by someone who<br />knows what debt feels like.
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-6">
                Dime Time was created with one mission: make debt repayment automatic, painless, and even rewarding. Traditional budgeting apps show you the problem. Dime Time solves it — one spare dime at a time.
              </p>
              <p className="text-gray-500 text-lg leading-relaxed mb-8">
                We believe that financial freedom shouldn't require a finance degree. With round-up technology and smart automation, anyone can make consistent progress on their debt — starting with their very next purchase.
              </p>
              <div className="flex items-center gap-4">
                <img
                  src={veteranBadgeImage}
                  alt="Veteran Owned Business"
                  className="h-16 w-auto"
                />
                <div>
                  <div className="font-bold text-gray-900">Veteran-Owned Business</div>
                  <div className="text-gray-500 text-sm">Proudly built in the United States</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 bg-gradient-to-br from-[#918EF4] to-[#5a56a8] text-center">
        <div className="max-w-2xl mx-auto">
          <LogoWithText size={80} />
          <h2 className="text-4xl md:text-5xl font-bold text-white mt-8 mb-4">
            Ready to start paying down debt?
          </h2>
          <p className="text-white/80 text-xl mb-10">
            Sign in to your account or join the waitlist for early access when we launch on the App Store.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate("/login")}
              className="bg-white text-[#918EF4] hover:bg-gray-100 font-bold px-8 py-4 h-auto text-lg rounded-full"
            >
              Sign In to Your Account
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-10">
            <div>
              <div className="bg-[#918EF4] rounded-xl p-2 inline-block mb-3">
                <LogoWithText size={40} />
              </div>
              <p className="text-sm max-w-xs leading-relaxed mt-3">
                Automated debt reduction through round-up microallocation technology.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
              <div>
                <div className="text-white font-semibold mb-3">Product</div>
                <ul className="space-y-2">
                  <li><button onClick={() => scrollToSection("how-it-works")} className="hover:text-white transition-colors">How It Works</button></li>
                  <li><button onClick={() => scrollToSection("features")} className="hover:text-white transition-colors">Features</button></li>
                  <li><button onClick={() => scrollToSection("technology")} className="hover:text-white transition-colors">Technology</button></li>
                </ul>
              </div>
              <div>
                <div className="text-white font-semibold mb-3">Company</div>
                <ul className="space-y-2">
                  <li><button onClick={() => scrollToSection("about")} className="hover:text-white transition-colors">About</button></li>
                  <li><a href="mailto:support@dime-time.com" className="hover:text-white transition-colors">Contact</a></li>
                </ul>
              </div>
              <div>
                <div className="text-white font-semibold mb-3">Legal</div>
                <ul className="space-y-2">
                  <li><button onClick={() => navigate("/legal")} className="hover:text-white transition-colors">Privacy Policy</button></li>
                  <li><button onClick={() => navigate("/legal")} className="hover:text-white transition-colors">Terms of Service</button></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
            <div>&copy; {new Date().getFullYear()} Dime Time Technologies. All rights reserved.</div>
            <div className="flex items-center gap-2">
              <span className="text-[#918EF4]">Patent Pending</span>
              <span>·</span>
              <span>Veteran-Owned Business</span>
              <span>·</span>
              <a href="https://dime-time.com" className="hover:text-white transition-colors">dime-time.com</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
