import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, DemoDataNote } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { WORKSPACES_LIST } from "@/lib/fixtures";

export const Route = createFileRoute("/guard/workspaces")({
  component: Workspaces,
});

function Workspaces() {
  const { session } = useDemoAuth();
  return (
    <div>
      <PageHeader
        title="Your workspaces"
        description="Switch between workspaces you belong to, or create a new one. In the real product, membership and roles are enforced by the backend."
        actions={
          <Button className="rounded-full">
            <Link to="/guard/overview">Create workspace</Link>
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {WORKSPACES_LIST.map((ws) => {
          const current = session?.workspace === ws.name;
          return (
            <div key={ws.id} className="rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-medium">{ws.name}</h2>
                {current ? <Badge className="rounded-full">Current</Badge> : <Badge variant="secondary" className="rounded-full">{ws.role}</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{ws.id}</p>
              <Button asChild variant={current ? "secondary" : "outline"} className="mt-4 w-full rounded-full">
                <Link to="/guard/overview">{current ? "Open workspace" : `Open as ${ws.role}`}</Link>
              </Button>
            </div>
          );
        })}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card p-5 text-center">
          <h2 className="font-display text-lg font-medium">Create a new workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">Isolate wallets, agents and policies per team or entity.</p>
          <Button className="mt-4 rounded-full" disabled>
            Create workspace — backend pending
          </Button>
        </div>
      </div>
      <DemoDataNote className="mt-6" />
    </div>
  );
}
