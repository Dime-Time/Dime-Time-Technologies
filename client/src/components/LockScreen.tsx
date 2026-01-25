import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Fingerprint } from "lucide-react";
import { verifyPin, isBiometricEnabled, setAppLocked } from "@/lib/securityStore";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/logo";

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (isBiometricEnabled()) {
      attemptBiometric();
    }
  }, []);

  const attemptBiometric = async () => {
    try {
      if ("PublicKeyCredential" in window) {
        toast({
          title: "Face ID",
          description: "Face ID authentication is not available in web mode. Please enter your PIN.",
        });
      }
    } catch (error) {
      console.log("Biometric not available");
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 4 && !isVerifying) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        handlePinVerify(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (!isVerifying) {
      setPin(pin.slice(0, -1));
    }
  };

  const handlePinVerify = async (pinValue: string) => {
    setIsVerifying(true);
    try {
      const valid = await verifyPin(pinValue);
      if (valid) {
        setAppLocked(false);
        onUnlock();
      } else {
        setAttempts((prev) => prev + 1);
        toast({
          title: "Incorrect PIN",
          description: attempts >= 2 ? "Too many attempts. Please try again." : "Please try again.",
          variant: "destructive",
        });
        setPin("");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify PIN. Please try again.",
        variant: "destructive",
      });
      setPin("");
    } finally {
      setIsVerifying(false);
    }
  };

  const renderPinDots = () => (
    <div className="flex justify-center gap-4 my-8">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full border-2 border-white transition-all ${
            i < pin.length ? "bg-white" : "bg-transparent"
          }`}
        />
      ))}
    </div>
  );

  const renderKeypad = () => (
    <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) => (
        <Button
          key={key}
          variant="ghost"
          className={`h-16 text-2xl font-semibold text-white hover:bg-white/20 rounded-full ${
            key === "" ? "invisible" : ""
          }`}
          onClick={() => (key === "⌫" ? handleBackspace() : handlePinInput(key))}
          disabled={isVerifying || key === ""}
        >
          {key}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#918EF4] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <Logo size={64} clean={true} />
        </div>
        
        <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-white" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
        <p className="text-white/80 text-sm mb-8">Enter your PIN to unlock</p>

        {renderPinDots()}
        {renderKeypad()}

        {isBiometricEnabled() && (
          <Button
            variant="ghost"
            onClick={attemptBiometric}
            className="mt-8 text-white/70 hover:text-white hover:bg-white/10"
          >
            <Fingerprint className="w-5 h-5 mr-2" />
            Use Face ID
          </Button>
        )}
      </div>
    </div>
  );
}
