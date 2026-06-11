import type Anthropic from "@anthropic-ai/sdk";
import { readCreatorVideos, readVideos } from "./csv";
import { engagementRate } from "./creator-metrics";
import { runCreatorAnalysis, runViralRescue, runAccountInsights } from "./creator-actions";

// Tool schemas exposed to Claude. Descriptions are prescriptive about WHEN to
// call each one — Opus reaches for tools conservatively, so the trigger
// conditions matter.
export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_my_video",
    description:
      "Fetch the FULL stored record for one of the user's own reels by id (id comes from the reels table in your data) — including the complete AI analysis and any Viral Rescue. Call this before giving deep, specific feedback on one of their videos; the always-on data only has the summary row.",
    input_schema: {
      type: "object",
      properties: { videoId: { type: "string", description: "The reel id from the user's reels table" } },
      required: ["videoId"],
    },
  },
  {
    name: "get_competitor_video",
    description:
      "Fetch the FULL stored record for one analyzed competitor reel by id — including the complete AI analysis, generated concepts, and checklist scorecard. Call this before discussing a specific competitor video in depth.",
    input_schema: {
      type: "object",
      properties: { videoId: { type: "string", description: "The competitor reel id" } },
      required: ["videoId"],
    },
  },
  {
    name: "analyze_my_video",
    description:
      "Run a fresh AI video analysis (Gemini watches the actual reel) on one of the user's own videos and save it. Takes ~30s and costs an API call. Call this when the user wants a deep breakdown of a specific reel that hasn't been analyzed yet, or explicitly asks you to (re)analyze one.",
    input_schema: {
      type: "object",
      properties: { videoId: { type: "string", description: "The reel id to analyze" } },
      required: ["videoId"],
    },
  },
  {
    name: "make_video_viral",
    description:
      "Generate a 'Viral Rescue' teardown for one of the user's underperforming reels — a hook autopsy, 5 ready-to-film replacement hooks, retention fixes, and a rewritten script. Takes ~30s and costs an API call. Call this when the user wants to fix or relaunch a specific flopped video.",
    input_schema: {
      type: "object",
      properties: { videoId: { type: "string", description: "The reel id to rescue" } },
      required: ["videoId"],
    },
  },
  {
    name: "generate_account_insights",
    description:
      "Regenerate the account-level insights report from all current metrics and analyses. Call this when the user asks for a fresh overall read on their account, or when the existing insights look stale relative to new videos.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

// Present-tense label shown in the UI while a tool is running.
export function toolRunningLabel(name: string): string {
  switch (name) {
    case "get_my_video":
      return "Reading your reel…";
    case "get_competitor_video":
      return "Reading competitor reel…";
    case "analyze_my_video":
      return "Analyzing your reel…";
    case "make_video_viral":
      return "Generating Viral Rescue…";
    case "generate_account_insights":
      return "Generating account insights…";
    default:
      return "Working…";
  }
}

export interface ToolOutcome {
  content: string;
  label: string;
  ok: boolean;
}

function asString(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v : "";
}

function shorten(text: string, n = 32): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

function reelLabel(v: { caption?: string; topic?: string } | undefined, fallback: string): string {
  if (!v) return fallback;
  return shorten(v.caption || v.topic || fallback);
}

// Execute a tool the model requested. Returns the string fed back to the model
// as the tool_result, plus a human label + ok flag for the chat UI.
export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<ToolOutcome> {
  switch (name) {
    case "get_my_video": {
      const id = asString(input, "videoId");
      const v = readCreatorVideos().find((x) => x.id === id);
      if (!v) return { content: `No reel found with id ${id}.`, label: "Look up reel (not found)", ok: false };
      const record = {
        id: v.id,
        link: v.link,
        caption: v.caption,
        topic: v.topic,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        datePosted: v.datePosted,
        engagementRate: engagementRate(v),
        analysis: v.analysis || "(not analyzed yet)",
        viralRescue: v.viralRescue ? safeParse(v.viralRescue) : "(no rescue generated)",
      };
      return { content: JSON.stringify(record, null, 2), label: `Read “${reelLabel(v, v.id)}”`, ok: true };
    }

    case "get_competitor_video": {
      const id = asString(input, "videoId");
      const v = readVideos().find((x) => x.id === id);
      if (!v) return { content: `No competitor reel found with id ${id}.`, label: "Look up competitor (not found)", ok: false };
      const record = {
        id: v.id,
        link: v.link,
        creator: v.creator,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        datePosted: v.datePosted,
        configName: v.configName,
        analysis: v.analysis || "(not analyzed)",
        newConcepts: v.newConcepts || "(none)",
        checklistResult: v.checklistResult ? safeParse(v.checklistResult) : "(none)",
      };
      return { content: JSON.stringify(record, null, 2), label: `Read @${v.creator}'s reel`, ok: true };
    }

    case "analyze_my_video": {
      const id = asString(input, "videoId");
      const r = await runCreatorAnalysis(id);
      if (!r.ok) return { content: `Analysis failed: ${r.error}`, label: "Analyze reel (failed)", ok: false };
      return {
        content: `Analysis complete for reel ${id}:\n\n${r.data.analysis}`,
        label: `Analyzed “${reelLabel(r.data.video, id)}”`,
        ok: true,
      };
    }

    case "make_video_viral": {
      const id = asString(input, "videoId");
      const r = await runViralRescue(id);
      if (!r.ok) return { content: `Rescue failed: ${r.error}`, label: "Make it viral (failed)", ok: false };
      return {
        content: `Viral Rescue generated for reel ${id}:\n\n${JSON.stringify(r.data.rescue, null, 2)}`,
        label: `Rescued “${reelLabel(r.data.video, id)}”`,
        ok: true,
      };
    }

    case "generate_account_insights": {
      const r = await runAccountInsights();
      if (!r.ok) return { content: `Insights failed: ${r.error}`, label: "Generate insights (failed)", ok: false };
      return { content: `New account insights report:\n\n${r.data.insights}`, label: "Generated account insights", ok: true };
    }

    default:
      return { content: `Unknown tool: ${name}`, label: `Unknown tool ${name}`, ok: false };
  }
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}
