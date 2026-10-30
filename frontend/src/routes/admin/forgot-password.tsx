import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/pg/kit";

export const Route = createFileRoute("/admin/forgot-password")({
  component: AdminForgotPasswordPage,
});

function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (email.includes("@")) setSent(true);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="aurora-strong" />
      <div className="relative w-full max-w-md rounded-3xl border bg-card p-8 shadow-sm">
        <Logo to="/" />
        <h1 className="mt-6 font-display text-2xl font-medium tracking-tight">Staff password reset</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your authorized platform email to request a reset link.
        </p>

        {sent ? (
          <div className="mt-6 rounded-2xl bg-emerald-500/10 p-5 text-center text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="mx-auto size-6" />
            <h3 className="mt-2 text-sm font-medium">Reset Link Dispatched</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              If {email} matches an authorized staff profile, reset instructions have been delivered.
            </p>
            <Button asChild className="mt-4 w-full rounded-full">
              <Link to="/admin/login">Return to Sign In</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Staff Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@poisonguard.io"
                className="mt-1.5 rounded-full"
                required
              />
            </div>
            <Button type="submit" className="w-full rounded-full py-6">
              Send Reset Link
            </Button>
            <div className="text-center text-xs text-muted-foreground">
              <Link to="/admin/login" className="hover:underline">Back to staff sign in</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

