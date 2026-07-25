import { Card, CardContent } from "@/components/ui/card";
import { Bitcoin } from "lucide-react";
import { Link } from "wouter";

/**
 * Registered redirect URI for the future per-user Coinbase OAuth flow:
 * https://dime-time.com/coinbase-callback
 *
 * Coinbase OAuth client creation is currently partner-gated, so no real
 * OAuth redirects can land here yet. When the connect flow is built, this
 * page becomes the actual callback handler (exchange ?code + verify state).
 * Until then it's an honest placeholder so the registered URI resolves.
 */
export default function CoinbaseCallback() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4" data-testid="page-coinbase-callback">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <Bitcoin className="h-8 w-8 text-amber-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              Coinbase connection coming soon
            </h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            This is where Dime Time will finish linking your Coinbase account
            once real crypto investing goes live. For now, crypto in Dime Time
            is in Preview&nbsp;&mdash; prices are real, purchases are simulated.
          </p>

          <Link
            href="/"
            data-testid="link-back-home"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            Back to Dime Time
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
