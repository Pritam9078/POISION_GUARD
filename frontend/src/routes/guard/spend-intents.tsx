import { createFileRoute } from "@tanstack/react-router";
import { Receipt, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, NetworkBadge, DemoDataNote } from "@/components/pg/kit";
import { SPEND_INTENTS, type SpendIntent } from "@/lib/fixtures";

export const Route = createFileRoute("/guard/spend-intents")({
  component: SpendIntentsPage,
});

const cols: Column<SpendIntent>[] = [
  { key: "id", header: "Intent ID", cell: (r) => <span className="font-mono text-xs font-semibold">{r.id}</span> },
  { key: "requester", header: "Requester", cell: (r) => <span className="text-xs">{r.requester}</span> },
  { key: "amount", header: "Amount", cell: (r) => <span className="font-medium">{r.amount} {r.asset}</span> },
  { key: "recipient", header: "Recipient", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.recipient}</span> },
  { key: "network", header: "Network", cell: (r) => <NetworkBadge network={r.network} /> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "createdAt", header: "Submitted", cell: (r) => <span className="text-xs text-muted-foreground">{r.createdAt}</span> },
];

function SpendIntentsPage() {
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
        <DataTable columns={cols} rows={SPEND_INTENTS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

