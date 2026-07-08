import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, XCircle } from "lucide-react";

interface ServiceStatus {
  coinbase?: {
    configured: boolean;
    status: string;
    demoMode?: boolean;
  };
  plaid?: {
    configured: boolean;
    status: string;
  };
}

export function CoinbaseStatus() {
  const { data: serviceStatus, isLoading } = useQuery<ServiceStatus>({
    queryKey: ['/api/service-status'],
  });

  if (isLoading) {
    return (
      <Alert className="bg-dime-purple/5 border-dime-purple/10 mb-8 shadow-sm">
        <AlertCircle className="h-4 w-4 text-dime-purple" />
        <AlertDescription className="text-slate-700 font-medium">Checking Coinbase connection...</AlertDescription>
      </Alert>
    );
  }

  const coinbaseStatus = serviceStatus?.coinbase;

  if (!coinbaseStatus) {
    return null;
  }

  if (coinbaseStatus.configured) {
    return (
      <Alert className="bg-dime-purple/5 border-dime-purple/20 mb-8 shadow-sm">
        <CheckCircle className="h-5 w-5 text-dime-purple" />
        <AlertDescription className="text-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-medium text-base">
              {coinbaseStatus.demoMode 
                ? "Bitcoin purchases in demo mode - simulated trades only"
                : "Coinbase integration is active - real crypto purchases enabled"
              }
            </span>
            <Badge 
              variant="default" 
              className={coinbaseStatus.demoMode 
                ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200" 
                : "bg-dime-purple text-white hover:bg-dime-purple/90"
              }
            >
              {coinbaseStatus.demoMode ? "Demo Mode" : "Connected"}
            </Badge>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="bg-amber-50 border-amber-200 mb-8 shadow-sm">
      <XCircle className="h-5 w-5 text-amber-600" />
      <AlertDescription className="text-amber-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="font-medium text-base">Coinbase not configured - using demo mode for crypto purchases</span>
          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-100 hover:bg-amber-200 w-fit">Demo Mode</Badge>
        </div>
      </AlertDescription>
    </Alert>
  );
}