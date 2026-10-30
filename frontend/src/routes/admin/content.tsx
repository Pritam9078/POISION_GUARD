import { createFileRoute } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { ADMIN_CONTENT } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/content")({
  component: AdminContentPage,
});

interface ContentRow {
  id: string;
  type: string;
  title: string;
  status: string;
  updatedAt: string;
  note: string;
}

const cols: Column<ContentRow>[] = [
  { key: "title", header: "Document / Page", cell: (r) => <span className="font-medium text-foreground">{r.title}</span> },
  { key: "type", header: "Content Type", cell: (r) => <span className="text-xs">{r.type}</span> },
  { key: "status", header: "Publication Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "updatedAt", header: "Last Edited", cell: (r) => <span className="text-xs text-muted-foreground">{r.updatedAt}</span> },
  { key: "note", header: "Release Note", cell: (r) => <span className="text-xs text-muted-foreground">{r.note || "—"}</span> },
];

function AdminContentPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Management"
        description="Public methodology explanations, legal terms, security playbooks, and accuracy benchmark updates."
        actions={
          <Button className="rounded-full">
            <Plus className="mr-1.5 size-4" /> New Content Page
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={ADMIN_CONTENT} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

