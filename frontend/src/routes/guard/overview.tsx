import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Shield, Wallet, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/pg/data-table";
import type { Column } from "@/components/pg/data-table";
import { PageHeader, SectionHeading, StatCard, SeverityBadge, StatusBadge, NetworkBadge } from "@/components/pg/kit";
import { fmtDateTime } from "@/lib/validation";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/guard/overview")({
  component: Overview,
});

interface IntentRow {
  id: string;
  asset: string;
  amount: string;
  status: string;
  requester: string;
}
const intentCols: Column<IntentRow>[] = [
  { key: "id", header: "Intent", cell: (r) => <span className="font-medium">{r.id}</span> },
  { key: "requester", header: "Requested by", cell: (r) => r.requester },
  { key: "amount", header: "Amount", cell: (r) => `${r.amount} ${r.asset}` },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
];

interface EventRow {
  id: string;
  severity: string;
  title?: string;
  type?: string;
  category?: string;
  detail?: string;
  status: string;
  openedAt?: string;
  at?: string;
}
const eventCols: Column<EventRow>[] = [
  {
    key: "severity",
    header: "Severity",
    cell: (r) => <SeverityBadge severity={r.severity as "critical" | "high" | "medium" | "low" | "info"} />,
  },
  {
    key: "type",
    header: "Event",
    cell: (r) => (
      <div>
        <div className="font-medium">{r.title || r.type || "Security Event"}</div>
        <div className="text-xs text-muted-foreground">{r.detail || r.category || "Workspace alert"}</div>
      </div>
    ),
  },
  {
    key: "at",
    header: "When",
    cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(r.openedAt || r.at || new Date().toISOString())}</span>,
  },
];

interface OverviewStats {
  wallets?: { active: number; paused: number };
  agents?: { active: number; frozen: number; total: number };
  scans?: { total: number; failed: number; high_risk: number };
  intents?: {
    pending_approval: number;
    denied: number;
    authorized_awaiting_signature: number;
    submitted_awaiting_confirmation: number;
    confirmed_on_chain: number;
    execution_problems: number;
  };
  recentSecurityEvents?: EventRow[];
  recentIntents?: any[];
}

function Overview() {
  const { session } = useDemoAuth();
  const [data, setData] = useState<OverviewStats | null>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unmounted = false;
    const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;
    if (!wsId) {
      setLoading(false);
      return;
    }

    Promise.allSettled([
      api<OverviewStats>(`/workspaces/${encodeURIComponent(wsId)}/overview`),
      api<{ items: any[] }>(`/workspaces/${encodeURIComponent(wsId)}/wallets`),
      api<{ items: any[] }>(`/workspaces/${encodeURIComponent(wsId)}/audit`),
    ]).then(([ovRes, walRes, audRes]) => {
      if (unmounted) return;
      if (ovRes.status === "fulfilled" && ovRes.value) {
        setData(ovRes.value);
      }
      if (walRes.status === "fulfilled" && walRes.value?.items) {
        setWallets(walRes.value.items);
      }
      if (audRes.status === "fulfilled" && audRes.value?.items) {
        setAuditEvents(audRes.value.items);
      }
      setLoading(false);
    });

    return () => {
      unmounted = true;
    };
  }, [session?.workspaceId, session?.memberships]);

  const activeWallets = data?.wallets?.active ?? wallets.filter((w) => w.status === "active").length;
  const totalWallets = wallets.length || (data?.wallets ? (data.wallets.active + (data.wallets.paused || 0)) : 0);
  const activeAgents = data?.agents?.active ?? 0;
  const totalAgents = data?.agents?.total ?? 0;
  const pendingApprovals = data?.intents?.pending_approval ?? 0;
  const blockedRequests = data?.intents?.denied ?? 0;
  const recentEvents = data?.recentSecurityEvents ?? [];

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Live state of your workspace security posture."
        actions={
          <Button asChild className="rounded-full">
            <Link to={"/guard/scans" as any}>Run a scan</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Watched wallets"
          value={totalWallets}
          sub={`${activeWallets} active monitoring`}
        />
        <StatCard
          label="Active agents"
          value={activeAgents}
          sub={`${totalAgents} registered`}
        />
        <StatCard
          label="Pending approvals"
          value={pendingApprovals}
          tone={pendingApprovals ? "warn" : "ok"}
          sub="Spend intents awaiting approvers"
        />
        <StatCard
          label="Blocked requests"
          value={blockedRequests}
          tone={blockedRequests ? "bad" : "ok"}
          sub="Stopped by policy (30 days)"
        />
        <StatCard
          label="Policy violations"
          value={blockedRequests}
          tone={blockedRequests ? "warn" : "ok"}
          sub="All auto-enforced"
        />
        <StatCard
          label="Open security events"
          value={recentEvents.filter((e) => e.status !== "resolved").length}
          tone={recentEvents.length ? "warn" : "ok"}
          sub="Investigation required"
        />
      </div>

      {pendingApprovals > 0 && (
        <div className="mt-6">
          <SectionHeading title="Pending approvals" description="These spend intents need a human decision before execution.">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to={"/guard/approvals" as any}>Open approval center</Link>
            </Button>
          </SectionHeading>
          <DataTable
            columns={intentCols}
            rows={(data?.recentIntents || []).filter((i: any) => i.status === "pending_approval")}
            rowKey={(r) => r.id}
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div>
          <SectionHeading title="Recent security events">
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to={"/guard/security-events" as any}>View all</Link>
            </Button>
          </SectionHeading>
          {recentEvents.length > 0 ? (
            <DataTable columns={eventCols} rows={recentEvents.slice(0, 4)} rowKey={(r) => r.id} pageSize={4} />
          ) : (
            <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
              <ShieldCheck className="mx-auto mb-2 size-8 text-emerald-500" />
              No security incidents detected. Monitored transactions and recipient addresses are normal.
            </div>
          )}
        </div>
        <div>
          <SectionHeading title="Recent audit events">
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to={"/guard/audit" as any}>View all</Link>
            </Button>
          </SectionHeading>
          {auditEvents.length > 0 ? (
            <div className="space-y-2">
              {auditEvents.slice(0, 4).map((e: any) => (
                <div key={e.id} className="rounded-2xl border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="mono text-xs font-medium">{e.action}</span>
                    <StatusBadge status={e.outcome || "completed"} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {e.actor?.label || e.actor?.id || "System"} · {fmtDateTime(e.createdAt || e.at || new Date().toISOString())}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
              <Shield className="mx-auto mb-2 size-8 opacity-40" />
              No audit records yet. All sensitive actions will be cryptographically logged here.
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <SectionHeading title="Watched wallets">
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link to={"/guard/wallets" as any}>Manage wallets</Link>
          </Button>
        </SectionHeading>
        {wallets.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {wallets.map((w: any) => (
              <div key={w.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{w.label}</span>
                  <StatusBadge status={w.status} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <NetworkBadge network={w.network || "ethereum"} />
                  <span className="mono truncate text-xs text-muted-foreground">
                    {w.address ? `${w.address.slice(0, 10)}…${w.address.slice(-6)}` : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 p-8 text-center">
            <Wallet className="mb-3 size-10 text-muted-foreground opacity-50" />
            <h3 className="text-sm font-medium">No watched wallets yet</h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Add your team or treasury wallets to start continuous mempool lookalike and poisoning attack detection.
            </p>
            <Button asChild size="sm" className="mt-4 rounded-full">
              <Link to={"/guard/wallets" as any}>
                <Plus className="mr-1 size-3.5" /> Add Wallet
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
