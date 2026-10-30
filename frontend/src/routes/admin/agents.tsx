import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, NetworkBadge, DemoDataNote } from "@/components/pg/kit";
import { AGENTS, type Agent } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/agents")({
  component: AdminAgentsPage,
});

const cols: Column<Agent>[] = [
  { key: "name", header: "Agent", cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
  { key: "description", header: "Description", cell: (r) => <span className="text-xs text-muted-foreground">{r.description}</span> },
  { key: "networks", header: "Networks", cell: (r) => <span className="text-xs">{r.networks.join(", ")}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "blocked", header: "Violations Stopped", cell: (r) => <span className="text-xs font-semibold text-destructive">{r.blockedRequests.length}</span> },
];

function AdminAgentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Governance (Platform-wide)"
        description="Inspect registered AI agents, automated spend requests, and policy enforcement blocks across all workspaces."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={AGENTS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

