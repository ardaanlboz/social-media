# Nexus Framework — Design

**Date:** 2026-06-11
**Status:** Approved by user

## Purpose

Add the user's "Nexus Framework" (content-creation guidelines: quick wins, foundations, value criteria, ideation, 8 scripting commandments, script structure, hooks, interest peak, value, promise, CTA, sandwich storytelling, recording process, screen zones) as a second global guidance layer in the pipeline — the same shape as the Master Scripting Checklist, but injected as writing rules only, not graded.

## Decisions (made with user)

1. **Enforcement:** Inject as guidance only. The framework is injected into generation prompts as mandatory writing rules. The verifier continues to grade ONLY the existing master checklist items — no new checklist items, no scorecard changes, no new per-video data.
2. **Injection points:** BOTH stages, same as the checklist — Gemini analysis (as descriptive vocabulary/context) and Claude generation + the revision call (as mandatory writing rules).
3. **Code structure:** Mirror the checklist pattern (separate small module + route), no generalization of the existing checklist code.

## Storage

- `data/nexus-framework.md` — single global file, seeded verbatim with the user's Nexus Framework markdown (preserved exactly as provided, including tables and informal wording).
- Empty or missing file → the entire feature is a no-op; prompts are exactly as today.

## Architecture

### New module: `app/src/lib/framework.ts`

Mirrors `app/src/lib/checklist.ts`:

- `readNexusFramework(): string` — returns trimmed file content, `""` if missing.
- `writeNexusFramework(content: string): void` — writes the file (creating `data/` if needed).

No parsing — the framework has no item structure to parse.

### New API route: `app/src/app/api/framework/route.ts`

Mirrors `api/checklist/route.ts`:

- `GET` → `{ content: string }`
- `PUT` body `{ content: string }` → writes, returns `{ content }`; 400 if `content` is not a string.

### Pipeline (`app/src/lib/pipeline.ts`)

- Read once per run next to the checklist: `const nexusFramework = readNexusFramework();` with a log line when non-empty.
- **Gemini analysis instruction:** when non-empty, append after the existing checklist-evaluation section:

  ```
  # NEXUS FRAMEWORK (CONTEXT)
  Where relevant, use the vocabulary and concepts of this framework (hooks, interest peak,
  value trinity, CTA types, sandwich storytelling) when describing the reference video.
  ------
  <framework content>
  ------
  ```

- **Generation:** pass as a new 4th argument to `generateNewConcepts(analysis, instruction, masterChecklist, nexusFramework)`.
- **Revision:** pass as a new 6th argument to `reviseConcepts(..., nexusFramework)` so revised scripts also follow the rules.
- **Verifier (`verifyConcepts`): unchanged.**

### `app/src/lib/claude.ts`

`generateNewConcepts` gains a 4th optional parameter `nexusFramework = ""`. When non-empty, a section is inserted into the prompt BEFORE the checklist section:

```
# NEXUS FRAMEWORK (MANDATORY WRITING RULES)
Write every concept and script following these rules (You-form, conviction, linear
storytelling, unique power words, simplicity, visual-in-mind, hook expansion, etc.).
------
<framework content>
------
```

### `app/src/lib/verifier.ts`

`reviseConcepts` gains a 6th optional parameter `nexusFramework = ""`, injected with the same section text as in `claude.ts`, placed before the checklist section in the revision prompt. `verifyConcepts` is NOT changed.

### UI (`app/src/app/configs/page.tsx`)

A second card directly below the Master Scripting Checklist card: "Nexus Framework" — `BookOpen` icon (amber/orange gradient to distinguish from the emerald checklist card), helper text "Global writing rules injected into every analysis and generation — not graded", textarea (rows=12, mono), Save button calling `PUT /api/framework`. State mirrors the checklist card (`framework`, `frameworkSaving`). No item count (nothing to parse).

## Error handling

- Missing/empty file → no-op everywhere (same degradation contract as the checklist).
- API PUT validates `content` is a string; otherwise 400.
- No changes to pipeline error handling — the framework only alters prompt text.

## Out of scope

- Grading framework adherence (verifier unchanged).
- New checklist items derived from the framework.
- Per-config framework overrides.
- Any new columns in videos.csv.

## Verification plan (manual — no test framework in repo)

1. `cd app && npx tsc --noEmit` and `npm run build` pass.
2. `GET /api/framework` returns the seeded content; `PUT` roundtrip updates and restores the file.
3. Configs page shows both cards; editing + saving the framework persists to `data/nexus-framework.md`.
4. Empty `data/nexus-framework.md` → prompts identical to today (no framework sections).
5. Live pipeline run (when API keys are available): generated concepts reflect You-form/conviction rules; analysis may reference framework vocabulary.

## Documentation updates

- `CLAUDE.md`: add the Nexus Framework to the "How The System Works" section (alongside the Master Scripting Checklist), `lib/framework.ts` + `api/framework` + `data/nexus-framework.md` to the workspace structure.
