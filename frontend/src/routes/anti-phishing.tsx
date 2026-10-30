import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Eye, Bookmark, AlertTriangle, ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/anti-phishing")({
  component: AntiPhishingPage,
  head: () => ({
    meta: [
      { title: "Anti-Phishing & Address Verification — PoisonGuard" },
      { name: "description", content: "Essential security guidelines to avoid address poisoning, clipboard hijacking, and social engineering." },
    ],
  }),
});

const RULES = [
  {
    icon: Eye,
    title: "Compare the middle characters, not just the ends",
    desc: "Attackers routinely generate vanity addresses with identical 4–6 character prefixes and suffixes. Always verify at least 8 to 12 middle characters of any destination address before hitting send.",
  },
  {
    icon: Bookmark,
    title: "Never copy destination addresses from transaction history",
    desc: "History-poisoning attacks rely on you copying a lookalike address from your recent transaction feed. Always copy addresses directly from verified address books or QR codes verified out-of-band.",
  },
  {
    icon: ShieldCheck,
    title: "Verify hardware wallet screens byte-by-byte",
    desc: "Malware on your workstation or mobile device can hijack your clipboard or alter browser DOM. Only what is displayed on your physical hardware wallet screen is cryptographically signed.",
  },
  {
    icon: AlertTriangle,
    title: "PoisonGuard will never ask for your seed phrase",
    desc: "No legitimate security protocol, wallet validator, or platform ever requires private keys or recovery words. Any prompt requesting 12 or 24 words is guaranteed theft.",
  },
];

function AntiPhishingPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
            Defense Best Practices
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-light tracking-tight text-foreground sm:text-5xl">
            Anti-phishing and <br className="hidden sm:inline" />
            <span className="text-muted-foreground">safe address verification.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Address poisoning exploits human cognitive shortcuts. Here is how to make lookalike spoofing ineffective.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {RULES.map((rule) => (
            <div key={rule.title} className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
                <rule.icon className="size-5 text-foreground" />
              </div>
              <h3 className="mt-5 font-display text-lg font-medium">{rule.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{rule.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-3xl border bg-card p-6 text-center sm:p-8">
          <h3 className="font-display text-lg font-medium">Verify a recipient before you transfer</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Test any address against our similarity engine and known poisoner databases in seconds.
          </p>
          <Button asChild className="mt-6 rounded-full px-8">
            <Link to="/check-recipient">
              Open Recipient Checker
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}

