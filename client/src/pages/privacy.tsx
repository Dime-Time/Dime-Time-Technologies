import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";
import logoUrl from "@/assets/dime-time-app-icon.png";

// NOTE: Update EFFECTIVE_DATE only when the policy text below actually changes.
const EFFECTIVE_DATE = "May 27, 2026";

export default function Privacy() {
  useEffect(() => {
    document.title = "Privacy Policy | Dime Time";
    return () => {
      document.title = "Dime Time | Round-Up App to Pay Off Debt With Spare Change";
    };
  }, []);

  return (
    <div className="dt-marketing min-h-screen bg-white text-slate-900 antialiased">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2" aria-label="Dime Time home">
              <img src={logoUrl} alt="Dime Time logo" className="h-9 w-9 rounded-lg" />
              <span className="text-lg font-semibold text-slate-900">Dime Time</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-dime-purple"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-dime-purple/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-dime-purple" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">Privacy Policy</h1>
            <p className="text-sm text-slate-500 mt-1">
              Effective {EFFECTIVE_DATE}
            </p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-8 mt-10">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Introduction</h2>
            <p>
              Dime Time LLC (“we,” “our,” or “us”) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you use our mobile application and web services (the
              “Service”).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Information We Collect</h2>
            <h3 className="font-semibold text-slate-900 mt-4 mb-2">Personal Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Name, email address, and phone number</li>
              <li>Account credentials and authentication data</li>
              <li>Identity verification information required by financial regulations</li>
              <li>Customer service communications</li>
            </ul>
            <h3 className="font-semibold text-slate-900 mt-4 mb-2">Financial Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Bank account and routing information (via our banking partners)</li>
              <li>Credit card and debt account details</li>
              <li>Transaction history and round-up calculations</li>
              <li>Investment preferences and portfolio data</li>
            </ul>
            <h3 className="font-semibold text-slate-900 mt-4 mb-2">Technical Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Device identifiers, IP addresses, and browser information</li>
              <li>App usage analytics and interaction data</li>
              <li>Crash reports and performance metrics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To process round-ups, ACH transfers, and debt payments</li>
              <li>To create, secure, and manage your account</li>
              <li>To detect fraud and maintain platform integrity</li>
              <li>To meet regulatory and legal obligations</li>
              <li>To improve our services through aggregated analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Data Security</h2>
            <p>
              Dime Time encrypts data in transit using TLS 1.2 or higher and at rest using
              AES-256-GCM. Passwords are hashed with bcrypt. Webhooks and API integrations
              are signature-verified. While we use industry-leading security measures, no
              system is completely secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Sharing of Information</h2>
            <p>
              We share information only with regulated financial infrastructure providers
              necessary to deliver our services, and with authorities when required by law.
              We do not sell your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Your Privacy Rights</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access copies of your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your data (subject to regulatory retention rules)</li>
              <li>Export your data in a machine-readable format</li>
            </ul>
            <p className="mt-3">
              California (CCPA/CPRA) and EU (GDPR) residents have additional rights as
              described under applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Data Retention</h2>
            <p>
              We retain account and transaction data for as long as your account is active
              and for an additional period required by financial-services regulations
              (typically up to 7 years).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">8. Children’s Privacy</h2>
            <p>
              Our services are not intended for individuals under 18. We do not knowingly
              collect personal information from children. If we learn we have, we will
              promptly delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of
              material changes via email or in-app notification at least 30 days before they
              take effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">10. Contact</h2>
            <p>
              Questions about this Privacy Policy can be sent to{" "}
              <a className="text-dime-purple underline" href="mailto:tim@dime-time.com">
                tim@dime-time.com
              </a>
              . We respond to privacy requests within 30 days.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 space-y-3">
          <p className="text-xs text-slate-500 italic">
            These policies may be updated as Dime Time's services evolve.
          </p>
          <Link href="/" className="text-sm text-dime-purple hover:underline">
            ← Back to Home
          </Link>
        </div>
      </main>

      <footer className="px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto text-center text-xs text-slate-500">
          Dime Time is a financial technology platform and is not a bank. Banking services
          and payment infrastructure are provided through regulated financial partners.
        </div>
      </footer>
    </div>
  );
}
