import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { hasPinSet, isAppLocked, setAppLocked, clearSecuritySettings } from "@/lib/securityStore";

interface SecurityContextType {
  isLocked: boolean;
  hasPinConfigured: boolean;
  needsPinSetup: boolean;
  setNeedsPinSetup: (needs: boolean) => void;
  unlock: () => void;
  lock: () => void;
  clearSecurity: () => void;
  skipPinSetup: () => void;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error("useSecurity must be used within a SecurityProvider");
  }
  return context;
}

interface SecurityProviderProps {
  children: ReactNode;
}

export function SecurityProvider({ children }: SecurityProviderProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [hasPinConfigured, setHasPinConfigured] = useState(false);
  const [needsPinSetup, setNeedsPinSetup] = useState(false);

  useEffect(() => {
    const checkSecurity = () => {
      const hasPin = hasPinSet();
      setHasPinConfigured(hasPin);
      if (hasPin) {
        setIsLocked(isAppLocked());
      }
    };
    checkSecurity();

    const handleVisibilityChange = () => {
      if (document.hidden && hasPinSet()) {
        setAppLocked(true);
        setIsLocked(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const unlock = () => {
    setAppLocked(false);
    setIsLocked(false);
  };

  const lock = () => {
    if (hasPinSet()) {
      setAppLocked(true);
      setIsLocked(true);
    }
  };

  const clearSecurity = () => {
    clearSecuritySettings();
    setHasPinConfigured(false);
    setIsLocked(false);
    setNeedsPinSetup(false);
  };

  const skipPinSetup = () => {
    setNeedsPinSetup(false);
  };

  const value: SecurityContextType = {
    isLocked,
    hasPinConfigured,
    needsPinSetup,
    setNeedsPinSetup,
    unlock,
    lock,
    clearSecurity,
    skipPinSetup,
  };

  return (
    <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>
  );
}
