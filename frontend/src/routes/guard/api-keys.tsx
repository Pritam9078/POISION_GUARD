import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Key, Plus, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";

export const Route = createFileRoute("/guard/api-keys")({
  component: ApiKeysPage,
});

const DEMO_KEYS = [
  { id: "key_live_9a8f2c", label: "Production Scanner API", prefix: "pg_live_9a8f…", created: "2026-09-12", lastUsed: "10 mins ago", status: "active" },
  { id: "key_test_3b1d5e", label: "Staging Test Key", prefix: "pg_test_3b1d…", created: "2026-10-01", lastUsed: "2 days ago", status: "active" },
];

function ApiKeysPage() {
  const [copied, setCopied] = useState("");

  const handleCopy = (id: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys & Webhooks"
        description="Programmatic credentials to integrate address similarity checks and approval audits into your pipeline."
        actions={
          <Button className="rounded-full">
            <Plus className="mr-1.5 size-4" /> Create API Key
          </Button>
        }
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <h3 className="font-display text-base font-medium">Active API Keys</h3>
        <div className="mt-4 divide-y">
          {DEMO_KEYS.map((k) => (
            <div key={k.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium text-sm text-foreground">{k.label}</div>
                <div className="font-mono text-xs text-muted-foreground mt-0.5">{k.prefix}</div>
                <div className="text-[11px] text-muted-foreground mt-1">Created {k.created} · Last active {k.lastUsed}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={k.status} />
                <Button
                  onClick={() => handleCopy(k.id, k.prefix)}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                >
                  <Copy className="mr-1.5 size-3" />
                  {copied === k.id ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <DemoDataNote />
    </div>
  );
}

