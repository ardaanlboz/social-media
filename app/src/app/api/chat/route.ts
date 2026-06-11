import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import {
  readConversations,
  readConversation,
  writeConversation,
  deleteConversation,
  deriveTitle,
} from "@/lib/chat-store";
import { runChatTurn } from "@/lib/chat";
import type { ChatConversation, ChatMessage } from "@/lib/types";

export const maxDuration = 300;

// GET /api/chat            → list conversations (id, title, updatedAt, count)
// GET /api/chat?id=<id>    → full conversation with messages
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const conv = readConversation(id);
    if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(conv);
  }
  const list = readConversations().map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    messageCount: c.messages.length,
  }));
  return NextResponse.json(list);
}

// DELETE /api/chat?id=<id> → remove a conversation
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  deleteConversation(id);
  return NextResponse.json({ ok: true });
}

// POST /api/chat → send a message, stream the assistant reply over SSE.
// Body: { conversationId?: string, message: string }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const existing = body.conversationId ? readConversation(body.conversationId) : null;
  const now = new Date().toISOString();
  const conv: ChatConversation = existing ?? {
    id: uuid(),
    title: deriveTitle(message),
    createdAt: now,
    updatedAt: now,
    messages: [],
  };

  // History the model sees (before this turn's user message).
  const history = [...conv.messages];

  const userMessage: ChatMessage = { id: uuid(), role: "user", content: message, createdAt: now };
  conv.messages.push(userMessage);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* client disconnected */
        }
      };

      send({ type: "conversation", id: conv.id, title: conv.title });

      try {
        const result = await runChatTurn(history, message, {
          onText: (delta) => send({ type: "text", delta }),
          onToolStart: (name, label) => send({ type: "tool", status: "running", name, label }),
          onToolEnd: (name, label, ok) =>
            send({ type: "tool", status: ok ? "done" : "error", name, label }),
        });

        const finalText =
          result.text ||
          (result.toolCalls.length
            ? "Done — see the actions above."
            : "(no response)");

        const assistantMessage: ChatMessage = {
          id: uuid(),
          role: "assistant",
          content: finalText,
          toolCalls: result.toolCalls.length ? result.toolCalls : undefined,
          createdAt: new Date().toISOString(),
        };
        conv.messages.push(assistantMessage);
        conv.updatedAt = new Date().toISOString();
        writeConversation(conv);

        send({
          type: "done",
          message: assistantMessage,
          conversation: { id: conv.id, title: conv.title, updatedAt: conv.updatedAt },
        });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "Chat failed" });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
