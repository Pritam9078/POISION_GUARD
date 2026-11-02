import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Key, Plus, Copy, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader, StatusBadge } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/guard/api-keys")({
  component: ApiKeysPage,
});

interface ApiKeyItem {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  status: string;
  lastUsedAt?: string | null;
  createdAt: string;
}

function ApiKeysPage() {
  const { session } = useDemoAuth();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");

  // Create key modal
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;

  const fetchKeys = async () => {
    if (!wsId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api<{ items: ApiKeyItem[] }>(`/workspaces/${encodeURIComponent(wsId)}/api-keys`);
      setKeys(res.items || []);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchKeys();
  }, [wsId]);

  const handleCopy = (id: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 2000);
      toast.success("Copied to clipboard");
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Please enter a key label.");
      return;
    }
    if (!wsId) return;
    setBusy(true);
    try {
      const res = await api<{ id: string; label: string; prefix: string; secret: string }>(
        `/workspaces/${encodeURIComponent(wsId)}/api-keys`,
        {
          method: "POST",
          body: {
            label: label.trim(),
            scopes: ["scans:read", "scans:write", "recipients:check"],
          },
        },
      );
      setRevealedSecret(res.secret);
      toast.success("API key generated successfully!");
      setLabel("");
      void fetchKeys();
    } catch (err: any) {
      toast.error(err.message || "Failed to create API key.");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!wsId) return;
    try {
      await api(`/workspaces/${encodeURIComponent(wsId)}/api-keys/${encodeURIComponent(keyId)}`, {
        method: "DELETE",
      });
      toast.success("API key revoked");
      void fetchKeys();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke key.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys & Webhooks"
        description="Programmatic credentials to integrate address similarity checks and approval audits into your pipeline."
        actions={
          <Button onClick={() => { setRevealedSecret(null); setCreateOpen(true); }} className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Create API Key
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <h3 className="font-display text-base font-medium">Workspace API Keys</h3>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading workspace API keys…</div>
        ) : keys.length === 0 ? (
          <div className="py-12 text-center">
            <Key className="mx-auto size-8 text-muted-foreground/60" />
            <h4 className="mt-3 text-sm font-medium text-foreground">No active API keys</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a workspace API key to integrate PoisonGuard directly into your CI/CD, agent runners, or transaction signing flows.
            </p>
            <Button
              onClick={() => { setRevealedSecret(null); setCreateOpen(true); }}
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
            >
              <Plus className="mr-1.5 size-3.5" /> Create First API Key
            </Button>
          </div>
        ) : (
          <div className="mt-4 divide-y">
            {keys.map((k) => (
              <div key={k.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-sm text-foreground">{k.label}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-0.5">{k.prefix}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Created {new Date(k.createdAt).toLocaleDateString()} {k.lastUsedAt ? `· Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "· Never used"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={k.status} />
                  <Button
                    onClick={() => handleCopy(k.id, k.prefix)}
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs"
                  >
                    <Copy className="mr-1.5 size-3" />
                    {copied === k.id ? "Copied" : "Copy"}
                  </Button>
                  {k.status === "active" && (
                    <Button
                      onClick={() => handleRevoke(k.id)}
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{revealedSecret ? "API Key Created" : "Create Workspace API Key"}</DialogTitle>
            <DialogDescription>
              {revealedSecret
                ? "Copy your key secret now. For security reasons, it will not be displayed again."
                : "Generate a programmatic key scoped exclusively to this workspace."}
            </DialogDescription>
          </DialogHeader>

          {revealedSecret ? (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border bg-secondary/50 p-3">
                <Label className="text-xs text-muted-foreground">Secret Token</Label>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs break-all text-foreground font-semibold">{revealedSecret}</span>
                  <Button
                    onClick={() => handleCopy("new-secret", revealedSecret)}
                    size="sm"
                    variant="outline"
                    className="shrink-0 rounded-full"
                  >
                    <Copy className="mr-1.5 size-3" />
                    {copied === "new-secret" ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setCreateOpen(false)} className="w-full rounded-full">
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="key-label">Key Label</Label>
                <Input
                  id="key-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. CI Scanner, Production Bot"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Scopes granted: <code>scans:read</code>, <code>scans:write</code>, <code>recipients:check</code>.
              </p>
              <DialogFooter className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy} className="rounded-full">
                  {busy ? "Generating…" : "Generate Key"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
