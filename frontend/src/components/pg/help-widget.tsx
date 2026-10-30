import { useState } from "react";
import { MessageCircleQuestion, X } from "lucide-react";
import { AssistantChat } from "@/components/pg/assistant-chat";
import { askPlatform } from "@/lib/assistant";

/** Floating public help assistant. Mount once in PublicLayout. Uses only the published platform guide. */
export function HelpWidget() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {open && (
        <div className="mb-3 flex h-[min(560px,75vh)] w-[min(380px,calc(100vw-2rem))] flex-col rounded-3xl border bg-card p-4 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">PoisonGuard help</p>
              <p className="text-[11px] text-muted-foreground">Answers from the PoisonGuard platform guide</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close help" className="rounded-full p-1 hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
          <AssistantChat
            compact
            ask={(q) => askPlatform(q)}
            greeting="Hi! Ask me anything about PoisonGuard — scanning a wallet, address poisoning, revoking approvals, or how Guard workspaces, policies and agents work."
            suggestions={["What is address poisoning?", "How do I revoke an approval?", "Is a scan with no findings safe?", "What does Guard do?"]}
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close help" : "Open help"}
        className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105"
      >
        {open ? <X className="size-5" /> : <MessageCircleQuestion className="size-5" />}
      </button>
    </div>
  );
}
