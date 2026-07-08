import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, FileText, Shield } from "lucide-react";

interface LegalDisclaimerProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function LegalDisclaimer({ onAccept, onDecline }: LegalDisclaimerProps) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedRisks, setAcceptedRisks] = useState(false);

  const canProceed = acceptedTerms && acceptedPrivacy && acceptedRisks;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto touch-pan-y animate-fade-in">
      <Card className="w-full max-w-4xl my-auto flex flex-col overflow-hidden shadow-card">
        <CardHeader className="flex-shrink-0 bg-slate-50 border-b">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <AlertTriangle className="h-5 w-5 text-dime-accent" />
            <span>Terms of Service & Risk Disclosure</span>
          </CardTitle>
          <p className="text-sm text-slate-600">
            Please read and acknowledge the following before using Dime Time
          </p>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
          <ScrollArea className="h-full max-h-[60vh] p-6">
            <div className="space-y-8">

              {/* Financial Risk Disclosure */}
              <section className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-900 border-b pb-2">
                  <Shield className="h-4 w-4 text-dime-purple" />
                  Financial Risk Disclosure
                </h3>
                <div className="p-4 rounded-lg space-y-2 text-sm bg-orange-50 border border-orange-100 text-orange-900">
                  <p className="font-semibold uppercase tracking-wider text-xs text-orange-800">IMPORTANT: READ CAREFULLY</p>
                  <ul className="list-disc list-inside space-y-1 ml-1 text-slate-700">
                    <li>Cryptocurrency investments involve substantial risk of loss</li>
                    <li>Past performance does not guarantee future results</li>
                    <li>You may lose some or all of your invested funds</li>
                    <li>Banking integrations may have fees and processing delays</li>
                    <li>Debt management tools are for informational purposes only</li>
                    <li>We are not financial advisors — consult professionals for advice</li>
                  </ul>
                </div>
              </section>

              {/* Service Terms */}
              <section className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-900 border-b pb-2">
                  <FileText className="h-4 w-4 text-dime-purple" />
                  Terms of Service
                </h3>
                <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                  <p><strong className="text-slate-900">1. Service Description:</strong> Dime Time provides financial tools and analytics. Services are provided "as is" without warranties.</p>
                  <p><strong className="text-slate-900">2. User Responsibilities:</strong></p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Providing accurate financial information</li>
                    <li>Monitoring accounts and transactions</li>
                    <li>Understanding risks before making investments</li>
                    <li>Complying with applicable laws</li>
                  </ul>
                </div>
              </section>

              {/* Privacy Policy */}
              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Privacy Policy Summary</h3>
                <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                  <p><strong className="text-slate-900">Data Collection:</strong> We collect account info, transaction data, and analytics.</p>
                  <p><strong className="text-slate-900">Data Sharing:</strong> Shared with banking partners and services required for app functionality.</p>
                  <p><strong className="text-slate-900">Data Security:</strong> Industry-standard protections, but no guarantee of absolute security.</p>
                </div>
              </section>

            </div>
          </ScrollArea>

          {/* Acceptance Checkboxes */}
          <div className="mt-auto space-y-3 border-t p-6 bg-slate-50">
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                className="w-5 h-5 mt-0.5 flex-shrink-0"
              />
              <label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer text-slate-700">
                I have read and agree to the <strong className="text-slate-900">Terms of Service</strong>
              </label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="privacy"
                checked={acceptedPrivacy}
                onCheckedChange={(checked) => setAcceptedPrivacy(checked === true)}
                className="w-5 h-5 mt-0.5 flex-shrink-0"
              />
              <label htmlFor="privacy" className="text-sm leading-relaxed cursor-pointer text-slate-700">
                I acknowledge the <strong className="text-slate-900">Privacy Policy</strong>
              </label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="risks"
                checked={acceptedRisks}
                onCheckedChange={(checked) => setAcceptedRisks(checked === true)}
                className="w-5 h-5 mt-0.5 flex-shrink-0"
              />
              <label htmlFor="risks" className="text-sm leading-relaxed cursor-pointer text-slate-700">
                I understand the <strong className="text-slate-900">Financial Risks</strong>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between p-6 border-t bg-white">
            <Button variant="outline" onClick={onDecline} className="w-1/3 press-scale">
              Cancel
            </Button>
            <Button
              onClick={onAccept}
              disabled={!canProceed}
              className="bg-dime-purple hover:bg-dime-accent text-white w-2/3 ml-4 press-scale shadow-sm"
            >
              Accept & Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
