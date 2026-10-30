import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Wallet, Plus, ShieldCheck, Activity } from "lucide-react";
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
import { PageHeader, StatusBadge, NetworkBadge } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";
import { isValidAddress } from "@/lib/validation";

export const Route = createFileRoute("/guard/wallets")({
  component: WalletsPage,
});

interface WatchedWalletItem {
  id: string;
  label: string;
  address: string;
  network?: string;
  chainId: number;
  walletType?: string;
  monitoring?: {
    enabled: boolean;
    frequency: string;
  };
  status: string;
  addedAt?: string;
}

const cols: Column<WatchedWalletItem>[] = [
  { key: "label", header: "Wallet Label", cell: (r) => <span className="font-medium text-foreground">{r.label}</span> },
  { key: "address", header: "Address", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.address}</span> },
  { key: "network", header: "Network", cell: (r) => <NetworkBadge network={r.network || "ethereum"} /> },
  { key: "monitoring", header: "Monitoring Frequency", cell: (r) => <span className="text-xs">{r.monitoring?.frequency || "Every 15 minutes"}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "addedAt", header: "Added Date", cell: (r) => <span className="text-xs text-muted-foreground">{r.addedAt ? new Date(r.addedAt).toLocaleDateString() : "Just now"}</span> },
];

function WalletsPage() {
  const { session } = useDemoAuth();
  const [wallets, setWallets] = useState<WatchedWalletItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Wallet Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState("1");
  const [walletType, setWalletType] = useState<"treasury" | "payroll" | "personal" | "agent_controlled" | "other">("treasury");
  const [addBusy, setAddBusy] = useState(false);

  const fetchWallets = async () => {
    const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;
    if (!wsId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api<{ items: WatchedWalletItem[] }>(`/workspaces/${encodeURIComponent(wsId)}/wallets`);
      setWallets(res.items || []);
    } catch {
      // Empty by default for new user
      setWallets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchWallets();
  }, [session?.workspaceId]);

  const handleAddWallet = async (e: FormEvent) => {
    e.preventDefault();
    const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;
    if (!wsId) {
      toast.error("No active workspace found.");
      return;
    }
    const cleanAddr = address.trim().toLowerCase();
    if (!isValidAddress(cleanAddr)) {
      toast.error("Please enter a valid 0x EVM wallet address.");
      return;
    }
    if (!label.trim()) {
      toast.error("Please enter a wallet label.");
      return;
    }
    setAddBusy(true);
    try {
      await api(`/workspaces/${encodeURIComponent(wsId)}/wallets`, {
        method: "POST",
        body: {
          label: label.trim(),
          address: cleanAddr,
          chainId: Number(chainId),
          walletType,
          monitoring: "enabled",
        },
      });
      toast.success(`Wallet "${label}" added for monitoring!`);
      setAddOpen(false);
      setLabel("");
      setAddress("");
      await fetchWallets();
    } catch (err: any) {
      toast.error(err.message || "Failed to add wallet.");
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Watched Wallets"
        description="Continuous mempool & block monitoring for address poisoning and dust attacks on active organization wallets."
        actions={
          <Button onClick={() => setAddOpen(true)} className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Add Wallet
          </Button>
        }
      />

      {wallets.length > 0 ? (
        <div className="rounded-3xl border bg-card p-6 shadow-sm">
          <DataTable columns={cols} rows={wallets} rowKey={(r) => r.id} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed bg-card/60 p-12 text-center">
          <Wallet className="mb-4 size-12 text-muted-foreground opacity-50" />
          <h2 className="font-display text-lg font-medium">No watched wallets yet</h2>
          <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
            Add your team, cold storage, or operational wallets to begin automated address poisoning detection and lookalike recipient alerts.
          </p>
          <Button onClick={() => setAddOpen(true)} className="mt-6 rounded-full">
            <Plus className="mr-1.5 size-4" /> Add your first wallet
          </Button>
        </div>
      )}

      {/* Add Wallet Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Watched Wallet</DialogTitle>
            <DialogDescription>
              Enter the EVM address and network to monitor for spoofed lookalikes and malicious allowances.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddWallet} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="w-label">Wallet Label</Label>
              <Input
                id="w-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Primary Treasury"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-addr">Wallet Address</Label>
              <Input
                id="w-addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                className="font-mono text-xs"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Network</Label>
                <Select value={chainId} onValueChange={setChainId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Ethereum</SelectItem>
                    <SelectItem value="42161">Arbitrum</SelectItem>
                    <SelectItem value="8453">Base</SelectItem>
                    <SelectItem value="10">Optimism</SelectItem>
                    <SelectItem value="137">Polygon</SelectItem>
                    <SelectItem value="11155111">Sepolia (Testnet)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={walletType} onValueChange={(v: any) => setWalletType(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="treasury">Treasury</SelectItem>
                    <SelectItem value="payroll">Payroll</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="agent_controlled">Agent Controlled</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addBusy}>
                {addBusy ? "Adding…" : "Start Watching"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
