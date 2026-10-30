import { createFileRoute } from "@tanstack/react-router";
import { FileSearch } from "lucide-react";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, SeverityBadge, StatusBadge, NetworkBadge, DemoDataNote } from "@/components/pg/kit";
import { SCANS, type Scan } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/scans")({
  component: AdminScansPage,
});

const cols: Column<Scan>[] = [
  { key: "id", header: "Scan ID", cell: (r) => <span className="font-mono text-xs font-semibold">{r.id}</span> },
  { key: "subject", header: "Subject Address / Tx", cell: (r) => <span className="font-mono text-xs">{r.subject}</span> },
  { key: "network", header: "Network", cell: (r) => <NetworkBadge network={r.network} /> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  {
    key: "risk",
    header: "Risk",
    cell: (r) => (
      <SeverityBadge
        severity={
          r.riskLabel === "elevated" ? "medium" : r.riskLabel === "inconclusive" ? "info" : r.riskLabel
        }
      />
    ),
  },
  { key: "completedAt", header: "Completed", cell: (r) => <span className="text-xs text-muted-foreground">{r.completedAt}</span> },
];

function AdminScansPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Scans"
        description="Global ledger of forensic scans executed across all public and authenticated users."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={SCANS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

