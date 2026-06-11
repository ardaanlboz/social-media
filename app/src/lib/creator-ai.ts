import Anthropic from "@anthropic-ai/sdk";
import { engagementRate } from "./creator-metrics";
import type { CreatorProfile, CreatorVideo } from "./types";

const MODEL = "claude-sonnet-4-5-20250929";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

export interface TopicAssignment {
  id: string;
  topic: string;
}

export function parseTopicAssignments(text: string): TopicAssignment[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (a): a is { id: string; topic: string } =>
          a && typeof a.id === "string" && typeof a.topic === "string" && a.topic.trim().length > 0
      )
      .map((a) => ({ id: a.id, topic: a.topic.trim() }));
  } catch {
    return [];
  }
}

export async function classifyTopics(
  videos: { id: string; caption: string }[],
  existingTopics: string[]
): Promise<Map<string, string>> {
  if (videos.length === 0) return new Map();
  const client = getClient();

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `# TASK
Classify each Instagram Reel below into a short content topic (2-4 words, Title Case) based on its caption.

# RULES
- Reuse one of the existing topics when it fits; only invent a new topic when none fit.
- Keep the total set of topics small and meaningful (group similar content together).
- Existing topics: ${existingTopics.length > 0 ? existingTopics.join(", ") : "(none yet)"}

# VIDEOS
${JSON.stringify(videos, null, 2)}

# OUTPUT
Respond with ONLY a JSON array: [{"id": "<video id>", "topic": "<topic>"}]`,
      },
    ],
  });

  const block = message.content[0];
  const text = block.type === "text" ? block.text : "";
  return new Map(parseTopicAssignments(text).map((a) => [a.id, a.topic]));
}

export function buildCreatorAnalysisPrompt(video: CreatorVideo, accountAvgViews: number): string {
  const ratio = accountAvgViews > 0 ? (video.views / accountAvgViews).toFixed(2) : "n/a";
  return `# ROLE
You are an expert Instagram Reels analyst. This is MY OWN video — analyze it so I understand exactly why it performed the way it did and how to do better.

# PERFORMANCE CONTEXT
- Views: ${video.views.toLocaleString()} (account average: ${accountAvgViews.toLocaleString()}, ratio: ${ratio}x)
- Likes: ${video.likes.toLocaleString()}, Comments: ${video.comments.toLocaleString()}
- Posted: ${video.datePosted}${video.topic ? `\n- Topic: ${video.topic}` : ""}

# YOUR ANALYSIS (use exactly these markdown sections)
# CONCEPT
The core idea and what makes it valuable (1-3 sentences).
# HOOK
The first 1-5 seconds: what is shown/said, and why it does or does not stop the scroll.
# RETENTION
How the video holds attention: pacing, visual changes, open loops.
# REWARD
What the viewer gets for watching to the end.
# SCRIPT
Full transcription/breakdown of what is said and shown, beat by beat.
# PERFORMANCE DIAGNOSIS
Why this video ${accountAvgViews > 0 && video.views >= accountAvgViews ? "outperformed" : "underperformed relative to"} the account average — be specific about which elements drove the result.
# IMPROVEMENTS
3-5 concrete, actionable changes that would make this video perform better.`;
}

export async function generateAccountInsights(
  profile: CreatorProfile,
  videos: CreatorVideo[]
): Promise<string> {
  const client = getClient();

  const rows = videos
    .map(
      (v) =>
        `| ${v.datePosted} | ${v.topic || "—"} | ${v.views} | ${v.likes} | ${v.comments} | ${(engagementRate(v) * 100).toFixed(2)}% |`
    )
    .join("\n");

  const analyses = videos
    .filter((v) => v.analysis)
    .map(
      (v) =>
        `## ${v.link} (${v.views.toLocaleString()} views, topic: ${v.topic || "—"})\n${v.analysis.slice(0, 1500)}`
    )
    .join("\n\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `# ROLE
You are an expert Instagram growth strategist analyzing MY account (@${profile.username}, ${profile.followers.toLocaleString()} followers).

# MY VIDEO DATA
| Posted | Topic | Views | Likes | Comments | Engagement |
|---|---|---|---|---|---|
${rows}
${analyses ? `\n# DEEP ANALYSES OF INDIVIDUAL VIDEOS\n${analyses}` : ""}

# TASK
Write a detailed, actionable report in markdown with exactly these sections:
# WHAT'S WORKING
# WHAT'S NOT WORKING
# TOPIC STRATEGY
Which topics to double down on, which to drop, with numbers.
# PATTERNS
Posting cadence, timing, format patterns visible in the data.
# RECOMMENDATIONS
5-7 concrete next actions, ordered by expected impact.

Ground every claim in the data above. Be direct and specific.`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}
