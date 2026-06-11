"use client";

import { AlertTriangle, Check, Loader2, Sparkles, Wrench, X } from "lucide-react";
import { MarkdownContent } from "@/components/markdown-content";
import type { ChatMessage, ChatToolCall } from "@/lib/types";

export interface LiveTool {
  name: string;
  label: string;
  status: "running" | "done" | "error";
}

const SUGGESTIONS = [
  "What should I post next, and why?",
  "Which of my videos should I remake first?",
  "Roast my worst performer and tell me exactly how to fix it.",
  "What are my competitors doing that I'm not?",
];

function ToolChip({ label, status }: { label: string; status: LiveTool["status"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-foreground/70">
      {status === "running" ? (
        <Loader2 className="h-3 w-3 animate-spin text-purple-300" />
      ) : status === "done" ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <X className="h-3 w-3 text-red-400" />
      )}
      {label}
    </span>
  );
}

function AssistantBlock({
  toolCalls,
  children,
}: {
  toolCalls?: { label: string; status: LiveTool["status"] }[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {toolCalls && toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {toolCalls.map((t, i) => (
              <ToolChip key={i} label={t.label} status={t.status} />
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-purple-500/20 bg-purple-500/15 px-4 py-2.5 text-sm text-foreground/90">
          {message.content}
        </div>
      </div>
    );
  }
  const chips = (message.toolCalls || []).map((t: ChatToolCall) => ({
    label: t.label,
    status: (t.ok ? "done" : "error") as LiveTool["status"],
  }));
  return (
    <AssistantBlock toolCalls={chips}>
      <MarkdownContent content={message.content} variant="analysis" />
    </AssistantBlock>
  );
}

export function MessageList({
  messages,
  streamingText,
  liveTools,
  sending,
  error,
  onPickSuggestion,
}: {
  messages: ChatMessage[];
  streamingText: string;
  liveTools: LiveTool[];
  sending: boolean;
  error: string;
  onPickSuggestion: (text: string) => void;
}) {
  const showEmpty = messages.length === 0 && !sending && !streamingText;

  if (showEmpty) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 glow-sm">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Your tactical assistant</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          It knows every one of your reels, your past analyses, your competitors&apos; breakdowns,
          and your insights. Ask it anything — no sugar-coating.
        </p>
        <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onPickSuggestion(s)}
              className="rounded-xl glass border-white/[0.06] px-4 py-3 text-left text-[13px] text-foreground/75 transition-all hover:border-white/[0.12] hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}

      {(sending || streamingText) && (
        <AssistantBlock toolCalls={liveTools}>
          {streamingText ? (
            <MarkdownContent content={streamingText} variant="analysis" />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wrench className="h-3.5 w-3.5 animate-pulse" />
              Thinking…
            </div>
          )}
        </AssistantBlock>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/15 bg-red-500/5 px-3 py-2 text-[12px] text-red-400/90">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
