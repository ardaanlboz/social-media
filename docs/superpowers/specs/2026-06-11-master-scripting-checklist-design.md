# Master Scripting Checklist — Design

**Date:** 2026-06-11
**Status:** Approved by user

## Purpose

Add a global "Master Scripting Checklist" that oversees every script/concept generation in the pipeline. The checklist encodes the user's viral-scripting rules (broad hook, open loop, visual movement, clear solution, viewer depictable, unique, under 1 minute, worth $5, stakes & curiosity, unskippable hook). Every generated concept must be checked against it, revised when it fails, and shipped with a visible compliance scorecard.

## Decisions (made with user)

1. **Enforcement:** Verify-and-revise loop — checklist injected into generation, plus an independent Claude verifier pass that grades each concept and drives automatic revision of failures.
2. **Storage:** Single global file `data/master-checklist.md`, editable from the app UI (Configs page). Applies to all configs; not per-config.
3. **Scope:** Applied at BOTH stages — Gemini analysis evaluates the reference video against the checklist, and Claude concept generation must satisfy it.
4. **Visibility:** Verification results are saved per video (new `videos.csv` column) and rendered as a scorecard in the Videos page.
5. **Loop structure:** Independent verifier (separate grading call), max 2 revision rounds, then save with whatever scorecard the concepts earned.

## The Checklist Content (seed)

`data/master-checklist.md` is seeded with the following items. Each has a stable ID (used in verifier JSON), a name, and a verifiable criterion. The file is plain markdown so the user can edit wording or add/remove items from the UI; IDs are derived from a `- [id] Name: criterion` line format.

```markdown
# Master Scripting Checklist

Every video concept and script MUST satisfy every item below.

- [broad] Broad: The hook is broad enough to catch the widest possible audience and let as many people as possible watch.
- [open-loop] Open loop: The hook creates a question in the viewer's mind so they stay to see the answer.
- [visual-movement] Visual movement: The concept describes a visual hook (e.g., flashing multiple images back to back) that keeps attention and interrupts the scroll pattern.
- [clear-solution] Clear solution: Clear steps to achieve the promised result.
- [viewer-depictable] Viewer depictable: The viewer can see themselves doing it.
- [unique] Unique: It feels like the viewer's first time hearing this advice.
- [under-1-minute] Under 1 minute: The script fits under 60 seconds, maximizes value per second, and uses understandable language.
- [worth-5-dollars] Worth $5: The viewer would pay 5 dollars for this video (e.g., teaches something like how to do independent research).
- [stakes-curiosity] Stakes & curiosity: Increases the stakes and creates curiosity and suspense, especially in the hook. Uses In Medias Res when suitable.
- [unskippable-hook] Unskippable hook: The most unskippable and most engaging part of the video IS the hook — it keeps the viewer for the first 5 seconds.
```

## Architecture

### New module: `app/src/lib/checklist.ts`

- `readMasterChecklist(): string` — returns raw markdown from `data/master-checklist.md`; returns `""` if the file is missing or empty.
- `writeMasterChecklist(content: string): void` — writes the file.
- `parseChecklistItems(markdown: string): { id: string; label: string; criterion: string }[]` — parses `- [id] Name: criterion` lines; used by the verifier prompt and the UI scorecard rendering. Lines that don't match the format are ignored.

The file lives in `data/` alongside the CSVs (read/written with the same `DATA_DIR` resolution as `csv.ts`).

### New module: `app/src/lib/verifier.ts`

- `verifyConcepts(concepts: string, checklistMarkdown: string): Promise<ChecklistVerdict>` — one Claude call (same model as `claude.ts`) prompted ONLY to grade. Uses structured JSON output: for each concept found in the text, for each checklist item id: `pass: boolean` and `feedback: string` (one line, only when failing). Robust JSON extraction; on malformed output retry once, then throw.
- `reviseConcepts(originalConcepts: string, verdict: ChecklistVerdict, videoAnalysis: string, newConceptsPrompt: string, checklistMarkdown: string): Promise<string>` — Claude call that rewrites ONLY what's needed to fix the failed items, given the verifier's specific feedback, while keeping the config's instructions.

### Types (`app/src/lib/types.ts`)

```ts
export interface ChecklistItemVerdict {
  itemId: string;
  pass: boolean;
  feedback: string;
}

export interface ConceptVerdict {
  conceptLabel: string;          // e.g. "Concept 1" — as identified by the verifier
  items: ChecklistItemVerdict[];
}

export interface ChecklistVerdict {
  concepts: ConceptVerdict[];
  allPass: boolean;
}

export interface ChecklistResult {
  verdict: ChecklistVerdict;     // final verdict after the loop
  revisionRounds: number;        // 0, 1, or 2
}
```

`Video` gains `checklistResult: string` (JSON-serialized `ChecklistResult`, `""` for legacy rows / when skipped).

### Pipeline flow (`app/src/lib/pipeline.ts`)

Per video, replacing the current single `generateNewConcepts` step:

```
1. checklist = readMasterChecklist()            // once per run, before the loop
2. analysis  = analyzeVideo(..., analysisInstruction + checklist evaluation section)
3. concepts  = generateNewConcepts(analysis, newConceptsInstruction, checklist)
4. if checklist is empty → save video as today (no verification), done
5. verdict   = verifyConcepts(concepts, checklist)
6. rounds = 0
   while (!verdict.allPass && rounds < 2):
       concepts = reviseConcepts(concepts, verdict, analysis, newConceptsInstruction, checklist)
       verdict  = verifyConcepts(concepts, checklist)
       rounds++
7. save video with concepts + checklistResult { verdict, revisionRounds: rounds }
```

Progress task steps added: `"Verifying against checklist"`, `"Revising concepts (round N)"`, `"Re-verifying"`.

### Prompt injection points

- **Gemini** (`analyzeVideo` call site in `pipeline.ts`): when the checklist is non-empty, append to the config's `analysisInstruction`:
  a `# CHECKLIST EVALUATION` section instructing Gemini to list, for each checklist item, whether the reference video satisfies it and how (one line each). This rides along in the existing single prompt parameter — `gemini.ts` itself does not change.
- **Claude generation** (`claude.ts` — `generateNewConcepts` gains a third parameter `masterChecklist?: string`): when non-empty, a `# MASTER SCRIPTING CHECKLIST (MANDATORY)` section is added to the prompt stating every generated concept must satisfy every item, with special emphasis on the hook rule (most engaging part = first 5 seconds).

### API routes

- `GET /api/checklist` → `{ content: string }`
- `PUT /api/checklist` → body `{ content: string }`, writes the file.

### UI

- **Configs page** (`app/src/app/configs/page.tsx`): a "Master Scripting Checklist" card at the top — textarea bound to the file content, Save button, helper text: "Applies to every config and every generation." Shows parsed item count as a sanity check.
- **Videos page** (`app/src/app/videos/page.tsx`): in the expanded video view, a scorecard block per concept: ✓/✗ chip per checklist item (label from parsed checklist ids; fall back to itemId when the current checklist no longer contains the id), header like "Checklist: 9/10 passed · 1 revision round". Videos with empty `checklistResult` show nothing (backward compatible).

### CSV (`app/src/lib/csv.ts`)

- `VIDEO_COLUMNS` gains `"checklistResult"`; `readVideos` maps it with `r.checklistResult || ""`. Existing rows simply read as empty — no migration needed.

## Error handling

- **Verifier call fails (after its one internal retry):** log to pipeline progress, save the video with concepts and `checklistResult` = `""` — same as a legacy/unverified row, so the UI shows no scorecard. A grading failure must never lose a video.
- **Revision call fails:** keep the last good concepts and the last verdict; save with the failing scorecard.
- **Checklist file missing/empty:** the entire feature is a no-op — prompts and pipeline behave exactly as today.
- **Verifier returns concepts count mismatch / unknown item ids:** accept what parses; unknown ids are kept in the data and rendered by raw id.

## Cost note

Per video: +0 Gemini calls (section rides in the existing prompt), +1 Claude verify call minimum, up to +2 revise and +2 re-verify calls in the worst case (5 Claude calls total vs. 1 today). Acceptable per user's enforcement choice.

## Out of scope

- Per-config checklist overrides or opt-outs.
- Blocking/discarding videos that never pass (they are saved with their failing scorecard).
- Re-verifying historical videos in `videos.csv`.

## Verification plan (manual — no test framework in repo)

1. Open Configs page → checklist card shows seeded content; edit + save → file updated.
2. Run pipeline with 1 creator, `topK=1`: log shows verify (and possibly revise) steps.
3. `data/videos.csv` row contains a JSON `checklistResult`.
4. Videos page shows the scorecard with per-item chips and revision count.
5. Empty the checklist file → run again → pipeline behaves exactly as before, no scorecard.

## Documentation updates

- `CLAUDE.md`: pipeline overview gains the checklist/verification step; workspace structure gains `data/master-checklist.md`, `lib/checklist.ts`, `lib/verifier.ts`, `api/checklist`.
