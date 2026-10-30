import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, SeverityBadge, StatusBadge, NetworkBadge, DemoDataNote } from "@/components/pg/kit";
import { SPEND_INTENTS, type SpendIntent } from "@/lib/fixtures";

export const Route = createFileRoute("/guard/approvals")({
  component: ApprovalsPage,
});

const cols: Column<SpendIntent>[] = [
  { key: "id", header: "Intent ID", cell: (r) => <span className="font-mono text-xs font-semibold">{r.id}</span> },
  { key: "agent", header: "Agent / Requester", cell: (r) => <span className="text-xs font-medium">{r.requester}</span> },
  { key: "amount", header: "Amount & Asset", cell: (r) => <span className="font-medium">{r.amount} {r.asset}</span> },
  { key: "recipient", header: "Target Recipient", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.recipient}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "network", header: "Network", cell: (r) => <NetworkBadge network={r.network} /> },
];

function ApprovalsPage() {
  const pending = SPEND_INTENTS.filter((i) => i.status === "pending_approval");

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
        <DataTable columns={cols} rows={SPEND_INTENTS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

