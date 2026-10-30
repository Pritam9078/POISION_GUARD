import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Code2, Terminal, Key, ShieldCheck, ArrowRight, ExternalLink } from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/docs")({
  component: DocsPage,
  head: () => ({
    meta: [
      { title: "Documentation & API Reference — PoisonGuard" },
      { name: "description", content: "Integrate PoisonGuard address poisoning detection and approval inspection into wallets, bots, and dApps." },
    ],
  }),
});

const DOCS_SECTIONS = [
  {
    title: "Getting Started",
    icon: BookOpen,
    items: [
      {
        id: "quickstart",
        title: "Quickstart Overview",
        content: `PoisonGuard provides a REST API and Web3 SDK to analyze destination addresses, compute edit distances against past counterparties, and verify ERC-20 allowances before users sign transactions.`,
      },
      {
        id: "architecture",
        title: "Core Architecture",
        content: `The detection engine operates a 4-tier pipeline:
1. Address similarity & Levenshtein byte divergence
2. High-throughput zero-value and dust transfer clustering
3. Spender deployment lineage & shared funding graphs
4. Transparent coverage and confidence disclosure`,
      },
    ],
  },
  {
    title: "API Reference",
    icon: Code2,
    items: [
      {
        id: "post-scans",
        title: "POST /api/v1/scans",
        content: `Submits an address or transaction hash for forensic analysis.
Request:
{
  "inputType": "address",
  "chainId": 1,
  "subject": "0x7a9e4f3b1c2d5e6f8091a2b3c4d5e6f708192a3b",
  "contextTxHash": "0x9f2c... (optional)"
}

Response (200 OK):
{
  "id": "SC-2026-0412",
  "status": "completed",
  "riskScore": 78,
  "riskLabel": "high",
  "findings": [...]
}`,
      },
      {
        id: "post-recipients",
        title: "POST /api/v1/recipients/check",
        content: `Compares a recipient against known legitimate counterparties to flag vanity address poisoning.
Request:
{
  "chainId": 1,
  "address": "0x7a9e...2a3d",
  "expectedLabel": "Vitalik"
}`,
      },
    ],
  },
  {
    title: "Wallet Integration",
    icon: Terminal,
    items: [
      {
        id: "pre-send",
        title: "Pre-Send Verification Hook",
        content: `Integrate PoisonGuard into your wallet's pre-send modal to alert users whenever a clipboard or history paste resembles a known contact with middle-byte divergence.`,
      },
    ],
  },
];

function DocsPage() {
  const [activeItem, setActiveItem] = useState("quickstart");

  const currentItem = DOCS_SECTIONS.flatMap((s) => s.items).find((i) => i.id === activeItem);

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="text-center sm:text-left">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
            Developer Documentation
          </Badge>
          <h1 className="mt-3 font-display text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            API Documentation & <br className="hidden sm:inline" />
            <span className="text-muted-foreground">Developer Guides.</span>
          </h1>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-4">
          {/* Sidebar */}
          <div className="space-y-6 lg:border-r lg:pr-6">
            {DOCS_SECTIONS.map((sec) => (
              <div key={sec.title}>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <sec.icon className="size-3.5" />
                  {sec.title}
                </div>
                <div className="mt-2 space-y-1">
                  {sec.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveItem(item.id)}
                      className={`block w-full rounded-full px-3 py-1.5 text-left text-xs transition-colors ${
                        activeItem === item.id
                          ? "bg-primary font-medium text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="lg:col-span-3">
            {currentItem && (
              <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
                <h2 className="font-display text-2xl font-medium">{currentItem.title}</h2>
                <div className="my-4 h-px bg-border" />
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {currentItem.content}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

