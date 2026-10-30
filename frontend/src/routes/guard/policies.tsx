import { createFileRoute } from "@tanstack/react-router";
import { ScrollText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, NetworkBadge, DemoDataNote } from "@/components/pg/kit";
import { POLICIES, type Policy } from "@/lib/fixtures";

export const Route = createFileRoute("/guard/policies")({
  component: PoliciesPage,
});

const cols: Column<Policy>[] = [
  { key: "name", header: "Policy Rule", cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
  { key: "description", header: "Description & Trigger", cell: (r) => <span className="text-xs text-muted-foreground">{r.description}</span> },
  { key: "scope", header: "Scope", cell: (r) => <span className="text-xs">{r.scope}</span> },
  { key: "version", header: "Version", cell: (r) => <span className="font-mono text-xs">v{r.version}</span> },
  { key: "status", header: "Enforcement", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "updatedAt", header: "Last Modified", cell: (r) => <span className="text-xs text-muted-foreground">{r.updatedAt}</span> },
];

function PoliciesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & Spending Policies"
        description="Deterministic guardrails enforced on all manual and autonomous transactions."
        actions={
          <Button className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Create New Policy
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={POLICIES} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

