import { createFileRoute } from "@tanstack/react-router";
import { Flag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { ADMIN_FEATURE_FLAGS } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/feature-flags")({
  component: AdminFeatureFlagsPage,
});

interface FlagRow {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  rollout: string;
  note: string;
}

const cols: Column<FlagRow>[] = [
  { key: "name", header: "Feature Flag", cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
  { key: "key", header: "Flag Key", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.key}</span> },
  { key: "enabled", header: "State", cell: (r) => <StatusBadge status={r.enabled ? "active" : "disabled"} /> },
  { key: "rollout", header: "Rollout", cell: (r) => <span className="font-mono text-xs">{r.rollout}</span> },
  { key: "note", header: "Operational Note", cell: (r) => <span className="text-xs text-muted-foreground">{r.note || "—"}</span> },
];

function AdminFeatureFlagsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Flags & Kill Switches"
        description="Gradual feature rollouts, experimental detection heuristics, and operational kill-switches."
        actions={
          <Button className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Add Feature Flag
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={ADMIN_FEATURE_FLAGS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

