import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/guard/knowledge")({
  component: KnowledgePage,
});

interface KnowledgeDoc {
  id: string;
  title: string;
  type?: string;
  category?: string;
  status?: string;
  source: string;
  addedBy?: string;
  addedAt: string;
  size?: string;
  chunks?: number;
}

const cols: Column<KnowledgeDoc>[] = [
  { key: "title", header: "Document Title", cell: (r) => <span className="font-medium text-foreground">{r.title}</span> },
  { key: "type", header: "Category", cell: (r) => <span className="text-xs">{r.category || r.type || "General"}</span> },
  { key: "source", header: "Ingestion Source", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.source}</span> },
  { key: "status", header: "Indexing Status", cell: (r) => <StatusBadge status={r.status || "active"} /> },
  {
    key: "addedAt",
    header: "Date Added",
    cell: (r) => <span className="text-xs text-muted-foreground">{new Date(r.addedAt).toLocaleDateString()}</span>,
  },
];

function KnowledgePage() {
  const { session } = useDemoAuth();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Security Runbook");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;

  const loadDocs = () => {
    if (!wsId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api<{ items: KnowledgeDoc[] }>(`/workspaces/${encodeURIComponent(wsId)}/knowledge`)
      .then((res) => setDocs(res.items || []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDocs();
  }, [wsId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsId) return;
    if (content.length < 20) {
      toast.error("Document content must be at least 20 characters.");
      return;
    }
    setSaving(true);
    try {
      await api(`/workspaces/${encodeURIComponent(wsId)}/knowledge`, {
        method: "POST",
        body: {
          title: title.trim(),
          category: category.trim(),
          source: "Manual Ingestion",
          accessScope: "members",
          content: content.trim(),
        },
      });
      toast.success("Document added and enqueued for RAG chunking.");
      setOpen(false);
      setTitle("");
      setContent("");
      loadDocs();
    } catch (err: any) {
      toast.error(err.message || "Failed to add document.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base (RAG)"
        description="Ingested security runbooks, threat intelligence feeds, and policy documentation indexed for semantic AI search."
        actions={
          <Button className="rounded-full" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 size-4" /> Add Document
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading knowledge documents…</div>
        ) : docs.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto size-8 text-muted-foreground/60" />
            <h4 className="mt-3 text-sm font-medium text-foreground">No documents indexed</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Add operational runbooks, treasury guidelines, or internal security standards to power workspace AI assistance.
            </p>
            <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => setOpen(true)}>
              <Upload className="mr-1.5 size-3.5" /> Ingest Runbook
            </Button>
          </div>
        ) : (
          <DataTable columns={cols} rows={docs} rowKey={(r) => r.id} />
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Add Knowledge Document</DialogTitle>
              <DialogDescription>
                Provide internal guidance for the workspace assistant. Documents are chunked and embedded with strict role-based access.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="doc-title">Title</Label>
                <Input
                  id="doc-title"
                  placeholder="e.g. Treasury Operations & Multi-sig Runbook"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-category">Category</Label>
                <Input
                  id="doc-category"
                  placeholder="e.g. Policy, Runbook, Architecture"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-content">Content / Markdown (min 20 characters)</Label>
                <Textarea
                  id="doc-content"
                  placeholder="Paste security instructions, emergency procedures, or recipient rules..."
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Ingesting..." : "Ingest Document"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
