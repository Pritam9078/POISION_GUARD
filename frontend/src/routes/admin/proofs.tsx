import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { PROOFS } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/proofs")({
  component: AdminProofsPage,
});

interface ProofRow {
  id: string;
  scope: string;
  kind: string;
  at: string;
  entries: number;
  status: string;
  anchor: string;
  verification: string;
}

const cols: Column<ProofRow>[] = [
  { key: "id", header: "Proof ID", cell: (r) => <span className="font-mono text-xs font-semibold">{r.id}</span> },
  { key: "scope", header: "Scope", cell: (r) => <span className="text-xs font-medium">{r.scope}</span> },
  { key: "kind", header: "Kind", cell: (r) => <span className="text-xs">{r.kind}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "anchor", header: "Anchor / State", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.anchor}</span> },
  { key: "verification", header: "Verification Result", cell: (r) => <span className="text-xs text-muted-foreground">{r.verification}</span> },
];

function AdminProofsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Proof Center (Platform-wide)"
        description="Verify cryptographic proofs, state reconciliation anchors, and on-chain receipts."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={PROOFS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

