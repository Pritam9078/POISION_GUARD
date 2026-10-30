import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, SeverityBadge, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { ADMIN_INCIDENTS } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/security-incidents")({
  component: AdminSecurityIncidentsPage,
});

interface IncidentRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  assignee: string;
  openedAt: string;
}

const cols: Column<IncidentRow>[] = [
  { key: "id", header: "Incident ID", cell: (r) => <span className="font-mono text-xs font-semibold">{r.id}</span> },
  { key: "title", header: "Incident Title", cell: (r) => <span className="font-medium text-foreground">{r.title}</span> },
  { key: "severity", header: "Severity", cell: (r) => <SeverityBadge severity={r.severity as "critical" | "high" | "medium" | "low" | "info"} /> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "assignee", header: "Assigned Staff", cell: (r) => <span className="text-xs text-muted-foreground">{r.assignee}</span> },
  { key: "openedAt", header: "Opened Date", cell: (r) => <span className="text-xs text-muted-foreground">{r.openedAt}</span> },
];

function AdminSecurityIncidentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Incidents & Investigations"
        description="Active threat investigations, credential rotations, and provider degradation tickets."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={ADMIN_INCIDENTS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

