import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { PROOFS } from "@/lib/fixtures";

export const Route = createFileRoute("/guard/proofs")({
  component: ProofsPage,
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
  { key: "kind", header: "Proof Kind", cell: (r) => <span className="text-xs">{r.kind}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "anchor", header: "Anchor / Tx", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.anchor}</span> },
  { key: "verification", header: "Verification Detail", cell: (r) => <span className="text-xs text-muted-foreground">{r.verification}</span> },
];

function ProofsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Proof Center"
        description="Cryptographic proofs anchoring execution receipts, policy compliance, and audit checkpoint states."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={PROOFS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

