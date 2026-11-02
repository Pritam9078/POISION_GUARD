import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Users, Plus, ShieldCheck } from "lucide-react";
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
import { PageHeader, NetworkBadge, StatusBadge } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";
import { isValidAddress } from "@/lib/validation";

export const Route = createFileRoute("/guard/recipients")({
  component: RecipientsPage,
});

interface RecipientItem {
  id: string;
  label: string;
  address: string;
  network?: string;
  chainId: number;
  allowedUse?: string;
  description?: string;
  status: string;
  updatedBy?: string;
}

const cols: Column<RecipientItem>[] = [
  { key: "label", header: "Recipient Label", cell: (r) => <span className="font-medium text-foreground">{r.label}</span> },
  { key: "address", header: "Verified Address", cell: (r) => <span className="font-mono text-xs text-muted-foreground break-all">{r.address}</span> },
  { key: "network", header: "Network", cell: (r) => <NetworkBadge network={r.network || "ethereum"} /> },
  { key: "allowedUse", header: "Purpose", cell: (r) => <span className="text-xs capitalize">{r.allowedUse || r.description || "Vendor"}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
];

function RecipientsPage() {
  const { session } = useDemoAuth();
  const [recipients, setRecipients] = useState<RecipientItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Dialog
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState("1");
  const [useType, setUseType] = useState<"payroll" | "vendor" | "treasury" | "other">("vendor");
  const [busy, setBusy] = useState(false);

  const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;

  const fetchRecipients = async () => {
    if (!wsId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api<{ items: RecipientItem[] }>(`/workspaces/${encodeURIComponent(wsId)}/recipients`);
      setRecipients(res.items || []);
    } catch {
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRecipients();
  }, [wsId]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!wsId) return;
    const cleanAddr = address.trim().toLowerCase();
    if (!isValidAddress(cleanAddr)) {
      toast.error("Please enter a valid EVM 0x address.");
      return;
    }
    if (!label.trim()) {
      toast.error("Please enter a recipient label.");
      return;
    }
    setBusy(true);
    try {
      await api(`/workspaces/${encodeURIComponent(wsId)}/recipients`, {
        method: "POST",
        body: {
          label: label.trim(),
          address: cleanAddr,
          chainId: Number(chainId),
          allowedUse: useType,
          verificationMethod: "independent_confirmation",
          verificationEvidence: "Verified via primary operator channel",
          tokenRestrictions: [],
          notes: "",
        },
      });
      toast.success("Trusted recipient added!");
      setOpen(false);
      setLabel("");
      setAddress("");
      void fetchRecipients();
    } catch (err: any) {
      toast.error(err.message || "Failed to add recipient.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trusted Recipients"
        description="Verified address book used by the similarity engine to flag lookalike vanity attempts."
        actions={
          <Button onClick={() => setOpen(true)} className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Add Recipient
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading trusted recipients…</div>
        ) : recipients.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="mx-auto size-8 text-muted-foreground/60" />
            <h4 className="mt-3 text-sm font-medium text-foreground">No trusted recipients yet</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Add known counterparty addresses (vendors, multisigs, payroll) to protect your team against lookalike poison attacks.
            </p>
            <Button onClick={() => setOpen(true)} variant="outline" size="sm" className="mt-4 rounded-full">
              <Plus className="mr-1.5 size-3.5" /> Add First Recipient
            </Button>
          </div>
        ) : (
          <DataTable columns={cols} rows={recipients} rowKey={(r) => r.id} />
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Trusted Recipient</DialogTitle>
            <DialogDescription>
              Add an independently-verified address to your workspace trusted address book.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-label">Recipient Label</Label>
              <Input
                id="r-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Audit Firm Escrow, Payroll Safe"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-addr">Wallet / Contract Address</Label>
              <Input
                id="r-addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                className="font-mono text-xs"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-net">Network</Label>
                <Select value={chainId} onValueChange={setChainId}>
                  <SelectTrigger id="r-net">
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
              <div className="space-y-1.5">
                <Label htmlFor="r-use">Allowed Use</Label>
                <Select value={useType} onValueChange={(v: any) => setUseType(v)}>
                  <SelectTrigger id="r-use">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="payroll">Payroll</SelectItem>
                    <SelectItem value="treasury">Treasury</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy} className="rounded-full">
                {busy ? "Saving…" : "Add Recipient"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
