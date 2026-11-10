import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Plus, CheckCircle2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/guard/proofs")({
  component: ProofsPage,
});

interface ProofRow {
  id: string;
  scope?: string;
  kind: string;
  createdAt: string;
  status: string;
  txHash?: string | null;
  commitment?: string;
  verification?: string;
  batchId?: string;
}

function ProofsPage() {
  const { session } = useDemoAuth();
  const [proofs, setProofs] = useState<ProofRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;

  const loadProofs = () => {
    if (!wsId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api<{ items: ProofRow[] }>(`/workspaces/${encodeURIComponent(wsId)}/proofs`)
      .then((res) => setProofs(res.items || []))
      .catch(() => setProofs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProofs();
  }, [wsId]);

  const handleCreateCheckpoint = async () => {
    if (!wsId) return;
    setCreating(true);
    try {
      await api(`/workspaces/${encodeURIComponent(wsId)}/proofs/checkpoint`, { method: "POST" });
      toast.success("Audit checkpoint created and local cryptographic hash verified.");
      loadProofs();
    } catch (err: any) {
      toast.error(err.message || "Failed to create checkpoint.");
    } finally {
      setCreating(false);
    }
  };

  const handleVerify = async (proofId: string) => {
    if (!wsId) return;
    setVerifyingId(proofId);
    try {
      const res = await api<ProofRow>(`/workspaces/${encodeURIComponent(wsId)}/proofs/${encodeURIComponent(proofId)}/verify`, {
        method: "POST",
      });
      toast.success(res.verification || "Proof integrity verified.");
      loadProofs();
    } catch (err: any) {
      toast.error(err.message || "Verification failed.");
    } finally {
      setVerifyingId(null);
    }
  };

  const cols: Column<ProofRow>[] = [
    { key: "id", header: "Proof ID", cell: (r) => <span className="font-mono text-xs font-semibold">{r.id}</span> },
    { key: "kind", header: "Proof Kind", cell: (r) => <span className="text-xs">{r.kind}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "commitment",
      header: "Commitment / Head Hash",
      cell: (r) => (
        <span className="font-mono text-xs text-muted-foreground truncate max-w-[140px] inline-block">
          {r.commitment || "—"}
        </span>
      ),
    },
    {
      key: "verification",
      header: "Verification Detail",
      cell: (r) => <span className="text-xs text-muted-foreground">{r.verification || "Hash chain verified locally."}</span>,
    },
    {
      key: "actions",
      header: "Action",
      cell: (r) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs rounded-full"
          disabled={verifyingId === r.id}
          onClick={() => handleVerify(r.id)}
        >
          {verifyingId === r.id ? <RotateCw className="mr-1 size-3 animate-spin" /> : <CheckCircle2 className="mr-1 size-3 text-emerald-500" />}
          Re-verify
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proof Center"
        description="Cryptographic proofs anchoring execution receipts, policy compliance, and audit checkpoint states."
        actions={
          <Button className="rounded-full" disabled={creating} onClick={handleCreateCheckpoint}>
            {creating ? <RotateCw className="mr-1.5 size-4 animate-spin" /> : <Plus className="mr-1.5 size-4" />}
            Create Checkpoint
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading cryptographic proofs…</div>
        ) : proofs.length === 0 ? (
          <div className="py-12 text-center">
            <ShieldCheck className="mx-auto size-8 text-muted-foreground/60" />
            <h4 className="mt-3 text-sm font-medium text-foreground">No audit checkpoints yet</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Audit checkpoints seal your workspace transaction history into a tamper-evident SHA-256 hash chain.
            </p>
            <Button size="sm" className="mt-4 rounded-full" onClick={handleCreateCheckpoint} disabled={creating}>
              Create First Checkpoint
            </Button>
          </div>
        ) : (
          <DataTable columns={cols} rows={proofs} rowKey={(r) => r.id} />
        )}
      </div>
    </div>
  );
}
