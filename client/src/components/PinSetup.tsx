import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Fingerprint } from "lucide-react";
import { savePinHash, setBiometricEnabled, checkBiometricAvailable, setAppLocked } from "@/lib/securityStore";
import { useToast } from "@/hooks/use-toast";

interface PinSetupProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function PinSetup({ onComplete, onSkip }: PinSetupProps) {
  const [step, setStep] = useState<"create" | "confirm" | "biometric">("create");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [biometricAvailable, setBiometricAvailableState] = useState(false);
  const { toast } = useToast();

  const handlePinInput = (digit: string) => {
    if (step === "create" && pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        setTimeout(() => setStep("confirm"), 300);
      }
    } else if (step === "confirm" && confirmPin.length < 4) {
      const newConfirm = confirmPin + digit;
      setConfirmPin(newConfirm);
      if (newConfirm.length === 4) {
        setTimeout(() => handlePinConfirm(newConfirm), 300);
      }
    }
  };

  const handleBackspace = () => {
    if (step === "create") {
      setPin(pin.slice(0, -1));
    } else if (step === "confirm") {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const handlePinConfirm = async (confirmValue: string) => {
    if (pin !== confirmValue) {
      toast({
        title: "PINs don't match",
        description: "Please try again",
        variant: "destructive",
      });
      setPin("");
      setConfirmPin("");
      setStep("create");
      return;
    }

    setIsProcessing(true);
    try {
      await savePinHash(pin);
      const available = await checkBiometricAvailable();
      setBiometricAvailableState(available);
      if (available) {
        setStep("biometric");
      } else {
        setAppLocked(false);
        onComplete();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save PIN. Please try again.",
        variant: "destructive",
      });
      setPin("");
      setConfirmPin("");
      setStep("create");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBiometricChoice = (enable: boolean) => {
    setBiometricEnabled(enable);
    setAppLocked(false);
    onComplete();
  };

  const renderPinDots = (value: string) => (
    <div className="flex justify-center gap-4 my-8">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full border-2 border-white transition-all ${
            i < value.length ? "bg-white" : "bg-transparent"
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
          disabled={isProcessing || key === ""}
        >
          {key}
        </Button>
      ))}
    </div>
  );

  if (step === "biometric") {
    return (
      <div className="min-h-screen bg-[#918EF4] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/10 border-white/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
              <Fingerprint className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-white text-xl">Enable Face ID?</CardTitle>
            <p className="text-white/80 text-sm mt-2">
              Use Face ID for quick and secure access to your account
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => handleBiometricChoice(true)}
              className="w-full bg-white text-[#918EF4] hover:bg-white/90 font-semibold"
            >
              Enable Face ID
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleBiometricChoice(false)}
              className="w-full text-white hover:bg-white/20"
            >
              Maybe Later
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#918EF4] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-white" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">
          {step === "create" ? "Create Your PIN" : "Confirm Your PIN"}
        </h1>
        <p className="text-white/80 text-sm mb-8">
          {step === "create"
            ? "Create a 4-digit PIN to secure your account"
            : "Enter your PIN again to confirm"}
        </p>

        {renderPinDots(step === "create" ? pin : confirmPin)}
        {renderKeypad()}

        {onSkip && step === "create" && (
          <Button
            variant="ghost"
            onClick={onSkip}
            className="mt-8 text-white/70 hover:text-white hover:bg-white/10"
          >
            Skip for Now
          </Button>
        )}
      </div>
    </div>
  );
}
