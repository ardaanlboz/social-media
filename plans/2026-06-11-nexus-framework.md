# Nexus Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Nexus Framework as a second global, UI-editable guidance document injected into Gemini analysis and Claude generation/revision prompts as mandatory writing rules — not graded by the verifier.

**Architecture:** Mirrors the master-checklist pattern exactly: `data/nexus-framework.md` is the source of truth, read/written by a new `lib/framework.ts`, exposed via `api/framework` (GET/PUT), edited from a second card on the Configs page. The pipeline reads it once per run and appends it to the analysis instruction, the generation prompt, and the revision prompt. `verifyConcepts` is untouched.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Anthropic SDK, CSV/markdown file storage, shadcn/ui + Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-11-nexus-framework-design.md`

**Testing note:** No test framework in this repo (per spec, verification is manual + type-checking). Each task verifies with `npx tsc --noEmit` from `app/`; the final task does a full build + API roundtrip. Do not add a test framework.

---

### Task 1: Framework storage module + seed file

**Files:**
- Create: `app/src/lib/framework.ts`
- Create: `data/nexus-framework.md`

- [ ] **Step 1: Create `app/src/lib/framework.ts`**

```ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const FRAMEWORK_PATH = path.join(DATA_DIR, "nexus-framework.md");

export function readNexusFramework(): string {
  if (!existsSync(FRAMEWORK_PATH)) return "";
  return readFileSync(FRAMEWORK_PATH, "utf-8").trim();
}

export function writeNexusFramework(content: string): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FRAMEWORK_PATH, content, "utf-8");
}
```

- [ ] **Step 2: Create `data/nexus-framework.md`** with the user's framework verbatim:

````markdown
# Nexus Framework

---

## 5 Quick Wins

- **Negativity Always Wins** — Be negative to the mistake, never the viewer themselves.
- **Hook Expansion** — Broaden your hook. Niche down during the video. *"When someone says you are too expensive, here's how you respond to that."*
- **Speaking in "You" Form** — Replace any plural with "you". Give ownership. *"do you like the dog" → "do you like your dog"*
- **Recording Like a G** — No white shirts, no big text. Read line by line, repeat until good. Remember hand positions between lines. Do not blink.
- **Optimized Captions** — A little below the chin. Remove captions briefly if a graphic needs placement.

---

## Foundations

- Only good content matters.
- Do not use 3rd party scheduler.
- Create a positive reinforcement for the audience to watch your videos.

**9 Gifts 1 Guide**
- 9 videos with audience best interest in mind
- 1 video with both interests (me + audience) — start with value, guide them to take action

---

## What Makes a Valuable Video

**Relevant**
- Information gap — present the unknown question, be the bridge
- Common problem / unaware problem / unmet desire
- Relevant = valuable → relevant to a larger group of people, solve a bigger problem

**Clear Solution**
- All the information from A to B

**Viewer Depictable**
- Can the viewer see themselves doing it? Do they believe they'll achieve the promised result?

**Unique**
- New, easier, or more efficient. *"Never thought of it that way."*

**Worth 5 Dollars**
- If the audience gives a full watch, is the video worth it?

---

## Niched Down

1. Pick a niche
2. Become the niche — do not get distracted
3. Expand the niche

---

## Contentpreneur Schedule

- The larger the recording batch → the slower you grow
- The shorter the recording batch → the faster you grow
- **6 videos per week**

| Block | Time |
|---|---|
| Ideation | 2 hrs |
| Scripting | 4 hrs |
| Recording | 2 hrs (3 takes per script, ~20 min each) |

---

## Ideation

### Active Ideation

**Instagram:**
- Hit list: top performing creators (Content Studio — creator analysis)
- Look at their following to find more competitors
- Tool: Instagram & TikTok Sorter ($4.50/month)
- Go to competitor → sort reels by views (descending) → get script via TokScript

**TikTok:**
- Same extension as Instagram
- TikTok search sort (use niche searches)
- Check "Others searched for" bar

**Other:** X (Twitter), Quora

### Passive Ideation

- **Idea Catcher** — write down ideas immediately (physical or digital)
- Favorite your top 5 creators — follow profile, what you see, save to favorites
- Optimize your reels feed (click interested / not interested while scrolling)
- **Instagram Collections:** Content Compass, Editing Inspiration, Hook Inspiration, Great Fucking Videos
- **TikTok Collections** as well
- New email → sign up to competitor email lists → email labels: content pillars + hook inspiration

### Serendipitous Ideation

Finding an idea while seeking knowledge and learning.

---

## Scripting

### 8 Scripting Commandments

**1. You Format**
- Replace plurals: *people → you, some people → you, everyone → you*
- Give ownership: *someone's dog → your dog, a dog → your dog, the dog → your dog*

**2. Unique Power Words**
- Use pattern-interrupting / unique power words
- 3 axes of uniqueness: (1) unexpected for that sentence, (2) unexpected for the niche, (3) unexpected for you
- GPT: Nexus Power Word Enhancer

**3. As Simple As Possible**
- The less the viewer has to use their brain, the better
- Target: Hemingway grade 5 or lower
- Simpler words + shorter sentences
- 1 point per line
- GPT: Nexus Script Simplifier

**4. As Short As Possible**
- Use Vidyard Script Timer
- Value per second test: green / yellow / red
- Stay away from: over-description, redundancies
- Do NOT remove if: it removes trust, removes useful context, or removes processing time

**5. Visual In Mind**
- Visuals are 650% more memorable when matched
- Leave editor comments on script (inspiration videos, graphs, sketches)
- Show don't tell — cut words and replace with visuals
- Allow processing time for visuals

**6. Script With Conviction**
- Use definitive words: *will, definitely, certainly, undoubtedly*
- Make concrete promises: *don't: "5–25k in 6–12 months" → do: "20k/month in 8 months"*
- Avoid qualifiers: *"as long as...", "stay consistent..."*
- Use tactical disclaimer / damaging admission (doesn't soften the promise)

**7. Linear Storytelling**
- Clear sequential structure (maintain predictability and viewer safety)
- Consistent sequential markers: *step 1 – step 2 – step 3* or *day 1 – day 2 – day 3*
- Transitional phrases: *start by, then for step 2, step 3, then finally*

**8. Audible Flow Check**
- Read every single line aloud as you would say it while recording

---

## Script Structure

*Interchangeable — may even exclude 4 and 5.*

1. **Hook** (cannot be moved)
2. **Interest Peak** (moveable depending on when you want interest to peak)
3. **Value**
4. **Promise**
5. **CTA**

---

## Hook

Most important part of the video.

- **Audio hook**
- **Verbal hook**
- **Visual hook (basic):** summarize verbal hook in 3–7 words, one of the words a power word
- **Visual hook (graphic) — SPG: Summarize, Power word, Graphic**
  1. Graphic borrowing interest from something more popular than yourself
  2. Graphic previewing what the viewer is about to learn
  3. Graphic showcasing a singular symbolic image
  4. Graphic highlighting the before, after, or transformation

*A visual hook is the visual representation of your verbal hook.*

---

## Interest Peak

Examples:
- *"Don't fuck this part up."*
- *"If you're questioning my competence, I grew my Instagram from 0 to 200k in 6 months with this strategy."*

---

## Value

1. Make the viewer aware of a problem → then solve it
2. Solve a problem the viewer is already aware of

**Trinity of Value:**
- **Viewer Depictable** — viewers see themselves doing it, believe it'll work, think effort is worth it
- **Unique** — clear solution is easier, more effective, or better explained
- **Clear Solution** — bridge from A (undesired state) to B (desired state), no extra homework

---

## Promise

*You have [result].*

---

## CTA

**Types:**
- **End-roll CTA** — higher conversion rate
- **Mid-roll CTA** — seen by more people, lower conversion; use for loops, pattern interrupts, or step extensions

**2 CTA categories:**
- Engagement CTA
- Off-platform CTA

**CTA Alternative:**
- **Loop** — split hook, put beginning at the end
- **Snap** — end quickly

---

## Sandwich Storytelling

About *when* you say it, not what or how.

Make the first value the golden nugget:
- Put the best tip first
- Put the second best tip last
- Example order: 1st, 3rd, 4th, 5th, 2nd

---

## Recording Process

### Recording Prep

**Realm of competence** — environment or setting that best represents your professional expertise and identity.

**Shirts to never wear:**
- White shirt (wear darker)
- Shirt with big text

**Camera angles:**
- Low angle → empowers the subject (undermines your authority — avoid)
- Eye level → connects you to the viewer (relatable)
- High angle → de-powers the subject (adds authority)
- **Recommended:** Record slightly above eye level; camera positioned just below eye level, aimed down slightly. Eye level at the upper thirds line.

---

## Screen Zones (Devin Zone)

| Zone | Name | Notes |
|---|---|---|
| 1 | No-No Square | Where social media buttons sit — never overlay here |
| 2 | Speaker Square | Center of frame — eyes naturally rest here |
| 3 | Caption Square | Just below chin — captions go here |
| 4 | Graphic Square | Non-focal graphics and animations |
| 5 | Focal Dot | Where viewer attention is always directed |
````

- [ ] **Step 3: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/framework.ts data/nexus-framework.md
git commit -m "feat: add nexus framework storage and seed content"
```

---

### Task 2: Inject framework into Claude generation

**Files:**
- Modify: `app/src/lib/claude.ts`

- [ ] **Step 1: Add the 4th parameter and framework section**

In `app/src/lib/claude.ts`, change the function signature:

```ts
export async function generateNewConcepts(
  videoAnalysis: string,
  newConceptsPrompt: string,
  masterChecklist = "",
  nexusFramework = ""
): Promise<string> {
```

Directly above the existing `const checklistSection = ...`, add:

```ts
  const frameworkSection = nexusFramework
    ? `
# NEXUS FRAMEWORK (MANDATORY WRITING RULES)
Write every concept and script following these rules (You-form, conviction, linear storytelling, unique power words, simplicity, visual-in-mind, hook expansion, etc.).
------
${nexusFramework}
------
`
    : "";
```

In the prompt template, change:

```
------
${checklistSection}
# BEGIN YOUR WORK`,
```

to:

```
------
${frameworkSection}${checklistSection}
# BEGIN YOUR WORK`,
```

- [ ] **Step 2: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: exits 0 (existing call sites pass 3 args; the 4th defaults to `""` producing the identical prompt).

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/claude.ts
git commit -m "feat: inject nexus framework into concept generation prompt"
```

---

### Task 3: Inject framework into the revision call

**Files:**
- Modify: `app/src/lib/verifier.ts`

`verifyConcepts` is NOT changed in any way.

- [ ] **Step 1: Add the 6th parameter to `reviseConcepts`**

Change the signature:

```ts
export async function reviseConcepts(
  originalConcepts: string,
  verdict: ChecklistVerdict,
  videoAnalysis: string,
  newConceptsPrompt: string,
  checklistMarkdown: string,
  nexusFramework = ""
): Promise<string> {
```

Directly after the `const failures = ...` block, add:

```ts
  const frameworkSection = nexusFramework
    ? `
# NEXUS FRAMEWORK (MANDATORY WRITING RULES)
Write every concept and script following these rules (You-form, conviction, linear storytelling, unique power words, simplicity, visual-in-mind, hook expansion, etc.).
------
${nexusFramework}
------
`
    : "";
```

In the revision prompt template, change:

```
------

# MASTER SCRIPTING CHECKLIST (MANDATORY)
```

to:

```
------
${frameworkSection}
# MASTER SCRIPTING CHECKLIST (MANDATORY)
```

(The framework section sits between "MY INSTRUCTIONS FOR NEW CONCEPTS" and the checklist section.)

- [ ] **Step 2: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/verifier.ts
git commit -m "feat: inject nexus framework into concept revision prompt"
```

---

### Task 4: Pipeline integration

**Files:**
- Modify: `app/src/lib/pipeline.ts`

- [ ] **Step 1: Add import**

Next to the existing `import { readMasterChecklist } from "./checklist";` add:

```ts
import { readNexusFramework } from "./framework";
```

- [ ] **Step 2: Read the framework and extend the analysis instruction**

Replace this block (added by the checklist feature):

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

with:

```ts
    const masterChecklist = readMasterChecklist();
    if (masterChecklist) log("Master scripting checklist loaded — verification enabled");

    const nexusFramework = readNexusFramework();
    if (nexusFramework) log("Nexus framework loaded — writing rules enabled");

    let analysisInstruction = config.analysisInstruction;
    if (masterChecklist) {
      analysisInstruction += `

# CHECKLIST EVALUATION
After the sections above, add a "# CHECKLIST" section: for each item of the master scripting checklist below, state in one line whether this reference video satisfies it and how.
------
${masterChecklist}
------`;
    }
    if (nexusFramework) {
      analysisInstruction += `

# NEXUS FRAMEWORK (CONTEXT)
Where relevant, use the vocabulary and concepts of this framework (hooks, interest peak, value trinity, CTA types, sandwich storytelling) when describing the reference video.
------
${nexusFramework}
------`;
    }
```

- [ ] **Step 3: Pass the framework to generation and revision**

Change:

```ts
        let newConcepts = await generateNewConcepts(analysis, config.newConceptsInstruction, masterChecklist);
```

to:

```ts
        let newConcepts = await generateNewConcepts(analysis, config.newConceptsInstruction, masterChecklist, nexusFramework);
```

And inside the verify-and-revise loop, change:

```ts
              newConcepts = await reviseConcepts(
                newConcepts,
                verdict,
                analysis,
                config.newConceptsInstruction,
                masterChecklist
              );
```

to:

```ts
              newConcepts = await reviseConcepts(
                newConcepts,
                verdict,
                analysis,
                config.newConceptsInstruction,
                masterChecklist,
                nexusFramework
              );
```

- [ ] **Step 4: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/pipeline.ts
git commit -m "feat: inject nexus framework into pipeline analysis and generation"
```

---

### Task 5: Framework API route

**Files:**
- Create: `app/src/app/api/framework/route.ts`

- [ ] **Step 1: Create `app/src/app/api/framework/route.ts`**

```ts
import { NextResponse } from "next/server";
import { readNexusFramework, writeNexusFramework } from "@/lib/framework";

export async function GET() {
  return NextResponse.json({ content: readNexusFramework() });
}

export async function PUT(request: Request) {
  const body = await request.json();
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content must be a string" }, { status: 400 });
  }
  writeNexusFramework(body.content);
  return NextResponse.json({ content: readNexusFramework() });
}
```

- [ ] **Step 2: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: exits 0.

If the dev server is running:
```bash
curl -s http://localhost:3000/api/framework | head -c 120
```
Expected: JSON starting with `{"content":"# Nexus Framework...`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/framework/route.ts
git commit -m "feat: add GET/PUT API route for nexus framework"
```

---

### Task 6: Configs page — Nexus Framework card

**Files:**
- Modify: `app/src/app/configs/page.tsx`

- [ ] **Step 1: Add the `BookOpen` icon import**

Change the lucide-react import to include `BookOpen`:

```ts
import { Plus, Pencil, Trash2, Settings2, Sparkles, Search, Users, Film, ClipboardCheck, BookOpen } from "lucide-react";
```

- [ ] **Step 2: Add state + handlers**

After the existing `const [checklistSaving, setChecklistSaving] = useState(false);` add:

```ts
  const [framework, setFramework] = useState("");
  const [frameworkSaving, setFrameworkSaving] = useState(false);
```

In the existing `useEffect`, after the `/api/checklist` fetch, add:

```ts
    fetch("/api/framework").then((r) => r.json()).then((d) => setFramework(d.content || ""));
```

After the existing `saveChecklist` function, add:

```ts
  const saveFramework = async () => {
    setFrameworkSaving(true);
    await fetch("/api/framework", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: framework }),
    });
    setFrameworkSaving(false);
  };
```

- [ ] **Step 3: Render the card**

In the returned JSX, directly after the closing `</div>` of the Master Scripting Checklist card (the block that ends with the `Save Checklist` button), insert:

```tsx
      {/* Nexus Framework */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
            <BookOpen className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Nexus Framework</h3>
            <p className="text-xs text-muted-foreground">
              Global writing rules injected into every analysis and generation — not graded
            </p>
          </div>
        </div>
        <Textarea
          value={framework}
          onChange={(e) => setFramework(e.target.value)}
          rows={12}
          placeholder="Content-creation framework injected as writing rules..."
          className="mt-4 rounded-xl glass border-white/[0.08] font-mono text-xs leading-relaxed"
        />
        <Button
          onClick={saveFramework}
          disabled={frameworkSaving}
          className="mt-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 border-0"
        >
          {frameworkSaving ? "Saving..." : "Save Framework"}
        </Button>
      </div>
```

- [ ] **Step 4: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: exits 0.

With the dev server running, open http://localhost:3000/configs — both cards render; the framework card shows the seeded content; Save persists to `data/nexus-framework.md`.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/configs/page.tsx
git commit -m "feat: add nexus framework editor card to configs page"
```

---

### Task 7: Docs + final verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

After the "### Master Scripting Checklist" section, add:

```markdown
### Nexus Framework

A global content-creation framework (`data/nexus-framework.md`, editable on the Configs page) injected as guidance — not graded:
- Appended to the Gemini analysis prompt as descriptive vocabulary/context
- Injected into the Claude generation and revision prompts as mandatory writing rules (You-form, conviction, linear storytelling, power words, simplicity, visual-in-mind)
- The checklist verifier does NOT grade framework adherence; an empty/missing file disables the layer
```

In the **Workspace Structure** tree, under `lib/` after the `checklist-parse.ts` line, add:

```
│   │   │   ├── framework.ts              # Nexus framework file read/write
```

Under `data/` after the `master-checklist.md` line, add:

```
│   ├── nexus-framework.md                 # Global content-creation framework
```

In the api line, change `(configs, creators, videos, pipeline, checklist)` to `(configs, creators, videos, pipeline, checklist, framework)`.

- [ ] **Step 2: Full build**

Run: `cd app && npm run build`
Expected: build succeeds; route list includes `ƒ /api/framework`.

- [ ] **Step 3: API roundtrip verification (dev server running)**

```bash
curl -s -X PUT http://localhost:3000/api/framework -H "Content-Type: application/json" -d '{"content":"roundtrip test"}'
cat data/nexus-framework.md   # expect: roundtrip test
# then restore the original content via PUT with the seed content (or git checkout data/nexus-framework.md)
git checkout data/nexus-framework.md
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document nexus framework in CLAUDE.md"
```
