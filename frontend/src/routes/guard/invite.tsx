import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/pg/kit";

export const Route = createFileRoute("/guard/invite")({
  component: InviteAcceptancePage,
});

function InviteAcceptancePage() {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="aurora" />
      <div className="relative w-full max-w-md rounded-3xl border bg-card p-8 shadow-sm text-center">
        <Logo to="/" />
        <div className="mx-auto mt-6 flex size-12 items-center justify-center rounded-full bg-secondary">
          <Users className="size-6 text-foreground" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-medium tracking-tight">Workspace Invitation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You have been invited to join <span className="font-semibold text-foreground">Nordguard Labs</span> as an Approver.
        </p>

        {accepted ? (
          <div className="mt-6 rounded-2xl bg-emerald-500/10 p-5 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="mx-auto size-6" />
            <h3 className="mt-2 text-sm font-medium">Invitation Accepted</h3>
            <p className="mt-1 text-xs text-muted-foreground">Welcome to the team workspace.</p>
            <Button asChild className="mt-4 w-full rounded-full">
              <Link to="/guard/overview">Go to Workspace Dashboard</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <Button onClick={() => setAccepted(true)} className="w-full rounded-full py-6">
              Accept Invitation & Join
            </Button>
            <Button asChild variant="outline" className="w-full rounded-full">
              <Link to="/">Decline</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

