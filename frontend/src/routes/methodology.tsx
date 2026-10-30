import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers, ShieldCheck, AlertCircle, FileSearch, CheckCircle2 } from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Badge } from "@/components/ui/badge";
import { METHODOLOGY_VERSIONS } from "@/lib/fixtures";

export const Route = createFileRoute("/methodology")({
  component: MethodologyPage,
  head: () => ({
    meta: [
      { title: "Detection Methodology — PoisonGuard" },
      { name: "description", content: "Evidence-based address poisoning and approval detection principles, layers, and limitations." },
    ],
  }),
});

function MethodologyPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
            Transparent Detection
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-light tracking-tight text-foreground sm:text-5xl">
            Evidence-based methodology, <br className="hidden sm:inline" />
            <span className="text-muted-foreground">never blind trust.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            We explain every finding and explicitly report what could not be verified. Absence of evidence is not evidence of safety.
          </p>
        </div>

        <div className="mt-12 space-y-8">
          <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="font-display text-xl font-medium">Core Detection Principles</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border bg-background p-5">
                <div className="font-medium">1. Prefix & Suffix Divergence</div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Address-poisoning vanity generators create addresses matching the first 4–8 and last 4–6 characters of frequent counter-parties. We calculate Levenshtein distance across byte slices.
                </p>
              </div>

              <div className="rounded-2xl border bg-background p-5">
                <div className="font-medium">2. Zero-Value & Dust Clustering</div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Attackers fund high-throughput wallets that disperse $0 or fractional-cent dust transactions to insert their addresses into victim transaction history.
                </p>
              </div>

              <div className="rounded-2xl border bg-background p-5">
                <div className="font-medium">3. Allowance Spender Lineage</div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Unlimited ERC-20 allowances granted to newly deployed contracts or spenders sharing gas funding with known phishing infrastructure are flagged as critical.
                </p>
              </div>

              <div className="rounded-2xl border bg-background p-5">
                <div className="font-medium">4. Explicit Coverage Bounds</div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  If an indexer or RPC node has incomplete block history or degraded latency, the scan result reports partial coverage rather than an erroneous safe verdict.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="font-display text-xl font-medium">Methodology Version History</h2>
            <div className="mt-6 divide-y">
              {METHODOLOGY_VERSIONS.map((v) => (
                <div key={v.version} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="font-mono text-xs">
                      v{v.version}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{v.releasedAt}</span>
                  </div>
                  <p className="mt-2 text-sm text-foreground">{v.changes}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

