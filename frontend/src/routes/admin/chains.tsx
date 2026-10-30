import { createFileRoute } from "@tanstack/react-router";
import { Globe, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { NETWORKS, type Network } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/chains")({
  component: AdminChainsPage,
});

const cols: Column<Network>[] = [
  { key: "name", header: "EVM Network", cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
  { key: "chainId", header: "Chain ID", cell: (r) => <span className="font-mono text-xs">{r.chainId}</span> },
  { key: "symbol", header: "Native Currency", cell: (r) => <span className="font-mono text-xs">{r.symbol}</span> },
  { key: "explorer", header: "Block Explorer", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.explorer}</span> },
  { key: "status", header: "Indexer Status", cell: (r) => <StatusBadge status={r.status} /> },
];

function AdminChainsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Blockchain & RPC Networks"
        description="Supported EVM chains, RPC pool routing, failover endpoints, and indexer sync status."
        actions={
          <Button className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Add Chain
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={NETWORKS} rowKey={(r) => r.key} />
      </div>

      <DemoDataNote />
    </div>
  );
}

