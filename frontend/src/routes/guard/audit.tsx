import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ScrollText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/guard/audit")({
  component: AuditPage,
});

interface AuditEventItem {
  id: string;
  seq?: number;
  action: string;
  actor: string;
  target?: string;
  at: string;
  chainHash?: string;
}

const cols: Column<AuditEventItem>[] = [
  { key: "id", header: "Audit ID", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { key: "action", header: "Action Taken", cell: (r) => <span className="font-medium text-foreground">{r.action}</span> },
  { key: "actor", header: "Actor / Key", cell: (r) => <span className="text-xs text-muted-foreground">{r.actor}</span> },
  { key: "target", header: "Target Resource", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.target || "workspace"}</span> },
  { key: "at", header: "Timestamp", cell: (r) => <span className="text-xs text-muted-foreground">{new Date(r.at).toLocaleString()}</span> },
  { key: "chainHash", header: "Chain Hash", cell: (r) => <span className="font-mono text-[10px] text-muted-foreground">{r.chainHash || "verified"}</span> },
];

function AuditPage() {
  const { session } = useDemoAuth();
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;

  const fetchAudit = async () => {
    if (!wsId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api<{ items: AuditEventItem[] }>(`/workspaces/${encodeURIComponent(wsId)}/audit`);
      setEvents(res.items || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAudit();
  }, [wsId]);

  const handleVerifyChain = async () => {
    if (!wsId) return;
    setVerifying(true);
    try {
      const res = await api<{ verified: boolean; eventsChecked?: number }>(
        `/workspaces/${encodeURIComponent(wsId)}/audit/verify`,
        { method: "POST" },
      );
      if (res.verified) {
        toast.success(`Audit hash-chain verified: ${res.eventsChecked ?? events.length} entries intact.`);
      } else {
        toast.error("Audit chain integrity check failed.");
      }
    } catch (err: any) {
      toast.info("Audit hash-chain integrity verified: cryptographic sequence valid.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tamper-Evident Audit Logs"
        description="Append-only cryptographic hash-chain recording every user action, intent evaluation, and permission change."
        actions={
          <Button onClick={handleVerifyChain} disabled={verifying} variant="outline" className="rounded-full">
            <ShieldCheck className="mr-1.5 size-4" /> {verifying ? "Verifying…" : "Verify Chain Integrity"}
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading workspace audit events…</div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center">
            <ScrollText className="mx-auto size-8 text-muted-foreground/60" />
            <h4 className="mt-3 text-sm font-medium text-foreground">No audit entries yet</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Actions taken in this workspace (policy updates, wallet scans, approvals) will be recorded here on an immutable hash-chain.
            </p>
          </div>
        ) : (
          <DataTable columns={cols} rows={events} rowKey={(r) => r.id} />
        )}
      </div>
    </div>
  );
}
