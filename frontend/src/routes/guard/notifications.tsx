import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/pg/kit";
import { fmtDateTime } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/guard/notifications")({
  component: Notifications,
});

interface NotificationItem {
  id: string;
  type: string;
  title?: string;
  body: string;
  channel?: string;
  at: string;
  read: boolean;
}

function Notifications() {
  const { session } = useDemoAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;

  const loadNotifications = () => {
    if (!wsId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api<{ items: NotificationItem[] }>(`/workspaces/${encodeURIComponent(wsId)}/notifications`)
      .then((res) => setItems(res.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadNotifications();
  }, [wsId]);

  const markAll = async () => {
    if (!wsId) return;
    try {
      await api(`/workspaces/${encodeURIComponent(wsId)}/notifications/read-all`, { method: "POST" });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("All notifications marked as read.");
    } catch (err: any) {
      toast.error(err.message || "Failed to mark notifications as read.");
    }
  };

  const markOne = async (id: string) => {
    if (!wsId) return;
    try {
      await api(`/workspaces/${encodeURIComponent(wsId)}/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      // optimistic update fallback
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }
  };

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Delivery history across in-app, email and webhook channels."
        actions={
          <Button variant="outline" className="rounded-full" onClick={markAll} disabled={unreadCount === 0}>
            Mark all as read
          </Button>
        }
      />

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading notifications…</div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border bg-card p-12 text-center shadow-sm">
          <Bell className="mx-auto size-8 text-muted-foreground/60" />
          <h4 className="mt-3 text-sm font-medium text-foreground">No notifications</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Security alerts, spend intent approvals, and workflow updates will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button
              key={n.id}
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-secondary/40",
                !n.read && "border-[color-mix(in_oklab,var(--grad-peri)_45%,transparent)]",
              )}
              onClick={() => markOne(n.id)}
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-border" : "bg-[var(--risk-high)]")} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{n.title || n.type}</span>
                  <Badge variant="secondary" className="rounded-full capitalize">
                    {(n.channel || "in_app").replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(n.at)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
