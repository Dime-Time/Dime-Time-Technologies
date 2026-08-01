import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";

type AdminTransfer = {
  id: string;
  userId: string;
  type: string;
  amount: string;
  status: string;
  provider: string | null;
  plaidTransferId: string | null;
  plaidAuthorizationId: string | null;
  mercuryTransferId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  debtId: string | null;
  correlationId: string;
  idempotencyKey: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type AdminWebhookEvent = {
  eventId: string;
  type: string;
  receivedAt: string;
};

async function adminFetch(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<Response> {
  const { getApiUrl } = await import("@/lib/queryClient");
  const { getAuthToken } = await import("@/lib/authToken");
  const headers: Record<string, string> = {};
  const token = await getAuthToken().catch(() => null);
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let body: string | undefined;
  if (init?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  return fetch(getApiUrl(path), {
    method: init?.method ?? "GET",
    credentials: "include",
    headers,
    body,
  });
}

function fmt(d: string | Date | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
}

function StatusPill({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const tone =
    lower === "settled" || lower === "completed" || lower === "posted"
      ? "bg-green-100 text-green-800 border-green-200"
      : lower === "failed" || lower === "returned" || lower === "cancelled"
      ? "bg-red-100 text-red-800 border-red-200"
      : lower === "requires_action"
      ? "bg-amber-100 text-amber-900 border-amber-200"
      : "bg-slate-100 text-slate-800 border-slate-200";
  return <Badge variant="outline" className={tone}>{status}</Badge>;
}

function TransferRow({ row }: { row: AdminTransfer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-md mb-2 bg-white" data-testid={`admin-transfer-${row.id}`}>
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-2 text-left"
        onClick={() => setOpen((v) => !v)}
        data-testid={`admin-transfer-toggle-${row.id}`}
      >
        {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
        <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_auto] gap-2 items-center">
          <div className="truncate text-sm">
            <span className="font-mono text-xs text-slate-500 mr-2">{row.id.slice(0, 8)}</span>
            <span className="font-medium">{row.type}</span>
            <span className="text-slate-500"> · ${row.amount}</span>
            <span className="text-slate-500"> · {row.provider ?? "—"}</span>
          </div>
          <StatusPill status={row.status} />
          <span className="text-xs text-slate-500 whitespace-nowrap">{fmt(row.createdAt)}</span>
        </div>
      </button>
      {open && (
        <div className="border-t px-3 py-3 text-xs font-mono text-slate-700 bg-slate-50 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
          <Field label="id" value={row.id} />
          <Field label="userId" value={row.userId} />
          <Field label="correlationId" value={row.correlationId} />
          <Field label="idempotencyKey" value={row.idempotencyKey} />
          <Field label="debtId" value={row.debtId} />
          <Field label="updatedAt" value={fmt(row.updatedAt)} />
          <Field label="provider" value={row.provider} />
          <Field label="stripePaymentIntentId" value={row.stripePaymentIntentId} />
          <Field label="stripeChargeId" value={row.stripeChargeId} />
          <Field label="plaidTransferId" value={row.plaidTransferId} />
          <Field label="plaidAuthorizationId" value={row.plaidAuthorizationId} />
          <Field label="mercuryTransferId" value={row.mercuryTransferId} />
          {row.errorCode && <Field label="errorCode" value={row.errorCode} />}
          {row.errorMessage && <Field label="errorMessage" value={row.errorMessage} />}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2 break-all">
      <span className="text-slate-500 shrink-0">{label}:</span>
      <span>{value && value.length > 0 ? value : <span className="text-slate-400">—</span>}</span>
    </div>
  );
}

function TransfersTab() {
  const [provider, setProvider] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [limit, setLimit] = useState<string>("100");

  const query = useQuery<{ count: number; transfers: AdminTransfer[] }>({
    queryKey: ["/api/admin/transfers", { provider, status, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (provider) params.set("provider", provider);
      if (status) params.set("status", status);
      if (limit) params.set("limit", limit);
      const res = await adminFetch(`/api/admin/transfers?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-slate-600 mb-1">provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="border rounded px-2 py-1 text-sm bg-white"
            data-testid="admin-filter-provider"
          >
            <option value="">all</option>
            <option value="stripe">stripe</option>
            <option value="plaid">plaid</option>
            <option value="mercury">mercury</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border rounded px-2 py-1 text-sm bg-white"
            data-testid="admin-filter-status"
          >
            <option value="">all</option>
            <option value="created">created</option>
            <option value="authorized">authorized</option>
            <option value="pending">pending</option>
            <option value="processing">processing</option>
            <option value="posted">posted</option>
            <option value="settled">settled</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
            <option value="returned">returned</option>
            <option value="cancelled">cancelled</option>
            <option value="requires_action">requires_action</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">limit</label>
          <Input
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-20 h-8"
            data-testid="admin-filter-limit"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          data-testid="admin-refresh-transfers"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <span className="text-xs text-slate-500 ml-auto">
          {query.data ? `${query.data.count} rows` : query.isLoading ? "loading…" : ""}
        </span>
      </div>

      {query.isError && (
        <div className="text-sm text-red-700 border border-red-200 bg-red-50 rounded p-2">
          Failed to load transfers.
        </div>
      )}

      <div>
        {query.data?.transfers.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-6">No transfers match.</div>
        )}
        {query.data?.transfers.map((t) => <TransferRow key={t.id} row={t} />)}
      </div>
    </div>
  );
}

function WebhooksTab() {
  const query = useQuery<{ count: number; events: AdminWebhookEvent[] }>({
    queryKey: ["/api/admin/webhooks/stripe"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/webhooks/stripe?limit=200");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          data-testid="admin-refresh-webhooks"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <span className="text-xs text-slate-500 ml-auto">
          {query.data ? `${query.data.count} events` : query.isLoading ? "loading…" : ""}
        </span>
      </div>
      {query.isError && (
        <div className="text-sm text-red-700 border border-red-200 bg-red-50 rounded p-2">
          Failed to load webhook events.
        </div>
      )}
      <div className="border rounded-md bg-white divide-y">
        {query.data?.events.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-6">No Stripe webhook events recorded yet.</div>
        )}
        {query.data?.events.map((e) => (
          <div key={e.eventId} className="flex items-center gap-3 px-3 py-2 text-sm" data-testid={`admin-webhook-${e.eventId}`}>
            <span className="font-mono text-xs text-slate-500 w-44 truncate">{e.eventId}</span>
            <span className="flex-1 truncate">{e.type}</span>
            <span className="text-xs text-slate-500 whitespace-nowrap">{fmt(e.receivedAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type RealTransferStatus = {
  userId: string;
  realTransfersEnabled: boolean;
  realTransfersBlockedAt: string | null;
  realTransfersBlockedBy: string | null;
  realTransfersNotes: string | null;
  trust: {
    tier: "new" | "settled" | "trusted" | "established";
    flagged: boolean;
    dailyTotalMaxDollars: number;
    dailyCountMax: number;
    firstTransferMaxDollars: number;
    overrideApplied: boolean;
    firstSettledAt: string | null;
  } | null;
  dailyCapOverride: string | null;
};

const TIER_LABELS: Record<string, string> = {
  new: "New (no settled transfer yet)",
  settled: "Settled (first transfer cleared)",
  trusted: "Trusted (7+ days clean)",
  established: "Established (30+ days clean)",
};

function UserRealMoneyControl({
  userId,
  title,
  subtitle,
}: {
  userId: string;
  title: string;
  subtitle?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const statusKey = ["/api/admin/users", userId, "real-transfers"] as const;

  const statusQuery = useQuery<RealTransferStatus>({
    queryKey: statusKey,
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/users/${encodeURIComponent(userId)}/real-transfers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: userId.length > 0,
  });

  const toggle = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await adminFetch(`/api/admin/users/${encodeURIComponent(userId)}/real-transfers`, {
        method: "POST",
        body: { enabled, notes: enabled ? "Unblocked via admin UI" : "Blocked via admin UI" },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }
      return (await res.json()) as RealTransferStatus;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(statusKey, data);
      toast({
        title: data.realTransfersEnabled ? "Real-money access restored" : "Real-money access blocked",
        description: data.realTransfersEnabled
          ? "This user can make real ACH transfers — still capped by the safety limits."
          : "This user can no longer make real ACH transfers.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Could not update",
        description: String(err?.message ?? err),
        variant: "destructive",
      });
    },
  });

  const [capInput, setCapInput] = useState("");
  const setCap = useMutation({
    mutationFn: async (dailyCap: number | null) => {
      const res = await adminFetch(`/api/admin/users/${encodeURIComponent(userId)}/real-transfer-limit`, {
        method: "POST",
        body: { dailyCap, notes: dailyCap === null ? "Override cleared via admin UI" : "Override set via admin UI" },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }
      return (await res.json()) as RealTransferStatus;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(statusKey, data);
      setCapInput("");
      toast({
        title: data.dailyCapOverride ? "Daily limit override set" : "Daily limit back to automatic",
        description: data.dailyCapOverride
          ? `This user's daily cap is now $${Number(data.dailyCapOverride).toFixed(2)} (manual override).`
          : "Automatic progressive-trust limits apply again.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Could not update limit", description: String(err?.message ?? err), variant: "destructive" });
    },
  });

  // Everyone is enabled by default; false only when an admin has blocked.
  const enabled = statusQuery.data?.realTransfersEnabled ?? true;
  const trust = statusQuery.data?.trust ?? null;

  return (
    <div className="space-y-2" data-testid={`admin-realmoney-${userId}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-medium truncate">{title}</div>
          {subtitle && <div className="font-mono text-xs text-slate-500 break-all">{subtitle}</div>}
        </div>
        {statusQuery.isLoading ? (
          <span className="text-xs text-slate-500">checking…</span>
        ) : statusQuery.isError ? (
          <span className="text-xs text-red-600">status unavailable</span>
        ) : (
          <Badge
            variant="outline"
            className={
              enabled
                ? "bg-green-100 text-green-800 border-green-200"
                : "bg-slate-100 text-slate-700 border-slate-200"
            }
          >
            {enabled ? "real money ON" : "real money off"}
          </Badge>
        )}
      </div>

      {statusQuery.data && (statusQuery.data.realTransfersBlockedAt || statusQuery.data.realTransfersNotes) && (
        <div className="text-xs text-slate-500 space-y-0.5">
          {statusQuery.data.realTransfersBlockedAt && <div>blocked since {fmt(statusQuery.data.realTransfersBlockedAt)}</div>}
          {statusQuery.data.realTransfersBlockedBy && (
            <div className="break-all">by {statusQuery.data.realTransfersBlockedBy}</div>
          )}
          {statusQuery.data.realTransfersNotes && <div>note: {statusQuery.data.realTransfersNotes}</div>}
        </div>
      )}

      {trust && (
        <div className="text-xs text-slate-600 border rounded-md bg-slate-50 border-slate-200 p-2 space-y-0.5">
          <div>
            Trust level: <strong>{TIER_LABELS[trust.tier] ?? trust.tier}</strong>
            {trust.flagged && <span className="text-red-600 font-semibold"> — RISK FLAGGED (returned/disputed transfer; limits demoted)</span>}
          </div>
          <div>
            Effective limits: ${trust.dailyTotalMaxDollars.toFixed(2)}/day · {trust.dailyCountMax} transfer(s)/day · first transfer ≤ ${trust.firstTransferMaxDollars.toFixed(2)}
            {trust.overrideApplied && <span className="font-semibold"> (manual override)</span>}
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">Manual daily cap ($)</div>
          <Input
            value={capInput}
            onChange={(e) => setCapInput(e.target.value)}
            placeholder={trust ? trust.dailyTotalMaxDollars.toFixed(2) : "e.g. 25"}
            className="h-8 w-28"
            inputMode="decimal"
            data-testid={`admin-realmoney-cap-input-${userId}`}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={setCap.isPending || !capInput.trim() || isNaN(Number(capInput)) || Number(capInput) < 0}
          onClick={() => setCap.mutate(Number(capInput))}
          data-testid={`admin-realmoney-cap-set-${userId}`}
        >
          Set limit
        </Button>
        {statusQuery.data?.dailyCapOverride != null && (
          <Button
            size="sm"
            variant="ghost"
            disabled={setCap.isPending}
            onClick={() => setCap.mutate(null)}
            data-testid={`admin-realmoney-cap-clear-${userId}`}
          >
            Clear override
          </Button>
        )}
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            variant={enabled ? "destructive" : "default"}
            disabled={toggle.isPending || statusQuery.isLoading || statusQuery.isError}
            data-testid={`admin-realmoney-toggle-${userId}`}
          >
            {toggle.isPending ? "Saving…" : enabled ? "Block real-money access" : "Unblock real-money access"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {enabled ? "Block real-money access?" : "Unblock real-money access?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {enabled
                ? `This immediately blocks ${title} from making real ACH transfers — it takes effect on their very next attempt.`
                : `This restores ${title}'s ability to move REAL money via ACH (real funds leave a real bank account). It stays capped by the safety limits: first transfer ≤ $1, ≤ $5/day, 1 per day. You can block instantly at any time.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`admin-realmoney-cancel-${userId}`}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toggle.mutate(!enabled)}
              className={enabled ? undefined : "bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"}
              data-testid={`admin-realmoney-confirm-${userId}`}
            >
              {enabled ? "Yes, block" : "Yes, unblock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RealMoneyTab({ selfUserId, selfEmail }: { selfUserId: string; selfEmail: string | null }) {
  const [lookupId, setLookupId] = useState("");
  const [activeLookupId, setActiveLookupId] = useState("");

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-700 border rounded-md bg-amber-50 border-amber-200 p-3">
        Every user can make <strong>real</strong> ACH transfers by default — always inside the built-in safety
        limits (first transfer ≤ $1, ≤ $5/day, 1 transfer/day, no duplicate pending). Use this tab to block a
        suspicious user instantly. Real money also still requires the master switch (<code>ENABLE_REAL_TRANSFERS</code>) to be on.
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your account</CardTitle>
        </CardHeader>
        <CardContent>
          <UserRealMoneyControl userId={selfUserId} title={selfEmail ?? "You"} subtitle={selfUserId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Look up / block a user</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-600 mb-1">User ID</label>
              <Input
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value.trim())}
                placeholder="paste a user id"
                data-testid="admin-realmoney-lookup-input"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setActiveLookupId(lookupId)}
              disabled={!lookupId}
              data-testid="admin-realmoney-lookup-btn"
            >
              Look up
            </Button>
          </div>
          {activeLookupId && activeLookupId === selfUserId && (
            <div className="text-xs text-slate-500">That's your own account — use the card above.</div>
          )}
          {activeLookupId && activeLookupId !== selfUserId && (
            <div className="border rounded-md p-3 bg-white">
              <UserRealMoneyControl userId={activeLookupId} title={activeLookupId} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-600">Loading…</div>;
  }

  if (!user) {
    return <div className="p-6 text-sm text-slate-600">Not authenticated.</div>;
  }

  if (!user.isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            This account is not an admin. Add your user id to <code>ADMIN_USER_IDS</code> (Replit Secret, comma-separated) and restart the server.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Internal Admin</h1>
        <span className="text-xs text-slate-500">Read-only · {user.email}</span>
      </div>
      <Tabs defaultValue="transfers">
        <TabsList>
          <TabsTrigger value="transfers" data-testid="admin-tab-transfers">Transfers</TabsTrigger>
          <TabsTrigger value="webhooks" data-testid="admin-tab-webhooks">Stripe Webhooks</TabsTrigger>
          <TabsTrigger value="realmoney" data-testid="admin-tab-realmoney">Real Money</TabsTrigger>
        </TabsList>
        <TabsContent value="transfers" className="mt-3">
          <TransfersTab />
        </TabsContent>
        <TabsContent value="webhooks" className="mt-3">
          <WebhooksTab />
        </TabsContent>
        <TabsContent value="realmoney" className="mt-3">
          <RealMoneyTab selfUserId={user.id} selfEmail={user.email} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
