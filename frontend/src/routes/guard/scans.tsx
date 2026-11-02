import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileSearch, Plus, ShieldAlert, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, SeverityBadge, StatusBadge, NetworkBadge } from "@/components/pg/kit";
import { validateScanInput } from "@/lib/validation";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/guard/scans")({
  component: ScansManagementPage,
});

interface ScanRow {
  id: string;
  subject: string;
  network?: string;
  chainId?: number;
  status: string;
  riskLabel?: string;
  completedAt?: string;
  requestedAt?: string;
}

const cols: Column<ScanRow>[] = [
  {
    key: "id",
    header: "Scan ID",
    cell: (r) => (
      <Link to="/scan/$scanId" params={{ scanId: r.id }} className="font-mono text-xs font-semibold text-primary hover:underline">
        {r.id}
      </Link>
    ),
  },
  { key: "subject", header: "Subject Address / Tx", cell: (r) => <span className="font-mono text-xs break-all">{r.subject}</span> },
  { key: "network", header: "Network", cell: (r) => <NetworkBadge network={r.network || "ethereum"} /> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  {
    key: "risk",
    header: "Risk Level",
    cell: (r) => (
      <SeverityBadge
        severity={
          r.riskLabel === "elevated"
            ? "medium"
            : r.riskLabel === "inconclusive"
              ? "info"
              : ((r.riskLabel as any) || "low")
        }
      />
    ),
  },
  {
    key: "completedAt",
    header: "Timestamp",
    cell: (r) => <span className="text-xs text-muted-foreground">{r.completedAt || r.requestedAt ? new Date(r.completedAt || r.requestedAt!).toLocaleString() : "Just now"}</span>,
  },
];

function ScansManagementPage() {
  const { session } = useDemoAuth();
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);

  // New scan dialog
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [chainId, setChainId] = useState("1");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;

  const fetchScans = async () => {
    if (!wsId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api<{ items: ScanRow[] }>(`/workspaces/${encodeURIComponent(wsId)}/scans`);
      setScans(res.items || []);
    } catch {
      setScans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchScans();
  }, [wsId]);

  const handleStartScan = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const check = validateScanInput(inputVal);
    if (!check.ok) {
      setError(check.message);
      return;
    }

    setScanning(true);
    try {
      let scanResultId = "";
      if (wsId) {
        try {
          const res = await api<{ scanId: string }>(`/workspaces/${encodeURIComponent(wsId)}/scans`, {
            method: "POST",
            body: { chainId: Number(chainId), input: inputVal.trim() },
          });
          scanResultId = res.scanId;
        } catch {
          // Fall back to public scan endpoint
          const res = await api<{ scanId: string }>("/scans", {
            method: "POST",
            body: { chainId: Number(chainId), input: inputVal.trim() },
          });
          scanResultId = res.scanId;
        }
      } else {
        const res = await api<{ scanId: string }>("/scans", {
          method: "POST",
          body: { chainId: Number(chainId), input: inputVal.trim() },
        });
        scanResultId = res.scanId;
      }

      setOpen(false);
      toast.success("Scan initiated!");
      navigate({ to: "/scan/$scanId", params: { scanId: scanResultId } });
    } catch (err: any) {
      setError(err.message || "Failed to initiate scan.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scan History & Analysis"
        description="Forensic evaluations of addresses, contracts, and transactions run by your organization."
        actions={
          <Button onClick={() => setOpen(true)} className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Run New Scan
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading workspace scans…</div>
        ) : scans.length === 0 ? (
          <div className="py-12 text-center">
            <FileSearch className="mx-auto size-8 text-muted-foreground/60" />
            <h4 className="mt-3 text-sm font-medium text-foreground">No scans run yet</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Run a forensic evaluation on any EVM wallet or transaction hash to detect lookalike address poisoning and unlimited allowances.
            </p>
            <Button onClick={() => setOpen(true)} variant="outline" size="sm" className="mt-4 rounded-full">
              <Plus className="mr-1.5 size-3.5" /> Start First Scan
            </Button>
          </div>
        ) : (
          <DataTable columns={cols} rows={scans} rowKey={(r) => r.id} />
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Launch Security Scan</DialogTitle>
            <DialogDescription>
              Submit an EVM address or transaction hash to verify counterparty authenticity.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStartScan} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="scan-target">Address or Transaction Hash</Label>
              <Input
                id="scan-target"
                placeholder="0x... (40-char address or 64-char tx hash)"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="font-mono text-xs"
                required
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scan-net">Network</Label>
              <Select value={chainId} onValueChange={setChainId}>
                <SelectTrigger id="scan-net">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Ethereum</SelectItem>
                  <SelectItem value="8453">Base</SelectItem>
                  <SelectItem value="42161">Arbitrum One</SelectItem>
                  <SelectItem value="10">OP Mainnet</SelectItem>
                  <SelectItem value="137">Polygon</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={scanning} className="rounded-full">
                {scanning ? "Analyzing…" : "Start Scan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
