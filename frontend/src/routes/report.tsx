import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Flag, CheckCircle2, ShieldAlert } from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { NETWORKS, FALSE_POSITIVE_CATEGORIES } from "@/lib/fixtures";
import { submitFeedback } from "@/lib/api";

export const Route = createFileRoute("/report")({
  component: ReportPage,
  head: () => ({
    meta: [
      { title: "Report a Finding — PoisonGuard" },
      { name: "description", content: "Submit a false positive, missed threat, or suspicious address for human and automated review." },
    ],
  }),
});

function ReportPage() {
  const [scanRef, setScanRef] = useState("");
  const [chainId, setChainId] = useState(1);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("false_positive");
  const [explanation, setExplanation] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [refId, setRefId] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    setRefId("");

    if (explanation.trim().length < 10) {
      setMsg("Please provide at least 10 characters explaining your report.");
      return;
    }

    setBusy(true);
    try {
      const res = await submitFeedback({
        scanRef: scanRef.trim() || undefined,
        chainId: Number(chainId),
        subject: subject.trim(),
        category,
        explanation: explanation.trim(),
        contact: contact.trim() || undefined,
      });
      setRefId(res.id);
      setMsg("Report submitted successfully for analysis.");
    } catch (err: any) {
      setMsg(err.message || "Failed to submit report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
            Community Intelligence
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            Report a finding or <br />
            <span className="text-muted-foreground">flag a false positive.</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We actively evaluate every detection rule against real-world reports. Submit suspicious lookalike activity or contest a scan verdict.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="scanRef" className="text-xs uppercase tracking-wider text-muted-foreground">
                Scan Reference (Optional)
              </Label>
              <Input
                id="scanRef"
                value={scanRef}
                onChange={(e) => setScanRef(e.target.value)}
                placeholder="e.g. SC-2026-0412"
                className="mt-1.5 rounded-full"
              />
            </div>

            <div>
              <Label htmlFor="network" className="text-xs uppercase tracking-wider text-muted-foreground">
                Network
              </Label>
              <select
                id="network"
                value={chainId}
                onChange={(e) => setChainId(Number(e.target.value))}
                className="mt-1.5 flex h-10 w-full rounded-full border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {NETWORKS.map((n) => (
                  <option key={n.chainId} value={n.chainId}>
                    {n.name} (Chain {n.chainId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor="subject" className="text-xs uppercase tracking-wider text-muted-foreground">
              Address or Transaction Hash
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="0x…"
              className="mt-1.5 font-mono text-sm rounded-full"
              required
            />
          </div>

          <div className="mt-4">
            <Label htmlFor="category" className="text-xs uppercase tracking-wider text-muted-foreground">
              Report Category
            </Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-full border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="false_positive">False positive (benign flagged as malicious)</option>
              <option value="missed_threat">Missed threat (malicious address not detected)</option>
              <option value="suspicious_address">Suspicious lookalike cluster</option>
              <option value="provider_issue">RPC / indexer discrepancy</option>
            </select>
          </div>

          <div className="mt-4">
            <Label htmlFor="explanation" className="text-xs uppercase tracking-wider text-muted-foreground">
              Explanation & Evidence
            </Label>
            <Textarea
              id="explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Provide details about why you consider this a false positive or missed poisoning attempt..."
              rows={4}
              className="mt-1.5 rounded-2xl"
              required
            />
          </div>

          <div className="mt-4">
            <Label htmlFor="contact" className="text-xs uppercase tracking-wider text-muted-foreground">
              Contact / Telegram / Email (Optional)
            </Label>
            <Input
              id="contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Optional — in case follow-up is needed"
              className="mt-1.5 rounded-full"
            />
          </div>

          {msg && (
            <div className={`mt-4 rounded-xl p-3 text-xs ${refId ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
              {msg} {refId && <span className="font-mono font-bold">({refId})</span>}
            </div>
          )}

          <Button type="submit" disabled={busy} className="mt-6 w-full rounded-full py-6 text-sm">
            {busy ? "Submitting report…" : "Submit Report"}
          </Button>
        </form>
      </div>
    </PublicLayout>
  );
}

