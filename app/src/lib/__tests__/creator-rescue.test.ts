import { describe, it, expect } from "vitest";
import { parseViralRescue } from "../creator-ai";

const validRescue = {
  viralityScore: { current: 3, potential: 8, oneLineVerdict: "Strong payoff buried behind a slow intro." },
  hookAutopsy: {
    whatYouDid: "Spoken: 'Hey guys'. On-screen: none. Visual: talking head.",
    firstFrameVerdict: "Static face, no text, no motion.",
    whyItFlopped: ["No curiosity gap.", "Six seconds of preamble."],
    scrollStopScore: 2,
  },
  newHooks: [
    { angle: "Curiosity gap", spokenLine: "I lost $10k so you don't have to.", onScreenText: "$10K MISTAKE", openingVisual: "Hand ripping a contract", whyItWorks: "Stakes + specificity." },
  ],
  recommendedHookIndex: 1,
  recommendedReason: "Highest stakes, instant.",
  retentionFixes: [{ timestamp: "0:05", issue: "Dead air", fix: "Cut to b-roll" }],
  rewrittenScript: "0:00 Hook...",
  captionAndCta: { caption: "The $10k lesson", cta: "Follow for more" },
  priorityChanges: [{ rank: 1, change: "Replace intro", impact: "high", effort: "low", expectedEffect: "More watch time" }],
};

describe("parseViralRescue", () => {
  it("parses a clean JSON object", () => {
    const result = parseViralRescue(JSON.stringify(validRescue));
    expect(result).not.toBeNull();
    expect(result!.viralityScore.current).toBe(3);
    expect(result!.newHooks).toHaveLength(1);
    expect(result!.hookAutopsy.whyItFlopped).toEqual(["No curiosity gap.", "Six seconds of preamble."]);
  });

  it("extracts JSON from surrounding prose and code fences", () => {
    const text = "Here's the rescue:\n```json\n" + JSON.stringify(validRescue) + "\n```\nGood luck!";
    const result = parseViralRescue(text);
    expect(result).not.toBeNull();
    expect(result!.newHooks[0].spokenLine).toContain("$10k");
  });

  it("returns null for non-JSON garbage", () => {
    expect(parseViralRescue("no json here")).toBeNull();
    expect(parseViralRescue("{broken")).toBeNull();
  });

  it("returns null when newHooks is missing or not an array", () => {
    const { newHooks, ...rest } = validRescue;
    void newHooks;
    expect(parseViralRescue(JSON.stringify(rest))).toBeNull();
    expect(parseViralRescue(JSON.stringify({ ...validRescue, newHooks: [] }))).toBeNull();
  });

  it("returns null when viralityScore numbers are missing", () => {
    const bad = { ...validRescue, viralityScore: { oneLineVerdict: "x" } };
    expect(parseViralRescue(JSON.stringify(bad))).toBeNull();
  });

  it("returns null when whyItFlopped is not an array", () => {
    const bad = { ...validRescue, hookAutopsy: { ...validRescue.hookAutopsy, whyItFlopped: "nope" } };
    expect(parseViralRescue(JSON.stringify(bad))).toBeNull();
  });
});
