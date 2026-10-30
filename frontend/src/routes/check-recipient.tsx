import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert, ShieldCheck, HelpCircle, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NETWORKS, ADDR_LOOKALIKE, ADDR_LEGIT, ADDR_SUBJECT } from "@/lib/fixtures";
import { isValidAddress, isValidTxHash } from "@/lib/validation";
import { checkRecipient } from "@/lib/api";

export const Route = createFileRoute("/check-recipient")({
  component: CheckRecipientPage,
  head: () => ({
    meta: [
      { title: "Recipient Checker — PoisonGuard" },
      { name: "description", content: "Verify EVM address similarity and protect against clipboard hijacking and lookalike addresses." },
    ],
  }),
});

function CheckRecipientPage() {
  const [chainId, setChainId] = useState(1);
  const [address, setAddress] = useState(ADDR_LOOKALIKE);
  const [label, setLabel] = useState("Uniswap Router");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!isValidAddress(address)) {
      setError("Please enter a valid 0x EVM address (42 characters).");
      return;
    }
    if (context && !isValidTxHash(context)) {
      setError("Context must be a valid 66-character 0x transaction hash.");
      return;
    }

    setBusy(true);
    try {
      const res = await checkRecipient({
        chainId: Number(chainId),
        address: address.trim(),
        expectedLabel: label.trim() || undefined,
        contextTxHash: context.trim() || undefined,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to check recipient.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
            Recipient Intelligence
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-light tracking-tight text-foreground sm:text-5xl">
            Check the recipient <br className="hidden sm:inline" />
            <span className="text-muted-foreground">before signing.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Valid address formatting does not verify the intended owner. Inspect similarity against historical transfers and flag zero-value dust injection.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 rounded-3xl border bg-card/80 p-6 backdrop-blur shadow-sm sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="network" className="text-xs uppercase tracking-wider text-muted-foreground">
                Network
              </Label>
              <select
                id="network"
                value={chainId}
                onChange={(e) => setChainId(Number(e.target.value))}
                className="mt-1.5 flex h-10 w-full rounded-full border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {NETWORKS.map((n) => (
                  <option key={n.chainId} value={n.chainId}>
                    {n.name} (Chain {n.chainId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="label" className="text-xs uppercase tracking-wider text-muted-foreground">
                Expected Label (Optional)
              </Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Binance Deposit, Vitalik, Colleague"
                className="mt-1.5 rounded-full"
              />
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor="address" className="text-xs uppercase tracking-wider text-muted-foreground">
              Recipient Address
            </Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x…"
              className="mt-1.5 font-mono text-sm rounded-full"
              required
            />
          </div>

          <div className="mt-4">
            <Label htmlFor="context" className="text-xs uppercase tracking-wider text-muted-foreground">
              Context Transaction Hash (Optional)
            </Label>
            <Input
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="0x… (transaction where you saw this address)"
              className="mt-1.5 font-mono text-sm rounded-full"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Try sample:</span>
            <button
              type="button"
              onClick={() => {
                setAddress(ADDR_LOOKALIKE);
                setLabel("Legitimate Trading Wallet");
              }}
              className="rounded-full bg-secondary px-2.5 py-0.5 text-foreground hover:bg-secondary/80"
            >
              Lookalike Attacker
            </button>
            <button
              type="button"
              onClick={() => {
                setAddress(ADDR_LEGIT);
                setLabel("Vitalik");
              }}
              className="rounded-full bg-secondary px-2.5 py-0.5 text-foreground hover:bg-secondary/80"
            >
              Legitimate Wallet
            </button>
          </div>

          {error && <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}

          <Button type="submit" disabled={busy} className="mt-6 w-full rounded-full py-6 text-sm">
            {busy ? "Analyzing address similarity…" : "Check Recipient"}
          </Button>
        </form>

        {result && (
          <div className="mt-6 rounded-3xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3">
              {result.riskLevel === "CRITICAL" ? (
                <div className="flex size-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50">
                  <ShieldAlert className="size-5" />
                </div>
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50">
                  <ShieldCheck className="size-5" />
                </div>
              )}
              <div>
                <h3 className="font-display text-lg font-medium">{result.verdict}</h3>
                <p className="font-mono text-xs text-muted-foreground">{result.address}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Similarity Score</div>
                <div className="mt-1 font-display text-lg font-medium">
                  {(result.similarityScore * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Risk Level</div>
                <div className="mt-1">
                  <Badge variant={result.riskLevel === "CRITICAL" ? "destructive" : "secondary"}>
                    {result.riskLevel}
                  </Badge>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Expected Label Match</div>
                <div className="mt-1 text-sm font-medium">
                  {result.expectedLabelMatch === true ? "Verified match" : result.expectedLabelMatch === false ? "Mismatch detected" : "No label supplied"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

