import { useEffect, useRef, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { savePlaidOauthState, clearPlaidOauthState, reportPlaidLinkEvent } from '@/lib/plaidOauth';
import { Loader2, RefreshCw } from 'lucide-react';

interface PlaidReconnectButtonProps {
  bankAccountId: string;
  onReconnected?: () => void;
}

/**
 * Repairs an existing bank connection via Plaid update mode. Rendered when a
 * balance/transaction fetch reported `needsRelink` for the account — the user
 * re-enters their bank credentials and the stored token starts working again
 * (no token exchange happens in update mode).
 */
export function PlaidReconnectButton({ bankAccountId, onReconnected }: PlaidReconnectButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: () => {
      clearPlaidOauthState();
      toast({
        title: 'Bank Reconnected',
        description: 'Your bank connection has been restored.',
      });
      onReconnected?.();
    },
    onExit: (error, metadata) => {
      clearPlaidOauthState();
      reportPlaidLinkEvent(error ? 'relink_exit_error' : 'relink_exit_cancel', error, metadata);
      if (error) {
        toast({
          title: 'Reconnect Failed',
          description: 'We could not restore the bank connection. Please try again.',
          variant: 'destructive',
        });
      }
    },
  });

  // open() as soon as the update-mode token is ready (mirrors PlaidLink's
  // click-twice avoidance); guard against duplicate opens.
  const openedRef = useRef(false);
  useEffect(() => {
    if (linkToken && ready && !openedRef.current) {
      openedRef.current = true;
      open();
    }
  }, [linkToken, ready, open]);

  const handleReconnect = async () => {
    if (linkToken && ready) {
      open();
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/plaid/create-update-link-token', { bankAccountId });
      if (!response.ok) throw new Error('Failed to create update link token');
      const data = await response.json();
      // OAuth banks redirect away and back to /plaid/oauth; persist the token
      // so that page can resume Link in relink mode.
      savePlaidOauthState(data.linkToken, 'relink');
      openedRef.current = false;
      setLinkToken(data.linkToken);
    } catch (error) {
      console.error('Error starting bank reconnect:', error);
      toast({
        title: 'Reconnect Error',
        description: 'Could not start the reconnect flow. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      onClick={handleReconnect}
      disabled={isLoading || (linkToken !== null && !ready)}
      className="flex items-center gap-1.5"
      data-testid={`button-reconnect-${bankAccountId}`}
    >
      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
      Reconnect
    </Button>
  );
}
