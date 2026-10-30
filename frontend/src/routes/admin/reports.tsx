import { createFileRoute } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { ADMIN_REPORTS } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReportsPage,
});

interface ReportRow {
  id: string;
  scanId: string;
  workspace: string;
  category: string;
  subject: string;
  status: string;
  submittedAt: string;
  note: string;
}

const cols: Column<ReportRow>[] = [
  { key: "id", header: "Report ID", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { key: "category", header: "Category", cell: (r) => <span className="text-xs font-semibold">{r.category}</span> },
  { key: "subject", header: "Target Address / Tx", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.subject}</span> },
  { key: "workspace", header: "Reporting Tenant", cell: (r) => <span className="text-xs">{r.workspace}</span> },
  { key: "status", header: "Review Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "note", header: "User Note", cell: (r) => <span className="text-xs text-muted-foreground">{r.note}</span> },
];

function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="User Reports & False Positives"
        description="Community-submitted disputes, false-positive reports, and missed address-poisoning threats."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={ADMIN_REPORTS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

