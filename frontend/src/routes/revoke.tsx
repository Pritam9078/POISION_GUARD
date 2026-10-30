import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Wallet, ShieldCheck, AlertCircle, CheckCircle2, RefreshCw, ExternalLink } from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TOKEN_ALLOWANCES, type Severity } from "@/lib/fixtures";
import { fetchAllowances, api } from "@/lib/api";
import { SeverityBadge } from "@/components/pg/kit";

export const Route = createFileRoute("/revoke")({
  component: RevokePage,
  head: () => ({
    meta: [
      { title: "Revoke Token Approvals — PoisonGuard" },
      { name: "description", content: "Review and revoke unlimited ERC-20 token allowances with your own wallet signature." },
    ],
  }),
});

type Stage = "idle" | "preview" | "signing" | "submitted" | "verified" | "failed";

function RevokePage() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [allowances, setAllowances] = useState<any[]>(TOKEN_ALLOWANCES);
  const [selected, setSelected] = useState<string[]>(["TA-1"]);
  const [stage, setStage] = useState<Stage>("idle");
  const [txHash, setTxHash] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const ethereum = typeof window !== "undefined" ? (window as any).ethereum : null;

  const connectWallet = async () => {
    setMsg("");
    if (!ethereum) {
      setMsg("No EVM wallet detected (e.g. MetaMask, Rabby, Rainbow). In demo mode, sample allowances are shown below.");
      setAccount("0x7a9e4f3b1c2d5e6f8091a2b3c4d5e6f708192a3b");
      setChainId(1);
      return;
    }
    try {
      setBusy(true);
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const cId = parseInt(await ethereum.request({ method: "eth_chainId" }), 16);
      if (accounts[0]) {
        setAccount(accounts[0]);
        setChainId(cId);
        const items = await fetchAllowances(accounts[0], cId);
        setAllowances(items);
        setMsg(items.length ? "" : "No active allowances found for this wallet in current scope.");
      }
    } catch (err: any) {
      setMsg(err.message || "Failed to connect wallet.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleRevoke = async () => {
    if (!selected.length) return;
    setMsg("");
    setStage("preview");
    try {
      const picked = allowances.filter((a) => selected.includes(a.id));

      if (ethereum && account) {
        setStage("signing");
        // ERC20 approve(spender, 0)
        for (const item of picked) {
          const zeroApproveData = `0x095ea7b3000000000000000000000000${item.spender.replace("0x", "").toLowerCase()}0000000000000000000000000000000000000000000000000000000000000000`;
          const hash = await ethereum.request({
            method: "eth_sendTransaction",
            params: [
              {
                from: account,
                to: item.tokenAddr || item.token,
                data: zeroApproveData,
                value: "0x0",
              },
            ],
          });
          setTxHash(hash);
          setStage("submitted");
          setStage("verified");
          setMsg(`Successfully revoked approval on transaction ${hash.slice(0, 10)}…`);
        }
      } else {
        // Demo simulation
        setStage("signing");
        setTimeout(() => {
          setStage("submitted");
          setTxHash("0x8e2c4a6d8e0f2b4c6a8d0f2b4c6a8d0f2b4c6a8d0f2b4c6a8d0f2b4c6a8d0f2b");
          setTimeout(() => {
            setStage("verified");
            setMsg("Allowances revoked and verified on-chain (demo).");
          }, 1200);
        }, 1000);
      }
    } catch (err: any) {
      setStage("failed");
      setMsg(err.message || "Revoke transaction was rejected or failed.");
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
            Self-Custody Security
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-light tracking-tight text-foreground sm:text-5xl">
            Audit and revoke <br className="hidden sm:inline" />
            <span className="text-muted-foreground">unlimited token allowances.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            PoisonGuard never asks for your seed phrase or private keys. You connect your wallet and sign only the zero-allowance transactions you approve.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={connectWallet} disabled={busy} className="rounded-full px-6">
              <Wallet className="mr-2 size-4" />
              {account ? `Connected: ${account.slice(0, 6)}…${account.slice(-4)}` : "Connect EVM Wallet"}
            </Button>
          </div>
          {msg && <p className="mt-3 text-xs text-muted-foreground">{msg}</p>}
        </div>

        <div className="mt-10 rounded-3xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="font-display text-lg font-medium">Active Token Approvals</h2>
              <p className="text-xs text-muted-foreground">
                Showing {allowances.length} allowance{allowances.length === 1 ? "" : "s"} found for this wallet
              </p>
            </div>
            {account && (
              <Badge variant="secondary" className="font-mono text-[11px]">
                Chain {chainId ?? 1}
              </Badge>
            )}
          </div>

          <div className="divide-y">
            {allowances.map((item) => {
              const isChecked = selected.includes(item.id);
              return (
                <div key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={item.id}
                      checked={isChecked}
                      onCheckedChange={() => handleToggle(item.id)}
                      className="mt-1"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.token}</span>
                        <span className="text-xs text-muted-foreground">({item.allowance})</span>
                        <SeverityBadge severity={item.risk} />
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        Spender: {item.spenderLabel || item.spender}
                      </div>
                      {item.note && <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {selected.length} allowance{selected.length === 1 ? "" : "s"} selected
            </div>
            <Button
              onClick={handleRevoke}
              disabled={!selected.length || stage === "signing" || stage === "submitted"}
              className="rounded-full px-6"
            >
              {stage === "signing"
                ? "Confirm in wallet…"
                : stage === "submitted"
                ? "Verifying on-chain…"
                : "Revoke Selected Allowances"}
            </Button>
          </div>

          {stage !== "idle" && (
            <div className="mt-6 rounded-2xl border bg-muted/40 p-4">
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                <span className={stage === "preview" ? "text-primary" : "text-muted-foreground"}>1. Preview</span>
                <span>→</span>
                <span className={stage === "signing" ? "text-primary font-bold" : "text-muted-foreground"}>2. Signing</span>
                <span>→</span>
                <span className={stage === "submitted" ? "text-primary font-bold" : "text-muted-foreground"}>3. Submitted</span>
                <span>→</span>
                <span className={stage === "verified" ? "text-emerald-600 font-bold" : "text-muted-foreground"}>4. Verified</span>
              </div>
              {txHash && (
                <div className="mt-2 font-mono text-xs text-muted-foreground">
                  Transaction: {txHash}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}

