# Master Scripting Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global, UI-editable Master Scripting Checklist that is injected into Gemini analysis and Claude concept generation, enforced by an independent verify-and-revise loop, with a per-video scorecard saved to videos.csv and rendered in the Videos page.

**Architecture:** A markdown file `data/master-checklist.md` is the single source of truth, read/written by a new server module `lib/checklist.ts` (parsing lives in a client-safe `lib/checklist-parse.ts`). The pipeline injects the checklist into both AI prompts, then a new `lib/verifier.ts` grades generated concepts (separate Claude call, strict JSON verdict) and drives up to 2 revision rounds. The final verdict is JSON-serialized into a new `checklistResult` column on videos.csv.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Anthropic SDK (`claude-sonnet-4-5-20250929`), CSV storage, shadcn/ui + Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-11-master-scripting-checklist-design.md`

**Testing note:** This repo has no test framework (per spec, verification is manual + type-checking). Each task verifies with `npx tsc --noEmit` from `app/`, and Task 9 does a full build + manual end-to-end verification. Do not add a test framework.

**All commands run from the repo root** unless stated otherwise. The app lives in `app/`.

---

### Task 1: Checklist parsing module (client-safe)

**Files:**
- Create: `app/src/lib/checklist-parse.ts`

This module is imported by both server code and client components, so it must not import `fs`.

- [ ] **Step 1: Create `app/src/lib/checklist-parse.ts`**

```ts
export interface ChecklistItem {
  id: string;
  label: string;
  criterion: string;
}

const ITEM_LINE = /^-\s*\[([a-z0-9-]+)\]\s*([^:]+):\s*(.+)$/;

export function parseChecklistItems(markdown: string): ChecklistItem[] {
  return markdown
    .split("\n")
    .map((line) => ITEM_LINE.exec(line.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ id: m[1], label: m[2].trim(), criterion: m[3].trim() }));
}
```

- [ ] **Step 2: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: exits 0, no output.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/checklist-parse.ts
git commit -m "feat: add client-safe checklist item parser"
```

---

### Task 2: Checklist storage module + seed file

**Files:**
- Create: `app/src/lib/checklist.ts`
- Create: `data/master-checklist.md`

- [ ] **Step 1: Create `app/src/lib/checklist.ts`**

Same `DATA_DIR` resolution as `app/src/lib/csv.ts` (`process.cwd()` is `app/` at runtime, so data lives one level up).

```ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const CHECKLIST_PATH = path.join(DATA_DIR, "master-checklist.md");

export function readMasterChecklist(): string {
  if (!existsSync(CHECKLIST_PATH)) return "";
  return readFileSync(CHECKLIST_PATH, "utf-8").trim();
}

export function writeMasterChecklist(content: string): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CHECKLIST_PATH, content, "utf-8");
}
```

- [ ] **Step 2: Create `data/master-checklist.md`** with exactly this seed content:

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

- [ ] **Step 3: Sanity-check the parser against the seed file**

Run from repo root:
```bash
cd app && npx tsc --noEmit && node -e "
const md = require('fs').readFileSync('../data/master-checklist.md','utf-8');
const items = md.split('\n').map(l => /^-\s*\[([a-z0-9-]+)\]\s*([^:]+):\s*(.+)$/.exec(l.trim())).filter(Boolean);
console.log(items.length + ' items parsed');
if (items.length !== 10) process.exit(1);
"
```
Expected: prints `10 items parsed`, exits 0.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/checklist.ts data/master-checklist.md
git commit -m "feat: add master checklist storage and seed content"
```

---

### Task 3: Types + CSV column

**Files:**
- Modify: `app/src/lib/types.ts`
- Modify: `app/src/lib/csv.ts`
- Modify: `app/src/lib/pipeline.ts` (one line — keep it compiling)

- [ ] **Step 1: Add checklist types to `app/src/lib/types.ts`** (append at the end of the file)

```ts
export interface ChecklistItemVerdict {
  itemId: string;
  pass: boolean;
  feedback: string;
}

export interface ConceptVerdict {
  conceptLabel: string;
  items: ChecklistItemVerdict[];
}

export interface ChecklistVerdict {
  concepts: ConceptVerdict[];
  allPass: boolean;
}

export interface ChecklistResult {
  verdict: ChecklistVerdict;
  revisionRounds: number;
}
```

- [ ] **Step 2: Add `checklistResult` to the `Video` interface in `app/src/lib/types.ts`**

In `export interface Video`, after `starred: boolean;` add:

```ts
  checklistResult: string;
```

- [ ] **Step 3: Update `app/src/lib/csv.ts`**

Change `VIDEO_COLUMNS` to:

```ts
const VIDEO_COLUMNS = ["id", "link", "thumbnail", "creator", "views", "likes", "comments", "analysis", "newConcepts", "datePosted", "dateAdded", "configName", "starred", "checklistResult"];
```

In `readVideos()`, after `starred: r.starred === "true",` add:

```ts
    checklistResult: r.checklistResult || "",
```

- [ ] **Step 4: Keep `pipeline.ts` compiling**

In `app/src/lib/pipeline.ts`, in the `videoRecord: Video = {` literal, after `starred: false,` add:

```ts
          checklistResult: "",
```

(Task 5 replaces this with the real value.)

- [ ] **Step 5: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: exits 0. Existing rows in videos.csv lack the column — `readVideos` defaults them to `""`, no migration needed.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/types.ts app/src/lib/csv.ts app/src/lib/pipeline.ts
git commit -m "feat: add checklist verdict types and checklistResult video column"
```

---

### Task 4: Verifier module (grade + revise)

**Files:**
- Create: `app/src/lib/verifier.ts`

- [ ] **Step 1: Create `app/src/lib/verifier.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { ChecklistVerdict, ConceptVerdict } from "./types";

const MODEL = "claude-sonnet-4-5-20250929";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

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
  const client = getClient();
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
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    const text = block.type === "text" ? block.text : "";
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
  checklistMarkdown: string
): Promise<string> {
  const client = getClient();
  const failures = verdict.concepts
    .map((c) => {
      const failed = c.items.filter((i) => !i.pass);
      if (failed.length === 0) return "";
      return `${c.conceptLabel}:\n${failed.map((i) => `- [${i.itemId}] ${i.feedback}`).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `# ROLE
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
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}
```

- [ ] **Step 2: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/verifier.ts
git commit -m "feat: add independent checklist verifier and concept reviser"
```

---

### Task 5: Inject checklist into Claude generation

**Files:**
- Modify: `app/src/lib/claude.ts`

- [ ] **Step 1: Add the optional `masterChecklist` parameter and prompt section**

Replace the full contents of `app/src/lib/claude.ts` with:

```ts
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
```

- [ ] **Step 2: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: exits 0. (Existing call site passes 2 args; the third defaults to `""` which produces the identical prompt as before.)

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/claude.ts
git commit -m "feat: inject master checklist into concept generation prompt"
```

---

### Task 6: Pipeline integration (analysis injection + verify-and-revise loop)

**Files:**
- Modify: `app/src/lib/pipeline.ts`

- [ ] **Step 1: Add imports**

At the top of `app/src/lib/pipeline.ts`, add to the existing imports:

```ts
import { readMasterChecklist } from "./checklist";
import { verifyConcepts, reviseConcepts } from "./verifier";
import type { ChecklistResult, ChecklistVerdict } from "./types";
```

(`ChecklistResult`/`ChecklistVerdict` go in the existing `import type { ... } from "./types"` line.)

- [ ] **Step 2: Load the checklist and build the augmented analysis instruction**

In `runPipeline`, directly after `log(\`Loaded config: ${config.configName}\`);`, add:

```ts
    const masterChecklist = readMasterChecklist();
    if (masterChecklist) log("Master scripting checklist loaded — verification enabled");

    const analysisInstruction = masterChecklist
      ? `${config.analysisInstruction}

# CHECKLIST EVALUATION
After the sections above, add a "# CHECKLIST" section: for each item of the master scripting checklist below, state in one line whether this reference video satisfies it and how.
------
${masterChecklist}
------`
      : config.analysisInstruction;
```

- [ ] **Step 3: Use the augmented instruction in the Gemini call**

In the video worker, change:

```ts
        const analysis = await analyzeVideo(
          fileData.uri,
          fileData.mimeType,
          config.analysisInstruction
        );
```

to:

```ts
        const analysis = await analyzeVideo(
          fileData.uri,
          fileData.mimeType,
          analysisInstruction
        );
```

- [ ] **Step 4: Pass the checklist to generation and run the verify-and-revise loop**

Change:

```ts
        const newConcepts = await generateNewConcepts(analysis, config.newConceptsInstruction);
```

to:

```ts
        let newConcepts = await generateNewConcepts(analysis, config.newConceptsInstruction, masterChecklist);

        let checklistResult = "";
        if (masterChecklist) {
          let verdict: ChecklistVerdict | null = null;
          let rounds = 0;
          try {
            updateTask(taskId, "Verifying against checklist");
            log(`@${video.username} (${label}): verifying against checklist`);
            verdict = await verifyConcepts(newConcepts, masterChecklist);

            while (!verdict.allPass && rounds < 2) {
              rounds++;
              updateTask(taskId, `Revising concepts (round ${rounds})`);
              log(`@${video.username} (${label}): revising concepts (round ${rounds})`);
              newConcepts = await reviseConcepts(
                newConcepts,
                verdict,
                analysis,
                config.newConceptsInstruction,
                masterChecklist
              );
              updateTask(taskId, "Re-verifying");
              verdict = await verifyConcepts(newConcepts, masterChecklist);
            }
          } catch (err) {
            // A grading failure must never lose a video — keep the last verdict (if any) and move on.
            log(`@${video.username} (${label}): checklist step failed (${err instanceof Error ? err.message : err})`);
          }
          if (verdict) {
            const result: ChecklistResult = { verdict, revisionRounds: rounds };
            checklistResult = JSON.stringify(result);
            log(
              `@${video.username} (${label}): checklist ${verdict.allPass ? "passed" : "NOT fully passed"} after ${rounds} revision round(s)`
            );
          }
        }
```

- [ ] **Step 5: Save the result on the video record**

In the `videoRecord: Video = {` literal, change `checklistResult: "",` (added in Task 3) to:

```ts
          checklistResult,
```

- [ ] **Step 6: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/pipeline.ts
git commit -m "feat: enforce master checklist in pipeline with verify-and-revise loop"
```

---

### Task 7: Checklist API route

**Files:**
- Create: `app/src/app/api/checklist/route.ts`

- [ ] **Step 1: Create `app/src/app/api/checklist/route.ts`**

```ts
import { NextResponse } from "next/server";
import { readMasterChecklist, writeMasterChecklist } from "@/lib/checklist";

export async function GET() {
  return NextResponse.json({ content: readMasterChecklist() });
}

export async function PUT(request: Request) {
  const body = await request.json();
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content must be a string" }, { status: 400 });
  }
  writeMasterChecklist(body.content);
  return NextResponse.json({ content: readMasterChecklist() });
}
```

- [ ] **Step 2: Verify by hand**

Run: `cd app && npx tsc --noEmit`
Expected: exits 0.

Then with the dev server running (`cd app && npm run dev` in another terminal):
```bash
curl -s http://localhost:3000/api/checklist | head -c 200
```
Expected: JSON starting with `{"content":"# Master Scripting Checklist...`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/checklist/route.ts
git commit -m "feat: add GET/PUT API route for master checklist"
```

---

### Task 8: Configs page — Master Checklist card

**Files:**
- Modify: `app/src/app/configs/page.tsx`

- [ ] **Step 1: Add imports**

In `app/src/app/configs/page.tsx`, add `ClipboardCheck` to the lucide-react import:

```ts
import { Plus, Pencil, Trash2, Settings2, Sparkles, Search, Users, Film, ClipboardCheck } from "lucide-react";
```

and below the type import add:

```ts
import { parseChecklistItems } from "@/lib/checklist-parse";
```

- [ ] **Step 2: Add state + handlers**

Inside `ConfigsPage()`, after the existing `useState` declarations, add:

```ts
  const [checklist, setChecklist] = useState("");
  const [checklistSaving, setChecklistSaving] = useState(false);
```

In the existing `useEffect`, add one more fetch:

```ts
    fetch("/api/checklist").then((r) => r.json()).then((d) => setChecklist(d.content || ""));
```

After `handleDelete`, add:

```ts
  const saveChecklist = async () => {
    setChecklistSaving(true);
    await fetch("/api/checklist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: checklist }),
    });
    setChecklistSaving(false);
  };

  const checklistItemCount = parseChecklistItems(checklist).length;
```

- [ ] **Step 3: Render the card**

In the returned JSX, directly after the closing `</div>` of the header block (the `flex items-end justify-between` div, which ends after the `</Dialog>`), insert:

```tsx
      {/* Master Scripting Checklist */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20">
            <ClipboardCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Master Scripting Checklist</h3>
            <p className="text-xs text-muted-foreground">
              Applies to every config and every generation — {checklistItemCount} items parsed
            </p>
          </div>
        </div>
        <Textarea
          value={checklist}
          onChange={(e) => setChecklist(e.target.value)}
          rows={12}
          placeholder="- [item-id] Item name: criterion..."
          className="mt-4 rounded-xl glass border-white/[0.08] font-mono text-xs leading-relaxed"
        />
        <Button
          onClick={saveChecklist}
          disabled={checklistSaving}
          className="mt-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 border-0"
        >
          {checklistSaving ? "Saving..." : "Save Checklist"}
        </Button>
      </div>
```

- [ ] **Step 4: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: exits 0.

With the dev server running, open http://localhost:3000/configs — the card shows the seeded checklist, "10 items parsed", and Save persists edits to `data/master-checklist.md`.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/configs/page.tsx
git commit -m "feat: add master checklist editor card to configs page"
```

---

### Task 9: Videos page — scorecard rendering

**Files:**
- Modify: `app/src/app/videos/page.tsx`

- [ ] **Step 1: Add imports**

Add `Check` and `ClipboardCheck` to the lucide-react import:

```ts
import { Heart, MessageCircle, Film, Sparkles, Search, Star, Play, ArrowUpDown, X, ExternalLink, Check, ClipboardCheck } from "lucide-react";
```

Change the existing type import line to include `ChecklistResult`:

```ts
import type { Video, Config, ChecklistResult } from "@/lib/types";
```

and add below it:

```ts
import { parseChecklistItems } from "@/lib/checklist-parse";
```

- [ ] **Step 2: Add a parse helper**

Below the `formatViews` function, add:

```ts
function parseChecklistResult(raw: string): ChecklistResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ChecklistResult;
    if (!parsed?.verdict?.concepts) return null;
    return parsed;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Load checklist labels**

Inside `VideosContent()`, add state:

```ts
  const [checklistContent, setChecklistContent] = useState("");
```

In the existing `useEffect`, add:

```ts
    fetch("/api/checklist").then((r) => r.json()).then((d) => setChecklistContent(d.content || ""));
```

After the `uniqueCreators` line, add:

```ts
  const itemLabels = new Map(parseChecklistItems(checklistContent).map((i) => [i.id, i.label]));
  const modalChecklist = modalVideo ? parseChecklistResult(modalVideo.checklistResult) : null;
  const modalChecklistItems = modalChecklist
    ? modalChecklist.verdict.concepts.flatMap((c) => c.items)
    : [];
  const modalChecklistPassed = modalChecklistItems.filter((i) => i.pass).length;
```

- [ ] **Step 4: Render the scorecard in the modal**

In the modal body (`<div className="overflow-y-auto max-h-[calc(90vh-100px)] p-6">`), directly BEFORE the `<MarkdownContent ... />` element, insert:

```tsx
                {modalSection === "concepts" && modalChecklist && (
                  <div className="mb-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-emerald-400" />
                      <p className="text-sm font-semibold">
                        Checklist: {modalChecklistPassed}/{modalChecklistItems.length} passed
                        {modalChecklist.revisionRounds > 0 &&
                          ` · ${modalChecklist.revisionRounds} revision round${modalChecklist.revisionRounds > 1 ? "s" : ""}`}
                      </p>
                    </div>
                    {modalChecklist.verdict.concepts.map((concept, ci) => (
                      <div key={ci} className="rounded-xl bg-black/20 border border-white/[0.04] p-3">
                        <p className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider mb-2">
                          {concept.conceptLabel}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {concept.items.map((item) => (
                            <span
                              key={item.itemId}
                              title={item.feedback || undefined}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] border ${
                                item.pass
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                                  : "bg-red-500/10 border-red-500/20 text-red-300"
                              }`}
                            >
                              {item.pass ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                              {itemLabels.get(item.itemId) || item.itemId}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
```

- [ ] **Step 5: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: exits 0. Videos with empty `checklistResult` (all legacy rows) render exactly as before — `parseChecklistResult("")` returns null.

- [ ] **Step 6: Commit**

```bash
git add app/src/app/videos/page.tsx
git commit -m "feat: render checklist scorecard in videos page modal"
```

---

### Task 10: Docs + final verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

In **Pipeline Overview**, replace step 6 and renumber:

```markdown
6. **Generate** — Send analysis + brand context to Claude for adapted video concepts (master scripting checklist injected as mandatory rules)
7. **Verify** — Independent Claude verifier grades every concept against the master checklist; failing concepts are revised with the verifier's feedback (max 2 rounds); the final scorecard is saved with the video
8. **Save** — Append results to `data/videos.csv`, viewable in the Videos page with thumbnails and checklist scorecards
```

After the "Two Customizable Prompts Per Config" section, add:

```markdown
### Master Scripting Checklist

A global checklist (`data/master-checklist.md`, editable on the Configs page) that oversees every generation:
- Injected into the Gemini analysis prompt (reference video is evaluated against it)
- Injected into the Claude concepts prompt as mandatory rules
- Enforced by `lib/verifier.ts`: independent grading + up to 2 automatic revision rounds
- Verdict saved per video as JSON in the `checklistResult` column, rendered as a scorecard in the Videos page
- Item line format: `- [item-id] Label: criterion`; an empty/missing file disables the feature entirely
```

In the **Workspace Structure** tree, add under `lib/`:

```
│   │   │   ├── checklist.ts              # Master checklist file read/write
│   │   │   ├── checklist-parse.ts        # Client-safe checklist item parser
│   │   │   ├── verifier.ts               # Checklist verify-and-revise (Claude)
```

and under `data/`:

```
│   ├── master-checklist.md                # Global scripting checklist
```

- [ ] **Step 2: Full build**

Run: `cd app && npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Manual end-to-end verification (requires API keys in `.env`)**

1. `cd app && npm run dev`
2. Configs page: checklist card shows seed content, edit + Save, confirm `data/master-checklist.md` changed, restore content.
3. Run page: run a pipeline with 1 creator config, `maxVideos` small, `topK=1`. Watch for log lines "verifying against checklist" and (possibly) "revising concepts (round 1)".
4. Check the newest row in `data/videos.csv` has a JSON `checklistResult` value.
5. Videos page: open the new video's Concepts modal — scorecard renders with ✓/✗ chips and pass count.
6. Empty `data/master-checklist.md`, run again: no verify steps in the log, video saved without scorecard. Restore the checklist afterwards.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document master scripting checklist in CLAUDE.md"
```
