import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileSearch, Plus, ShieldAlert, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, SeverityBadge, StatusBadge, NetworkBadge, DemoDataNote } from "@/components/pg/kit";
import { SCANS, NETWORKS, ADDR_SUBJECT, ADDR_LOOKALIKE, type Scan } from "@/lib/fixtures";
import { validateScanInput } from "@/lib/validation";

export const Route = createFileRoute("/guard/scans")({
  component: ScansManagementPage,
});

const cols: Column<Scan>[] = [
  {
    key: "id",
    header: "Scan ID",
    cell: (r) => (
      <Link to="/scan/$scanId" params={{ scanId: r.id }} className="font-mono text-xs font-semibold text-primary hover:underline">
        {r.id}
      </Link>
    ),
  },
  { key: "subject", header: "Subject Address / Tx", cell: (r) => <span className="font-mono text-xs">{r.subject}</span> },
  { key: "network", header: "Network", cell: (r) => <NetworkBadge network={r.network} /> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  {
    key: "risk",
    header: "Risk Level",
    cell: (r) => (
      <SeverityBadge
        severity={
          r.riskLabel === "elevated" ? "medium" : r.riskLabel === "inconclusive" ? "info" : r.riskLabel
        }
      />
    ),
  },
  { key: "completedAt", header: "Timestamp", cell: (r) => <span className="text-xs text-muted-foreground">{r.completedAt}</span> },
];

function ScansManagementPage() {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(ADDR_SUBJECT);
  const [network, setNetwork] = useState("ethereum");
  const [contextTx, setContextTx] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleStartScan = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const check = validateScanInput(inputVal);
    if (!check.ok) {
      setError(check.message);
      return;
    }

    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setOpen(false);
      // Navigate to the scan results page inside the app
      const match = SCANS.find((s) => s.subject.toLowerCase() === inputVal.trim().toLowerCase()) ?? SCANS[0]!;
      navigate({ to: "/scan/$scanId", params: { scanId: match.id } });
    }, 600);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scan History & Analysis"
        description="Forensic evaluations of addresses, contracts, and transactions run by your organization."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full">
                <Plus className="mr-1.5 size-4" /> Run New Scan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-3xl">
              <DialogHeader>
                <DialogTitle className="font-display text-xl font-medium">Run Forensic Scan</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Analyze an EVM address or transaction hash for poisoning patterns, lookalike disparity, and unlimited allowances.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleStartScan} className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="scan-network" className="text-xs uppercase tracking-wider text-muted-foreground">
                    EVM Network
                  </Label>
                  <select
                    id="scan-network"
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                    className="mt-1.5 flex h-10 w-full rounded-full border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {NETWORKS.map((n) => (
                      <option key={n.key} value={n.key}>
                        {n.name} (Chain {n.chainId})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="scan-subject" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Address or Transaction Hash
                  </Label>
                  <Input
                    id="scan-subject"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder="0x…"
                    className="mt-1.5 font-mono text-sm rounded-full"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="scan-context" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Context Transaction Hash (Optional)
                  </Label>
                  <Input
                    id="scan-context"
                    value={contextTx}
                    onChange={(e) => setContextTx(e.target.value)}
                    placeholder="0x… (recent interaction)"
                    className="mt-1.5 font-mono text-sm rounded-full"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Samples:</span>
                  <button
                    type="button"
                    onClick={() => setInputVal(ADDR_SUBJECT)}
                    className="rounded-full bg-secondary px-2.5 py-0.5 text-foreground hover:bg-secondary/80"
                  >
                    Victim Wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputVal(ADDR_LOOKALIKE)}
                    className="rounded-full bg-secondary px-2.5 py-0.5 text-foreground hover:bg-secondary/80"
                  >
                    Lookalike Attacker
                  </button>
                </div>

                {error && <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-full">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={scanning} className="rounded-full px-6">
                    {scanning ? "Analyzing…" : "Execute Scan"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={SCANS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

