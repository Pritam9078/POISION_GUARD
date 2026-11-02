import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Receipt, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, NetworkBadge } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/guard/spend-intents")({
  component: SpendIntentsPage,
});

interface SpendIntentItem {
  id: string;
  requester?: string;
  amount: string;
  asset?: string;
  assetSymbol?: string;
  recipient?: string;
  toAddress?: string;
  network?: string;
  status: string;
  createdAt: string;
}

const cols: Column<SpendIntentItem>[] = [
  { key: "id", header: "Intent ID", cell: (r) => <span className="font-mono text-xs font-semibold">{r.id}</span> },
  { key: "requester", header: "Requester", cell: (r) => <span className="text-xs">{r.requester || "Operator"}</span> },
  { key: "amount", header: "Amount", cell: (r) => <span className="font-medium">{r.amount} {r.asset || r.assetSymbol || "ETH"}</span> },
  { key: "recipient", header: "Recipient", cell: (r) => <span className="font-mono text-xs text-muted-foreground break-all">{r.recipient || r.toAddress}</span> },
  { key: "network", header: "Network", cell: (r) => <NetworkBadge network={r.network || "ethereum"} /> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "createdAt", header: "Submitted", cell: (r) => <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span> },
];

function SpendIntentsPage() {
  const { session } = useDemoAuth();
  const [intents, setIntents] = useState<SpendIntentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;

  useEffect(() => {
    if (!wsId) {
      setLoading(false);
      return;
    }
    let unmounted = false;
    api<{ items: SpendIntentItem[] }>(`/workspaces/${encodeURIComponent(wsId)}/spend-intents`)
      .then((res) => {
        if (!unmounted) setIntents(res.items || []);
      })
      .catch(() => {
        if (!unmounted) setIntents([]);
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
        title="Spend Intents"
        description="Formal declarations of on-chain intent evaluated against policy before execution."
        actions={
          <Button className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Declare Spend Intent
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading workspace spend intents…</div>
        ) : intents.length === 0 ? (
          <div className="py-12 text-center">
            <Receipt className="mx-auto size-8 text-muted-foreground/60" />
            <h4 className="mt-3 text-sm font-medium text-foreground">No spend intents declared</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Spend intents declare upcoming transaction amounts, targets, and purpose before signing.
            </p>
          </div>
        ) : (
          <DataTable columns={cols} rows={intents} rowKey={(r) => r.id} />
        )}
      </div>
    </div>
  );
}
