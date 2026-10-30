const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;

export function isValidAddress(value: string): boolean {
  return ADDR_RE.test(value.trim());
}

export function isValidTxHash(value: string): boolean {
  return TX_RE.test(value.trim());
}

export type InputKind = "address" | "transaction" | "unknown";

export function classifyInput(value: string): InputKind {
  const v = value.trim();
  if (ADDR_RE.test(v)) return "address";
  if (TX_RE.test(v)) return "transaction";
  return "unknown";
}

/** Helpful validation message instead of a bare "invalid" for UX. */
export function validateScanInput(value: string): { ok: true; kind: InputKind } | { ok: false; message: string } {
  const v = value.trim();
  if (!v) return { ok: false, message: "Enter a wallet address or transaction hash." };
  if (!v.startsWith("0x")) return { ok: false, message: "EVM addresses and transaction hashes start with 0x." };
  if (v.length < 42) return { ok: false, message: "Too short — a wallet address is 42 characters (0x + 40 hex)." };
  if (classifyInput(v) === "address") return { ok: true, kind: "address" };
  if (classifyInput(v) === "transaction") return { ok: true, kind: "transaction" };
  return {
    ok: false,
    message:
      v.length === 66
        ? "Transaction hashes must be 0x + 64 hex characters — check for typos."
        : "Not a valid EVM address (0x + 40 hex) or transaction hash (0x + 64 hex).",
  };
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 10)}…${a.slice(-8)}`;
}

export function fmtDateTime(iso: string): string {
  return new Date(iso.replace(" ", "T") + (iso.endsWith("Z") ? "" : "Z")).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";
}

export function fmtDate(iso: string): string {
  return new Date(iso.replace(" ", "T") + (iso.endsWith("Z") ? "" : "Z")).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
