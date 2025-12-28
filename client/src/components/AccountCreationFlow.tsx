import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { UserPlus, Mail, Lock, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Keyboard } from "@capacitor/keyboard";
import { getApiUrl } from "@/lib/queryClient";
import { saveAuthToken } from "@/lib/authToken";

interface AccountCreationFlowProps {
  onAccountCreated: (userData: any) => void;
  onCancel: () => void;
}

export function AccountCreationFlow({ onAccountCreated, onCancel }: AccountCreationFlowProps) {
  const [step, setStep] = useState<'form' | 'legal'>('form');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Handle keyboard events for iOS scrolling
  useEffect(() => {
    let showListener: any;
    let hideListener: any;

    const setupKeyboardListeners = async () => {
      try {
        showListener = await Keyboard.addListener('keyboardWillShow', (info) => {
          setKeyboardHeight(info.keyboardHeight);
          // Scroll focused input into view
          setTimeout(() => {
            const activeElement = document.activeElement as HTMLElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
              activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
        });

        hideListener = await Keyboard.addListener('keyboardWillHide', () => {
          setKeyboardHeight(0);
        });
      } catch (e) {
        // Keyboard plugin not available (web browser)
        console.log('Capacitor Keyboard not available');
      }
    };

    setupKeyboardListeners();

    return () => {
      showListener?.remove?.();
      hideListener?.remove?.();
    };
  }, []);

  // Scroll input into view on focus (fallback for web)
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      });
      return;
    }

    // Show legal disclaimer
    setStep('legal');
  };

  const handleLegalAccept = async () => {
    setIsCreating(true);
    
    try {
      // Call the real /api/signup endpoint - use absolute URL for iOS native app
      const response = await fetch(getApiUrl('/api/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important: include cookies for session
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName
        })
      });

      if (!response.ok) {
        const error = await response.json();
        // If email already exists, guide user to login
        if (error.message === "Email already registered") {
          toast({
            title: "Email Already Registered",
            description: "This email already has an account. Please use the login page instead.",
            variant: "destructive"
          });
          setIsCreating(false);
          // Redirect to login after a short delay
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          return;
        }
        throw new Error(error.message || 'Signup failed');
      }

      const userData = await response.json();

      // Save auth token for native apps (persists across app restarts)
      if (userData.authToken) {
        saveAuthToken(userData.authToken);
      }

      // Invalidate auth cache so useAuth refetches /api/user with new session
      await queryClient.invalidateQueries({ queryKey: ['/api/user'] });

      toast({
        title: "Account Created Successfully!",
        description: "Welcome to Dime Time. Your account is ready to use.",
      });

      onAccountCreated(userData.user || userData);
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: "Account Creation Failed",
        description: error.message || "Please try again later",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleLegalDecline = () => {
    toast({
      title: "Account Creation Cancelled",
      description: "You must accept the terms to create an account",
      variant: "destructive"
    });
    setStep('form');
  };

  if (step === 'legal') {
    return (
      <LegalDisclaimer 
        onAccept={handleLegalAccept}
        onDecline={handleLegalDecline}
      />
    );
  }

  return (
    <div 
      ref={scrollContainerRef}
      className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto touch-pan-y"
      style={{ paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '1rem' }}
    >
      <Card className="w-full max-w-md my-4 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-dime-purple" />
            Create Your Account
          </CardTitle>
          <p className="text-sm text-gray-600">
            Join Dime Time to start your debt-free journey
          </p>
        </CardHeader>
        
        <CardContent className="flex-1 pb-6">
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    autoComplete="given-name"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    onFocus={handleInputFocus}
                    className="pl-10"
                    data-testid="input-first-name"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    autoComplete="family-name"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    onFocus={handleInputFocus}
                    className="pl-10"
                    data-testid="input-last-name"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  onFocus={handleInputFocus}
                  className="pl-10"
                  data-testid="input-email"
                  required
                />
              </div>
            </div>


            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  onFocus={handleInputFocus}
                  className="pl-10"
                  data-testid="input-password"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  onFocus={handleInputFocus}
                  className="pl-10"
                  data-testid="input-confirm-password"
                  required
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                data-testid="button-cancel-account"
              >
                Cancel
              </Button>
              
              <Button
                type="submit"
                disabled={isCreating}
                className="bg-dime-purple hover:bg-dime-purple/90"
                data-testid="button-create-account"
              >
                {isCreating ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      {/* Keyboard spacer for iOS */}
      {keyboardHeight > 0 && (
        <div style={{ height: `${keyboardHeight}px`, flexShrink: 0 }} />
      )}
    </div>
  );
}