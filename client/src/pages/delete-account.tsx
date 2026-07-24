import { Link } from "wouter";
import { ArrowLeft, Trash2 } from "lucide-react";
import logoUrl from "@/assets/dime-time-app-icon.png";

export default function DeleteAccount() {
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
            <Trash2 className="w-6 h-6 text-dime-purple" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Delete Your Dime Time Account
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              How to permanently delete your account and data
            </p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-8 mt-10">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              Delete your account in the app
            </h2>
            <p>
              You can permanently delete your Dime Time account and all associated data at any
              time, directly in the app:
            </p>
            <ol className="list-decimal pl-6 space-y-2 mt-3">
              <li>Open the Dime Time app and sign in</li>
              <li>
                Go to <span className="font-semibold">Settings</span> (the gear tab)
              </li>
              <li>
                Scroll to the bottom and tap{" "}
                <span className="font-semibold">Delete Account</span>
              </li>
              <li>
                Type <span className="font-semibold">DELETE</span> to confirm, then tap{" "}
                <span className="font-semibold">Confirm Delete</span>
              </li>
            </ol>
            <p className="mt-3">
              Deletion takes effect immediately. This action cannot be undone.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              Or request deletion by email
            </h2>
            <p>
              If you can no longer access the app, email{" "}
              <a href="mailto:tim@dime-time.com" className="text-dime-purple font-medium">
                tim@dime-time.com
              </a>{" "}
              from the email address on your account with the subject line{" "}
              <span className="font-semibold">"Delete my account"</span>. We will verify your
              identity and process the deletion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">What gets deleted</h2>
            <p>When your account is deleted, we permanently remove:</p>
            <ul className="list-disc pl-6 space-y-1 mt-3">
              <li>Your account profile (name, email address, login credentials)</li>
              <li>All debts, balances, and payoff data you entered</li>
              <li>Transaction and round-up history stored by Dime Time</li>
              <li>Bank connection tokens and payment method references</li>
              <li>App settings, preferences, and analytics data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">What may be retained</h2>
            <p>
              Records of completed payment transactions may be retained by our regulated
              financial infrastructure partners as required by banking and anti-fraud
              regulations. These records are held by those partners under their own retention
              policies; Dime Time itself retains no personal data after account deletion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Questions</h2>
            <p>
              Contact us at{" "}
              <a href="mailto:tim@dime-time.com" className="text-dime-purple font-medium">
                tim@dime-time.com
              </a>{" "}
              or see our{" "}
              <Link href="/privacy" className="text-dime-purple font-medium">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
