import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/pg/public-layout";
import { PageHeader, DemoDataNote } from "@/components/pg/kit";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
  head: () => ({
    meta: [
      { title: "Privacy — PoisonGuard" },
      { name: "description", content: "How PoisonGuard handles wallet addresses, scan data, retention and third-party providers." },
      { property: "og:title", content: "Privacy — PoisonGuard" },
      { property: "og:description", content: "Wallet-address handling, scan retention, sharing and third-party provider usage." },
      { property: "og:type", content: "website" },
    ],
  }),
});

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "What we collect",
    p: [
      "For public scans: the address or transaction hash you submit, the network, the time of the request, and the resulting analysis. No wallet connection is required for read-only analysis.",
      "For Guard accounts: your email, name, workspace membership, and the workspace content you add (watched wallets, trusted recipients, agents, policies, intents, approvals and audit records).",
    ],
  },
  {
    h: "Wallet addresses",
    p: [
      "Wallet addresses are public blockchain data. We process them to produce findings and evidence. We never request private keys or seed phrases, and you should never enter them anywhere in this product.",
    ],
  },
  {
    h: "Retention",
    p: [
      "Public scan results are retained for a limited window (default 90 days) to power repeat lookups and false-positive review, then deleted. Workspace records are retained while your workspace is active; deletion of the workspace removes its records.",
      "Audit records are retained per your workspace retention settings, because they are required for tamper-evident verification.",
    ],
  },
  {
    h: "Sharing",
    p: [
      "Scan results are private by default. A shared report is created only when you explicitly create a share link; share identifiers are random, links can be revoked, and shares can carry an expiration. Shared reports contain only the fields shown on the share page — never your workspace internals.",
    ],
  },
  {
    h: "Third-party providers",
    p: [
      "Analysis queries third-party RPC nodes and transfer indexers. When configured, threat-intel feeds and AI explanation providers are used under a versioned contract; an unconfigured provider is surfaced as unavailable, never simulated.",
      "We do not sell personal data, and provider credentials are stored only server-side.",
    ],
  },
  {
    h: "Your choices",
    p: [
      "You can delete your account and workspace from Settings (in the full product), which removes workspace records. You can request deletion of a specific scan report by contacting us through the Report page.",
    ],
  },
];

function Privacy() {
  return (
    <PublicLayout>
      <div className="py-10">
        <PageHeader title="Privacy" description="How PoisonGuard handles data. Last updated 2026-10-29." />
        <div className="max-w-3xl space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="font-display text-lg font-medium tracking-tight">{s.h}</h2>
              {s.p.map((para, i) => (
                <p key={i} className="mt-2 text-sm leading-relaxed text-muted-foreground">{para}</p>
              ))}
            </section>
          ))}
          <DemoDataNote />
        </div>
      </div>
    </PublicLayout>
  );
}
