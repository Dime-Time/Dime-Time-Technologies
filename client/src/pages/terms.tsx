import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";
import logoUrl from "@/assets/dime-time-app-icon.png";

// NOTE: Update EFFECTIVE_DATE only when the policy text below actually changes.
const EFFECTIVE_DATE = "May 27, 2026";

export default function Terms() {
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
            <FileText className="w-6 h-6 text-dime-purple" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">Terms of Service</h1>
            <p className="text-sm text-slate-500 mt-1">
              Effective {EFFECTIVE_DATE}
            </p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-8 mt-10">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Service Description</h2>
            <p>
              Dime Time provides debt-reduction tools, automated round-up features, ACH
              payment management, and financial-tracking services. All services are
              provided “as is” without warranties of any kind.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. User Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide accurate and complete financial information</li>
              <li>Monitor your accounts and transactions regularly</li>
              <li>Understand the risks of any financial decision before acting</li>
              <li>Comply with all applicable laws and regulations</li>
              <li>Keep your login credentials secure</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Financial Risk Disclosure</h2>
            <p>
              Dime Time is a financial-technology platform and is not a bank, broker-dealer,
              investment advisor, or tax professional. We do not provide investment, tax,
              or legal advice. You are responsible for any financial decisions you make.
              Banking integrations may have fees, delays, or service interruptions.
              Cryptocurrency, when offered, is highly volatile and may result in partial
              or total loss of principal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Limitations of Liability</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Investment losses or poor financial outcomes</li>
              <li>Third-party service interruptions or failures</li>
              <li>Data processing errors or system downtime</li>
              <li>Indirect, incidental, or consequential damages</li>
              <li>Financial decisions made using our tools or information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Third-Party Integrations</h2>
            <p>
              Dime Time integrates with regulated financial infrastructure providers and
              banking partners to deliver payment, transfer, and account services. These
              providers have their own terms and conditions that apply to your use of those
              underlying services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Account Management</h2>
            <p>We reserve the right to suspend or terminate accounts that:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Violate these Terms of Service</li>
              <li>Engage in suspicious or fraudulent activity</li>
              <li>Compromise system security or integrity</li>
            </ul>
            <p className="mt-3">
              You may request deletion of your account at any time through the Settings
              page in the app.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Changes to These Terms</h2>
            <p>
              We may update these Terms periodically. Continued use of the service after
              changes take effect constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">8. Contact</h2>
            <p>
              Questions about these Terms can be sent to{" "}
              <a className="text-dime-purple underline" href="mailto:support@dimetime.com">
                support@dimetime.com
              </a>
              .
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
