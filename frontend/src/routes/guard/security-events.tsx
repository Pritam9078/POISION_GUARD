import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Gauge, ShieldCheck } from "lucide-react";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, SeverityBadge, StatusBadge } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/guard/security-events")({
  component: SecurityEventsPage,
});

interface SecurityEventItem {
  id: string;
  type?: string;
  category?: string;
  title?: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  detail?: string;
  status: string;
  at?: string;
  openedAt?: string;
}

const cols: Column<SecurityEventItem>[] = [
  { key: "id", header: "Event ID", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { key: "type", header: "Event Type", cell: (r) => <span className="font-medium text-foreground">{r.title || r.type || r.category || "Security Alert"}</span> },
  { key: "severity", header: "Severity", cell: (r) => <SeverityBadge severity={r.severity || "info"} /> },
  { key: "detail", header: "Description", cell: (r) => <span className="text-xs text-muted-foreground">{r.detail || "Workspace event"}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "at", header: "Timestamp", cell: (r) => <span className="text-xs text-muted-foreground">{r.at || r.openedAt ? new Date(r.at || r.openedAt!).toLocaleString() : "Just now"}</span> },
];

function SecurityEventsPage() {
  const { session } = useDemoAuth();
  const [events, setEvents] = useState<SecurityEventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;

  useEffect(() => {
    if (!wsId) {
      setLoading(false);
      return;
    }
    let unmounted = false;
    api<{ items: SecurityEventItem[] }>(`/workspaces/${encodeURIComponent(wsId)}/security-events`)
      .then((res) => {
        if (!unmounted) setEvents(res.items || []);
      })
      .catch(() => {
        if (!unmounted) setEvents([]);
      })
      .finally(() => {
        if (!unmounted) setLoading(false);
      });
    return () => {
      unmounted = true;
    };
  }, [wsId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Events & Incidents"
        description="Mempool alerts, dust transaction attempts, and policy violations detected across watched assets."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Checking security incidents…</div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center">
            <ShieldCheck className="mx-auto size-8 text-emerald-500/80" />
            <h4 className="mt-3 text-sm font-medium text-foreground">Zero security incidents detected</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Watched wallets and autonomous agents are clean. No lookalike vanity spoofing or unauthorized allowances flagged.
            </p>
          </div>
        ) : (
          <DataTable columns={cols} rows={events} rowKey={(r) => r.id} />
        )}
      </div>
    </div>
  );
}
