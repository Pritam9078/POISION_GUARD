import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, NetworkBadge } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/guard/approvals")({
  component: ApprovalsPage,
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
}

const cols: Column<SpendIntentItem>[] = [
  { key: "id", header: "Intent ID", cell: (r) => <span className="font-mono text-xs font-semibold">{r.id}</span> },
  { key: "requester", header: "Agent / Requester", cell: (r) => <span className="text-xs font-medium">{r.requester || "Agent"}</span> },
  { key: "amount", header: "Amount & Asset", cell: (r) => <span className="font-medium">{r.amount} {r.asset || r.assetSymbol || "ETH"}</span> },
  { key: "recipient", header: "Target Recipient", cell: (r) => <span className="font-mono text-xs text-muted-foreground break-all">{r.recipient || r.toAddress}</span> },
  { key: "network", header: "Network", cell: (r) => <NetworkBadge network={r.network || "ethereum"} /> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
];

function ApprovalsPage() {
  const { session } = useDemoAuth();
  const [pending, setPending] = useState<SpendIntentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;

  useEffect(() => {
    if (!wsId) {
      setLoading(false);
      return;
    }
    let unmounted = false;
    api<{ items: SpendIntentItem[] }>(`/workspaces/${encodeURIComponent(wsId)}/spend-intents?status=pending_approval`)
      .then((res) => {
        if (!unmounted) setPending(res.items || []);
      })
      .catch(() => {
        if (!unmounted) setPending([]);
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
        title="Approvals & Authorizations"
        description="Pending authorization requests for agent transactions, policy exceptions, and dual-custody transfers."
        actions={
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/revoke">Audit Token Allowances</Link>
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <h3 className="font-display text-base font-medium">Pending Approvals ({pending.length})</h3>
        <p className="mb-4 text-xs text-muted-foreground">Requires authorized human approver signature.</p>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Checking pending approvals…</div>
        ) : pending.length === 0 ? (
          <div className="py-12 text-center">
            <ShieldCheck className="mx-auto size-8 text-emerald-500/80" />
            <h4 className="mt-3 text-sm font-medium text-foreground">No approvals waiting</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              All spend intents in this workspace have been evaluated and authorized.
            </p>
          </div>
        ) : (
          <DataTable columns={cols} rows={pending} rowKey={(r) => r.id} />
        )}
      </div>
    </div>
  );
}
