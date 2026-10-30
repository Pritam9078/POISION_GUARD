import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import {
  PageHeader,
  SectionHeading,
  StatCard,
  SeverityBadge,
  StatusBadge,
  DemoDataNote,
} from "@/components/pg/kit";
import {
  ADMIN_OVERVIEW,
  ADMIN_HEALTH,
  ADMIN_WORKSPACES,
  ADMIN_INCIDENTS,
  ADMIN_REPORTS,
} from "@/lib/fixtures";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

interface HealthRow {
  component: string;
  status: string;
  latency: string;
  errorRate: string;
  note: string;
}

const healthCols: Column<HealthRow>[] = [
  { key: "component", header: "Component", cell: (r) => <span className="font-medium">{r.component}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "latency", header: "Latency", cell: (r) => <span className="text-muted-foreground">{r.latency}</span> },
  { key: "errorRate", header: "Error rate", cell: (r) => <span className="text-muted-foreground">{r.errorRate}</span> },
  { key: "note", header: "Note", cell: (r) => <span className="text-xs text-muted-foreground">{r.note || "—"}</span> },
];

interface WorkspaceRow {
  id: string;
  name: string;
  plan: string;
  members: number;
  wallets: number;
  agents: number;
  status: string;
  createdAt: string;
}

const workspaceCols: Column<WorkspaceRow>[] = [
  { key: "id", header: "ID", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.id}</span> },
  { key: "name", header: "Workspace", cell: (r) => <span className="font-medium">{r.name}</span> },
  { key: "plan", header: "Plan", cell: (r) => <span className="text-xs">{r.plan}</span> },
  { key: "members", header: "Members", cell: (r) => <span>{r.members}</span> },
  { key: "wallets", header: "Wallets", cell: (r) => <span>{r.wallets}</span> },
  { key: "agents", header: "Agents", cell: (r) => <span>{r.agents}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
];

interface IncidentRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  assignee: string;
  openedAt: string;
}

const incidentCols: Column<IncidentRow>[] = [
  { key: "id", header: "Incident", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { key: "title", header: "Title", cell: (r) => <span className="font-medium">{r.title}</span> },
  { key: "severity", header: "Severity", cell: (r) => <SeverityBadge severity={r.severity as "critical" | "high" | "medium" | "low" | "info"} /> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "assignee", header: "Assignee", cell: (r) => <span className="text-sm text-muted-foreground">{r.assignee}</span> },
  { key: "openedAt", header: "Opened", cell: (r) => <span className="text-xs text-muted-foreground">{r.openedAt}</span> },
];

function AdminOverview() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Overview"
        description="Platform-wide operations, active customer workspaces, detection pipeline and incident response."
        actions={
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/admin/settings">Platform settings</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Scans today"
          value={ADMIN_OVERVIEW.scansToday.toLocaleString()}
          sub={`${ADMIN_OVERVIEW.scansFailedToday} failed (${((ADMIN_OVERVIEW.scansFailedToday / ADMIN_OVERVIEW.scansToday) * 100).toFixed(1)}%)`}
          tone={ADMIN_OVERVIEW.scansFailedToday > 50 ? "bad" : "ok"}
        />
        <StatCard
          label="Findings raised"
          value={ADMIN_OVERVIEW.findingsRaised.toLocaleString()}
          sub="Threats & poison attempts"
          tone="warn"
        />
        <StatCard
          label="Active workspaces"
          value={ADMIN_OVERVIEW.activeWorkspaces}
          sub="Customer organizations"
          tone="ok"
        />
        <StatCard
          label="Open incidents"
          value={ADMIN_OVERVIEW.openIncidents}
          sub={`${ADMIN_OVERVIEW.providerAlerts} provider alerts`}
          tone={ADMIN_OVERVIEW.openIncidents > 0 ? "warn" : "ok"}
        />
      </div>

      <div className="space-y-3">
        <SectionHeading title="System health & pipeline components" />
        <DataTable columns={healthCols} rows={ADMIN_HEALTH} rowKey={(r) => r.component} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <SectionHeading title="Active customer workspaces" />
          <DataTable columns={workspaceCols} rows={ADMIN_WORKSPACES} rowKey={(r) => r.id} />
        </div>

        <div className="space-y-3">
          <SectionHeading title="Platform security & ops incidents" />
          <DataTable columns={incidentCols} rows={ADMIN_INCIDENTS} rowKey={(r) => r.id} />
        </div>
      </div>

      <DemoDataNote />
    </div>
  );
}
