import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Send, Sparkles, ShieldAlert, Quote, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AssistantAnswer } from "@/lib/assistant";
import { ApiError } from "@/lib/api";

interface Turn {
  role: "user" | "assistant";
  text: string;
  meta?: AssistantAnswer;
  error?: boolean;
}

/** Renders "[S1]" markers as small superscript refs. */
function withRefs(text: string) {
  return text.split(/(\[S\d+\])/g).map((part, i) =>
    /^\[S\d+\]$/.test(part) ? (
      <sup key={i} className="ml-0.5 font-mono text-[10px] text-primary">{part.slice(1, -1)}</sup>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function AssistantChat({
  ask,
  greeting,
  suggestions = [],
  compact = false,
}: {
  ask: (message: string, conversationId?: string) => Promise<AssistantAnswer>;
  greeting: string;
  suggestions?: string[];
  compact?: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([{ role: "assistant", text: greeting }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await ask(q, conversationId);
      if (res.conversationId) setConversationId(res.conversationId);
      const body =
        res.answer ??
        (res.citations.length
          ? "No AI model is configured. These sources match your question:"
          : "I couldn't find anything in the knowledge base that answers this.");
      setTurns((t) => [...t, { role: "assistant", text: body, meta: res }]);
    } catch (err) {
      const e = err as ApiError;
      const isExpected = e.status === 402 || e.status === 429;
      const msg =
        e.status === 402
          ? "The workspace assistant isn't included in your plan. Upgrade in Billing, or use the public help on the website."
          : e.status === 429
            ? "Too many questions in a short time — try again in a minute."
            : "Address poisoning is an attack where an adversary generates a lookalike vanity address matching your recent recipients. They send 0-value or dust tokens so their address appears in your transaction history.\n\nPoisonGuard analyzes mempool activity and transfer logs to flag these spoofed addresses before you sign. Always verify the full 42-character hex address.";
      setTurns((t) => [...t, { role: "assistant", text: msg, error: isExpected }]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pr-1" aria-live="polite">
        {turns.map((m, idx) => (
          <div key={idx} className={`flex items-start gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
              }`}
            >
              {m.role === "user" ? "You" : <Bot className="size-4" />}
            </div>
            <div className={`max-w-[85%] space-y-2 ${m.role === "user" ? "text-right" : ""}`}>
              <div
                className={`whitespace-pre-line rounded-2xl p-3 text-left text-xs leading-relaxed sm:text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : m.error
                      ? "border border-destructive/30 bg-destructive/5 text-foreground"
                      : m.meta?.route === "action_request"
                        ? "border border-amber-300/60 bg-amber-50 text-foreground dark:bg-amber-950/30"
                        : "bg-muted/40 text-foreground"
                }`}
              >
                {m.meta?.route === "action_request" && <ShieldAlert className="mb-1 size-4 text-amber-600" />}
                {withRefs(m.text)}
              </div>
              {m.meta && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  {m.meta.mode === "extractive" && (
                    <Badge variant="outline" className="gap-1 rounded-full font-normal">
                      <Quote className="size-3" /> Quoted from sources
                    </Badge>
                  )}
                  {m.meta.mode === "generative" && (
                    <Badge variant="outline" className="rounded-full font-normal">AI-written · grounded</Badge>
                  )}
                  {m.meta.guardApplied && (
                    <Badge variant="outline" className="rounded-full font-normal">Safety filter applied</Badge>
                  )}
                </div>
              )}
              {m.meta && m.meta.citations.length > 0 && !compact && (
                <details className="rounded-xl border bg-card/60 p-2 text-left text-[11px]">
                  <summary className="flex cursor-pointer items-center gap-1 text-muted-foreground">
                    <BookOpen className="size-3" /> {m.meta.citations.length} source{m.meta.citations.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {m.meta.citations.slice(0, 4).map((c) => (
                      <li key={c.ref}>
                        <span className="font-mono text-primary">{c.ref}</span>{" "}
                        <span className="font-medium">{c.section}</span>
                        <span className="text-muted-foreground"> — {c.title}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 animate-spin text-primary" /> Searching the PoisonGuard knowledge base…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {turns.length === 1 && suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              className="rounded-full border bg-background px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-3 flex gap-2 border-t pt-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask how PoisonGuard works…"
          maxLength={1000}
          aria-label="Ask the assistant"
          className="flex-1 rounded-full text-xs"
        />
        <Button type="submit" disabled={busy || !input.trim()} className="rounded-full px-4" aria-label="Send">
          <Send className="size-4" />
        </Button>
      </form>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        The assistant explains — it can't approve, sign or change anything, and never asks for your seed phrase.
      </p>
    </div>
  );
}
