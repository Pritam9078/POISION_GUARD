import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/pg/public-layout";
import { PageHeader, DemoDataNote } from "@/components/pg/kit";

export const Route = createFileRoute("/terms")({
  component: Terms,
  head: () => ({
    meta: [
      { title: "Terms of Service — PoisonGuard" },
      { name: "description", content: "PoisonGuard terms of service: acceptable use, no warranty of safety, demo status." },
      { property: "og:title", content: "Terms of Service — PoisonGuard" },
      { property: "og:description", content: "The rules for using PoisonGuard. Analysis, not advice; no warranty of safety." },
      { property: "og:type", content: "website" },
    ],
  }),
});

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "1. What PoisonGuard does",
    p: [
      "PoisonGuard analyzes wallet addresses, transactions and token approvals for evidence of address-poisoning and related risks, and governs authorized spending by automated agents. It provides risk analysis and workflow tooling.",
      "PoisonGuard does not custody funds, execute transactions on your behalf, or provide financial, legal or tax advice.",
    ],
  },
  {
    h: "2. No guarantee of safety",
    p: [
      "Risk analysis is evidence-based and incomplete by nature. Absence of findings is not proof that an address, transaction or recipient is safe. Coverage limitations are shown with every result and must be read.",
      "We do not warrant that detection is complete, accurate or uninterrupted, and we do not promise recovery of lost funds. Completed blockchain transfers may be irreversible.",
    ],
  },
  {
    h: "3. Your responsibilities",
    p: [
      "Verify recipients independently before sending funds. Keep your keys and seed phrases private — PoisonGuard will never ask for them. Review approvals before signing anything in your wallet.",
      "Do not use the service for unlawful purposes, and do not attempt to circumvent rate limits, authorization checks or tenant isolation.",
    ],
  },
  {
    h: "4. Accounts and workspaces",
    p: [
      "You are responsible for the accuracy of workspace data, the conduct of members you invite, and the credentials you issue to agents. Roles and permissions are enforced server-side; do not rely on the interface alone.",
    ],
  },
  {
    h: "5. Third-party data",
    p: [
      "Analysis relies on third-party RPC nodes, indexers and (where configured) threat-intel providers. Their availability and accuracy are outside our control, and outages are surfaced as coverage limitations rather than hidden.",
    ],
  },
  {
    h: "6. Liability",
    p: [
      "To the maximum extent permitted by law, PoisonGuard is not liable for losses arising from blockchain transactions, missed detections, or reliance on analysis output. Nothing in these terms claims the product is audited, insured or certified.",
    ],
  },
  {
    h: "7. Changes",
    p: [
      "These terms may be updated; material changes will be announced in the product. The version in effect applies to your use of the service.",
    ],
  },
];

function Terms() {
  return (
    <PublicLayout>
      <div className="py-10">
        <PageHeader title="Terms of Service" description="Plain-language terms for using PoisonGuard. Last updated 2026-10-29." />
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
