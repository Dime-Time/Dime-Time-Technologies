import { Capacitor } from "@capacitor/core";
import { useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSecurity } from "@/hooks/useSecurity";
import { useAuth } from "@/hooks/useAuth";
import { useFlag } from "@/hooks/useFlag";
import { BetaModeBanner, ComplianceDisclaimer } from "@/components/BetaModeBanner";
import { FundingAccountSelector } from "@/components/FundingAccountSelector";
import { hasPinSet, isBiometricEnabled, setBiometricEnabled } from "@/lib/securityStore";
import { 
  Bell, 
  CreditCard, 
  DollarSign, 
  Shield, 
  User, 
  Smartphone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  LogOut,
  Trash2,
  AlertTriangle,
  MessageSquare,
  Send,
  ChevronRight,
  ShieldCheck,
  FileText,
  Info,
  Sparkles
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface RoundUpSettings {
  id: string;
  userId: string;
  isEnabled: boolean;
  targetDebtId: string | null;
  multiplier: string;
  autoApplyThreshold: string;
  cryptoEnabled: boolean;
  cryptoPercentage: string;
  preferredCrypto: string;
}

interface UserProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function Settings() {
  const { toast } = useToast();
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const { setNeedsPinSetup, clearSecurity, hasPinConfigured } = useSecurity();
  const [showPassword, setShowPassword] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(isBiometricEnabled());
  const [pinConfigured, setPinConfigured] = useState(hasPinSet());
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const sendFeedbackMutation = useMutation({
    mutationFn: async (payload: { subject: string; message: string }) => {
      const composed = payload.subject
        ? `[${payload.subject}]\n\n${payload.message}`
        : payload.message;
      const res = await apiRequest("POST", "/api/contact", { message: composed });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Feedback sent", description: "Thanks — we'll review it shortly." });
      setFeedbackSubject("");
      setFeedbackMessage("");
      setFeedbackOpen(false);
    },
    onError: () => {
      toast({
        title: "Couldn't send feedback",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const handleSendFeedback = () => {
    if (!feedbackMessage.trim()) {
      toast({ title: "Please write a message", variant: "destructive" });
      return;
    }
    sendFeedbackMutation.mutate({
      subject: feedbackSubject.trim(),
      message: feedbackMessage.trim(),
    });
  };

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/account");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Account deleted", description: "Your account and all data have been permanently removed." });
      setTimeout(() => {
        logout();
      }, 1500);
    },
    onError: () => {
      toast({ title: "Failed to delete account", description: "Please try again or contact support.", variant: "destructive" });
    },
  });

  const handleDeleteAccount = useCallback(() => {
    if (deleteConfirmText === "DELETE") {
      deleteAccountMutation.mutate();
    }
  }, [deleteConfirmText]);

  const handleSetupPin = () => {
    setNeedsPinSetup(true);
  };

  const handleClearPin = () => {
    clearSecurity();
    setPinConfigured(false);
    setBiometricEnabledState(false);
    toast({ title: "PIN removed", description: "Your app lock has been disabled." });
  };

  const handleToggleBiometric = (enabled: boolean) => {
    setBiometricEnabled(enabled);
    setBiometricEnabledState(enabled);
    toast({ title: enabled ? "Face ID enabled" : "Face ID disabled" });
  };

  // Fetch user data
  const { data: user } = useQuery<UserProfile>({
    queryKey: ["/api/user"],
  });

  // Fetch round-up settings
  const { data: roundUpSettings } = useQuery<RoundUpSettings>({
    queryKey: ["/api/round-up-settings"],
  });

  // Active debts — needed so the user can pick which debt round-ups attack.
  const { data: debts = [] } = useQuery<Array<{ id: string; name: string; currentBalance: string; isActive: boolean }>>({
    queryKey: ["/api/debts"],
  });
  const activeDebts = debts.filter((d) => d.isActive !== false && parseFloat(d.currentBalance) > 0);

  // Premium gate: when subscriptions are live, round-up automation requires
  // an active plan. Flag OFF → no query, no banner, everything unlocked.
  const subscriptionsEnabled = useFlag("ENABLE_SUBSCRIPTIONS");
  const { data: subscriptionState } = useQuery<{ entitled: boolean }>({
    queryKey: ["/api/subscription"],
    enabled: subscriptionsEnabled,
  });
  const needsSubscription = subscriptionsEnabled && subscriptionState?.entitled === false;

  // Update round-up settings mutation
  const updateRoundUpSettings = useMutation({
    mutationFn: async (settings: Partial<RoundUpSettings>) => {
      // apiRequest (not raw fetch): attaches the Bearer token on native.
      // Raw fetch relied on the session cookie, which the native WebView
      // does not send cross-origin → 401 → "Failed to update settings".
      const response = await apiRequest("PUT", "/api/round-up-settings", settings);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/round-up-settings"] });
      toast({ title: "Settings updated successfully" });
    },
    onError: (err: Error & { status?: number }) => {
      if (err.status === 402) {
        toast({
          title: "Subscription required",
          description: "Round-up automation is part of the Dime Time Debt plan.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Failed to update settings", variant: "destructive" });
    },
  });

  // Initialize profile data when user data loads
  useState(() => {
    if (user) {
      setProfileData(prev => ({
        ...prev,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      }));
    }
  });

  const handleRoundUpToggle = (field: keyof RoundUpSettings, value: boolean | string) => {
    if (roundUpSettings) {
      updateRoundUpSettings.mutate({
        ...roundUpSettings,
        [field]: value,
      });
    }
  };

  const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="mb-8 animate-fade-in-up">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4">{title}</h2>
      <div className="bg-card rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {children}
      </div>
    </div>
  );

  const Row = ({ children, isLast }: { children: React.ReactNode, isLast?: boolean }) => (
    <div className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${!isLast ? 'border-b border-slate-100' : ''}`}>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20 pt-4 md:pt-8 animate-fade-in">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="mb-8 px-2">
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        </div>

        {/* ACCOUNT */}
        <Section title="Account">
          <Row>
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-slate-700">First Name</Label>
                <Input
                  id="firstName"
                  value={profileData.firstName}
                  readOnly
                  disabled
                  className="bg-slate-50 border-slate-200 text-slate-900"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-slate-700">Last Name</Label>
                <Input
                  id="lastName"
                  value={profileData.lastName}
                  readOnly
                  disabled
                  className="bg-slate-50 border-slate-200 text-slate-900"
                />
              </div>
            </div>
          </Row>
          <Row isLast>
            <div className="w-full space-y-2">
              <Label htmlFor="email" className="text-slate-700">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={profileData.email}
                readOnly
                disabled
                className="bg-slate-50 border-slate-200 text-slate-900"
              />
            </div>
          </Row>
        </Section>

        {/* SECURITY */}
        <Section title="Security">
          <Row>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">App Lock PIN</p>
                <p className="text-xs text-slate-500">
                  {pinConfigured ? "Secured with a 4-digit PIN" : "Not configured"}
                </p>
              </div>
            </div>
            {pinConfigured ? (
              <Button variant="outline" size="sm" onClick={handleClearPin} className="text-slate-700 press-scale shrink-0">
                Remove PIN
              </Button>
            ) : (
              <Button size="sm" onClick={handleSetupPin} className="bg-dime-purple hover:bg-dime-accent text-white press-scale shrink-0">
                Set Up PIN
              </Button>
            )}
          </Row>
          <Row isLast>
            <div className="w-full space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Change Password</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Current Password"
                    value={profileData.currentPassword}
                    onChange={(e) => setProfileData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="pr-10 border-slate-200 focus-visible:ring-dime-purple"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <PasswordInput
                    placeholder="New Password"
                    value={profileData.newPassword}
                    onChange={(e) => setProfileData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="border-slate-200 focus-visible:ring-dime-purple"
                    data-testid="input-new-password"
                  />
                  <PasswordInput
                    placeholder="Confirm New Password"
                    value={profileData.confirmPassword}
                    onChange={(e) => setProfileData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="border-slate-200 focus-visible:ring-dime-purple"
                    data-testid="input-confirm-password"
                  />
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto text-slate-700 press-scale">
                  Update Password
                </Button>
              </div>
            </div>
          </Row>
        </Section>

        {/* ROUND-UPS */}
        <Section title="Round-Ups">
          {needsSubscription && (
            <div className="p-4 border-b border-slate-100 bg-purple-50/60" data-testid="banner-subscription-required">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-dime-purple/10 text-dime-purple flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900 text-sm">Unlock round-up automation</p>
                  <p className="text-xs text-slate-500 mb-2">
                    Automatic round-ups and debt payments are part of the Dime Time
                    Debt plan. Debt tracking stays free.
                  </p>
                  {/* No purchase steering in native builds (Apple 3.1.1 / Play Payments). */}
                  {!Capacitor.isNativePlatform() && (
                    <Link href="/subscription">
                      <Button size="sm" className="bg-dime-purple hover:bg-dime-accent text-white press-scale" data-testid="button-view-plan">
                        View Plan
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
          <Row>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <DollarSign className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">Enable Round-Ups</p>
                <p className="text-xs text-slate-500">Automatically round up purchases</p>
              </div>
            </div>
            <Switch
              checked={roundUpSettings?.isEnabled ?? false}
              onCheckedChange={(checked) => handleRoundUpToggle("isEnabled", checked)}
            />
          </Row>
          <Row>
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 text-xs font-semibold uppercase tracking-wider">Multiplier</Label>
                <Select
                  value={roundUpSettings?.multiplier ?? "1.00"}
                  onValueChange={(value) => handleRoundUpToggle("multiplier", value)}
                >
                  <SelectTrigger className="border-slate-200 focus:ring-dime-purple">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1.00">1x (Standard)</SelectItem>
                    <SelectItem value="2.00">2x (Double)</SelectItem>
                    <SelectItem value="3.00">3x (Triple)</SelectItem>
                    <SelectItem value="5.00">5x (Aggressive)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 text-xs font-semibold uppercase tracking-wider">Auto-Apply Threshold</Label>
                <Select
                  value={roundUpSettings?.autoApplyThreshold ?? "25.00"}
                  onValueChange={(value) => handleRoundUpToggle("autoApplyThreshold", value)}
                >
                  <SelectTrigger className="border-slate-200 focus:ring-dime-purple">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10.00">$10</SelectItem>
                    <SelectItem value="25.00">$25</SelectItem>
                    <SelectItem value="50.00">$50</SelectItem>
                    <SelectItem value="100.00">$100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-slate-700 text-xs font-semibold uppercase tracking-wider">Target Debt</Label>
                <Select
                  value={roundUpSettings?.targetDebtId ?? ""}
                  onValueChange={(value) => handleRoundUpToggle("targetDebtId", value)}
                >
                  <SelectTrigger className="border-slate-200 focus:ring-dime-purple" data-testid="select-target-debt">
                    <SelectValue placeholder="Choose which debt your round-ups pay down" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeDebts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} — ${parseFloat(d.currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!roundUpSettings?.targetDebtId && (
                  <p className="text-xs text-amber-600 font-medium" data-testid="text-no-target-debt">
                    No target debt selected — round-ups will collect but won't be applied until you choose one.
                  </p>
                )}
              </div>
            </div>
          </Row>

          <Row>
            <FundingAccountSelector />
          </Row>

          <Row>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <span className="font-bold text-xs">₿</span>
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">Crypto Investment</p>
                <p className="text-xs text-slate-500">Invest a portion of round-ups in crypto</p>
              </div>
            </div>
            <Switch
              checked={roundUpSettings?.cryptoEnabled ?? false}
              onCheckedChange={(checked) => handleRoundUpToggle("cryptoEnabled", checked)}
            />
          </Row>
          
          {roundUpSettings?.cryptoEnabled && (
            <Row isLast>
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 pl-11">
                <div className="space-y-2">
                  <Label className="text-slate-700 text-xs font-semibold uppercase tracking-wider">Percentage</Label>
                  <Select
                    value={roundUpSettings?.cryptoPercentage ?? "25.00"}
                    onValueChange={(value) => handleRoundUpToggle("cryptoPercentage", value)}
                  >
                    <SelectTrigger className="border-slate-200 focus:ring-dime-purple">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10.00">10%</SelectItem>
                      <SelectItem value="25.00">25%</SelectItem>
                      <SelectItem value="50.00">50%</SelectItem>
                      <SelectItem value="75.00">75%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 text-xs font-semibold uppercase tracking-wider">Preferred Asset</Label>
                  <Select
                    value={roundUpSettings?.preferredCrypto ?? "BTC"}
                    onValueChange={(value) => handleRoundUpToggle("preferredCrypto", value)}
                  >
                    <SelectTrigger className="border-slate-200 focus:ring-dime-purple">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                      <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                      <SelectItem value="XRP">Ripple (XRP)</SelectItem>
                      <SelectItem value="LTC">Litecoin (LTC)</SelectItem>
                      <SelectItem value="ADA">Cardano (ADA)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Row>
          )}
        </Section>

        {/* NOTIFICATIONS */}
        <Section title="Notifications">
          <Row>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">Push Notifications</p>
                <p className="text-xs text-slate-500">Alerts on your device</p>
              </div>
            </div>
            <Switch defaultChecked />
          </Row>
          <Row>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">Email Notifications</p>
                <p className="text-xs text-slate-500">Weekly progress summaries</p>
              </div>
            </div>
            <Switch defaultChecked />
          </Row>
          <Row>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">Payment Reminders</p>
                <p className="text-xs text-slate-500">Upcoming due dates</p>
              </div>
            </div>
            <Switch defaultChecked />
          </Row>
          <Row isLast>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">Round-Up Milestones</p>
                <p className="text-xs text-slate-500">Savings achievements</p>
              </div>
            </div>
            <Switch defaultChecked />
          </Row>
        </Section>

        {/* SUPPORT */}
        <Section title="Support & Info">
          <button onClick={() => setFeedbackOpen(true)} className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left border-b border-slate-100 press-scale" data-testid="button-open-feedback">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-dime-purple/10 text-dime-purple flex items-center justify-center shrink-0">
                <MessageSquare className="h-4 w-4" />
              </div>
              <p className="font-medium text-slate-900 text-sm">Send Feedback</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
          
          <div className="p-4 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <Info className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">App Version</p>
              </div>
            </div>
            <span className="text-sm font-medium text-slate-500 tabular-nums">1.0.0</span>
          </div>

          <button
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left border-b border-slate-100 press-scale"
            onClick={() => setLocation("/privacy")}
            data-testid="link-privacy-policy"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p className="font-medium text-slate-900 text-sm">Privacy Policy</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>

          <button
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left press-scale"
            onClick={() => setLocation("/terms")}
            data-testid="link-terms-of-service"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <p className="font-medium text-slate-900 text-sm">Terms of Service</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        </Section>

        {/* LOGOUT & DANGER */}
        <div className="space-y-4 mb-8">
          <Button 
            variant="outline" 
            className="w-full bg-white text-slate-900 border-slate-200 hover:bg-slate-50 h-12 press-scale shadow-sm"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2 text-slate-500" />
            Log Out
          </Button>

          <div className="bg-red-50/50 border border-red-100 rounded-2xl p-1 shadow-sm overflow-hidden animate-fade-in-up">
            {!showDeleteConfirm ? (
              <Button 
                variant="ghost" 
                className="w-full text-red-600 hover:bg-red-100 hover:text-red-700 h-12 press-scale"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            ) : (
              <div className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-red-900 text-sm">This action cannot be undone.</p>
                    <p className="text-xs text-red-700 mt-1 leading-relaxed">
                      All your data, connections, and settings will be permanently removed.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deleteConfirm" className="text-xs font-semibold text-red-800 uppercase tracking-wider">
                    Type <span className="font-bold font-mono bg-red-100 px-1 py-0.5 rounded">DELETE</span> to confirm
                  </Label>
                  <Input
                    id="deleteConfirm"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="border-red-200 focus-visible:ring-red-500 bg-white"
                  />
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-red-200 text-red-700 hover:bg-red-100 hover:text-red-800 press-scale"
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive"
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white press-scale"
                    disabled={deleteConfirmText !== "DELETE" || deleteAccountMutation.isPending}
                    onClick={handleDeleteAccount}
                  >
                    {deleteAccountMutation.isPending ? "Deleting..." : "Confirm Delete"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TRUST FOOTER */}
        <div className="flex flex-col items-center justify-center py-6 text-slate-400 space-y-2 animate-fade-in-up delay-200">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Lock className="h-3 w-3" />
            <span>256-bit encryption</span>
            <span className="mx-1">•</span>
            <span>Secured by Plaid</span>
          </div>
          <p className="text-[10px] uppercase tracking-wider font-semibold">Dime Time Financial</p>
        </div>

        {/* Beta + Compliance */}
        <div className="mb-6 hidden">
          <BetaModeBanner variant="full" showCompliance />
        </div>

        {/* Modals */}
        <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
          <DialogContent className="sm:max-w-md bg-card border-none shadow-card">
            <DialogHeader className="bg-slate-50 p-6 border-b -mx-6 -mt-6 mb-6">
              <DialogTitle className="text-xl font-bold text-slate-900">Send Feedback</DialogTitle>
              <DialogDescription className="text-slate-600 mt-1">
                Your name and email are attached automatically from your account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="feedback-from" className="text-slate-700 text-xs font-semibold uppercase tracking-wider">From</Label>
                <Input
                  id="feedback-from"
                  value={user?.email ?? ""}
                  readOnly
                  disabled
                  className="bg-slate-50 border-slate-200 text-slate-900"
                  data-testid="input-feedback-from"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback-subject" className="text-slate-700 text-xs font-semibold uppercase tracking-wider">Subject (optional)</Label>
                <Input
                  id="feedback-subject"
                  value={feedbackSubject}
                  onChange={(e) => setFeedbackSubject(e.target.value)}
                  placeholder="Short summary"
                  maxLength={120}
                  className="border-slate-200 focus-visible:ring-dime-purple"
                  data-testid="input-feedback-subject"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback-message" className="text-slate-700 text-xs font-semibold uppercase tracking-wider">Message</Label>
                <Textarea
                  id="feedback-message"
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder="Tell us what's working, what's broken, or what you'd love to see."
                  rows={5}
                  maxLength={4000}
                  className="border-slate-200 focus-visible:ring-dime-purple resize-none"
                  data-testid="textarea-feedback-message"
                />
              </div>
            </div>
            <DialogFooter className="mt-4 pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setFeedbackOpen(false)}
                disabled={sendFeedbackMutation.isPending}
                className="press-scale"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendFeedback}
                disabled={sendFeedbackMutation.isPending || !feedbackMessage.trim()}
                className="bg-dime-purple text-white hover:bg-dime-accent press-scale shadow-sm"
                data-testid="button-send-feedback"
              >
                {sendFeedbackMutation.isPending ? "Sending..." : "Send"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
