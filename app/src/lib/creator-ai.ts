import Anthropic from "@anthropic-ai/sdk";
import { engagementRate } from "./creator-metrics";
import type { CreatorProfile, CreatorVideo, ViralRescue } from "./types";

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
    // ~64 output tokens per assignment (UUID + topic + JSON syntax); 2k was truncating large batches
    max_tokens: Math.min(8192, 256 + videos.length * 64),
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

// ── Viral Rescue ("Make It Viral") ──────────────────────────────────────────

// Stage 1: Gemini watches the video and reports ground truth only — no strategy.
// Output starts with a "#" so gemini.ts's markdown normalization keeps it intact.
export function buildHookExtractionPrompt(video: CreatorVideo): string {
  return `# ROLE
You are a precise video analyst. Watch this Instagram Reel and report EXACTLY what happens — facts only, no opinions, no advice. A strategist will use your report, so be faithful and specific. Quote spoken words and on-screen text verbatim.

# CONTEXT
${video.caption ? `Caption: ${video.caption}` : "No caption provided."}

# REPORT (use these exact markdown sections)
# HOOK (FIRST 3 SECONDS)
- Spoken words (verbatim): exactly what is said in the first ~3 seconds.
- On-screen text (verbatim): any text overlay shown in the first ~3 seconds.
- First frame: describe the very first image the viewer sees (subject, framing, background, motion, any text).
- Audio/energy: music, tone, pace, and energy level.

# FULL TRANSCRIPT
Beat-by-beat with timestamps (0:00, 0:03, ...): everything spoken and shown, in order.

# VISUAL SEQUENCE
Shots, cuts, camera moves, and pacing across the video. Note how often the visual changes.

# ON-SCREEN TEXT
Every text overlay that appears, with rough timestamps.

# PAYOFF / REWARD
What value or punchline the viewer gets, and when it lands (timestamp).

# CTA
Any call to action and where it appears. Write "None" if absent.

# PRODUCTION
Framing, lighting, caption/subtitle style, and format (talking head, b-roll, screen recording, etc.).`;
}

// Stage 2: Claude turns the factual breakdown + metrics into a strategic rescue.
export const VIRAL_RESCUE_SYSTEM_PROMPT = `You are the most sought-after short-form video strategist alive. You have scripted hooks that generated billions of views on Instagram Reels and TikTok. Creators pay you thousands for a single teardown because you see exactly why a video lives or dies in its first three seconds.

You are analyzing ONE video a creator posted that UNDERPERFORMED — it flopped relative to their account. Your job: tell them, with surgical precision and zero sugar-coating, exactly what to change to make this video go viral instead — with the overwhelming majority of your attention on the HOOK.

# CORE BELIEFS YOU OPERATE FROM
- A short-form video is won or lost in the first 3 seconds. Everything else only matters if the hook earns it.
- The hook is three things firing at once: the first FRAME (what the eye sees), the first WORDS (what the ear hears), and the first ON-SCREEN TEXT (what is read). A hook fails when these do not combine into an instant reason to stop scrolling.
- Scrolls are stopped by: a curiosity gap (an open loop the brain needs closed), a bold or contrarian claim, visible stakes (something to gain or lose), ruthless specificity (numbers, named outcomes, timeframes), a pattern interrupt in frame one, and direct callouts ("If you're a [X], stop scrolling").
- Hooks die from: preamble and throat-clearing ("Hey guys, so today..."), slow visual ramp-ups, vagueness, no stakes, a payoff that is buried instead of teased, and a first frame with no motion, no text, and no context.
- Reach is earned by watch time, rewatches, shares, and saves. The hook buys watch time; the structure sustains it; the payoff earns the save; emotion and relatability earn the share; a looping ending earns the rewatch.
- A hook must promise exactly what the video delivers. Maximize intrigue, never bait.

# HOW YOU WORK
- You are given a precise, frame-by-frame breakdown of the actual video (from a vision model that watched it) plus its real performance numbers. Ground EVERY observation in what actually happened in THIS video — quote the creator's actual opening words and describe their actual first frame. Generic advice is worthless.
- You are brutally honest. If the hook is weak, you say so plainly and explain the MECHANISM of why it failed. You are never cruel, but you never soften a hard truth into uselessness.
- Every new hook you write must be READY TO FILM: the exact words to say, the exact text to put on screen, and the exact opening shot to capture. No placeholders, no "something like."
- You end with a clear ranked priority so the creator knows the single most important change.

# OUTPUT
Respond with ONLY a valid JSON object — no markdown, no code fences, no prose outside the JSON — matching exactly this shape:
{
  "viralityScore": { "current": <integer 1-10>, "potential": <integer 1-10>, "oneLineVerdict": <string> },
  "hookAutopsy": {
    "whatYouDid": <string: the actual hook — spoken words, on-screen text, and opening visual>,
    "firstFrameVerdict": <string: a blunt verdict on the literal first frame>,
    "whyItFlopped": [<string>, ...],
    "scrollStopScore": <integer 1-10>
  },
  "newHooks": [
    { "angle": <string>, "spokenLine": <string>, "onScreenText": <string>, "openingVisual": <string>, "whyItWorks": <string> }
  ],
  "recommendedHookIndex": <1-based integer into newHooks>,
  "recommendedReason": <string>,
  "retentionFixes": [ { "timestamp": <string e.g. "0:05">, "issue": <string>, "fix": <string> } ],
  "rewrittenScript": <string: full beat-by-beat shooting script opening with the recommended hook>,
  "captionAndCta": { "caption": <string>, "cta": <string> },
  "priorityChanges": [ { "rank": <integer>, "change": <string>, "impact": "high"|"medium"|"low", "effort": "high"|"medium"|"low", "expectedEffect": <string> } ]
}

RULES:
- newHooks MUST contain exactly 5 hooks, each a distinct angle, each ready to film (exact words, exact on-screen text, exact opening shot — no placeholders).
- whyItFlopped: 2-4 specific, mechanism-based reasons, each referencing THIS video.
- recommendedHookIndex is 1-based into newHooks.
- rewrittenScript opens with your recommended hook and covers the whole video beat by beat.
- priorityChanges ranked 1..N, most impactful first.
- Output JSON only.`;

export function parseViralRescue(text: string): ViralRescue | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const p = JSON.parse(text.slice(start, end + 1));
    if (
      !p ||
      typeof p.viralityScore?.current !== "number" ||
      typeof p.viralityScore?.potential !== "number" ||
      !p.hookAutopsy ||
      !Array.isArray(p.hookAutopsy.whyItFlopped) ||
      !Array.isArray(p.newHooks) ||
      p.newHooks.length === 0
    ) {
      return null;
    }
    return p as ViralRescue;
  } catch {
    return null;
  }
}

export async function generateViralRescue(
  geminiBreakdown: string,
  video: CreatorVideo,
  accountAvgViews: number,
  caption: string
): Promise<ViralRescue | null> {
  const client = getClient();
  const ratio = accountAvgViews > 0 ? (video.views / accountAvgViews).toFixed(2) : "n/a";

  const message = await client.messages.create({
    model: MODEL,
    // The full rescue (5 hooks + a beat-by-beat rewritten script + priorities) runs
    // ~4.5-5k tokens; 4096 truncated it mid-JSON. Give a generous ceiling so the JSON
    // can never be cut off — billing tracks actual tokens used, not this cap.
    max_tokens: 16000,
    system: VIRAL_RESCUE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `# THE VIDEO THAT UNDERPERFORMED
Performance:
- Views: ${video.views.toLocaleString()} vs account average ${accountAvgViews.toLocaleString()} (${ratio}x the average)
- Likes: ${video.likes.toLocaleString()}, Comments: ${video.comments.toLocaleString()}
- Posted: ${video.datePosted}${video.topic ? `, Topic: ${video.topic}` : ""}
- Caption: ${caption || "(none)"}

# FRAME-BY-FRAME BREAKDOWN (from a vision model that watched the video)
${geminiBreakdown}

# YOUR TASK
Produce the viral rescue for THIS video as JSON. Ground every observation in the breakdown above — quote the actual opening words and describe the actual first frame. Obsess over the hook.`,
      },
    ],
  });

  const block = message.content[0];
  const text = block.type === "text" ? block.text : "";
  return parseViralRescue(text);
}
