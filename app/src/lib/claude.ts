import Anthropic from "@anthropic-ai/sdk";

export async function generateNewConcepts(
  videoAnalysis: string,
  newConceptsPrompt: string,
  masterChecklist = ""
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });

  const checklistSection = masterChecklist
    ? `
# MASTER SCRIPTING CHECKLIST (MANDATORY)
Every concept you generate MUST satisfy EVERY item below. The hook rule is non-negotiable: the most unskippable, most engaging part of the video must be the first 5 seconds.
------
${masterChecklist}
------
`
    : "";

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `# ROLE
You're an expert in creating viral Reels on Instagram.

# OBJECTIVE
Take as input viral video from my competitor and based on it generate new concepts for me. Adapt this reference for me.

# REFERENCE VIDEO DESCRIPTION
------
${videoAnalysis}
------

# MY INSTRUCTIONS FOR NEW CONCEPTS
------
${newConceptsPrompt}
------
${checklistSection}
# BEGIN YOUR WORK`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}
