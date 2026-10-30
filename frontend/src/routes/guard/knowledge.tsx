import { createFileRoute } from "@tanstack/react-router";
import { Landmark, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { KNOWLEDGE_DOCS } from "@/lib/fixtures";

export const Route = createFileRoute("/guard/knowledge")({
  component: KnowledgePage,
});

interface KnowledgeDoc {
  id: string;
  title: string;
  type: string;
  addedAt: string;
  source: string;
}

const cols: Column<KnowledgeDoc>[] = [
  { key: "title", header: "Document Title", cell: (r) => <span className="font-medium text-foreground">{r.title}</span> },
  { key: "type", header: "Type", cell: (r) => <span className="text-xs">{r.type}</span> },
  { key: "source", header: "Ingestion Source", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.source}</span> },
  { key: "addedAt", header: "Date Added", cell: (r) => <span className="text-xs text-muted-foreground">{r.addedAt}</span> },
];

function KnowledgePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base (RAG)"
        description="Ingested security runbooks, threat intelligence feeds, and policy documentation indexed for semantic AI search."
        actions={
          <Button className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Add Document
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={KNOWLEDGE_DOCS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

