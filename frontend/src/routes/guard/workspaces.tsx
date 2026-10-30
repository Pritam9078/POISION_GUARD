import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Building2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { PageHeader } from "@/components/pg/kit";
import { useDemoAuth, type WorkspaceMembership } from "@/lib/demo-auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/guard/workspaces")({
  component: Workspaces,
});

interface WorkspaceItem {
  id: string;
  workspaceId: string;
  name: string;
  slug?: string;
  role: string;
}

function Workspaces() {
  const { session, switchWorkspace, refreshSession } = useDemoAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Workspace Dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const fetchWorkspaces = async () => {
    try {
      const res = await api<{ items: any[] }>("/workspaces");
      if (res?.items && Array.isArray(res.items)) {
        setWorkspaces(
          res.items.map((m: any) => ({
            id: m.workspaceId || m.id,
            workspaceId: m.workspaceId || m.id,
            name: m.workspaceName || m.workspace?.name || m.name || "Workspace",
            slug: m.slug || m.workspace?.slug,
            role: m.role || "member",
          }))
        );
      }
    } catch {
      // Fall back to session memberships if offline
      if (session?.memberships && session.memberships.length > 0) {
        setWorkspaces(
          session.memberships.map((m) => ({
            id: m.workspaceId,
            workspaceId: m.workspaceId,
            name: m.workspaceName || m.workspace?.name || `${session.name}'s Workspace`,
            role: m.role || "owner",
          }))
        );
      } else if (session?.workspace) {
        setWorkspaces([
          {
            id: session.workspaceId || "ws-default",
            workspaceId: session.workspaceId || "ws-default",
            name: session.workspace,
            role: "owner",
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchWorkspaces();
  }, [session?.workspaceId]);

  const handleCreateWorkspace = async (e: FormEvent) => {
    e.preventDefault();
    const cleanName = newWsName.trim();
    if (cleanName.length < 2) {
      toast.error("Workspace name must be at least 2 characters.");
      return;
    }
    setCreateBusy(true);
    try {
      const created = await api<{ id: string; workspaceId: string; name: string; role: string }>("/workspaces", {
        method: "POST",
        body: { name: cleanName },
      });
      toast.success(`Workspace "${created.name}" created!`);
      setCreateOpen(false);
      setNewWsName("");
      switchWorkspace(created.id || created.workspaceId, created.name);
      await refreshSession();
      await fetchWorkspaces();
      navigate({ to: "/guard/overview" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create workspace.");
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Your workspaces"
        description="Switch between workspaces you belong to, or create a new isolated security workspace."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Create workspace
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {workspaces.map((ws) => {
          const isCurrent =
            ws.workspaceId === session?.workspaceId ||
            ws.name === session?.workspace;
          return (
            <div key={ws.id} className="rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Building2 className="size-5 text-primary" />
                  <h2 className="font-display text-lg font-medium">{ws.name}</h2>
                </div>
                {isCurrent ? (
                  <Badge className="rounded-full bg-primary/10 text-primary border-primary/20">Current</Badge>
                ) : (
                  <Badge variant="secondary" className="rounded-full capitalize">
                    {ws.role}
                  </Badge>
                )}
              </div>
              <p className="mt-2 font-mono text-xs text-muted-foreground">{ws.id}</p>
              <Button
                variant={isCurrent ? "secondary" : "outline"}
                className="mt-4 w-full rounded-full"
                onClick={() => {
                  switchWorkspace(ws.workspaceId, ws.name);
                  navigate({ to: "/guard/overview" });
                }}
              >
                {isCurrent ? "Open workspace" : `Switch to ${ws.name}`}
              </Button>
            </div>
          );
        })}

        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/60 p-6 text-center">
          <Building2 className="mb-2 size-8 text-muted-foreground opacity-60" />
          <h2 className="font-display text-base font-medium">Create a new workspace</h2>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Isolate wallets, spending agents and approval policies per team or client.
          </p>
          <Button onClick={() => setCreateOpen(true)} variant="outline" className="mt-4 rounded-full">
            <Plus className="mr-1.5 size-4" /> New workspace
          </Button>
        </div>
      </div>

      {/* Create Workspace Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Enter a name for your workspace. You can invite team members and configure agent policies afterward.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Workspace Name</Label>
              <Input
                id="ws-name"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                placeholder="e.g. Treasury Operations"
                required
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createBusy}>
                {createBusy ? "Creating…" : "Create Workspace"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
