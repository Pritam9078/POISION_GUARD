import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Shield, Mail, CheckCircle2, Building2, Globe } from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About PoisonGuard — Mission & Team" },
      { name: "description", content: "Building evidence-based wallet security and address poisoning protection for self-custody Web3." },
    ],
  }),
});

function AboutPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
            Company & Mission
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-light tracking-tight text-foreground sm:text-5xl">
            Protecting self-custody <br className="hidden sm:inline" />
            <span className="text-muted-foreground">from address poisoning.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            PoisonGuard was built to solve a critical blind spot in crypto usability: vanity address imitation and clipboard hijacking.
          </p>
        </div>

        <div className="mt-12 space-y-8">
          <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="font-display text-2xl font-medium">Our Core Tenet</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Most Web3 security tools rely on static blocklists or simple black-box safety scores that give users false confidence. PoisonGuard operates on the principle of transparent, evidence-based disclosure: we explain every finding, calculate cryptographic similarity distances, and disclose exactly what indexers could or could not check.
            </p>
          </div>

          <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="font-display text-2xl font-medium">Contact Us</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Questions about institutional integration, enterprise indexers, or security audits?
            </p>

            {submitted ? (
              <div className="mt-6 rounded-2xl bg-emerald-500/10 p-6 text-center text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="mx-auto size-6" />
                <h3 className="mt-2 text-sm font-medium">Message Received</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Thank you for reaching out. A security specialist will follow up shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="rounded-full"
                    required
                  />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="rounded-full"
                    required
                  />
                </div>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we assist you or your organization?"
                  rows={4}
                  className="rounded-2xl"
                  required
                />
                <Button type="submit" className="rounded-full px-6">
                  Send Message
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

