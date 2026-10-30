import { createFileRoute } from "@tanstack/react-router";
import { Users, Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, NetworkBadge, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { RECIPIENTS, type TrustedRecipient } from "@/lib/fixtures";

export const Route = createFileRoute("/guard/recipients")({
  component: RecipientsPage,
});

const cols: Column<TrustedRecipient>[] = [
  { key: "label", header: "Recipient Label", cell: (r) => <span className="font-medium text-foreground">{r.label}</span> },
  { key: "address", header: "Verified Address", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.address}</span> },
  { key: "network", header: "Network", cell: (r) => <NetworkBadge network={r.network} /> },
  { key: "description", header: "Description", cell: (r) => <span className="text-xs">{r.description}</span> },
  { key: "updatedBy", header: "Updated By", cell: (r) => <span className="text-xs text-muted-foreground">{r.updatedBy}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
];

function RecipientsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Trusted Recipients"
        description="Verified address book used by the similarity engine to flag lookalike vanity attempts."
        actions={
          <Button className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Add Recipient
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={RECIPIENTS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

