import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Shield, AlertTriangle, Info } from "lucide-react";
import { BetaModeBanner } from "@/components/BetaModeBanner";

export default function Legal() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Legal Information</h1>
        <p className="text-slate-600">Terms of Service, Privacy Policy, and Risk Disclosures</p>
      </div>

      <div className="space-y-8">

        <BetaModeBanner variant="full" showCompliance />
        
        {/* Risk Disclosure */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Financial Risk Disclosure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
              <p className="font-medium text-red-800">IMPORTANT RISK WARNING</p>
              <div className="text-sm text-red-700 space-y-2">
                <p><strong>Cryptocurrency Risks:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Cryptocurrency investments are highly volatile and speculative</li>
                  <li>You may lose some or all of your invested funds</li>
                  <li>Past performance does not guarantee future results</li>
                  <li>Regulatory changes may affect cryptocurrency values</li>
                </ul>
                
                <p><strong>Banking & Debt Management:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Banking integrations may have fees, delays, or service interruptions</li>
                  <li>Debt management tools are informational only, not financial advice</li>
                  <li>Results may vary based on individual financial circumstances</li>
                </ul>

                <p className="font-medium">We are not licensed financial advisors. Consult qualified professionals before making financial decisions.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms of Service */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Terms of Service
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-4 text-sm text-gray-700 pr-4">
                <section>
                  <h3 className="font-semibold text-gray-900 mb-2">1. Service Description</h3>
                  <p>Dime Time provides debt reduction tools, round-up investment features, and financial tracking services. All services are provided "as is" without warranties of any kind.</p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-2">2. User Responsibilities</h3>
                  <p>By using our service, you agree to:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Provide accurate and complete financial information</li>
                    <li>Monitor your accounts and transactions regularly</li>
                    <li>Understand investment risks before making financial decisions</li>
                    <li>Comply with all applicable laws and regulations</li>
                    <li>Keep your login credentials secure</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-2">3. Limitations of Liability</h3>
                  <p>Dime Time and its operators shall not be liable for:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Investment losses or poor financial outcomes</li>
                    <li>Third-party service interruptions or failures</li>
                    <li>Data processing errors or system downtime</li>
                    <li>Indirect, incidental, or consequential damages</li>
                    <li>Financial decisions made using our tools or information</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-2">4. Third-Party Integrations</h3>
                  <p>Our app integrates with external services including:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Coinbase for cryptocurrency transactions</li>
                    <li>Plaid for banking connections</li>
                    <li>Financial institutions for account access</li>
                  </ul>
                  <p className="mt-2">These services have their own terms and conditions which apply to your use.</p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-2">5. Account Management</h3>
                  <p>We reserve the right to suspend or terminate accounts that:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Violate these terms of service</li>
                    <li>Engage in suspicious or fraudulent activity</li>
                    <li>Compromise system security or integrity</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-2">6. Changes to Terms</h3>
                  <p>We may update these terms periodically. Continued use of the service constitutes acceptance of updated terms.</p>
                </section>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Privacy Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-6 text-sm text-gray-700 pr-4">
                <section>
                  <h3 className="font-semibold text-gray-900 mb-3">1. Introduction</h3>
                  <p>Dime Time LLC ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and web services (the "Service").</p>
                  <p className="mt-2"><strong>Effective Date:</strong> {new Date().toLocaleDateString()}</p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-3">2. Information We Collect</h3>
                  
                  <h4 className="font-medium text-gray-800 mb-2">2.1 Personal Information</h4>
                  <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                    <li>Name, email address, phone number</li>
                    <li>Account credentials and authentication data</li>
                    <li>Identity verification information as required by financial regulations</li>
                    <li>Customer service communications</li>
                  </ul>

                  <h4 className="font-medium text-gray-800 mb-2">2.2 Financial Information</h4>
                  <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                    <li>Bank account information and routing numbers (via Plaid integration)</li>
                    <li>Credit card and debt account details</li>
                    <li>Transaction history and round-up calculations</li>
                    <li>Cryptocurrency wallet addresses and transaction records (via Coinbase)</li>
                    <li>Investment preferences and portfolio data</li>
                    <li>Debt balances, payment history, and financial goals</li>
                  </ul>

                  <h4 className="font-medium text-gray-800 mb-2">2.3 Technical Information</h4>
                  <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                    <li>Device identifiers, IP addresses, and browser information</li>
                    <li>App usage analytics and interaction data (via Google Analytics)</li>
                    <li>Location data (if enabled for fraud prevention)</li>
                    <li>Crash reports and performance metrics</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-3">3. How We Use Your Information</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Core Services:</strong> Process round-up transactions, manage debt payments, and facilitate cryptocurrency investments</li>
                    <li><strong>Account Management:</strong> Create and maintain your account, verify identity, and provide customer support</li>
                    <li><strong>Financial Operations:</strong> Calculate round-ups, process payments via Axos Bank, and manage sweep account operations</li>
                    <li><strong>Analytics:</strong> Track app usage, optimize features, and improve user experience</li>
                    <li><strong>Security:</strong> Detect fraud, prevent unauthorized access, and maintain platform integrity</li>
                    <li><strong>Compliance:</strong> Meet regulatory requirements and respond to legal requests</li>
                    <li><strong>Communication:</strong> Send service updates, payment confirmations, and promotional materials (with consent)</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-3">4. Information Sharing and Disclosure</h3>
                  
                  <h4 className="font-medium text-gray-800 mb-2">4.1 Third-Party Service Providers</h4>
                  <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                    <li><strong>Plaid Technologies:</strong> Bank account connections and transaction data</li>
                    <li><strong>Coinbase, Inc.:</strong> Cryptocurrency trading and portfolio management</li>
                    <li><strong>Axos Bank:</strong> Business banking services and sweep account management</li>
                    <li><strong>Google Analytics:</strong> App usage analytics and user behavior tracking</li>
                    <li><strong>Payment Processors:</strong> Subscription billing and payment processing</li>
                  </ul>

                  <h4 className="font-medium text-gray-800 mb-2">4.2 Legal and Regulatory Requirements</h4>
                  <p className="mb-3">We may disclose information when required by law, court order, or regulatory authorities, including:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                    <li>Financial crimes investigations</li>
                    <li>Anti-money laundering (AML) compliance</li>
                    <li>Tax reporting obligations</li>
                    <li>Consumer protection enforcement</li>
                  </ul>

                  <h4 className="font-medium text-gray-800 mb-2">4.3 Business Transfers</h4>
                  <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred to the new entity.</p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-3">5. Data Security</h3>
                  <p className="mb-2">We implement comprehensive security measures to protect your information:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Encryption:</strong> All data is encrypted in transit (TLS 1.3) and at rest (AES-256)</li>
                    <li><strong>Authentication:</strong> Multi-factor authentication and secure session management</li>
                    <li><strong>Access Controls:</strong> Role-based access with principle of least privilege</li>
                    <li><strong>Monitoring:</strong> 24/7 security monitoring and incident response</li>
                    <li><strong>Compliance:</strong> SOC 2 Type II and PCI DSS compliance standards</li>
                    <li><strong>Regular Audits:</strong> Third-party security assessments and penetration testing</li>
                  </ul>
                  <p className="mt-3 text-red-600"><strong>Important:</strong> While we implement industry-leading security measures, no system is completely secure. We cannot guarantee absolute protection against all security threats.</p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-3">6. Your Privacy Rights</h3>
                  
                  <h4 className="font-medium text-gray-800 mb-2">6.1 General Rights</h4>
                  <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                    <li><strong>Access:</strong> Request copies of your personal information</li>
                    <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                    <li><strong>Deletion:</strong> Request deletion of your personal data (subject to regulatory requirements)</li>
                    <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
                    <li><strong>Objection:</strong> Object to certain processing activities</li>
                  </ul>

                  <h4 className="font-medium text-gray-800 mb-2">6.2 California Privacy Rights (CCPA/CPRA)</h4>
                  <p className="mb-2">California residents have additional rights including:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                    <li>Right to know what personal information is collected, used, and shared</li>
                    <li>Right to delete personal information (with exceptions for financial records)</li>
                    <li>Right to opt-out of the sale of personal information</li>
                    <li>Right to non-discrimination for exercising privacy rights</li>
                  </ul>

                  <h4 className="font-medium text-gray-800 mb-2">6.3 European Privacy Rights (GDPR)</h4>
                  <p>EU residents have rights under GDPR including data portability, right to rectification, and right to be forgotten (subject to financial record retention requirements).</p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-3">7. Data Retention</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Account Data:</strong> Retained while your account is active plus 7 years for regulatory compliance</li>
                    <li><strong>Transaction Records:</strong> Retained for 7 years as required by financial regulations</li>
                    <li><strong>Analytics Data:</strong> Aggregated and anonymized data retained indefinitely for service improvement</li>
                    <li><strong>Communication Records:</strong> Customer service interactions retained for 3 years</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-3">8. Cookies and Tracking</h3>
                  <p className="mb-2">We use cookies and similar technologies for:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Authentication and session management</li>
                    <li>Analytics and performance monitoring (Google Analytics)</li>
                    <li>Fraud prevention and security</li>
                    <li>Personalization and user preferences</li>
                  </ul>
                  <p className="mt-3">You can manage cookie preferences through your browser settings, though some features may not function properly if cookies are disabled.</p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-3">9. International Data Transfers</h3>
                  <p>Your information may be processed and stored in the United States and other countries where our service providers operate. We ensure appropriate safeguards are in place for international transfers, including Standard Contractual Clauses where applicable.</p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-3">10. Children's Privacy</h3>
                  <p>Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal information from children under 18. If we become aware that we have collected such information, we will promptly delete it.</p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-3">11. Changes to This Privacy Policy</h3>
                  <p>We may update this Privacy Policy periodically to reflect changes in our practices or legal requirements. We will notify you of material changes via email or app notification at least 30 days before the changes take effect.</p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-3">12. Contact Information</h3>
                  <p className="mb-2">For privacy-related questions or to exercise your rights, contact us:</p>
                  <ul className="list-none space-y-1">
                    <li><strong>Email:</strong> privacy@dimetime.com</li>
                    <li><strong>Mailing Address:</strong> Dime Time LLC, Privacy Department</li>
                    <li><strong>Response Time:</strong> We will respond to privacy requests within 30 days</li>
                  </ul>
                </section>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Financial Data Protection:</strong> As a fintech platform handling sensitive financial information, we maintain additional security measures beyond standard privacy practices, including regulatory compliance with GLBA, FFIEC guidelines, and state financial privacy laws.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Regulatory Notice */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Regulatory Notice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Important:</strong> Dime Time is a financial technology platform, not a licensed financial advisor, broker-dealer, or investment company. We do not provide investment advice, tax planning, or legal counsel. 
              </p>
              <p className="text-sm text-blue-800 mt-2">
                Before making any financial decisions, please consult with qualified licensed professionals including financial advisors, tax professionals, or legal counsel as appropriate for your situation.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-gray-500 pt-8 border-t">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <p className="mt-2">
            <strong>Legal Notice:</strong> This framework requires review by qualified legal counsel before use.
          </p>
        </div>
      </div>
    </main>
  );
}