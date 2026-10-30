import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  ArrowRight,
  Bot,
  Receipt,
  FileSearch,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Lock,
  Layers,
  ExternalLink,
} from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  NETWORKS,
  SCANS,
  ADDR_SUBJECT,
  ADDR_LOOKALIKE,
  ADDR_LEGIT,
  USER_WALLET,
  TX_SUBJECT,
  type NetworkKey,
} from "@/lib/fixtures";
import {
  SeverityBadge,
  AddressDisplay,
} from "@/components/pg/kit";
import { cn } from "@/lib/utils";
import { OrbScene } from "@/components/pg/orb-scene";

/** Left-aligned hero copy + free-floating orb on the right (two-column balanced hero). */
export function HeroIntro() {
  return (
    <div className="relative mx-auto flex max-w-7xl items-center gap-0 lg:gap-4 xl:gap-6">
      {/* ── Left text column: ~55% ── */}
      <div className="relative z-20 flex w-full shrink-0 flex-col text-left lg:w-[55%] xl:w-[54%]">
        {/* Heading */}
        <h1 className="text-[2.6rem] font-light leading-[1.1] tracking-tight text-foreground sm:text-5xl sm:leading-[1.1] lg:text-[3.4rem] lg:leading-[1.08] xl:text-6xl xl:leading-[1.07]">
          <span className="pg-word-in inline-block" style={{ animationDelay: "100ms" }}>
            Verify before you sign.
          </span>
          <br />
          <span className="relative inline-block mt-1">
            <span className="pg-word-in text-grad inline-block font-normal" style={{ animationDelay: "230ms" }}>
              Never blindly execute.
            </span>
            <span
              className="pg-bar-in absolute -bottom-1.5 left-0 right-0 h-[2.5px] rounded-full bg-gradient-to-r from-primary/50 via-primary/80 to-transparent"
              style={{ animationDelay: "430ms" }}
            />
          </span>
        </h1>

        {/* Description */}
        <p
          className="pg-word-in mt-5 max-w-[42ch] text-base leading-[1.7] text-muted-foreground sm:text-[1.0625rem]"
          style={{ animationDelay: "340ms" }}
        >
          PoisonGuard protects individuals and teams against lookalike addresses, zero-value
          transfer dust attacks, and rogue smart contract approvals — with built-in governance
          for autonomous AI agents.
        </p>

        {/* CTA group — primary + secondary only */}
        <div
          className="pg-word-in mt-7 flex flex-wrap items-center gap-3"
          style={{ animationDelay: "450ms" }}
        >
          <Button asChild size="lg" className="rounded-full px-6 shadow-sm">
            <a href="#scanner">Launch Scanner <ArrowRight className="ml-1.5 size-4" /></a>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full bg-white/60 px-6 backdrop-blur-md">
            <Link to="/guard/login">Open Guard Workspace</Link>
          </Button>
        </div>

        {/* Live Protection — dashed transparent-border pill */}
        <div
          className="pg-word-in mt-6"
          style={{ animationDelay: "560ms" }}
        >
          <div className="inline-flex items-center gap-2.5 rounded-full border border-dashed border-foreground/20 bg-transparent px-4 py-2 text-xs backdrop-blur-sm">
            <span className="font-semibold text-foreground">Live Protection Active</span>
            <span className="text-foreground/25">·</span>
            <span className="text-muted-foreground">Real-time lookalike &amp; zero-value dust detection across 7 EVM networks</span>
          </div>
        </div>
      </div>

      {/* ── Right column: 3D orb, ~45% wide, tall enough to be impactful ── */}
      <div className="relative z-10 hidden shrink-0 items-center justify-center lg:flex lg:w-[45%] xl:w-[46%]">
        {/* Square container — 100% of column width, capped at 580px so it's prominent */}
        <div className="relative h-[480px] w-full max-w-[540px] xl:h-[560px] xl:max-w-[600px]">
          <OrbScene />
        </div>
      </div>

      {/* Mobile-only orb: stacked below text, centered */}
      <div className="relative z-10 mt-8 flex w-full items-center justify-center lg:hidden">
        <div className="h-[300px] w-[300px] sm:h-[380px] sm:w-[380px]">
          <OrbScene />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "PoisonGuard — Wallet Security & Address-Poisoning Protection" },
      {
        name: "description",
        content:
          "Detect address-poisoning attacks, inspect recipient similarity, audit unlimited token approvals, and govern AI-agent spending.",
      },
      {
        property: "og:title",
        content: "PoisonGuard — Wallet Security & Address-Poisoning Protection",
      },
      {
        property: "og:description",
        content:
          "Light, minimal fintech security for modern web3 wallets and AI agent spend governance.",
      },
    ],
  }),
});

function Index() {
  const [network, setNetwork] = useState<NetworkKey>("ethereum");
  const [inputVal, setInputVal] = useState(ADDR_SUBJECT);
  const [scanResult, setScanResult] = useState<(typeof SCANS)[0] | null>(SCANS[0] ?? null);
  const [scanning, setScanning] = useState(false);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      // Pick matching or default demo scan
      const match = SCANS.find((s) => s.subject.toLowerCase() === inputVal.trim().toLowerCase()) ?? SCANS[0] ?? null;
      setScanResult(match);
    }, 450);
  };

  const setSample = (val: string) => {
    setInputVal(val);
    const match = SCANS.find((s) => s.subject.toLowerCase() === val.toLowerCase()) ?? SCANS[0] ?? null;
    setScanResult(match);
  };

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative overflow-x-hidden px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10 lg:px-8 lg:pb-20 lg:pt-12">
        <HeroIntro />

        {/* Live Interactive Scanner Card */}
        <div id="scanner" className="mx-auto mt-10 max-w-4xl sm:mt-12 lg:mt-14">
          <div className="relative rounded-3xl border border-border/70 bg-card/90 p-5 sm:p-8 shadow-xl shadow-black/[0.03] backdrop-blur-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-medium tracking-tight text-foreground">
                  Interactive Risk Scanner
                </h2>
                <p className="text-xs text-muted-foreground">
                  Paste any EVM address or tx hash to analyze lookalike collisions and spender risk.
                </p>
              </div>

              {/* Network Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {NETWORKS.slice(0, 4).map((net) => (
                  <button
                    key={net.key}
                    type="button"
                    onClick={() => setNetwork(net.key)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      network === net.key
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {net.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleScan} className="mt-5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder="Enter 0x... address or transaction hash"
                    className="h-11 rounded-full pl-10 pr-4 text-sm font-mono border-input bg-background/80"
                  />
                </div>
                <Button type="submit" disabled={scanning} className="h-11 rounded-full px-6">
                  {scanning ? "Analyzing..." : "Inspect Risk"}
                </Button>
              </div>
            </form>

            {/* Quick Demo Chips */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Quick tests:</span>
              <button
                type="button"
                onClick={() => setSample(ADDR_SUBJECT)}
                className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-[11px] hover:bg-secondary/80 text-foreground transition-colors"
              >
                Poisoned wallet
              </button>
              <button
                type="button"
                onClick={() => setSample(ADDR_LOOKALIKE)}
                className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-[11px] hover:bg-secondary/80 text-foreground transition-colors"
              >
                Lookalike address
              </button>
              <button
                type="button"
                onClick={() => setSample(ADDR_LEGIT)}
                className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-[11px] hover:bg-secondary/80 text-foreground transition-colors"
              >
                Legitimate recipient
              </button>
              <button
                type="button"
                onClick={() => setSample(USER_WALLET)}
                className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 font-mono text-[11px] hover:bg-primary/20 text-primary transition-colors"
              >
                My wallet (0x2f35...A0a8)
              </button>
            </div>

            {/* Scan Output Panel */}
            {scanResult && (
              <div className="mt-6 rounded-2xl border border-border/80 bg-background/80 p-5 sm:p-7 shadow-xs">
                {/* Header: Target Subject & Risk Meter */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground">
                        Target Subject
                      </span>
                      <SeverityBadge
                        severity={
                          scanResult.riskLabel === "elevated"
                            ? "medium"
                            : scanResult.riskLabel === "inconclusive"
                              ? "info"
                              : scanResult.riskLabel
                        }
                      />
                      <Badge variant="outline" className="rounded-full text-[10px] font-mono capitalize">
                        {scanResult.subjectType}
                      </Badge>
                    </div>
                    <AddressDisplay address={scanResult.subject} />
                  </div>

                  {/* Score Pill / Meter */}
                  <div className="flex items-center gap-4 sm:border-l sm:border-border/60 sm:pl-6">
                    <div className="text-left sm:text-right">
                      <div className="flex items-baseline gap-1 sm:justify-end">
                        <span className="font-display text-4xl font-light tracking-tight text-foreground">
                          {scanResult.riskScore}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">/ 100</span>
                      </div>
                      <div className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mt-0.5">
                        Risk Score
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verdict Summary */}
                {scanResult.summary && (
                  <div className="mt-4 rounded-xl border border-border/50 bg-secondary/40 p-3.5 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">Summary: </span>
                    {scanResult.summary}
                  </div>
                )}

                {/* Findings List */}
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Identified Findings & Indicators ({scanResult.findings.length})
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Ruleset v1.3 · Confidence Weighted
                    </span>
                  </div>

                  {scanResult.findings.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-card p-6 text-center text-xs text-muted-foreground">
                      No poisoning indicators or risky allowances detected in available data. See Data Coverage below.
                    </div>
                  ) : (
                    scanResult.findings.map((finding) => (
                      <div
                        key={finding.id}
                        className="group rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{finding.title}</span>
                              <SeverityBadge severity={finding.severity} />
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {finding.summary}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="rounded-full font-mono text-[11px]">
                              {finding.confidence}% match
                            </Badge>
                          </div>
                        </div>

                        {/* Evidence Chips */}
                        {finding.evidence.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-border/50 pt-3 text-[11px]">
                            {finding.evidence.map((ev, i) => (
                              <div
                                key={i}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/50 px-2.5 py-1 text-muted-foreground font-mono"
                              >
                                <span className="font-medium text-foreground">{ev.label}:</span>
                                <span>{ev.value.length > 32 ? ev.value.slice(0, 16) + "…" + ev.value.slice(-8) : ev.value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer Controls */}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/60 pt-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>Completed {new Date(scanResult.completedAt).toLocaleTimeString()}</span>
                    <span>·</span>
                    <span className="capitalize">{network} Network</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline" className="rounded-full text-xs">
                      <Link to="/scan/$scanId" params={{ scanId: scanResult.id }}>
                        Full Forensic Inspector
                        <ArrowRight className="ml-1.5 size-3" />
                      </Link>
                    </Button>
                    <Button asChild size="sm" className="rounded-full text-xs">
                      <Link to="/guard/overview">
                        Open in Workspace
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Bento Grid Features Section */}
      <section className="relative px-4 py-16 sm:px-6 lg:py-24 border-t border-border/40">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">
              Complete security for modern on-chain operations
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Everything required to safeguard digital asset transfers, audit smart contract allowances, and govern agent spending.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Bento Card 1 */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="size-10 rounded-2xl bg-secondary flex items-center justify-center text-foreground mb-5">
                  <ShieldAlert className="size-5" />
                </div>
                <h3 className="text-lg font-medium tracking-tight text-foreground">
                  Address-Poisoning Detection
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Identifies spoofed lookalike addresses generated by vanity collision scripts and zero-value transfer dust campaigns before you copy them from tx history.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>Edit-distance similarity</span>
                <span className="text-emerald-600 font-medium font-mono">Levenshtein 0.97</span>
              </div>
            </div>

            {/* Bento Card 2 */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="size-10 rounded-2xl bg-secondary flex items-center justify-center text-foreground mb-5">
                  <Bot className="size-5" />
                </div>
                <h3 className="text-lg font-medium tracking-tight text-foreground">
                  AI Agent Spend Governance
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Autonomous agents cannot blindly sign transactions. PoisonGuard validates spend intents against policy rules and routes high-value calls for human approval.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>Dual-key policy gate</span>
                <span className="text-foreground font-medium">Policy simulator</span>
              </div>
            </div>

            {/* Bento Card 3 */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="size-10 rounded-2xl bg-secondary flex items-center justify-center text-foreground mb-5">
                  <Receipt className="size-5" />
                </div>
                <h3 className="text-lg font-medium tracking-tight text-foreground">
                  Token Approval Audit
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Surfaces open <span className="font-mono">uint256.max</span> allowances across Ethereum, Base, and Arbitrum. Pinpoint unverified spenders and revoke risky contracts.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>Allowance inspector</span>
                <span className="text-foreground font-medium">1-click revoke flow</span>
              </div>
            </div>

            {/* Bento Card 4 */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="size-10 rounded-2xl bg-secondary flex items-center justify-center text-foreground mb-5">
                  <Lock className="size-5" />
                </div>
                <h3 className="text-lg font-medium tracking-tight text-foreground">
                  Tamper-Evident Audit Proofs
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Every scan, policy evaluation, and spend decision is immutably chained with SHA-256 hashes, providing verifiable audit trails for compliance.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>Chain integrity</span>
                <span className="font-mono text-emerald-600 font-medium">100% verifiable</span>
              </div>
            </div>

            {/* Bento Card 5 */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="size-10 rounded-2xl bg-secondary flex items-center justify-center text-foreground mb-5">
                  <Layers className="size-5" />
                </div>
                <h3 className="text-lg font-medium tracking-tight text-foreground">
                  Multi-Chain Support
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Native indexing coverage for Ethereum, Base, Arbitrum One, Optimism, Polygon PoS, and BNB Smart Chain with consistent security semantics.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>Chains indexed</span>
                <span className="text-foreground font-medium">6 Major EVM Networks</span>
              </div>
            </div>

            {/* Bento Card 6 */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="size-10 rounded-2xl bg-secondary flex items-center justify-center text-foreground mb-5">
                  <Zap className="size-5" />
                </div>
                <h3 className="text-lg font-medium tracking-tight text-foreground">
                  Read-Only Non-Custodial
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  PoisonGuard never asks for your private keys or seed phrase. All risk assessments operate purely on public mempool and blockchain data.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>Private key exposure</span>
                <span className="text-emerald-600 font-medium">Zero</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Stats Banner */}
      <section className="relative px-4 py-16 sm:px-6 bg-secondary/50 border-t border-border/60">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            <div>
              <div className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">62,000+</div>
              <div className="mt-1 text-xs text-muted-foreground">Transfers scanned</div>
            </div>
            <div>
              <div className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">99.4%</div>
              <div className="mt-1 text-xs text-muted-foreground">Poison detection rate</div>
            </div>
            <div>
              <div className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">0.4s</div>
              <div className="mt-1 text-xs text-muted-foreground">Average analysis latency</div>
            </div>
            <div>
              <div className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">0 Keys</div>
              <div className="mt-1 text-xs text-muted-foreground">Never requires custody</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="rounded-3xl border border-border/80 bg-card p-8 sm:p-12 shadow-md">
            <h2 className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">
              Ready to secure your crypto operations?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
              Sign in to access the complete Guard workspace and platform administration dashboard.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="rounded-full px-6">
                <Link to="/guard/login">Open Guard Workspace</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-6">
                <Link to="/admin/login">Admin Portal</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
