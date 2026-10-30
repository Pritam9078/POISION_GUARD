import { createFileRoute } from "@tanstack/react-router";
import { Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { TEAM, type TeamMember } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

const cols: Column<TeamMember>[] = [
  { key: "name", header: "User", cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
  { key: "email", header: "Email Address", cell: (r) => <span className="text-xs text-muted-foreground">{r.email}</span> },
  { key: "role", header: "Role", cell: (r) => <span className="text-xs font-semibold">{r.role}</span> },
  { key: "status", header: "Account Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "joinedAt", header: "Registration Date", cell: (r) => <span className="text-xs text-muted-foreground">{r.joinedAt}</span> },
];

function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Global platform users, authentication state, account status, and privilege levels."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={TEAM} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

