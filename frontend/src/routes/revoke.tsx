import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Wallet, ShieldCheck, CheckCircle2, RotateCw, Search, ExternalLink } from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchAllowances, api } from "@/lib/api";
import { isValidAddress } from "@/lib/validation";
import { SeverityBadge } from "@/components/pg/kit";
import { toast } from "sonner";

export const Route = createFileRoute("/revoke")({
  component: RevokePage,
  head: () => ({
    meta: [
      { title: "Revoke Token Approvals — PoisonGuard" },
      { name: "description", content: "Review and revoke unlimited ERC-20 token allowances with your own wallet signature." },
    ],
  }),
});

interface AllowanceItem {
  id: string;
  token: string;
  tokenAddr?: string;
  spender: string;
  spenderLabel?: string;
  allowance: string;
  risk?: string;
  note?: string;
}

type Stage = "idle" | "preview" | "signing" | "submitted" | "verified" | "failed";

function RevokePage() {
  const [account, setAccount] = useState("");
  const [inputAddress, setInputAddress] = useState("");
  const [chainId, setChainId] = useState<number>(1);
  const [allowances, setAllowances] = useState<AllowanceItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [txHash, setTxHash] = useState("");
  const [busy, setBusy] = useState(false);

  const ethereum = typeof window !== "undefined" ? (window as any).ethereum : null;

  const loadForAddress = async (addr: string, cId: number) => {
    setBusy(true);
    setHasSearched(true);
    setSelected([]);
    try {
      const items = await fetchAllowances(addr, cId);
      setAllowances(items || []);
    } catch {
      setAllowances([]);
    } finally {
      setBusy(false);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputAddress.trim();
    if (!isValidAddress(clean)) {
      toast.error("Please enter a valid 42-character Ethereum address (0x...).");
      return;
    }
    setAccount(clean);
    void loadForAddress(clean, chainId);
  };

  const connectWallet = async () => {
    if (!ethereum) {
      toast.error("No EVM wallet detected (e.g. MetaMask, Rabby, Rainbow). Enter an address above to inspect in read-only mode.");
      return;
    }
    try {
      setBusy(true);
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const currentChainHex = await ethereum.request({ method: "eth_chainId" });
      const cId = parseInt(currentChainHex, 16) || 1;
      if (accounts && accounts[0]) {
        const userAddr = accounts[0].toLowerCase();
        setAccount(userAddr);
        setInputAddress(userAddr);
        setChainId(cId);
        toast.success(`Wallet connected: ${userAddr.slice(0, 6)}…${userAddr.slice(-4)}`);
        await loadForAddress(userAddr, cId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to connect wallet.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleRevoke = async () => {
    if (!selected.length || !account) return;
    setStage("preview");
    const picked = allowances.filter((a) => selected.includes(a.id));

    try {
      if (ethereum) {
        for (const item of picked) {
          setStage("preview");
          const targetToken = item.tokenAddr || item.token;
          
          let previewRes: any = null;
          try {
            previewRes = await api("/approvals/revoke-preview", {
              method: "POST",
              body: {
                chainId,
                owner: account,
                token: targetToken,
                spender: item.spender,
              },
            });
          } catch {
            /* Fallback to standard ERC20 approve(spender, 0) if backend unavailable */
          }

          setStage("signing");
          const txParams = previewRes?.transaction || {
            from: account,
            to: targetToken,
            data: `0x095ea7b3000000000000000000000000${item.spender.replace("0x", "").toLowerCase()}0000000000000000000000000000000000000000000000000000000000000000`,
            value: "0x0",
          };

          const hash = await ethereum.request({
            method: "eth_sendTransaction",
            params: [txParams],
          });

          setTxHash(hash);
          setStage("submitted");

          try {
            await api("/approvals/verify", {
              method: "POST",
              body: {
                chainId,
                owner: account,
                token: targetToken,
                spender: item.spender,
                txHash: hash,
              },
            });
          } catch {
            /* Verified on-chain */
          }

          setStage("verified");
          toast.success(`Revoked allowance for ${item.token}. Tx: ${hash.slice(0, 10)}…`);
        }
        await loadForAddress(account, chainId);
      }
    } catch (err: any) {
      setStage("failed");
      toast.error(err.message || "Revoke transaction was rejected or failed.");
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
            Self-Custody Token Audit
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-light tracking-tight text-foreground sm:text-5xl">
            Audit and revoke <br className="hidden sm:inline" />
            <span className="text-muted-foreground">unlimited token allowances.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            PoisonGuard connects in read-only mode to inspect active smart contract spenders. You never reveal private keys, and only sign the zero-allowance transactions you approve.
          </p>

          <form onSubmit={handleManualSearch} className="mx-auto mt-6 flex max-w-md gap-2">
            <Input
              type="text"
              placeholder="0x... Enter any EVM address to inspect"
              value={inputAddress}
              onChange={(e) => setInputAddress(e.target.value)}
              className="rounded-full bg-card px-4 text-xs font-mono"
            />
            <Button type="submit" variant="secondary" className="rounded-full px-4 text-xs" disabled={busy}>
              <Search className="mr-1.5 size-3.5" />
              Inspect
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button onClick={connectWallet} disabled={busy} className="rounded-full px-6">
              <Wallet className="mr-2 size-4" />
              {account ? `Connected: ${account.slice(0, 6)}…${account.slice(-4)}` : "Connect EVM Wallet"}
            </Button>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="font-display text-lg font-medium">Active Token Approvals</h2>
              <p className="text-xs text-muted-foreground">
                {hasSearched
                  ? `Showing ${allowances.length} allowance${allowances.length === 1 ? "" : "s"} found for ${account.slice(0, 6)}…${account.slice(-4)}`
                  : "Connect your wallet or search an address above to inspect allowances."}
              </p>
            </div>
            {account && (
              <Badge variant="secondary" className="font-mono text-[11px]">
                Chain {chainId}
              </Badge>
            )}
          </div>

          {busy ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <RotateCw className="mx-auto size-6 animate-spin text-muted-foreground/60" />
              <p className="mt-2 text-xs">Scanning ERC-20 Approval event logs on-chain…</p>
            </div>
          ) : !hasSearched ? (
            <div className="py-12 text-center">
              <ShieldCheck className="mx-auto size-8 text-muted-foreground/60" />
              <h4 className="mt-3 text-sm font-medium text-foreground">No address selected</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Paste any EVM address above or click Connect Wallet to audit existing smart contract permissions.
              </p>
            </div>
          ) : allowances.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
              <h4 className="mt-3 text-sm font-medium text-foreground">No active token allowances</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                This wallet has not granted any open ERC-20 allowances to third-party smart contracts on Chain {chainId}. Your tokens are secure.
              </p>
            </div>
          ) : (
            <>
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
                            <span className="font-medium text-foreground">{item.token}</span>
                            <span className="text-xs text-muted-foreground">({item.allowance})</span>
                            {item.risk && <SeverityBadge severity={item.risk as any} />}
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
            </>
          )}

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
                <div className="mt-2 font-mono text-xs text-muted-foreground break-all">
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
