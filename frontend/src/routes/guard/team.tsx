import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/guard/team")({
  component: TeamPage,
});

interface MemberItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  roleLabel?: string;
  status: string;
  joinedAt?: string;
  lastActive?: string | null;
}

const cols: Column<MemberItem>[] = [
  { key: "name", header: "Name", cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
  { key: "email", header: "Email", cell: (r) => <span className="text-xs text-muted-foreground">{r.email}</span> },
  { key: "role", header: "Workspace Role", cell: (r) => <span className="text-xs font-semibold capitalize">{r.roleLabel || r.role}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  {
    key: "joinedAt",
    header: "Joined",
    cell: (r) => <span className="text-xs text-muted-foreground">{r.joinedAt ? new Date(r.joinedAt).toLocaleDateString() : "Active"}</span>,
  },
];

function TeamPage() {
  const { session } = useDemoAuth();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);

  const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;

  useEffect(() => {
    if (!wsId) {
      if (session?.email) {
        setMembers([
          {
            id: session.id || "mem_owner",
            userId: session.id || "usr_owner",
            name: session.name || "User",
            email: session.email,
            role: "owner",
            roleLabel: "Owner",
            status: "active",
          },
        ]);
      }
      setLoading(false);
      return;
    }

    let unmounted = false;
    api<{ items: MemberItem[] }>(`/workspaces/${encodeURIComponent(wsId)}/members`)
      .then((res) => {
        if (!unmounted) setMembers(res.items || []);
      })
      .catch(() => {
        if (!unmounted && session?.email) {
          setMembers([
            {
              id: session.id || "mem_owner",
              userId: session.id || "usr_owner",
              name: session.name || "User",
              email: session.email,
              role: "owner",
              roleLabel: "Owner",
              status: "active",
            },
          ]);
        }
      })
      .finally(() => {
        if (!unmounted) setLoading(false);
      });

    return () => {
      unmounted = true;
    };
  }, [wsId, session?.email, session?.name, session?.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team & Access Control"
        description="Manage workspace members, role-based privileges, and authorization approvers."
        actions={
          <Button asChild className="rounded-full">
            <Link to="/guard/invite">
              <UserPlus className="mr-1.5 size-4" /> Invite Member
            </Link>
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading workspace members…</div>
        ) : (
          <DataTable columns={cols} rows={members} rowKey={(r) => r.id} />
        )}
      </div>
    </div>
  );
}
