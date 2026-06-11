"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";

export interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: ConversationMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex w-64 shrink-0 flex-col glass rounded-2xl border-white/[0.06] p-2">
      <button
        onClick={onNew}
        className="mb-2 flex items-center gap-2 rounded-xl bg-gradient-to-br from-purple-500/90 to-indigo-600/90 px-3 py-2.5 text-sm font-medium text-white transition-all hover:from-purple-500 hover:to-indigo-600"
      >
        <Plus className="h-4 w-4" />
        New chat
      </button>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
            No conversations yet.
          </p>
        ) : (
          conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <div
                key={c.id}
                className={`group flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
                  active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                }`}
              >
                <button
                  onClick={() => onSelect(c.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <MessageSquare
                    className={`h-3.5 w-3.5 shrink-0 ${active ? "text-purple-300" : "text-muted-foreground"}`}
                  />
                  <span className="truncate text-[13px] text-foreground/80">{c.title}</span>
                </button>
                <button
                  onClick={() => onDelete(c.id)}
                  className="shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
