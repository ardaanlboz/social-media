import { generateText } from "./gemini";
import type { ChecklistVerdict, ConceptVerdict } from "./types";

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
    const text = await generateText({ prompt, maxOutputTokens: 4096, json: true });
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
  checklistMarkdown: string,
  nexusFramework = ""
): Promise<string> {
  const failures = verdict.concepts
    .map((c) => {
      const failed = c.items.filter((i) => !i.pass);
      if (failed.length === 0) return "";
      return `${c.conceptLabel}:\n${failed.map((i) => `- [${i.itemId}] ${i.feedback}`).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const frameworkSection = nexusFramework
    ? `
# NEXUS FRAMEWORK (MANDATORY WRITING RULES)
Write every concept and script following these rules (You-form, conviction, linear storytelling, unique power words, simplicity, visual-in-mind, hook expansion, etc.).
------
${nexusFramework}
------
`
    : "";

  return generateText({
    prompt: `# ROLE
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
${frameworkSection}
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
    maxOutputTokens: 4096,
  });
}
