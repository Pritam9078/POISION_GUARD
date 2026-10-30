import { createFileRoute } from "@tanstack/react-router";
import { Bot, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { KNOWLEDGE_DOCS } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/ai-rag")({
  component: AdminAiRagPage,
});

interface RagDocRow {
  id: string;
  title: string;
  type: string;
  addedAt: string;
  source: string;
}

const cols: Column<RagDocRow>[] = [
  { key: "id", header: "Doc ID", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { key: "title", header: "Ingested Knowledge Document", cell: (r) => <span className="font-medium">{r.title}</span> },
  { key: "type", header: "Type", cell: (r) => <span className="text-xs">{r.type}</span> },
  { key: "source", header: "Vector Store Source", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.source}</span> },
  { key: "addedAt", header: "Added Date", cell: (r) => <span className="text-xs text-muted-foreground">{r.addedAt}</span> },
];

function AdminAiRagPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="AI & RAG Management"
        description="Vector embeddings, knowledge source ingestion, reranking models, and retrieval accuracy evaluations."
        actions={
          <Button variant="outline" className="rounded-full">
            <RefreshCw className="mr-1.5 size-4" /> Re-index Vector Store
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

