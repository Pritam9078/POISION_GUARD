import { createFileRoute } from "@tanstack/react-router";
import { Gauge, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, SeverityBadge, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { SECURITY_EVENTS, type SecurityEvent } from "@/lib/fixtures";

export const Route = createFileRoute("/guard/security-events")({
  component: SecurityEventsPage,
});

const cols: Column<SecurityEvent>[] = [
  { key: "id", header: "Event ID", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { key: "type", header: "Event Type", cell: (r) => <span className="font-medium text-foreground">{r.type}</span> },
  { key: "severity", header: "Severity", cell: (r) => <SeverityBadge severity={r.severity} /> },
  { key: "detail", header: "Description", cell: (r) => <span className="text-xs text-muted-foreground">{r.detail}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "at", header: "Timestamp", cell: (r) => <span className="text-xs text-muted-foreground">{r.at}</span> },
];

function SecurityEventsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Events & Incidents"
        description="Mempool alerts, dust transaction attempts, and policy violations detected across watched assets."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={SECURITY_EVENTS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

