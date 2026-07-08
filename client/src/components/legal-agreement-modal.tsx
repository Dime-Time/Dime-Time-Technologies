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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto touch-pan-y bg-card border-none shadow-card animate-fade-in" data-testid="legal-agreement-modal">
        <DialogHeader className="bg-slate-50 p-6 border-b -mx-6 -mt-6 mb-6">
          <DialogTitle className="text-xl font-bold text-slate-900">
            Welcome to Dime Time
          </DialogTitle>
          <p className="text-slate-600 mt-1">
            Before you begin, please review and accept our legal agreements
          </p>
        </DialogHeader>

        <ScrollArea className="h-96 pr-4">
          <div className="space-y-6">
            
            {/* Age Verification */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mt-0.5 shrink-0">
                  <Shield className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">Age Verification Required</h3>
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    You must be at least 18 years old to use Dime Time's financial services, including debt management tools and cryptocurrency features.
                  </p>
                  <div className="flex items-center space-x-3">
                    <Checkbox 
                      id="age-confirm"
                      checked={ageConfirmed}
                      onCheckedChange={(checked) => setAgeConfirmed(checked === true)}
                      data-testid="checkbox-age-confirm"
                      className="w-5 h-5 border-slate-300"
                    />
                    <label htmlFor="age-confirm" className="text-sm font-medium text-slate-900 cursor-pointer">
                      I confirm I am 18 years of age or older
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Risk Warning */}
            <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mt-0.5 shrink-0">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">Important Risk Disclosure</h3>
                  <div className="text-sm text-slate-700 space-y-2 mb-4">
                    <p className="font-semibold text-orange-900">Cryptocurrency investments are highly volatile and you may lose money.</p>
                    <ul className="list-disc list-inside space-y-1 ml-1">
                      <li>Past performance does not guarantee future results</li>
                      <li>We are not licensed financial advisors</li>
                      <li>Debt management results may vary by individual</li>
                      <li>Banking integrations may have fees or interruptions</li>
                    </ul>
                  </div>
                  <div className="flex items-center space-x-3 pt-2 border-t border-orange-200">
                    <Checkbox 
                      id="risk-acknowledge"
                      checked={riskAccepted}
                      onCheckedChange={(checked) => setRiskAccepted(checked === true)}
                      data-testid="checkbox-risk-acknowledge"
                      className="w-5 h-5 border-orange-300"
                    />
                    <label htmlFor="risk-acknowledge" className="text-sm font-medium text-slate-900 cursor-pointer">
                      I understand and accept these financial risks
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms of Service */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center mt-0.5 shrink-0">
                  <FileText className="w-4 h-4 text-slate-700" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">Terms of Service</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    By using Dime Time, you agree to our terms including:
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside mb-4">
                    <li>Providing accurate financial information</li>
                    <li>Understanding investment risks before investing</li>
                    <li>Compliance with all applicable laws</li>
                    <li>Keeping your login credentials secure</li>
                  </ul>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                    <div className="flex items-center space-x-3">
                      <Checkbox 
                        id="terms-accept"
                        checked={termsAccepted}
                        onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                        data-testid="checkbox-terms-accept"
                        className="w-5 h-5 border-slate-300"
                      />
                      <label htmlFor="terms-accept" className="text-sm font-medium text-slate-900 cursor-pointer">
                        I agree to the Terms of Service
                      </label>
                    </div>
                    <Link href="/legal" className="text-sm font-medium text-dime-accent hover:text-dime-purple transition-colors">
                      Read Full Terms →
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy Policy */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center mt-0.5 shrink-0">
                  <Shield className="w-4 h-4 text-slate-700" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">Privacy Policy</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    We collect and process your data to provide our services:
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside mb-4">
                    <li>Financial transaction and account data</li>
                    <li>App usage analytics for improvements</li>
                    <li>Account information for authentication</li>
                  </ul>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                    <div className="flex items-center space-x-3">
                      <Checkbox 
                        id="privacy-accept"
                        checked={privacyAccepted}
                        onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                        data-testid="checkbox-privacy-accept"
                        className="w-5 h-5 border-slate-300"
                      />
                      <label htmlFor="privacy-accept" className="text-sm font-medium text-slate-900 cursor-pointer">
                        I agree to the Privacy Policy
                      </label>
                    </div>
                    <Link href="/legal" className="text-sm font-medium text-dime-accent hover:text-dime-purple transition-colors">
                      Read Full Policy →
                    </Link>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </ScrollArea>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 mt-6 border-t">
          <Button 
            variant="outline" 
            onClick={onDecline}
            data-testid="button-decline-legal"
            className="w-full sm:w-auto min-w-[120px] press-scale"
          >
            Decline
          </Button>
          <Button 
            onClick={handleAccept}
            disabled={!allAccepted}
            className="w-full sm:w-auto min-w-[200px] bg-dime-purple hover:bg-dime-accent text-white press-scale shadow-sm"
            data-testid="button-accept-legal"
          >
            Accept & Continue
          </Button>
        </div>

        <p className="text-xs text-slate-500 text-center mt-4 pb-2">
          By continuing, you confirm you're 18+ and understand the risks of financial services
        </p>
      </DialogContent>
    </Dialog>
  );
}