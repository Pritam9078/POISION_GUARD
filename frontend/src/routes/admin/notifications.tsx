import { createFileRoute } from "@tanstack/react-router";
import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { NOTIFICATIONS, type Notification } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotificationsPage,
});

const cols: Column<Notification>[] = [
  { key: "type", header: "Alert Type", cell: (r) => <span className="font-medium text-foreground">{r.type}</span> },
  { key: "body", header: "Message Body", cell: (r) => <span className="text-xs text-muted-foreground">{r.body}</span> },
  { key: "channel", header: "Channel", cell: (r) => <span className="text-xs uppercase">{r.channel}</span> },
  { key: "read", header: "Delivery Status", cell: (r) => <StatusBadge status={r.read ? "read" : "delivered"} /> },
  { key: "at", header: "Dispatched", cell: (r) => <span className="text-xs text-muted-foreground">{r.at}</span> },
];

function AdminNotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Dispatch & Templates"
        description="Global notification delivery logs, email webhooks, and incident alert fanouts."
        actions={
          <Button className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Broadcast Announcement
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={NOTIFICATIONS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

