import { generateText } from "./gemini";

export async function generateNewConcepts(
  videoAnalysis: string,
  newConceptsPrompt: string,
  masterChecklist = "",
  nexusFramework = ""
): Promise<string> {
  const frameworkSection = nexusFramework
    ? `
# NEXUS FRAMEWORK (MANDATORY WRITING RULES)
Write every concept and script following these rules (You-form, conviction, linear storytelling, unique power words, simplicity, visual-in-mind, hook expansion, etc.).
------
${nexusFramework}
------
`
    : "";

  const checklistSection = masterChecklist
    ? `
# MASTER SCRIPTING CHECKLIST (MANDATORY)
Every concept you generate MUST satisfy EVERY item below. The hook rule is non-negotiable: the most unskippable, most engaging part of the video must be the first 5 seconds.
------
${masterChecklist}
------
`
    : "";

  return generateText({
    prompt: `# ROLE
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
${frameworkSection}${checklistSection}
# BEGIN YOUR WORK`,
    maxOutputTokens: 4096,
  });
}
