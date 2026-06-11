import Anthropic from "@anthropic-ai/sdk";
import type { ChecklistVerdict, ConceptVerdict } from "./types";

const MODEL = "claude-sonnet-4-5-20250929";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in verifier response");
  return JSON.parse(text.slice(start, end + 1));
}

function toVerdict(raw: unknown): ChecklistVerdict {
  const obj = raw as { concepts?: unknown };
  if (!Array.isArray(obj?.concepts) || obj.concepts.length === 0) {
    throw new Error("Verifier JSON missing concepts array");
  }
  const concepts: ConceptVerdict[] = obj.concepts.map((c) => {
    const concept = c as { conceptLabel?: unknown; items?: unknown };
    const items = Array.isArray(concept.items) ? concept.items : [];
    return {
      conceptLabel: String(concept.conceptLabel ?? "Concept"),
      items: items.map((i) => {
        const item = i as { itemId?: unknown; pass?: unknown; feedback?: unknown };
        return {
          itemId: String(item.itemId ?? ""),
          pass: item.pass === true,
          feedback: String(item.feedback ?? ""),
        };
      }),
    };
  });
  const allPass = concepts.every((c) => c.items.every((i) => i.pass));
  return { concepts, allPass };
}

export async function verifyConcepts(
  concepts: string,
  checklistMarkdown: string
): Promise<ChecklistVerdict> {
  const client = getClient();
  const prompt = `# ROLE
You are a strict quality verifier for short-form video scripts. You only grade — you never rewrite.

# MASTER SCRIPTING CHECKLIST
------
${checklistMarkdown}
------

# CONCEPTS TO GRADE
------
${concepts}
------

# TASK
Identify each distinct video concept in the text above. For EACH concept, grade it against EVERY checklist item (use the item ids in square brackets).
Be strict: a vague or partial fulfillment is a fail. For failing items give one concrete line of feedback on how to fix it; for passing items use an empty string.

# OUTPUT
Respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{"concepts":[{"conceptLabel":"Concept 1: <title>","items":[{"itemId":"broad","pass":true,"feedback":""}]}]}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    const text = block.type === "text" ? block.text : "";
    try {
      return toVerdict(extractJson(text));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Verifier failed");
}

export async function reviseConcepts(
  originalConcepts: string,
  verdict: ChecklistVerdict,
  videoAnalysis: string,
  newConceptsPrompt: string,
  checklistMarkdown: string
): Promise<string> {
  const client = getClient();
  const failures = verdict.concepts
    .map((c) => {
      const failed = c.items.filter((i) => !i.pass);
      if (failed.length === 0) return "";
      return `${c.conceptLabel}:\n${failed.map((i) => `- [${i.itemId}] ${i.feedback}`).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `# ROLE
You're an expert in creating viral Reels on Instagram.

# OBJECTIVE
Revise the video concepts below so that every concept passes every item of the master scripting checklist. Keep everything that already works; change only what is needed to fix the failures.

# REFERENCE VIDEO DESCRIPTION
------
${videoAnalysis}
------

# MY INSTRUCTIONS FOR NEW CONCEPTS
------
${newConceptsPrompt}
------

# MASTER SCRIPTING CHECKLIST (MANDATORY)
------
${checklistMarkdown}
------

# CURRENT CONCEPTS
------
${originalConcepts}
------

# VERIFIER FAILURES TO FIX
------
${failures}
------

# OUTPUT
Output the full revised concepts document in the same format as the current concepts. No commentary about the revision.`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}
