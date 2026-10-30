import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, LoadingState, ErrorState } from "@/components/pg/kit";
import { AssistantChat } from "@/components/pg/assistant-chat";
import { askWorkspace, currentWorkspaceId } from "@/lib/assistant";

export const Route = createFileRoute("/guard/assistant")({
  component: AssistantPage,
});

function AssistantPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    void currentWorkspaceId().then(setWorkspaceId);
  }, []);

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col space-y-4">
      <PageHeader
        title="Ask PoisonGuard"
        description="Answers about the platform and your workspace documents, with sources. It knows your role, but it never approves, signs or changes anything."
      />
      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border bg-card p-6 shadow-sm">
        {workspaceId === undefined ? (
          <LoadingState label="Loading workspace…" />
        ) : workspaceId === null ? (
          <ErrorState title="No workspace" description="Sign in and select a workspace to use the assistant." />
        ) : (
          <AssistantChat
            ask={(q, conversationId) => askWorkspace(workspaceId, q, { conversationId })}
            greeting="Hi! I can explain how any part of PoisonGuard works, what your role lets you do, and what's in your workspace knowledge base. Every answer cites its sources."
            suggestions={["What can I do in this workspace?", "Why was my spend intent denied?", "How do I activate a policy?", "What happens when I freeze an agent?"]}
          />
        )}
      </div>
    </div>
  );
}
