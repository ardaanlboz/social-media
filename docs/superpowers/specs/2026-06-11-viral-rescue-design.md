# Viral Rescue ("Make It Viral") — Design

**Date:** 2026-06-11
**Status:** Approved

## Problem

On `/creator`, the user can browse their own posted reels and run a neutral "Analyze with AI". What they actually want for videos that **flopped** is a prescriptive teardown: exactly what to change to make this video go viral instead — with the overwhelming majority of the attention on the **hook**. This is the highest-value feature of the app.

## Decisions (user-confirmed)

- **Engine:** two-stage — Gemini watches the video and reports ground truth, then Claude (with a strong system prompt) produces the strategy. Gemini is the eyes; Claude is the strategist/copywriter.
- **Tone:** brutally honest expert — direct, mechanism-based, never cruel, never softened into uselessness.
- **Placement:** a separate **"Make It Viral"** action on every video card, distinct from the existing "Analyze with AI". The flame accent is emphasized on below-account-average videos.

## User flow

1. User clicks **Make It Viral** on a video card.
2. Loading state on the button. Backend runs the two stages (~30–60s).
3. A rich modal opens with the rescue: virality score, hook autopsy, 5 ready-to-film replacement hooks, retention fixes, a full rewritten script, caption/CTA, and a ranked priority list.
4. The result is saved to the video record (`viralRescue` column). The button then reads **"View Rescue"** and reopens the saved result instantly; the modal has a **Regenerate** action.

## Architecture

Two stages, orchestrated by a new API route:

**Stage 1 — Gemini extraction (eyes).** Download the reel (shared helper with expired-URL re-scrape fallback) → upload to Gemini → run `buildHookExtractionPrompt()`. Gemini returns a *factual* markdown breakdown only — it does not strategize. It captures:
- HOOK (0–3s): exact spoken words, exact on-screen text, the literal first frame, audio/energy
- Full transcript beat-by-beat with timestamps
- Visual sequence, cuts, pacing, on-screen text throughout
- Payoff/reward and how it's delivered; CTA if any
- Production notes (framing, lighting, captions, format)

**Stage 2 — Claude rescue (strategist).** Claude gets Gemini's breakdown + the metrics (this video's views vs account average, likes, comments, engagement, topic, posting date) + the Instagram caption, under `VIRAL_RESCUE_SYSTEM_PROMPT`. It returns **structured JSON** (see schema). `parseViralRescue()` extracts and validates it.

### Why structured JSON
The hooks are the hero of the UI and must render as individual cards (spoken line, on-screen text, opening visual, why it works). A markdown blob can't be laid out that way, and structured output lets us validate/repair before saving.

## The system prompt (centerpiece)

`VIRAL_RESCUE_SYSTEM_PROMPT` — persona: the most sought-after short-form strategist alive; analyzing ONE underperforming video; surgical, brutally honest, hook-obsessed. Core beliefs encoded:
- Won or lost in the first 3 seconds; everything else only matters if the hook earns it.
- The hook is three things firing at once: first **frame** (eye), first **words** (ear), first **on-screen text** (read). It fails when these don't combine into an instant reason to stop scrolling.
- Scrolls stop for: curiosity gap / open loop, bold or contrarian claim, visible stakes, ruthless specificity (numbers, named outcomes, timeframes), a pattern interrupt in frame one, direct callouts.
- Hooks die from: preamble/throat-clearing, slow visual ramp-ups, vagueness, no stakes, a buried (un-teased) payoff, a dead first frame (no motion/text/context).
- Reach = watch time + rewatches + shares + saves. Hook buys watch time; structure sustains it; payoff earns the save; emotion earns the share; a looping ending earns the rewatch.
- A hook must promise exactly what the video delivers — maximize intrigue, never bait.

Working rules in the prompt: ground every observation in THIS video (quote actual opening words, describe the actual first frame); be brutally honest about the *mechanism* of failure; every new hook must be **ready to film** (exact words, exact on-screen text, exact opening shot — no placeholders); end with a ranked priority so the creator knows the single most important change. The full prompt text lives in `creator-ai.ts`.

The Gemini extraction prompt is deliberately separate and neutral — its only job is accurate observation, so Claude reasons over faithful facts.

## Output schema (`ViralRescue`)

```ts
interface ViralRescueHook {
  angle: string;          // e.g. "Curiosity gap", "Contrarian claim"
  spokenLine: string;     // exact words for the first ~3s
  onScreenText: string;   // exact overlay text
  openingVisual: string;  // the literal first shot to film
  whyItWorks: string;     // mechanism, tied to this video
}

interface ViralRescuePriority {
  rank: number;
  change: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  expectedEffect: string;
}

interface ViralRescueRetentionFix {
  timestamp: string;      // e.g. "0:05"
  issue: string;
  fix: string;
}

interface ViralRescue {
  viralityScore: { current: number; potential: number; oneLineVerdict: string };
  hookAutopsy: {
    whatYouDid: string;
    firstFrameVerdict: string;
    whyItFlopped: string[];   // 2-4 mechanism-based bullets
    scrollStopScore: number;  // 1-10
  };
  newHooks: ViralRescueHook[];     // exactly 5
  recommendedHookIndex: number;    // 1-based
  recommendedReason: string;
  retentionFixes: ViralRescueRetentionFix[];
  rewrittenScript: string;         // full beat-by-beat shooting script
  captionAndCta: { caption: string; cta: string };
  priorityChanges: ViralRescuePriority[];
}
```

`parseViralRescue(text)` returns `ViralRescue | null`: slice from first `{` to last `}`, `JSON.parse`, then validate required shape (viralityScore numbers present, `newHooks` is a non-empty array, `hookAutopsy.whyItFlopped` is an array). Returns `null` on any failure so the route can surface a retryable error instead of saving garbage.

## Files

- **`lib/types.ts`** — add `viralRescue: string` to `CreatorVideo`; add the `ViralRescue*` interfaces.
- **`lib/csv.ts`** — add `viralRescue` to `CREATOR_VIDEO_COLUMNS` and the read mapping (default `""`).
- **`lib/creator-media.ts`** (new) — `fetchCreatorVideoMedia(video)`: download from `video.videoUrl`; on failure re-scrape a fresh URL via `scrapePostVideoUrl(video.link)`, mutate `video.videoUrl`, retry. Returns `{ buffer, contentType }` or throws. Extracted from the analyze route's inline logic; the analyze route is refactored to use it (DRY, removes duplication).
- **`lib/creator-ai.ts`** — add `buildHookExtractionPrompt(video)`, `VIRAL_RESCUE_SYSTEM_PROMPT`, `generateViralRescue(geminiBreakdown, video, accountAvgViews, caption)` (Claude call, returns `ViralRescue`), and `parseViralRescue(text)`.
- **`app/api/creator/rescue/route.ts`** (new) — `POST {videoId}`: find video → Gemini extraction → Claude rescue → save `viralRescue` JSON → return parsed object. `maxDuration = 300`.
- **`components/creator/viral-rescue-modal.tsx`** (new) — renders the structured rescue; hooks as hero cards, recommended one highlighted; score, autopsy, retention, script, caption/CTA, priority list.
- **`components/creator/video-grid.tsx`** — add the "Make It Viral" / "View Rescue" button + state + modal wiring.
- **Tests:** `lib/__tests__/creator-rescue.test.ts` — `parseViralRescue` (valid, prose-wrapped/fenced, garbage, missing-field rejection).

## Model

Claude `claude-sonnet-4-5-20250929` (matches the rest of `creator-ai.ts`), a single `MODEL` constant — trivially upgradable. Gemini uses the existing `gemini.ts` client (whatever model it points at), so no change there.

## Error handling

- Video unfetchable after re-scrape → `502` with message; button re-enables for retry.
- Gemini error → propagated as `500`; nothing saved.
- Claude returns unparseable JSON → `parseViralRescue` returns `null` → route responds `502 "Could not parse rescue — try again"`; nothing saved.
- Missing API keys throw the same explicit errors as existing clients.
- The saved `viralRescue` is only written after a fully valid parse, so a partial/failed run never corrupts the row.

## Testing

- Unit: `parseViralRescue` across valid/fenced/garbage/missing-field inputs.
- Build: `npm run build` type-checks the new route, schema, and components.
- Manual: on the live server, run Make It Viral on a genuine below-average @instudicom reel → verify 5 ready-to-film hooks, persisted result, "View Rescue" reopen, and Regenerate.

## Out of scope

- Re-editing/rendering the actual video; A/B tracking of rescued reposts; batch-rescue of many videos at once; changing the existing competitor pipeline; multi-account support.
