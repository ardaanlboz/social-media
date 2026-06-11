"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationList, type ConversationMeta } from "@/components/chat/conversation-list";
import { MessageList, type LiveTool } from "@/components/chat/message-list";
import { ChatComposer } from "@/components/chat/chat-composer";
import type { ChatConversation, ChatMessage } from "@/lib/types";

export default function ChatPage() {
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [liveTools, setLiveTools] = useState<LiveTool[]>([]);
  const [error, setError] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat");
      if (res.ok) setConversations(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Keep the thread pinned to the bottom as content streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingText, liveTools]);

  const selectConversation = async (id: string) => {
    if (sending || id === activeId) return;
    setError("");
    try {
      const res = await fetch(`/api/chat?id=${id}`);
      if (!res.ok) return;
      const conv: ChatConversation = await res.json();
      setActiveId(conv.id);
      setMessages(conv.messages);
      setStreamingText("");
      setLiveTools([]);
    } catch {
      /* ignore */
    }
  };

  const newChat = () => {
    if (sending) return;
    setActiveId(null);
    setMessages([]);
    setStreamingText("");
    setLiveTools([]);
    setError("");
  };

  const deleteConversation = async (id: string) => {
    await fetch(`/api/chat?id=${id}`, { method: "DELETE" });
    if (id === activeId) newChat();
    loadConversations();
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);
    setStreamingText("");
    setLiveTools([]);
    setError("");

    const handle = (data: Record<string, unknown>) => {
      switch (data.type) {
        case "conversation":
          if (!activeId) setActiveId(data.id as string);
          break;
        case "text":
          setStreamingText((prev) => prev + (data.delta as string));
          break;
        case "tool":
          if (data.status === "running") {
            setLiveTools((prev) => [
              ...prev,
              { name: data.name as string, label: data.label as string, status: "running" },
            ]);
          } else {
            setLiveTools((prev) => {
              const copy = [...prev];
              for (let i = copy.length - 1; i >= 0; i--) {
                if (copy[i].status === "running") {
                  copy[i] = {
                    ...copy[i],
                    label: data.label as string,
                    status: data.status as LiveTool["status"],
                  };
                  break;
                }
              }
              return copy;
            });
          }
          break;
        case "done":
          setMessages((prev) => [...prev, data.message as ChatMessage]);
          setStreamingText("");
          setLiveTools([]);
          loadConversations();
          break;
        case "error":
          setError(data.error as string);
          setStreamingText("");
          setLiveTools([]);
          break;
      }
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, message: trimmed }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          handle(JSON.parse(line.slice(6)));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
      setStreamingText("");
      setLiveTools([]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col">
      <div className="mb-4 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">Assistant</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tactical, no-BS advice grounded in all your videos, analyses, and competitors.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={selectConversation}
          onNew={newChat}
          onDelete={deleteConversation}
        />

        <div className="flex min-w-0 flex-1 flex-col glass rounded-2xl border-white/[0.06]">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <MessageList
              messages={messages}
              streamingText={streamingText}
              liveTools={liveTools}
              sending={sending}
              error={error}
              onPickSuggestion={(s) => send(s)}
            />
          </div>
          <ChatComposer value={input} onChange={setInput} onSend={() => send(input)} disabled={sending} />
        </div>
      </div>
    </div>
  );
}
