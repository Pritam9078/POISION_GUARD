import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageHeader, SectionHeading, DemoDataNote, KeyValue } from "@/components/pg/kit";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Platform settings"
        description="Sensitive configuration lives in the secure configuration store. Secret values are never displayed on admin pages or in logs."
      />

      <div className="rounded-2xl border bg-card p-5">
        <SectionHeading title="Environment" />
        <div className="grid gap-4 sm:grid-cols-3">
          <KeyValue label="Environment">production</KeyValue>
          <KeyValue label="API namespace">/api/v1</KeyValue>
          <KeyValue label="Config source">Secure config store</KeyValue>
        </div>
        <Separator className="my-4" />
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Provider keys (RPC, indexer, threat intel, AI, payments) are write-only from this console: staff can rotate them, but values are never returned.</p>
          <p>Changes to platform settings are recorded in the admin audit trail with actor, reason and before/after metadata (excluding secrets).</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" disabled>Rotate provider secret — backend pending</Button>
          <Button variant="outline" className="rounded-full" disabled>Edit CORS origins — backend pending</Button>
          <Button variant="outline" className="rounded-full" disabled>Configure log retention — backend pending</Button>
        </div>
      </div>

      <DemoDataNote className="mt-6" />
    </div>
  );
}
