import { createFileRoute } from "@tanstack/react-router";
import { Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { TEAM, type TeamMember } from "@/lib/fixtures";

export const Route = createFileRoute("/guard/team")({
  component: TeamPage,
});

const cols: Column<TeamMember>[] = [
  { key: "name", header: "Name", cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
  { key: "email", header: "Email", cell: (r) => <span className="text-xs text-muted-foreground">{r.email}</span> },
  { key: "role", header: "Workspace Role", cell: (r) => <span className="text-xs font-semibold">{r.role}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "joinedAt", header: "Joined", cell: (r) => <span className="text-xs text-muted-foreground">{r.joinedAt}</span> },
];

function TeamPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Team & Access Control"
        description="Manage workspace members, role-based privileges, and authorization approvers."
        actions={
          <Button className="rounded-full">
            <UserPlus className="mr-1.5 size-4" /> Invite Member
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={TEAM} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

