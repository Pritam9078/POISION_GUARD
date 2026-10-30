import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { ADMIN_WORKSPACES } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/workspaces")({
  component: AdminWorkspacesPage,
});

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

const cols: Column<WorkspaceRow>[] = [
  { key: "id", header: "Workspace ID", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { key: "name", header: "Workspace Name", cell: (r) => <span className="font-medium">{r.name}</span> },
  { key: "plan", header: "Subscription Tier", cell: (r) => <span className="text-xs">{r.plan}</span> },
  { key: "members", header: "Members", cell: (r) => <span>{r.members}</span> },
  { key: "wallets", header: "Watched Wallets", cell: (r) => <span>{r.wallets}</span> },
  { key: "agents", header: "Agents", cell: (r) => <span>{r.agents}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "createdAt", header: "Created", cell: (r) => <span className="text-xs text-muted-foreground">{r.createdAt}</span> },
];

function AdminWorkspacesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Management"
        description="All registered tenant workspaces, subscription quotas, and member allocations."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={ADMIN_WORKSPACES} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

