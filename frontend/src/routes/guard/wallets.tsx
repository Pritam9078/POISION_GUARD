import { createFileRoute } from "@tanstack/react-router";
import { Wallet, Plus, ShieldCheck, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, SectionHeading, StatusBadge, NetworkBadge, DemoDataNote } from "@/components/pg/kit";
import { WALLETS, type WatchedWallet } from "@/lib/fixtures";

export const Route = createFileRoute("/guard/wallets")({
  component: WalletsPage,
});

const cols: Column<WatchedWallet>[] = [
  { key: "label", header: "Wallet Label", cell: (r) => <span className="font-medium text-foreground">{r.label}</span> },
  { key: "address", header: "Address", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.address}</span> },
  { key: "network", header: "Network", cell: (r) => <NetworkBadge network={r.network} /> },
  { key: "monitoring", header: "Monitoring Frequency", cell: (r) => <span className="text-xs">{r.monitoring.frequency}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "addedAt", header: "Added Date", cell: (r) => <span className="text-xs text-muted-foreground">{r.addedAt}</span> },
];

function WalletsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Watched Wallets"
        description="Continuous mempool & block monitoring for address poisoning and dust attacks on active organization wallets."
        actions={
          <Button className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Add Wallet
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={WALLETS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

