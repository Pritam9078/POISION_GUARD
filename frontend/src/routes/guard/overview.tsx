import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/pg/data-table";
import type { Column } from "@/components/pg/data-table";
import { PageHeader, SectionHeading, StatCard, SeverityBadge, StatusBadge, NetworkBadge, DemoDataNote } from "@/components/pg/kit";
import { AGENTS, AUDIT_EVENTS, SECURITY_EVENTS, SPEND_INTENTS, WALLETS } from "@/lib/fixtures";
import { fmtDateTime } from "@/lib/validation";

export const Route = createFileRoute("/guard/overview")({
  component: Overview,
});

interface IntentRow { id: string; asset: string; amount: string; status: string; requester: string }
const intentCols: Column<IntentRow>[] = [
  { key: "id", header: "Intent", cell: (r) => <span className="font-medium">{r.id}</span> },
  { key: "requester", header: "Requested by", cell: (r) => r.requester },
  { key: "amount", header: "Amount", cell: (r) => `${r.amount} ${r.asset}` },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
];

interface EventRow { id: string; severity: string; type: string; detail: string; status: string; at: string }
const eventCols: Column<EventRow>[] = [
  { key: "severity", header: "Severity", cell: (r) => <SeverityBadge severity={r.severity as "critical" | "high" | "medium" | "low" | "info"} /> },
  { key: "type", header: "Event", cell: (r) => <div><div className="font-medium">{r.type}</div><div className="text-xs text-muted-foreground">{r.detail}</div></div> },
  { key: "at", header: "When", cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(r.at)}</span> },
];

function Overview() {
  const pending = SPEND_INTENTS.filter((i) => i.status === "pending_approval");
  const blocked = AGENTS.flatMap((a) => a.blockedRequests);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Live state of your workspace security posture (demo data)."
        actions={
          <Button asChild className="rounded-full">
            <Link to={"/guard/scans" as any}>Run a scan</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Watched wallets" value={WALLETS.length} sub={`${WALLETS.filter((w) => w.status === "active").length} active monitoring`} />
        <StatCard label="Active agents" value={AGENTS.filter((a) => a.status === "active").length} sub={`${AGENTS.length} registered`} />
        <StatCard label="Pending approvals" value={pending.length} tone={pending.length ? "warn" : "ok"} sub="Spend intents awaiting approvers" />
        <StatCard label="Blocked requests" value={blocked.length} tone="bad" sub="Stopped by policy (30 days)" />
        <StatCard label="Policy violations" value={blocked.length} tone="warn" sub="All auto-enforced" />
        <StatCard label="Open security events" value={SECURITY_EVENTS.filter((e) => e.status !== "resolved").length} tone="warn" sub="Investigation required" />
      </div>

      {pending.length > 0 && (
        <div className="mt-6">
          <SectionHeading title="Pending approvals" description="These spend intents need a human decision before execution.">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to={"/guard/approvals" as any}>Open approval center</Link>
            </Button>
          </SectionHeading>
          <DataTable
            columns={intentCols}
            rows={pending.map((i) => ({ id: i.id, asset: i.asset, amount: i.amount, status: i.status, requester: i.requester }))}
            rowKey={(r) => r.id}
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div>
          <SectionHeading title="Recent security events">
            <Button asChild variant="ghost" size="sm" className="rounded-full"><Link to={"/guard/security-events" as any}>View all</Link></Button>
          </SectionHeading>
          <DataTable columns={eventCols} rows={SECURITY_EVENTS.slice(0, 4) as EventRow[]} rowKey={(r) => r.id} pageSize={4} />
        </div>
        <div>
          <SectionHeading title="Recent audit events">
            <Button asChild variant="ghost" size="sm" className="rounded-full"><Link to={"/guard/audit" as any}>View all</Link></Button>
          </SectionHeading>
          <div className="space-y-2">
            {AUDIT_EVENTS.slice(0, 4).map((e) => (
              <div key={e.id} className="rounded-2xl border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="mono text-xs font-medium">{e.action}</span>
                  <StatusBadge status={e.outcome} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {e.actor} → {e.target} · {fmtDateTime(e.at)} · chain {e.chainHash}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <SectionHeading title="Watched wallets">
          <Button asChild variant="ghost" size="sm" className="rounded-full"><Link to={"/guard/wallets" as any}>Manage wallets</Link></Button>
        </SectionHeading>
        <div className="grid gap-3 sm:grid-cols-3">
          {WALLETS.map((w) => (
            <div key={w.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{w.label}</span>
                <StatusBadge status={w.status} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <NetworkBadge network={w.network} />
                <span className="mono truncate text-xs text-muted-foreground">{w.address.slice(0, 10)}…{w.address.slice(-6)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <DemoDataNote className="mt-6" />
    </div>
  );
}
