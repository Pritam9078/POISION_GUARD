import { createFileRoute } from "@tanstack/react-router";
import { Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { ADMIN_HEALTH } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/system-health")({
  component: SystemHealthPage,
});

interface HealthRow {
  component: string;
  status: string;
  latency: string;
  errorRate: string;
  note: string;
}

const cols: Column<HealthRow>[] = [
  { key: "component", header: "Component", cell: (r) => <span className="font-medium text-foreground">{r.component}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "latency", header: "Latency", cell: (r) => <span className="text-muted-foreground">{r.latency}</span> },
  { key: "errorRate", header: "Error Rate", cell: (r) => <span className="text-muted-foreground">{r.errorRate}</span> },
  { key: "note", header: "Operational Note", cell: (r) => <span className="text-xs text-muted-foreground">{r.note || "Operational"}</span> },
];

function SystemHealthPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health & Infrastructure"
        description="Live API availability, replication lag, queue backlogs, RPC pools, and transfer indexers."
        actions={
          <Button variant="outline" className="rounded-full">
            <RefreshCw className="mr-1.5 size-4" /> Refresh Status
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={ADMIN_HEALTH} rowKey={(r) => r.component} />
      </div>

      <DemoDataNote />
    </div>
  );
}

