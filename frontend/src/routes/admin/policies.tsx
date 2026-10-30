import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { POLICIES, type Policy } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/policies")({
  component: AdminPoliciesPage,
});

const cols: Column<Policy>[] = [
  { key: "name", header: "Policy Rule", cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
  { key: "description", header: "Rule Definition", cell: (r) => <span className="text-xs text-muted-foreground">{r.description}</span> },
  { key: "scope", header: "Target Scope", cell: (r) => <span className="text-xs">{r.scope}</span> },
  { key: "version", header: "Version", cell: (r) => <span className="font-mono text-xs">v{r.version}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
];

function AdminPoliciesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Policy Management"
        description="Global policy templates, tenant spend constraints, and enforcement heuristics."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={POLICIES} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

