import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, DemoDataNote, EmptyState } from "@/components/pg/kit";
import { NOTIFICATIONS } from "@/lib/fixtures";
import { fmtDateTime } from "@/lib/validation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guard/notifications")({
  component: Notifications,
});

function Notifications() {
  const [readIds, setReadIds] = useState<string[]>(NOTIFICATIONS.filter((n) => n.read).map((n) => n.id));
  const unread = NOTIFICATIONS.filter((n) => !readIds.includes(n.id));

  const markAll = () => setReadIds(NOTIFICATIONS.map((n) => n.id));

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Delivery history across in-app, email and webhook channels."
        actions={
          <Button variant="outline" className="rounded-full" onClick={markAll} disabled={unread.length === 0}>
            Mark all as read
          </Button>
        }
      />
      {NOTIFICATIONS.length === 0 ? (
        <EmptyState title="No notifications" description="Security alerts and workflow updates will appear here." />
      ) : (
        <div className="space-y-2">
          {NOTIFICATIONS.map((n) => {
            const read = readIds.includes(n.id);
            return (
              <button
                key={n.id}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-secondary/40",
                  !read && "border-[color-mix(in_oklab,var(--grad-peri)_45%,transparent)]",
                )}
                onClick={() => setReadIds((ids) => (ids.includes(n.id) ? ids : [...ids, n.id]))}
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", read ? "bg-border" : "bg-[var(--risk-high)]")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{n.type}</span>
                    <Badge variant="secondary" className="rounded-full capitalize">{n.channel.replace("_", " ")}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(n.at)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <DemoDataNote className="mt-6" />
    </div>
  );
}
