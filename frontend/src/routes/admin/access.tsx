import { createFileRoute } from "@tanstack/react-router";
import { Users, KeyRound } from "lucide-react";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, DemoDataNote } from "@/components/pg/kit";
import { ROLE_MATRIX } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/access")({
  component: AdminAccessPage,
});

interface RoleRow {
  capability: string;
  Owner: boolean;
  Admin: boolean;
  Approver: boolean;
  Operator: boolean;
  Auditor: boolean;
}

const cols: Column<RoleRow>[] = [
  { key: "capability", header: "Permission / Capability", cell: (r) => <span className="font-medium">{r.capability}</span> },
  { key: "Owner", header: "Owner", cell: (r) => <span>{r.Owner ? "✓" : "—"}</span> },
  { key: "Admin", header: "Admin", cell: (r) => <span>{r.Admin ? "✓" : "—"}</span> },
  { key: "Approver", header: "Approver", cell: (r) => <span>{r.Approver ? "✓" : "—"}</span> },
  { key: "Operator", header: "Operator", cell: (r) => <span>{r.Operator ? "✓" : "—"}</span> },
  { key: "Auditor", header: "Auditor", cell: (r) => <span>{r.Auditor ? "✓" : "—"}</span> },
];

function AdminAccessPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Access & Permissions Matrix"
        description="Global role-based access control (RBAC) definitions and permission scopes."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={ROLE_MATRIX} rowKey={(r) => r.capability} />
      </div>

      <DemoDataNote />
    </div>
  );
}

