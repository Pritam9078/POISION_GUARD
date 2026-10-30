import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldAlert,
  ShieldCheck,
  Share2,
  Flag,
  FileSearch,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SCANS, scanById, type Scan, type Finding } from "@/lib/fixtures";
import { SeverityBadge, AddressDisplay, DemoDataNote } from "@/components/pg/kit";
import { submitFeedback } from "@/lib/api";

export const Route = createFileRoute("/scan/$scanId")({
  component: ScanResultPage,
});

const TABS = [
  "Overview",
  "Poisoning Analysis",
  "Token Approvals",
  "Transactions",
  "Evidence",
  "Data Coverage",
  "Recommendations",
] as const;

type TabKey = (typeof TABS)[number];

export function ScanResultPage() {
  const { scanId } = Route.useParams();
  const [tab, setTab] = useState<TabKey>("Overview");
  const [feedback, setFeedback] = useState("");
  const [fbMsg, setFbMsg] = useState("");
  const [fbBusy, setFbBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  const scan: Scan = scanById(scanId) ?? SCANS[0]!;

  const findings = scan.findings || [];
  const poisoningFindings = findings.filter(
    (f) => f.category.toLowerCase().includes("poison") || f.category.toLowerCase().includes("dust"),
  );
  const approvalFindings = findings.filter((f) => f.category.toLowerCase().includes("approval"));

  const handleFeedback = async () => {
    if (feedback.trim().length < 10) return;
    setFbBusy(true);
    try {
      const res = await submitFeedback({
        scanRef: scan.id,
        chainId: 1,
        subject: scan.subject,
        category: "false_positive",
        explanation: feedback,
      });
      setFbMsg(`Report submitted for review (${res.id}).`);
      setFeedback("");
    } catch (err: any) {
      setFbMsg(err.message || "Failed to submit report.");
    } finally {
      setFbBusy(false);
    }
  };

  const handleShare = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setShareMsg("Share link copied to clipboard!");
      setTimeout(() => setShareMsg(""), 3000);
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{scan.id}</span>
              <Badge variant={scan.riskLabel === "high" ? "destructive" : "secondary"} className="rounded-full">
                {scan.status}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {scan.network}
              </Badge>
            </div>
            <h1 className="mt-2 font-display text-2xl font-light tracking-tight text-foreground sm:text-4xl">
              Scan Analysis: <span className="font-mono text-base font-normal sm:text-2xl">{scan.subject}</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Requested {scan.requestedAt} · Completed {scan.completedAt}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleShare} variant="outline" size="sm" className="rounded-full">
              <Share2 className="mr-1.5 size-3.5" />
              Share Report
            </Button>
            {shareMsg && <span className="text-xs text-emerald-600 dark:text-emerald-400">{shareMsg}</span>}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-8 flex flex-wrap gap-1.5 border-b pb-3">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {tab === "Overview" && (
            <div className="space-y-6">
              <div className="rounded-3xl border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Risk Verdict
                  </span>
                  <SeverityBadge
                    severity={
                      scan.riskLabel === "elevated"
                        ? "medium"
                        : scan.riskLabel === "inconclusive"
                        ? "info"
                        : scan.riskLabel
                    }
                  />
                </div>
                <p className="mt-3 text-base text-foreground">{scan.summary}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Notice: Findings indicate observed patterns and risks, not proof that the address owner is malicious.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-display text-lg font-medium">Recorded Findings ({findings.length})</h3>
                {findings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                    No findings recorded. This does not mean the subject is guaranteed safe — see Data Coverage.
                  </div>
                ) : (
                  findings.map((f) => <FindingCard key={f.id} finding={f} />)
                )}
              </div>
            </div>
          )}

          {tab === "Poisoning Analysis" && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-medium">Address-Poisoning & Dust Findings</h3>
              {poisoningFindings.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                  No address-poisoning patterns detected within available transaction history.
                </div>
              ) : (
                poisoningFindings.map((f) => <FindingCard key={f.id} finding={f} />)
              )}
            </div>
          )}

          {tab === "Token Approvals" && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-medium">Token Approvals Analysis</h3>
              {approvalFindings.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                  No risky token approvals recorded for this subject.
                </div>
              ) : (
                approvalFindings.map((f) => <FindingCard key={f.id} finding={f} />)
              )}
            </div>
          )}

          {tab === "Transactions" && (
            <div className="rounded-3xl border bg-card p-6 shadow-sm">
              <h3 className="font-display text-lg font-medium">Observed Interactions & Transfers</h3>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 pr-4">Tx Hash</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">From</th>
                      <th className="py-2">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2.5 pr-4 text-primary">0x9f2c…0f2b</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">Zero-value ERC20</td>
                      <td className="py-2.5 pr-4">0x7a9e…2a3d (attacker)</td>
                      <td className="py-2.5">0.00 USDC</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-4 text-primary">0x3b1c…4a6d</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">Normal transfer</td>
                      <td className="py-2.5 pr-4">0xd8da…6045 (counterparty)</td>
                      <td className="py-2.5">14.50 ETH</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "Evidence" && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-medium">Cryptographic & Forensic Evidence</h3>
              {findings.flatMap((f) =>
                f.evidence.map((ev, idx) => (
                  <div key={`${f.id}-${idx}`} className="rounded-2xl border bg-card p-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{ev.label}</span>
                      <span className="text-muted-foreground">Source: {ev.source}</span>
                    </div>
                    <pre className="mt-2 font-mono text-xs text-muted-foreground">{ev.value}</pre>
                  </div>
                )),
              )}
            </div>
          )}

          {tab === "Data Coverage" && (
            <div className="rounded-3xl border bg-card p-6 shadow-sm">
              <h3 className="font-display text-lg font-medium">Indexer & Node Data Coverage</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                PoisonGuard explicitly discloses data provider coverage bounds for every scan:
              </p>
              <div className="mt-4 divide-y">
                {scan.coverage.map((c) => (
                  <div key={c.source} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-medium">{c.source}</div>
                      <div className="text-xs text-muted-foreground">{c.note}</div>
                    </div>
                    <Badge variant={c.status === "covered" ? "secondary" : "outline"} className="rounded-full text-xs">
                      {c.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "Recommendations" && (
            <div className="rounded-3xl border bg-card p-6 shadow-sm">
              <h3 className="font-display text-lg font-medium">Actionable Next Steps</h3>
              <div className="mt-4 space-y-3">
                {findings.map((f) => (
                  <div key={f.id} className="rounded-2xl border bg-muted/30 p-4">
                    <div className="text-xs font-semibold text-foreground">{f.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{f.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* False Positive & Community Feedback Box */}
          <div className="mt-8 rounded-3xl border bg-card p-6 shadow-sm">
            <h3 className="font-display text-base font-medium">Report an issue with this scan</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Think a finding is a false positive or vanity address? Submit an explanation for automated test-suite review.
            </p>
            <div className="mt-4">
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Explain why this finding should be re-evaluated..."
                rows={3}
                className="rounded-2xl"
              />
            </div>
            {fbMsg && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{fbMsg}</p>}
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleFeedback}
                disabled={fbBusy || feedback.trim().length < 10}
                variant="outline"
                className="rounded-full"
              >
                {fbBusy ? "Submitting…" : "Submit Review Report"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <div className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={finding.severity} />
          <h4 className="font-medium text-foreground">{finding.title}</h4>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{finding.id}</span>
      </div>
      <p className="mt-2 text-sm text-foreground">{finding.summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Method: {finding.method}</span>
        {finding.confidence && <span>Confidence: {finding.confidence}%</span>}
      </div>
      {finding.limitations && (
        <div className="mt-3 rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <strong>Limitation:</strong> {finding.limitations}
        </div>
      )}
    </div>
  );
}
