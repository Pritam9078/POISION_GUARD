import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, ArrowRight, KeyRound, AlertTriangle, ExternalLink } from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/recovery")({
  component: RecoveryPage,
  head: () => ({
    meta: [
      { title: "Incident Recovery Guidance — PoisonGuard" },
      { name: "description", content: "Step-by-step checklist and incident response actions if your wallet interacted with a suspicious address or malicious approval." },
    ],
  }),
});

const STEPS = [
  {
    num: "01",
    title: "Stop interacting with the suspicious address & site",
    desc: "Do not send follow-up transactions to test. Do not sign any further signature requests or permit messages from the affected dApp.",
  },
  {
    num: "02",
    title: "Review and revoke token approvals immediately",
    desc: "Use the PoisonGuard Revoke tool to audit unlimited allowances and submit zero-allowance transactions from a secure, clean device.",
    action: { label: "Go to Revoke tool", to: "/revoke" },
  },
  {
    num: "03",
    title: "Move remaining uncompromised assets to a fresh wallet",
    desc: "If you suspect seed phrase or private key exposure, transfer tokens, NFTs, and stakes to a clean cold hardware wallet or newly generated vault.",
  },
  {
    num: "04",
    title: "Preserve transaction hashes & counterparty evidence",
    desc: "Record exact transaction hashes, timestamped screenshots, and dApp URLs. Submit a threat report to help poison detection networks update cluster definitions.",
    action: { label: "Report threat evidence", to: "/report" },
  },
  {
    num: "05",
    title: "Understand blockchain finality & recovery limits",
    desc: "Completed on-chain blockchain transfers are mathematically irreversible. Beware of 'recovery services' or Telegram/Discord DMs offering to retrieve stolen crypto — all such solicitations are secondary scams.",
  },
];

function RecoveryPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
            Incident Playbook
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-light tracking-tight text-foreground sm:text-5xl">
            Incident recovery guidance <br className="hidden sm:inline" />
            <span className="text-muted-foreground">and containment steps.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            If you inadvertently sent funds to a lookalike address or signed a malicious permit allowance, act immediately following these steps.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {STEPS.map((step) => (
            <div key={step.num} className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className="font-mono text-2xl font-light text-muted-foreground">{step.num}</span>
                  <div>
                    <h3 className="font-display text-lg font-medium">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
                {step.action && (
                  <Button asChild variant="outline" className="shrink-0 rounded-full sm:self-center">
                    <Link to={step.action.to as any}>
                      {step.action.label}
                      <ArrowRight className="ml-1.5 size-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}

