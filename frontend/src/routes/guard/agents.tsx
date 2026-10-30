import { createFileRoute } from "@tanstack/react-router";
import { Bot, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, NetworkBadge, DemoDataNote } from "@/components/pg/kit";
import { AGENTS, type Agent } from "@/lib/fixtures";

export const Route = createFileRoute("/guard/agents")({
  component: AgentsPage,
});

const cols: Column<Agent>[] = [
  { key: "name", header: "Agent Name", cell: (r) => <span className="font-medium">{r.name}</span> },
  { key: "description", header: "Description & Scope", cell: (r) => <span className="text-xs text-muted-foreground">{r.description}</span> },
  { key: "networks", header: "Networks", cell: (r) => <span className="text-xs">{r.networks.join(", ")}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  {
    key: "limits",
    header: "Spend Cap",
    cell: (r) => <span className="text-xs font-mono">${r.limits.perTxUsd.toLocaleString()} / tx</span>,
  },
  {
    key: "blocked",
    header: "Blocked Requests",
    cell: (r) => <span className="text-xs font-semibold text-destructive">{r.blockedRequests.length}</span>,
  },
];

function AgentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Autonomous AI Agents"
        description="Register and govern AI agents with cryptographically enforced spend policies and threshold checks."
        actions={
          <Button className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Register New Agent
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={AGENTS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

