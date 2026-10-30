import { createFileRoute } from "@tanstack/react-router";
import { ScrollText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { AUDIT_EVENTS, type AuditEvent } from "@/lib/fixtures";

export const Route = createFileRoute("/guard/audit")({
  component: AuditPage,
});

const cols: Column<AuditEvent>[] = [
  { key: "id", header: "Audit ID", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { key: "action", header: "Action Taken", cell: (r) => <span className="font-medium">{r.action}</span> },
  { key: "actor", header: "Actor / Key", cell: (r) => <span className="text-xs text-muted-foreground">{r.actor}</span> },
  { key: "target", header: "Target Resource", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.target}</span> },
  { key: "at", header: "Timestamp", cell: (r) => <span className="text-xs text-muted-foreground">{r.at}</span> },
  { key: "chainHash", header: "Chain Hash", cell: (r) => <span className="font-mono text-[10px] text-muted-foreground">{r.chainHash}</span> },
];

function AuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tamper-Evident Audit Logs"
        description="Append-only cryptographic hash-chain recording every user action, intent evaluation, and permission change."
        actions={
          <Button variant="outline" className="rounded-full">
            <ShieldCheck className="mr-1.5 size-4" /> Verify Chain Integrity
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={AUDIT_EVENTS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

