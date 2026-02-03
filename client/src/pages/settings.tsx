import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSecurity } from "@/hooks/useSecurity";
import { useAuth } from "@/hooks/useAuth";
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
  Save,
  Fingerprint,
  KeyRound,
  LogOut
} from "lucide-react";

interface RoundUpSettings {
  id: string;
  userId: string;
  isEnabled: boolean;
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

  // Update round-up settings mutation
  const updateRoundUpSettings = useMutation({
    mutationFn: async (settings: Partial<RoundUpSettings>) => {
      const response = await fetch("/api/round-up-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("Failed to update settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/round-up-settings"] });
      toast({ title: "Settings updated successfully" });
    },
    onError: () => {
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

  const handleProfileUpdate = () => {
    // In a real app, this would update the user profile
    toast({ title: "Profile update feature coming soon" });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your account settings and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Settings
            </CardTitle>
            <CardDescription>
              Update your personal information and account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={profileData.firstName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={profileData.lastName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <Button onClick={handleProfileUpdate} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Save Profile Changes
            </Button>
          </CardContent>
        </Card>

        {/* App Lock Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              App Lock
            </CardTitle>
            <CardDescription>
              Secure your app with PIN and Face ID
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-gray-500" />
                <div>
                  <Label>PIN Lock</Label>
                  <p className="text-sm text-gray-600">
                    {pinConfigured ? "Your app is secured with a PIN" : "Set up a 4-digit PIN to lock your app"}
                  </p>
                </div>
              </div>
              {pinConfigured ? (
                <Button variant="outline" size="sm" onClick={handleClearPin}>
                  Remove PIN
                </Button>
              ) : (
                <Button size="sm" onClick={handleSetupPin} className="bg-dime-purple hover:bg-dime-purple/90">
                  Set Up PIN
                </Button>
              )}
            </div>

            {/* Face ID: Not yet implemented - hidden until native biometrics integrated */}
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Password Settings
            </CardTitle>
            <CardDescription>
              Change your account password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showPassword ? "text" : "password"}
                  value={profileData.currentPassword}
                  onChange={(e) => setProfileData(prev => ({ ...prev, currentPassword: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={profileData.newPassword}
                  onChange={(e) => setProfileData(prev => ({ ...prev, newPassword: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={profileData.confirmPassword}
                  onChange={(e) => setProfileData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </div>
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Update Password
            </Button>
          </CardContent>
        </Card>

        {/* Round-Up Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Round-Up Settings
            </CardTitle>
            <CardDescription>
              Configure how your spare change is collected and applied
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Enable Round-Ups</Label>
                <p className="text-sm text-gray-600">
                  Automatically round up purchases to the nearest dollar
                </p>
              </div>
              <Switch
                checked={roundUpSettings?.isEnabled ?? false}
                onCheckedChange={(checked) => handleRoundUpToggle("isEnabled", checked)}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Round-Up Multiplier</Label>
                <Select
                  value={roundUpSettings?.multiplier ?? "1.00"}
                  onValueChange={(value) => handleRoundUpToggle("multiplier", value)}
                >
                  <SelectTrigger>
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
                <Label>Auto-Apply Threshold</Label>
                <Select
                  value={roundUpSettings?.autoApplyThreshold ?? "25.00"}
                  onValueChange={(value) => handleRoundUpToggle("autoApplyThreshold", value)}
                >
                  <SelectTrigger>
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
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Crypto Investment</Label>
                  <p className="text-sm text-gray-600">
                    Invest a portion of round-ups in cryptocurrency
                  </p>
                </div>
                <Switch
                  checked={roundUpSettings?.cryptoEnabled ?? false}
                  onCheckedChange={(checked) => handleRoundUpToggle("cryptoEnabled", checked)}
                />
              </div>

              {roundUpSettings?.cryptoEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Crypto Percentage</Label>
                    <Select
                      value={roundUpSettings?.cryptoPercentage ?? "25.00"}
                      onValueChange={(value) => handleRoundUpToggle("cryptoPercentage", value)}
                    >
                      <SelectTrigger>
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
                    <Label>Preferred Cryptocurrency</Label>
                    <Select
                      value={roundUpSettings?.preferredCrypto ?? "BTC"}
                      onValueChange={(value) => handleRoundUpToggle("preferredCrypto", value)}
                    >
                      <SelectTrigger>
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
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Choose how you want to be notified about your progress
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-gray-500" />
                <div>
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-gray-600">Receive alerts on your device</p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-500" />
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-gray-600">Weekly progress summaries</p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-gray-500" />
                <div>
                  <Label>Payment Reminders</Label>
                  <p className="text-sm text-gray-600">Alerts for upcoming due dates</p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-gray-500" />
                <div>
                  <Label>Round-Up Milestones</Label>
                  <p className="text-sm text-gray-600">Celebrate your savings achievements</p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* App Information */}
        <Card>
          <CardHeader>
            <CardTitle>App Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Version</span>
              <Badge variant="outline">1.0.0</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last Updated</span>
              <span className="text-sm">August 12, 2025</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Privacy Policy</span>
              <Button variant="link" size="sm">View</Button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Terms of Service</span>
              <Button variant="link" size="sm">View</Button>
            </div>
          </CardContent>
        </Card>

        {/* Logout */}
        <Button 
          variant="outline" 
          className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          onClick={logout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Log Out
        </Button>
      </div>
    </div>
  );
}