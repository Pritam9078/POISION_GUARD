import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, SeverityBadge, DemoDataNote } from "@/components/pg/kit";
import { SCANS, type Finding } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/findings")({
  component: AdminFindingsPage,
});

const cols: Column<Finding>[] = [
  { key: "id", header: "Finding ID", cell: (r) => <span className="font-mono text-xs font-semibold">{r.id}</span> },
  { key: "category", header: "Category", cell: (r) => <span className="text-xs">{r.category}</span> },
  { key: "title", header: "Finding Title", cell: (r) => <span className="font-medium text-foreground">{r.title}</span> },
  { key: "severity", header: "Severity", cell: (r) => <SeverityBadge severity={r.severity} /> },
  { key: "confidence", header: "Confidence", cell: (r) => <span className="text-xs">{r.confidence}%</span> },
  { key: "detectedAt", header: "Detected", cell: (r) => <span className="text-xs text-muted-foreground">{r.detectedAt}</span> },
];

function AdminFindingsPage() {
  const allFindings = SCANS.flatMap((s) => s.findings);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Findings Management"
        description="All detection indicators raised across active scans, dust clusters, and risky token approvals."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={allFindings} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

