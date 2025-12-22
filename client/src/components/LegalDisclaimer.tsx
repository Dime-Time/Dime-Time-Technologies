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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto touch-pan-y">
      <Card className="w-full max-w-4xl my-auto flex flex-col overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Terms of Service & Risk Disclosure
          </CardTitle>
          <p className="text-sm text-gray-600">
            Please read and acknowledge the following before using Dime Time
          </p>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="h-full max-h-[60vh] pr-4">
            <div className="space-y-6">

              {/* Financial Risk Disclosure */}
              <section className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-red-500" />
                  Financial Risk Disclosure
                </h3>
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2 text-sm">
                  <p className="font-medium text-red-800">IMPORTANT: READ CAREFULLY</p>
                  <ul className="list-disc list-inside space-y-1 text-red-700">
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
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Terms of Service
                </h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>1. Service Description:</strong> Dime Time provides financial tools and analytics. Services are provided "as is" without warranties.</p>
                  <p><strong>2. User Responsibilities:</strong></p>
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
                <h3 className="text-lg font-semibold">Privacy Policy Summary</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>Data Collection:</strong> We collect account info, transaction data, and analytics.</p>
                  <p><strong>Data Sharing:</strong> Shared with banking partners and services required for app functionality.</p>
                  <p><strong>Data Security:</strong> Industry-standard protections, but no guarantee of absolute security.</p>
                </div>
              </section>

            </div>
          </ScrollArea>

          {/* Acceptance Checkboxes */}
          <div className="mt-6 space-y-4 border-t pt-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
              />
              <label htmlFor="terms" className="text-sm leading-relaxed">
                I have read and agree to the <strong>Terms of Service</strong>.
              </label>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="privacy"
                checked={acceptedPrivacy}
                onCheckedChange={(checked) => setAcceptedPrivacy(checked === true)}
              />
              <label htmlFor="privacy" className="text-sm leading-relaxed">
                I acknowledge the <strong>Privacy Policy</strong>.
              </label>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="risks"
                checked={acceptedRisks}
                onCheckedChange={(checked) => setAcceptedRisks(checked === true)}
              />
              <label htmlFor="risks" className="text-sm leading-relaxed">
                I understand the <strong>Financial Risks</strong>.
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between mt-6 pt-4 border-t">
            <Button variant="outline" onClick={onDecline}>
              Cancel
            </Button>
            <Button
              onClick={onAccept}
              disabled={!canProceed}
              className="bg-dime-purple hover:bg-dime-purple/90"
            >
              OK — Accept Terms & Services
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
