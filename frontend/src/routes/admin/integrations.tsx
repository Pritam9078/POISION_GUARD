import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { ADMIN_INTEGRATIONS } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/integrations")({
  component: AdminIntegrationsPage,
});

interface IntegrationRow {
  id: string;
  name: string;
  type: string;
  status: string;
  keyConfigured: boolean;
  lastCheck: string;
  note: string;
}

const cols: Column<IntegrationRow>[] = [
  { key: "name", header: "Integration", cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
  { key: "type", header: "Category", cell: (r) => <span className="text-xs uppercase">{r.type}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "keyConfigured", header: "Key Configured", cell: (r) => <span className="text-xs">{r.keyConfigured ? "✓ Configured" : "Missing"}</span> },
  { key: "note", header: "Status Detail", cell: (r) => <span className="text-xs text-muted-foreground">{r.note || "—"}</span> },
];

function AdminIntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integration Management"
        description="Cake Wallet integration, Dodo Payments, RPC nodes, transfer indexers, and AI models."
        actions={
          <Button className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Configure Integration
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={ADMIN_INTEGRATIONS} rowKey={(r) => r.name} />
      </div>

      <DemoDataNote />
    </div>
  );
}

