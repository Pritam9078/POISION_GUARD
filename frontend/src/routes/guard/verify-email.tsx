import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/pg/kit";

export const Route = createFileRoute("/guard/verify-email")({
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) {
      setVerified(true);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="aurora" />
      <div className="relative w-full max-w-md rounded-3xl border bg-card p-8 shadow-sm text-center">
        <Logo to="/" />
        <div className="mx-auto mt-6 flex size-12 items-center justify-center rounded-full bg-secondary">
          <Mail className="size-6 text-foreground" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-medium tracking-tight">Verify your email</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a 6-digit verification code to your email. Enter it below to activate your account.
        </p>

        {verified ? (
          <div className="mt-6 rounded-2xl bg-emerald-500/10 p-5 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="mx-auto size-6" />
            <h3 className="mt-2 text-sm font-medium">Email Verified</h3>
            <p className="mt-1 text-xs text-muted-foreground">Your account has been confirmed.</p>
            <Button asChild className="mt-4 w-full rounded-full">
              <Link to="/guard/overview">Enter Workspace</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            <div>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="text-center font-mono text-2xl tracking-widest rounded-full"
                required
              />
            </div>
            <Button type="submit" disabled={code.length !== 6} className="w-full rounded-full py-6">
              Confirm Verification
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

