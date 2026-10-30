import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet, ShieldCheck, CheckCircle2, ArrowRight, ExternalLink } from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/wallet-connect")({
  component: WalletConnectPage,
  head: () => ({
    meta: [
      { title: "Connect Wallet — PoisonGuard" },
      { name: "description", content: "Connect with Cake Wallet, MetaMask, Rabby, WalletConnect, or hardware wallets for read-only monitoring and approval audits." },
    ],
  }),
});

const WALLETS_LIST = [
  {
    name: "Cake Wallet",
    description: "Open-source multi-currency wallet with robust privacy and EVM support.",
    popular: true,
    badge: "Official Integration",
  },
  {
    name: "MetaMask",
    description: "Leading Web3 browser extension and mobile wallet for all EVM ecosystems.",
    popular: false,
    badge: "EVM Standard",
  },
  {
    name: "Rabby Wallet",
    description: "Security-first multi-chain wallet with integrated pre-sign simulation.",
    popular: false,
    badge: "Recommended",
  },
  {
    name: "WalletConnect",
    description: "Scan QR code to connect 300+ mobile wallets and hardware devices.",
    popular: false,
    badge: "Universal Protocol",
  },
  {
    name: "Coinbase Wallet",
    description: "Self-custody wallet with multi-chain dApp connectivity and passkey support.",
    popular: false,
    badge: "Web3 Wallet",
  },
  {
    name: "Ledger / Trezor (via Extension)",
    description: "Hardware security for high-value cold storage and institutional keys.",
    popular: false,
    badge: "Cold Storage",
  },
];

function WalletConnectPage() {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<string | null>(null);
  const [account, setAccount] = useState("");

  const handleConnect = async (walletName: string) => {
    setConnecting(walletName);
    const eth = typeof window !== "undefined" ? (window as any).ethereum : null;

    if (eth) {
      try {
        const accounts = await eth.request({ method: "eth_requestAccounts" });
        if (accounts[0]) {
          setAccount(accounts[0]);
          setConnected(walletName);
        }
      } catch {
        /* rejected */
      } finally {
        setConnecting(null);
      }
    } else {
      // Demo connection simulation
      setTimeout(() => {
        setAccount("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
        setConnected(walletName);
        setConnecting(null);
      }, 700);
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
            Wallet Connectivity
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-light tracking-tight text-foreground sm:text-5xl">
            Connect your wallet, <br className="hidden sm:inline" />
            <span className="text-muted-foreground">maintain 100% self-custody.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            PoisonGuard connects in read-only mode to scan history and verify approvals. You never reveal private keys.
          </p>

          {connected && (
            <div className="mx-auto mt-6 max-w-md rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center justify-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4" />
                Connected via {connected}
              </div>
              <div className="mt-1 font-mono text-xs">{account}</div>
              <div className="mt-3 flex justify-center gap-2">
                <Button asChild size="sm" className="rounded-full">
                  <Link to="/revoke">Audit Approvals</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link to="/guard/overview">Open Workspace</Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WALLETS_LIST.map((w) => (
            <div
              key={w.name}
              className="flex flex-col justify-between rounded-3xl border bg-card p-6 shadow-sm transition-all hover:border-primary/40"
            >
              <div>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    {w.badge}
                  </Badge>
                  <Wallet className="size-4 text-muted-foreground" />
                </div>
                <h3 className="mt-4 font-display text-lg font-medium">{w.name}</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{w.description}</p>
              </div>

              <div className="mt-6">
                <Button
                  onClick={() => handleConnect(w.name)}
                  disabled={Boolean(connecting)}
                  variant={connected === w.name ? "outline" : "default"}
                  className="w-full rounded-full text-xs font-medium"
                >
                  {connecting === w.name
                    ? "Connecting…"
                    : connected === w.name
                    ? "Connected"
                    : `Connect with ${w.name}`}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}

