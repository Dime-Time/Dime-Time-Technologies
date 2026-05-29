import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type StripeDiagnostics = {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  capabilities: Record<string, string>;
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
    disabledReason: string | null;
  };
  futureRequirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
  };
};

async function adminFetch(path: string): Promise<Response> {
  const { getApiUrl } = await import("@/lib/queryClient");
  const { getAuthToken } = await import("@/lib/authToken");
  const headers: Record<string, string> = {};
  const token = await getAuthToken().catch(() => null);
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(getApiUrl(path), { credentials: "include", headers });
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

function CapabilityStatus({ status }: { status: string | undefined }) {
  const s = (status ?? "inactive").toLowerCase();
  const label = s === "active" ? "ACTIVE" : s === "pending" ? "PENDING" : "INACTIVE";
  const tone =
    s === "active"
      ? "bg-green-100 text-green-800 border-green-200"
      : s === "pending"
      ? "bg-amber-100 text-amber-900 border-amber-200"
      : "bg-slate-100 text-slate-700 border-slate-200";
  return <Badge variant="outline" className={tone}>{label}</Badge>;
}

const TRACKED_CAPABILITIES = [
  "card_payments",
  "transfers",
  "treasury",
  "financial_connections",
  "us_bank_account_ach_payments",
];

function Verdict({ d }: { d: StripeDiagnostics }) {
  const ach = (d.capabilities["us_bank_account_ach_payments"] ?? "inactive").toLowerCase();
  const fc = (d.capabilities["financial_connections"] ?? "inactive").toLowerCase();
  const treasury = (d.capabilities["treasury"] ?? "inactive").toLowerCase();

  let headline: string;
  let tone: string;
  if (d.requirements.disabledReason) {
    headline = `Account restricted: ${d.requirements.disabledReason}. Resolve the requirements below.`;
    tone = "border-red-200 bg-red-50 text-red-800";
  } else if (d.requirements.currentlyDue.length > 0) {
    headline = "Missing required information — Stripe needs the fields listed under \"currently due\" before capabilities activate.";
    tone = "border-red-200 bg-red-50 text-red-800";
  } else if (ach === "active" && fc === "active") {
    headline = "Fully approved for ACH — Financial Connections + ACH debit are both active. You can run the internal test walkthrough.";
    tone = "border-green-200 bg-green-50 text-green-800";
  } else if (fc !== "active" && ach === "active") {
    headline = "ACH debit is active but Financial Connections is not — bank linking via FC may not work yet. Waiting on Financial Connections approval.";
    tone = "border-amber-200 bg-amber-50 text-amber-900";
  } else if (treasury === "pending") {
    headline = "Core payments look active; Treasury is still pending review (only needed for stored balances, not for basic ACH debit).";
    tone = "border-amber-200 bg-amber-50 text-amber-900";
  } else {
    headline = "ACH capabilities are not active yet — likely still in review. See per-capability status and requirements below.";
    tone = "border-amber-200 bg-amber-50 text-amber-900";
  }

  return <div className={`text-sm rounded-md border px-3 py-2 ${tone}`} data-testid="admin-stripe-verdict">{headline}</div>;
}

function ReqList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-600 mb-1">{label} <span className="text-slate-400">({items.length})</span></div>
      {items.length === 0 ? (
        <div className="text-xs text-slate-400">none</div>
      ) : (
        <ul className="text-xs font-mono text-slate-700 list-disc pl-4 space-y-0.5">
          {items.map((i) => <li key={i}>{i}</li>)}
        </ul>
      )}
    </div>
  );
}

function StripeDiagnosticsTab() {
  const query = useQuery<StripeDiagnostics>({
    queryKey: ["/api/admin/stripe/diagnostics"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/stripe/diagnostics");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      return res.json();
    },
    retry: false,
  });

  const d = query.data;
  const capRows = d
    ? Array.from(new Set([...TRACKED_CAPABILITIES, ...Object.keys(d.capabilities)]))
    : TRACKED_CAPABILITIES;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          data-testid="admin-refresh-diagnostics"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh from Stripe
        </Button>
        <span className="text-xs text-slate-500 ml-auto">Live read from Stripe · no secrets exposed</span>
      </div>

      {query.isLoading && <div className="text-sm text-slate-500">Querying Stripe…</div>}

      {query.isError && (
        <div className="text-sm text-red-700 border border-red-200 bg-red-50 rounded p-3" data-testid="admin-diagnostics-error">
          {(query.error as Error)?.message || "Failed to load Stripe diagnostics."}
        </div>
      )}

      {d && (
        <>
          <Verdict d={d} />

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Account Status</CardTitle></CardHeader>
            <CardContent className="text-xs font-mono grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-6">
              <Field label="account id" value={d.accountId} />
              <Field label="charges_enabled" value={String(d.chargesEnabled)} />
              <Field label="payouts_enabled" value={String(d.payoutsEnabled)} />
              <Field label="details_submitted" value={String(d.detailsSubmitted)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Capabilities</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y">
                {capRows.map((name) => (
                  <div key={name} className="flex items-center gap-3 py-1.5" data-testid={`admin-capability-${name}`}>
                    <span className="font-mono text-xs flex-1">{name}</span>
                    <CapabilityStatus status={d.capabilities[name]} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Requirements</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {d.requirements.disabledReason && (
                <div className="md:col-span-2 text-xs text-red-700">
                  <span className="font-medium">disabled_reason:</span> <span className="font-mono">{d.requirements.disabledReason}</span>
                </div>
              )}
              <ReqList label="currently due" items={d.requirements.currentlyDue} />
              <ReqList label="eventually due" items={d.requirements.eventuallyDue} />
              <ReqList label="past due" items={d.requirements.pastDue} />
              <ReqList label="pending verification" items={d.requirements.pendingVerification} />
              <ReqList label="future · currently due" items={d.futureRequirements.currentlyDue} />
              <ReqList label="future · eventually due" items={d.futureRequirements.eventuallyDue} />
            </CardContent>
          </Card>
        </>
      )}
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
          <TabsTrigger value="diagnostics" data-testid="admin-tab-diagnostics">Stripe Diagnostics</TabsTrigger>
        </TabsList>
        <TabsContent value="transfers" className="mt-3">
          <TransfersTab />
        </TabsContent>
        <TabsContent value="webhooks" className="mt-3">
          <WebhooksTab />
        </TabsContent>
        <TabsContent value="diagnostics" className="mt-3">
          <StripeDiagnosticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
