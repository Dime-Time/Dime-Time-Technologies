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
  realTransfersEnabledAt: string | null;
  realTransfersEnabledBy: string | null;
  realTransfersNotes: string | null;
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
        body: { enabled, notes: enabled ? "Approved via admin UI" : "Revoked via admin UI" },
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
        title: data.realTransfersEnabled ? "Approved for real money" : "Real-money access revoked",
        description: data.realTransfersEnabled
          ? "This user can now make real ACH transfers — still capped by the safety limits."
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

  const enabled = statusQuery.data?.realTransfersEnabled ?? false;

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

      {statusQuery.data && (statusQuery.data.realTransfersEnabledAt || statusQuery.data.realTransfersNotes) && (
        <div className="text-xs text-slate-500 space-y-0.5">
          {statusQuery.data.realTransfersEnabledAt && <div>since {fmt(statusQuery.data.realTransfersEnabledAt)}</div>}
          {statusQuery.data.realTransfersEnabledBy && (
            <div className="break-all">by {statusQuery.data.realTransfersEnabledBy}</div>
          )}
          {statusQuery.data.realTransfersNotes && <div>note: {statusQuery.data.realTransfersNotes}</div>}
        </div>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            variant={enabled ? "destructive" : "default"}
            disabled={toggle.isPending || statusQuery.isLoading || statusQuery.isError}
            data-testid={`admin-realmoney-toggle-${userId}`}
          >
            {toggle.isPending ? "Saving…" : enabled ? "Revoke real-money access" : "Approve for real money"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {enabled ? "Revoke real-money access?" : "Approve for real money?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {enabled
                ? `This immediately stops ${title} from making real ACH transfers — it takes effect on their very next attempt.`
                : `This lets ${title} move REAL money via ACH (real funds leave a real bank account). It stays capped by the safety limits: first transfer ≤ $1, ≤ $5/day, 1 per day. You can revoke instantly at any time.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`admin-realmoney-cancel-${userId}`}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toggle.mutate(!enabled)}
              className={enabled ? undefined : "bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"}
              data-testid={`admin-realmoney-confirm-${userId}`}
            >
              {enabled ? "Yes, revoke" : "Yes, approve real money"}
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
        Approving a user lets them make <strong>real</strong> ACH transfers — but only inside the built-in safety
        limits (first transfer ≤ $1, ≤ $5/day, 1 transfer/day, no duplicate pending). You can revoke instantly at any
        time. Real money also still requires the master switch (<code>ENABLE_REAL_TRANSFERS</code>) to be on.
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
          <CardTitle className="text-base">Approve another user</CardTitle>
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

type RunwayMetrics = {
  totalUsers: number;
  payingSubscribers: number;
  newPayingLast30Days: number;
  priceCents: number;
  mrrCents: number;
  asOf: string;
};

type RunwayAssumptions = {
  targetMonthlyIncome: number;
  monthlyCosts: number;
  feePct: number;
  streakMonths: number;
  steadyPerMonth: number;
  strongPerMonth: number;
  breakoutPerMonth: number;
};

const RUNWAY_DEFAULTS: RunwayAssumptions = {
  targetMonthlyIncome: 8500,
  monthlyCosts: 1500,
  feePct: 5,
  streakMonths: 6,
  steadyPerMonth: 50,
  strongPerMonth: 200,
  breakoutPerMonth: 600,
};

const RUNWAY_STORAGE_KEY = "dt-runway-assumptions";

function loadRunwayAssumptions(): RunwayAssumptions {
  try {
    const raw = localStorage.getItem(RUNWAY_STORAGE_KEY);
    if (!raw) return RUNWAY_DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...RUNWAY_DEFAULTS, ...parsed };
  } catch {
    return RUNWAY_DEFAULTS;
  }
}

function monthYearAfter(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + Math.ceil(months));
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function usd(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function AssumptionInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  testId,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  testId: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-600 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-slate-500">{prefix}</span>}
        <Input
          value={String(value)}
          onChange={(e) => {
            const n = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
            onChange(Number.isFinite(n) ? n : 0);
          }}
          className="w-24 h-8"
          data-testid={testId}
        />
        {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}

function ScenarioRow({
  name,
  perMonth,
  gap,
  reached,
}: {
  name: string;
  perMonth: number;
  gap: number;
  reached: boolean;
}) {
  const months = perMonth > 0 ? gap / perMonth : Infinity;
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-sm" data-testid={`runway-scenario-${name.toLowerCase()}`}>
      <span className="w-24 font-medium">{name}</span>
      <span className="text-slate-500 w-36">+{perMonth} paying subs/mo</span>
      <span className="flex-1 text-right font-medium">
        {reached ? (
          <span className="text-green-700">Target reached</span>
        ) : !Number.isFinite(months) ? (
          <span className="text-slate-400">—</span>
        ) : (
          <>
            {monthYearAfter(months)}
            <span className="text-slate-500 font-normal"> ({Math.ceil(months)} mo)</span>
          </>
        )}
      </span>
    </div>
  );
}

function RunwayTab() {
  const [assumptions, setAssumptions] = useState<RunwayAssumptions>(loadRunwayAssumptions);

  const set = (patch: Partial<RunwayAssumptions>) => {
    setAssumptions((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(RUNWAY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage unavailable — assumptions just won't persist
      }
      return next;
    });
  };

  const query = useQuery<RunwayMetrics>({
    queryKey: ["/api/admin/runway"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/runway");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const m = query.data;
  const price = (m?.priceCents ?? 299) / 100;
  const netPerSub = price * (1 - assumptions.feePct / 100);
  const monthlyNeed = assumptions.targetMonthlyIncome + assumptions.monthlyCosts;
  const subsNeeded = netPerSub > 0 ? Math.ceil(monthlyNeed / netPerSub) : 0;
  const paying = m?.payingSubscribers ?? 0;
  const gap = Math.max(0, subsNeeded - paying);
  const reached = paying >= subsNeeded && subsNeeded > 0;
  const mrr = paying * price;
  const progressPct = subsNeeded > 0 ? Math.min(100, (paying / subsNeeded) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-700 border rounded-md bg-purple-50 border-purple-200 p-3">
        <strong>The quit trigger:</strong> leave Delilah when monthly recurring revenue has covered your income
        target for {assumptions.streakMonths} straight months — or when a funding round pays you a salary. Until
        then, the restaurant is the funding round.
      </div>

      {query.isError && (
        <div className="text-sm text-red-700 border border-red-200 bg-red-50 rounded p-2">
          Failed to load live numbers.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-slate-500">Registered users</div>
            <div className="text-2xl font-semibold" data-testid="runway-total-users">
              {query.isLoading ? "…" : m?.totalUsers ?? "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-slate-500">Paying subscribers</div>
            <div className="text-2xl font-semibold" data-testid="runway-paying-subs">
              {query.isLoading ? "…" : paying}
            </div>
            <div className="text-xs text-slate-500">+{m?.newPayingLast30Days ?? 0} last 30 days</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-slate-500">MRR (gross)</div>
            <div className="text-2xl font-semibold" data-testid="runway-mrr">
              {query.isLoading ? "…" : `$${mrr.toFixed(2)}`}
            </div>
            <div className="text-xs text-slate-500">at ${price.toFixed(2)}/mo</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-slate-500">Subscribers needed</div>
            <div className="text-2xl font-semibold" data-testid="runway-subs-needed">
              {subsNeeded.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500">{gap.toLocaleString()} to go</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Progress to full-time Dime Time</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-dime-purple transition-all"
              style={{ width: `${Math.max(progressPct, paying > 0 ? 1 : 0)}%` }}
              data-testid="runway-progress-bar"
            />
          </div>
          <div className="text-xs text-slate-500">
            {paying.toLocaleString()} of {subsNeeded.toLocaleString()} paying subscribers (
            {progressPct.toFixed(1)}%) · covering {usd(monthlyNeed)}/mo ({usd(assumptions.targetMonthlyIncome)} income
            + {usd(assumptions.monthlyCosts)} company costs) at ~${netPerSub.toFixed(2)} net per subscriber
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">When could that be?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="border rounded-md bg-white divide-y">
            <ScenarioRow name="Steady" perMonth={assumptions.steadyPerMonth} gap={gap} reached={reached} />
            <ScenarioRow name="Strong" perMonth={assumptions.strongPerMonth} gap={gap} reached={reached} />
            <ScenarioRow name="Breakout" perMonth={assumptions.breakoutPerMonth} gap={gap} reached={reached} />
          </div>
          <div className="text-xs text-slate-500">
            Dates assume growth starts now and holds. Once real subscribers exist, the "+ last 30 days" number above
            is your actual pace — compare it against these scenarios. Remember the {assumptions.streakMonths}-month
            streak rule before giving notice.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Assumptions (saved on this device)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <AssumptionInput
              label="Income to replace / mo"
              prefix="$"
              value={assumptions.targetMonthlyIncome}
              onChange={(v) => set({ targetMonthlyIncome: v })}
              testId="runway-input-target"
            />
            <AssumptionInput
              label="Company costs / mo"
              prefix="$"
              value={assumptions.monthlyCosts}
              onChange={(v) => set({ monthlyCosts: v })}
              testId="runway-input-costs"
            />
            <AssumptionInput
              label="Payment fees"
              suffix="%"
              value={assumptions.feePct}
              onChange={(v) => set({ feePct: Math.min(50, v) })}
              testId="runway-input-fees"
            />
            <AssumptionInput
              label="Streak before quitting"
              suffix="mo"
              value={assumptions.streakMonths}
              onChange={(v) => set({ streakMonths: Math.max(1, v) })}
              testId="runway-input-streak"
            />
            <AssumptionInput
              label="Steady growth"
              suffix="/mo"
              value={assumptions.steadyPerMonth}
              onChange={(v) => set({ steadyPerMonth: v })}
              testId="runway-input-steady"
            />
            <AssumptionInput
              label="Strong growth"
              suffix="/mo"
              value={assumptions.strongPerMonth}
              onChange={(v) => set({ strongPerMonth: v })}
              testId="runway-input-strong"
            />
            <AssumptionInput
              label="Breakout growth"
              suffix="/mo"
              value={assumptions.breakoutPerMonth}
              onChange={(v) => set({ breakoutPerMonth: v })}
              testId="runway-input-breakout"
            />
          </div>
          <div className="text-xs text-slate-500 mt-3">
            Defaults: replace ~$8,500/mo gross (≈$100K/yr Delilah income), $1,500/mo company costs (Plaid contract +
            infrastructure), 5% payment fees on the ${price.toFixed(2)} plan.
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-slate-500">
        {m?.asOf ? `Live numbers as of ${fmt(m.asOf)}. ` : ""}
        Milestones that move these dates: Stripe Financial Connections registration → Plaid production approval →
        subscription launch → LinkedIn announcement.
      </div>
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
