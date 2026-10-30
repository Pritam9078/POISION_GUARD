import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo, DemoDataNote } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";

export const Route = createFileRoute("/guard/register")({
  component: GuardRegister,
});

function GuardRegister() {
  const { signIn } = useDemoAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Enter your full name.");
      return;
    }
    if (!email.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (!accepted) {
      toast.error("Please accept the Terms and Privacy Policy.");
      return;
    }
    setBusy(true);
    setTimeout(() => {
      signIn("guard", email, name.trim());
      toast.success("Account created — demo session active");
      navigate({ to: "/guard/workspaces" });
    }, 350);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="aurora-strong" />
      <div className="relative w-full max-w-md rounded-3xl border bg-card p-8">
        <Logo />
        <h1 className="mt-6 font-display text-2xl font-medium tracking-tight">Create your Guard account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Register to create a workspace and invite your team.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ava Chen" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative flex items-center">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
            <span>
              I agree to the <Link to="/terms" className="underline-offset-4 hover:underline">Terms</Link> and{" "}
              <Link to="/privacy" className="underline-offset-4 hover:underline">Privacy Policy</Link>.
            </span>
          </label>
          <Button type="submit" className="w-full rounded-full" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link to="/guard/login" className="font-medium text-foreground underline-offset-4 hover:underline">Sign in</Link>
        </p>
        <DemoDataNote className="mt-6" />
      </div>
    </div>
  );
}
