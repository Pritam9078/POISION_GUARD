import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { HelpCircle, ChevronDown, ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/faq")({
  component: FaqPage,
  head: () => ({
    meta: [
      { title: "Frequently Asked Questions — PoisonGuard" },
      { name: "description", content: "Answers to common questions about address poisoning, token approval revokes, agent spend policies, and billing." },
    ],
  }),
});

interface FaqItem {
  q: string;
  a: string;
}

const CATEGORIES: { name: string; items: FaqItem[] }[] = [
  {
    name: "General",
    items: [
      {
        q: "What is address poisoning?",
        a: "Address poisoning is an attack where a scammer observes your transaction history and generates a vanity address matching the first and last few characters of your frequent contacts. They then send you zero-value or dust transfers so their address appears at the top of your transaction feed, hoping you copy-paste it later.",
      },
      {
        q: "How does PoisonGuard detect poisoning?",
        a: "PoisonGuard compares candidate addresses against your historical counter-parties using Levenshtein byte distances, detects high-velocity zero-value transfer patterns, and identifies known dust-generating wallet clusters across EVM chains.",
      },
      {
        q: "Does a 'safe' scan guarantee no risk?",
        a: "No. Incomplete data is never proof of safety. If an address has no prior history or indexer coverage is partial, PoisonGuard explicitly discloses that no evidence was found, rather than declaring it safe.",
      },
    ],
  },
  {
    name: "Wallets & Revoke",
    items: [
      {
        q: "Does PoisonGuard ask for seed phrases or private keys?",
        a: "Never. PoisonGuard is non-custodial and read-only. For token approval revocations, you connect via standard browser wallet extensions (MetaMask, Rabby, Cake Wallet) and sign zero-allowance transactions yourself.",
      },
      {
        q: "What are unlimited token allowances?",
        a: "When you interact with a DEX or DeFi protocol, it often asks for permission to spend unlimited amounts of your ERC-20 tokens. If that protocol is compromised or a malicious spender is approved, all tokens in your wallet can be drained without a new signature.",
      },
    ],
  },
  {
    name: "Guard Workspace & Agents",
    items: [
      {
        q: "What is AI agent spend governance?",
        a: "PoisonGuard enables teams to deploy autonomous on-chain agents (e.g. trading bots or operational AI) with hard cryptographic policies, maximum spend thresholds, and mandatory human approvals for high-value transactions.",
      },
      {
        q: "What are tamper-evident audit logs?",
        a: "Every scan, policy evaluation, and spend intent is recorded into an append-only hash-chain where each entry commits to the cryptographic hash of the previous record.",
      },
    ],
  },
  {
    name: "Billing & Subscriptions",
    items: [
      {
        q: "How does billing work?",
        a: "Subscriptions are billed through Dodo Payments in USD with support for credit cards and crypto checkout. You can upgrade, downgrade, or cancel anytime from your Guard workspace billing tab.",
      },
    ],
  },
];

function FaqPage() {
  const [activeCat, setActiveCat] = useState("General");
  const [openItems, setOpenItems] = useState<number[]>([0]);

  const toggle = (idx: number) => {
    setOpenItems((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));
  };

  const currentItems = CATEGORIES.find((c) => c.name === activeCat)?.items || [];

  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
            Knowledge & FAQ
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-light tracking-tight text-foreground sm:text-5xl">
            Frequently asked questions, <br className="hidden sm:inline" />
            <span className="text-muted-foreground">plain answers.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Everything you need to know about address poisoning, approvals, workspace governance, and billing.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.name}
              onClick={() => {
                setActiveCat(c.name);
                setOpenItems([0]);
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                activeCat === c.name
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Accordions */}
        <div className="mt-8 space-y-3">
          {currentItems.map((item, idx) => {
            const isOpen = openItems.includes(idx);
            return (
              <div key={item.q} className="rounded-3xl border bg-card p-6 shadow-sm transition-all">
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="flex w-full items-center justify-between text-left font-display text-base font-medium text-foreground"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>}
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-3xl border bg-card p-8 text-center shadow-sm">
          <h3 className="font-display text-lg font-medium">Have a question not covered here?</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            Our security researchers and engineering team are available to help.
          </p>
          <Button asChild variant="outline" className="mt-5 rounded-full px-6">
            <Link to="/about">Contact PoisonGuard Team</Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}

