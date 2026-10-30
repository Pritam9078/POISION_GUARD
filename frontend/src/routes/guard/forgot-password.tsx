import { createFileRoute } from "@tanstack/react-router";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/pg/kit";

export const Route = createFileRoute("/guard/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    // Demo build: no mail delivery exists yet. Real flow sends a reset link
    // with redirectTo /guard/reset-password.
    toast.success("If that address is registered, a reset link is on its way (demo — no email is sent).");
    navigate({ to: "/guard/login" });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="aurora-strong" />
      <div className="relative w-full max-w-md rounded-3xl border bg-card p-8">
        <Logo />
        <h1 className="mt-6 font-display text-2xl font-medium tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">We'll email you a link to set a new password.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="f-email">Email</Label>
            <Input id="f-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
          </div>
          <Button type="submit" className="w-full rounded-full">Send reset link</Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link to="/guard/login" className="font-medium text-foreground underline-offset-4 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
