import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ScrollText, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/guard/policies")({
  component: PoliciesPage,
});

interface PolicyItem {
  id: string;
  name: string;
  description: string;
  scope?: string;
  version?: number | null;
  status: string;
  updatedAt?: string;
  createdAt?: string;
}

const cols: Column<PolicyItem>[] = [
  { key: "name", header: "Policy Rule", cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
  { key: "description", header: "Description & Trigger", cell: (r) => <span className="text-xs text-muted-foreground">{r.description}</span> },
  { key: "scope", header: "Scope", cell: (r) => <span className="text-xs">{r.scope || "Workspace"}</span> },
  { key: "version", header: "Version", cell: (r) => <span className="font-mono text-xs">v{r.version || 1}</span> },
  { key: "status", header: "Enforcement", cell: (r) => <StatusBadge status={r.status} /> },
  {
    key: "updatedAt",
    header: "Last Modified",
    cell: (r) => <span className="text-xs text-muted-foreground">{r.updatedAt || r.createdAt ? new Date(r.updatedAt || r.createdAt!).toLocaleDateString() : "Active"}</span>,
  },
];

function PoliciesPage() {
  const { session } = useDemoAuth();
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [loading, setLoading] = useState(true);

  const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;

  useEffect(() => {
    if (!wsId) {
      setLoading(false);
      return;
    }
    let unmounted = false;
    api<{ items: PolicyItem[] }>(`/workspaces/${encodeURIComponent(wsId)}/policies`)
      .then((res) => {
        if (!unmounted) setPolicies(res.items || []);
      })
      .catch(() => {
        if (!unmounted) setPolicies([]);
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
        title="Security & Spending Policies"
        description="Deterministic guardrails enforced on all manual and autonomous transactions."
        actions={
          <Button className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Create New Policy
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading workspace policies…</div>
        ) : policies.length === 0 ? (
          <div className="py-12 text-center">
            <ScrollText className="mx-auto size-8 text-muted-foreground/60" />
            <h4 className="mt-3 text-sm font-medium text-foreground">No custom policies configured</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure deterministic threshold, allowance, or allowlist policies to guard transactions against address poisoning and unauthorized execution.
            </p>
          </div>
        ) : (
          <DataTable columns={cols} rows={policies} rowKey={(r) => r.id} />
        )}
      </div>
    </div>
  );
}
