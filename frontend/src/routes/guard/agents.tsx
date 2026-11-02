import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/guard/agents")({
  component: AgentsPage,
});

interface AgentItem {
  id: string;
  name: string;
  description: string;
  environment?: string;
  networks?: string[];
  status: string;
  limits?: {
    perTx?: any[];
    period?: any[];
    unit?: string;
  };
  blockedRequests?: any[];
}

const cols: Column<AgentItem>[] = [
  { key: "name", header: "Agent Name", cell: (r) => <span className="font-medium">{r.name}</span> },
  { key: "description", header: "Description & Scope", cell: (r) => <span className="text-xs text-muted-foreground">{r.description}</span> },
  { key: "networks", header: "Networks", cell: (r) => <span className="text-xs capitalize">{r.networks?.join(", ") || "Ethereum"}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  {
    key: "environment",
    header: "Environment",
    cell: (r) => <span className="text-xs capitalize">{r.environment || "production"}</span>,
  },
];

function AgentsPage() {
  const { session } = useDemoAuth();
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;

  useEffect(() => {
    if (!wsId) {
      setLoading(false);
      return;
    }
    let unmounted = false;
    api<{ items: AgentItem[] }>(`/workspaces/${encodeURIComponent(wsId)}/agents`)
      .then((res) => {
        if (!unmounted) setAgents(res.items || []);
      })
      .catch(() => {
        if (!unmounted) setAgents([]);
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
        title="Autonomous AI Agents"
        description="Register and govern AI agents with cryptographically enforced spend policies and threshold checks."
        actions={
          <Button className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Register New Agent
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading workspace agents…</div>
        ) : agents.length === 0 ? (
          <div className="py-12 text-center">
            <Bot className="mx-auto size-8 text-muted-foreground/60" />
            <h4 className="mt-3 text-sm font-medium text-foreground">No registered agents</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect autonomous agents or automated signers to enforce granular spend policies and require dual authorization.
            </p>
          </div>
        ) : (
          <DataTable columns={cols} rows={agents} rowKey={(r) => r.id} />
        )}
      </div>
    </div>
  );
}
