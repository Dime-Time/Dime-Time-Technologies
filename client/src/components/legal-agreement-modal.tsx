import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Shield, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

interface LegalAgreementModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function LegalAgreementModal({ isOpen, onAccept, onDecline }: LegalAgreementModalProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const allAccepted = termsAccepted && privacyAccepted && riskAccepted && ageConfirmed;

  const handleAccept = () => {
    if (allAccepted) {
      localStorage.setItem('dime-time-legal-accepted', 'true');
      localStorage.setItem('dime-time-legal-date', new Date().toISOString());
      onAccept();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="legal-agreement-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            Welcome to Dime Time
          </DialogTitle>
          <p className="text-slate-600">
            Before you begin, please review and accept our legal agreements
          </p>
        </DialogHeader>

        <ScrollArea className="h-96 pr-4">
          <div className="space-y-6">
            
            {/* Age Verification */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-blue-100 rounded-lg flex items-center justify-center mt-0.5">
                  <Shield className="w-3 h-3 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">Age Verification Required</h3>
                  <p className="text-sm text-slate-700 mb-3">
                    You must be at least 18 years old to use Dime Time's financial services, including debt management tools and cryptocurrency features.
                  </p>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="age-confirm"
                      checked={ageConfirmed}
                      onCheckedChange={(checked) => setAgeConfirmed(checked === true)}
                      data-testid="checkbox-age-confirm"
                    />
                    <label htmlFor="age-confirm" className="text-sm font-medium text-slate-900">
                      I confirm I am 18 years of age or older
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Risk Warning */}
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-red-100 rounded-lg flex items-center justify-center mt-0.5">
                  <AlertTriangle className="w-3 h-3 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">Important Risk Disclosure</h3>
                  <div className="text-sm text-slate-700 space-y-2">
                    <p><strong>Cryptocurrency investments are highly volatile and you may lose money.</strong></p>
                    <p>• Past performance does not guarantee future results</p>
                    <p>• We are not licensed financial advisors</p>
                    <p>• Debt management results may vary by individual</p>
                    <p>• Banking integrations may have fees or interruptions</p>
                  </div>
                  <div className="flex items-center space-x-2 mt-3">
                    <Checkbox 
                      id="risk-acknowledge"
                      checked={riskAccepted}
                      onCheckedChange={(checked) => setRiskAccepted(checked === true)}
                      data-testid="checkbox-risk-acknowledge"
                    />
                    <label htmlFor="risk-acknowledge" className="text-sm font-medium text-slate-900">
                      I understand and accept these financial risks
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms of Service */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-slate-100 rounded-lg flex items-center justify-center mt-0.5">
                  <FileText className="w-3 h-3 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">Terms of Service</h3>
                  <p className="text-sm text-slate-700 mb-3">
                    By using Dime Time, you agree to our terms including:
                  </p>
                  <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                    <li>Providing accurate financial information</li>
                    <li>Understanding investment risks before investing</li>
                    <li>Compliance with all applicable laws</li>
                    <li>Keeping your login credentials secure</li>
                  </ul>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="terms-accept"
                        checked={termsAccepted}
                        onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                        data-testid="checkbox-terms-accept"
                      />
                      <label htmlFor="terms-accept" className="text-sm font-medium text-slate-900">
                        I agree to the Terms of Service
                      </label>
                    </div>
                    <Link href="/legal" className="text-sm text-dime-purple hover:underline">
                      Read Full Terms
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy Policy */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-slate-100 rounded-lg flex items-center justify-center mt-0.5">
                  <Shield className="w-3 h-3 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">Privacy Policy</h3>
                  <p className="text-sm text-slate-700 mb-3">
                    We collect and process your data to provide our services:
                  </p>
                  <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                    <li>Financial transaction and account data</li>
                    <li>App usage analytics for improvements</li>
                    <li>Account information for authentication</li>
                  </ul>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="privacy-accept"
                        checked={privacyAccepted}
                        onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                        data-testid="checkbox-privacy-accept"
                      />
                      <label htmlFor="privacy-accept" className="text-sm font-medium text-slate-900">
                        I agree to the Privacy Policy
                      </label>
                    </div>
                    <Link href="/legal" className="text-sm text-dime-purple hover:underline">
                      Read Full Policy
                    </Link>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </ScrollArea>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={onDecline}
            data-testid="button-decline-legal"
          >
            Decline
          </Button>
          <Button 
            onClick={handleAccept}
            disabled={!allAccepted}
            className="bg-dime-purple hover:bg-dime-purple/90"
            data-testid="button-accept-legal"
          >
            Accept & Continue
          </Button>
        </div>

        <p className="text-xs text-slate-500 text-center">
          By continuing, you confirm you're 18+ and understand the risks of financial services
        </p>
      </DialogContent>
    </Dialog>
  );
}