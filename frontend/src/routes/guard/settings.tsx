import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageHeader, SectionHeading, DemoDataNote, KeyValue } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";

export const Route = createFileRoute("/guard/settings")({
  component: Settings,
});

function Settings() {
  const { session, signOut } = useDemoAuth();
  const [prefs, setPrefs] = useState({ poisoning: true, approvals: true, execution: true, digest: false, webhook: true });

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    toast.success("Preference saved (demo)");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Workspace profile, security and notification preferences." />

      <div className="rounded-2xl border bg-card p-5">
        <SectionHeading title="Account" />
        <div className="grid gap-4 sm:grid-cols-3">
          <KeyValue label="Name">{session?.name}</KeyValue>
          <KeyValue label="Email">{session?.email}</KeyValue>
          <KeyValue label="Role">Owner (demo)</KeyValue>
        </div>
        <Separator className="my-4" />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" disabled>Change password — backend pending</Button>
          <Button variant="outline" className="rounded-full" disabled>Manage sessions — backend pending</Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              signOut();
              toast.success("Signed out");
            }}
          >
            Sign out
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-card p-5">
        <SectionHeading title="Notifications" description="Choose which security events notify you." />
        <div className="divide-y">
          {(
            [
              ["poisoning", "Poisoning patterns detected", "Watched wallets show lookalike or dust activity"],
              ["approvals", "Approval required", "A spend intent is waiting for an approver"],
              ["execution", "Execution updates", "Submission, confirmation and reconciliation results"],
              ["digest", "Weekly digest", "Summary email of findings and policy changes"],
              ["webhook", "Webhook delivery", "Push events to your configured endpoint"],
            ] as const
          ).map(([key, label, desc]) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
              <Switch checked={prefs[key]} onCheckedChange={() => toggle(key)} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-card p-5">
        <SectionHeading title="Workspace & data" />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/guard/workspaces">Workspace profile</Link>
          </Button>
          <Button variant="outline" className="rounded-full" disabled>API & webhooks — backend pending</Button>
          <Button variant="outline" className="rounded-full" disabled>Retention preferences — backend pending</Button>
        </div>
      </div>

      <DemoDataNote className="mt-6" />
    </div>
  );
}
