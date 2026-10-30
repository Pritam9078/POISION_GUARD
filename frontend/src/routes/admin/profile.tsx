import { createFileRoute } from "@tanstack/react-router";
import { User, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeading, KeyValue, DemoDataNote } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";

export const Route = createFileRoute("/admin/profile")({
  component: AdminProfilePage,
});

function AdminProfilePage() {
  const { session } = useDemoAuth();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Admin Profile"
        description="Your platform credentials, security session status, and administrative role."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <SectionHeading title="Identity & Permissions" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <KeyValue label="Staff Name">{session?.name || "Platform Staff"}</KeyValue>
          <KeyValue label="Authorized Email">{session?.email || "staff@poisonguard.io"}</KeyValue>
          <KeyValue label="Platform Role">Super Administrator</KeyValue>
          <KeyValue label="Multi-Factor Auth">Enforced (Hardware Key / TOTP)</KeyValue>
          <KeyValue label="Session Expiry">12 hours rolling</KeyValue>
          <KeyValue label="Audit Logging">100% Actor Attestation</KeyValue>
        </div>
      </div>

      <DemoDataNote />
    </div>
  );
}

