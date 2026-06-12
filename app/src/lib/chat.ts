import { buildDataDigest } from "./chat-context";
import { CHAT_TOOLS, executeTool, toolRunningLabel } from "./chat-tools";
import { streamGeminiTurn } from "./gemini";
import type { GeminiContent, GeminiPart } from "./gemini";
import type { ChatMessage, ChatToolCall } from "./types";

const MAX_OUTPUT_TOKENS = 8192;
const MAX_TOOL_ROUNDS = 8;

const SYSTEM_PERSONA = `You are the user's personal short-form growth strategist, embedded in their Instagram Reels tooling. You can see their entire account, every analysis they've run, their competitors' analyzed videos, and their scripting checklist + framework — all provided under "THE USER'S DATA" below.

Your job: give brutally honest, highly tactical, specific advice. No sugar-coating, no fluff, no generic social-media platitudes ("post consistently!", "engage with your audience!"). You are the blunt expert friend who tells them exactly what to do next.

HOW YOU OPERATE:
- Lead with the answer. No preamble ("Great question!"), no hedging, no throat-clearing. Give the final answer directly — do not narrate your reasoning.
- Ground EVERY claim in their actual data. Cite real videos by topic and view count. Compare against their own average and against their competitors. If you make a claim, the number that backs it should be right there.
- When they ask about a specific video in depth, call get_my_video / get_competitor_video first to pull the full analysis — the table you see only has the summary row.
- When they want you to analyze a reel, make one viral, or refresh their account insights, USE THE TOOLS (analyze_my_video, make_video_viral, generate_account_insights). Don't describe what the tool would do — call it, then talk through the result.
- Be concrete. "Your hook is weak" is useless. "Your first 3 seconds open on a static talking-head with no on-screen text — that's why this got 1.2K vs your 8K average. Open on the payoff instead: '[exact line]'" is the standard.
- If the data genuinely doesn't support an answer, say so plainly. Never invent numbers.
- Respond in clean, skimmable markdown. Short paragraphs, bold the key moves, use lists for action items.`;

export interface ChatStreamCallbacks {
  onText: (delta: string) => void;
  onToolStart: (name: string, label: string) => void;
  onToolEnd: (name: string, label: string, ok: boolean) => void;
}

// Run one assistant turn: stream text to the callbacks, execute any tools the
// model calls (streaming tool activity too), and loop until the model stops
// asking for tools. Returns the final assistant text + the tools it used.
export async function runChatTurn(
  history: ChatMessage[],
  userText: string,
  cb: ChatStreamCallbacks
): Promise<{ text: string; toolCalls: ChatToolCall[] }> {
  const system = `${SYSTEM_PERSONA}\n\n# THE USER'S DATA\n${buildDataDigest()}`;

  const contents: GeminiContent[] = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userText }] });

  const toolCalls: ChatToolCall[] = [];
  let allText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { text, functionCalls } = await streamGeminiTurn({
      contents,
      system,
      tools: CHAT_TOOLS,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      onText: cb.onText,
    });

    allText += text;

    // Record the model turn (text + any function-call parts) so the next round
    // sees its own previous tool requests.
    const modelParts: GeminiPart[] = [
      ...(text ? [{ text }] : []),
      ...functionCalls.map((fc) => ({ functionCall: { name: fc.name, args: fc.args } })),
    ];
    contents.push({ role: "model", parts: modelParts });

    if (functionCalls.length === 0) break;

    // Execute every requested tool and feed the results back as one user turn.
    const responseParts: GeminiPart[] = [];
    for (const fc of functionCalls) {
      cb.onToolStart(fc.name, toolRunningLabel(fc.name));
      const outcome = await executeTool(fc.name, fc.args || {});
      cb.onToolEnd(fc.name, outcome.label, outcome.ok);
      toolCalls.push({ name: fc.name, label: outcome.label, ok: outcome.ok });
      responseParts.push({
        functionResponse: {
          name: fc.name,
          response: { result: outcome.content, ok: outcome.ok },
        },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return { text: allText.trim(), toolCalls };
}
