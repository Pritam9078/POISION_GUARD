import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ShieldCheck, ArrowRight, Zap, Building2, Sparkles } from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing & Plans — PoisonGuard" },
      { name: "description", content: "Transparent pricing for individual DeFi users, on-chain teams, and autonomous AI-agent workflows." },
    ],
  }),
});

const TIERS = [
  {
    name: "Free",
    id: "free",
    price: "$0",
    period: "forever",
    description: "Essential lookalike detection & approval checks for everyday DeFi users.",
    features: [
      "Up to 25 address & tx scans / day",
      "Prefix / suffix divergence analysis",
      "Manual ERC-20 approval revoker",
      "Basic EVM chain coverage (Ethereum, Base, Arbitrum)",
      "Community threat reporting",
    ],
    cta: "Start Free",
    to: "/",
    popular: false,
  },
  {
    name: "Pro",
    id: "pro",
    price: "$29",
    period: "per month",
    description: "Real-time watched wallet monitoring and zero-latency alerts for active traders.",
    features: [
      "Unlimited manual address scans",
      "Up to 5 watched wallets with real-time dust monitoring",
      "Instant Telegram & Webhook alerts",
      "Full coverage: Polygon, Optimism & BNB Chain",
      "Unlimited token approval audits & batch revokes",
      "Evidence export & forensic PDF receipts",
    ],
    cta: "Get Pro",
    to: "/guard/register",
    popular: true,
  },
  {
    name: "Business (Guard Team)",
    id: "business",
    price: "$199",
    period: "per month",
    description: "Multi-seat workspace governance, AI agent spending limits, and dual approvals.",
    features: [
      "Includes 10 team seats with granular roles",
      "Up to 25 watched team wallets",
      "Autonomous AI agent spend governance & intent policies",
      "Human-in-the-loop multi-sig approval workflows",
      "Tamper-evident hash-chain audit logs",
      "Priority RPC & 99.9% indexer SLA",
    ],
    cta: "Start Team Trial",
    to: "/guard/register",
    popular: false,
  },
  {
    name: "Enterprise",
    id: "enterprise",
    price: "Custom",
    period: "annual billing",
    description: "Dedicated indexer clusters, customized heuristic models, and 24/7 incident SLA.",
    features: [
      "Unlimited wallets, agents, and team members",
      "Dedicated high-throughput EVM RPC & transfer indexers",
      "Custom detection rule pipelines & threat-intel ingestion",
      "On-premise / private cloud deployment option",
      "24/7 emergency incident response & dedicated Slack channel",
      "SOC 2 compliance reports & formal vendor agreement",
    ],
    cta: "Contact Sales",
    to: "/about",
    popular: false,
  },
];

function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
            Transparent Subscription
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-light tracking-tight text-foreground sm:text-5xl">
            Predictable security, <br className="hidden sm:inline" />
            <span className="text-muted-foreground">scalable protection.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            From single-wallet scans to multi-agent treasury governance. Powered by Dodo Payments.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`relative flex flex-col justify-between rounded-3xl border bg-card p-6 shadow-sm transition-all ${
                tier.popular ? "border-primary/50 shadow-md ring-1 ring-primary/20" : ""
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="rounded-full bg-primary text-primary-foreground text-[10px] uppercase font-semibold">
                    Most Popular
                  </Badge>
                </div>
              )}

              <div>
                <h3 className="font-display text-xl font-medium">{tier.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-light">{tier.price}</span>
                  <span className="text-xs text-muted-foreground">{tier.period}</span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{tier.description}</p>

                <div className="my-6 h-px bg-border" />

                <ul className="space-y-2.5 text-xs text-foreground">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className="size-3.5 shrink-0 text-emerald-600 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <Button
                  asChild
                  variant={tier.popular ? "default" : "outline"}
                  className="w-full rounded-full text-xs font-medium"
                >
                  <Link to={tier.to as any}>{tier.cta}</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}

