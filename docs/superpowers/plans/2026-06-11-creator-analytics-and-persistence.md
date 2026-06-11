# Creator Analytics & Local Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove seeded data and stop tracking user data in git (so it persists across branch switches), record pipeline run history, and add a "My Creator" section for analyzing the user's own Instagram account.

**Architecture:** Data stays in CSV/JSON files under `data/` (untracked by git). New pure-logic modules (`creator-merge`, `creator-metrics`) are unit-tested with vitest; thin fs wrappers follow the existing `csv.ts` pattern. The My Creator page reuses the existing Apify/Gemini/Claude clients and SSE streaming pattern.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind + shadcn/ui, Apify Instagram scraper, Gemini 2.0 Flash, Claude Sonnet (`claude-sonnet-4-5-20250929`), vitest (new devDependency).

**Spec:** `docs/superpowers/specs/2026-06-11-creator-analytics-and-persistence-design.md`

**Working directory for all `npm`/`npx` commands:** `/Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app`. Git commands run from the repo root `/Users/ardaanilboz/Desktop/socialMedia-AI/social-media`.

---

### Task 1: De-seed data and stop tracking user data in git

**Files:**
- Modify: `.gitignore`
- Modify (truncate): `data/configs.csv`, `data/creators.csv`, `data/videos.csv`
- Delete: `app/src/scripts/seed.ts`

- [ ] **Step 1: Confirm nothing imports the seed script**

Run: `grep -rn "scripts/seed" /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app/src --include="*.ts" --include="*.tsx" --include="*.json"`
Expected: no matches (exit code 1).

- [ ] **Step 2: Untrack user data files (keep them on disk)**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git rm --cached data/configs.csv data/creators.csv data/videos.csv data/master-checklist.md
```

Expected: `rm 'data/configs.csv'` etc. printed; files still exist on disk (`ls data/` still shows them).

- [ ] **Step 3: Add ignore rules**

Append to `/Users/ardaanilboz/Desktop/socialMedia-AI/social-media/.gitignore`:

```gitignore

# User data — never tracked, so branch switches/checkouts can't revert it
data/configs.csv
data/creators.csv
data/videos.csv
data/master-checklist.md
data/runs.csv
data/creator-profile.json
data/creator-videos.csv
```

- [ ] **Step 4: Truncate seeded CSVs to headers only**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
printf 'id,configName,creatorsCategory,analysisInstruction,newConceptsInstruction\n' > data/configs.csv
printf 'id,username,category,profilePicUrl,followers,reelsCount30d,avgViews30d,lastScrapedAt\n' > data/creators.csv
printf 'id,link,thumbnail,creator,views,likes,comments,analysis,newConcepts,datePosted,dateAdded,configName,starred,checklistResult\n' > data/videos.csv
```

Do NOT touch `data/master-checklist.md` content (it is the user's work product — only untracked). Leave `data/nate-herk-*` files alone.

- [ ] **Step 5: Delete the seed script**

```bash
rm /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app/src/scripts/seed.ts
rmdir /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app/src/scripts 2>/dev/null || true
```

- [ ] **Step 6: Verify git no longer sees data files**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media && git status --short`
Expected: shows `D  data/configs.csv` etc. (staged deletions from the index), `.gitignore` modified, seed.ts deleted. The data files must NOT appear as untracked (`??`) — the ignore rules cover them.

- [ ] **Step 7: Commit**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add .gitignore app/src/scripts 2>/dev/null; git add -u
git commit -m "feat: remove seeded data and stop tracking user data in git"
```

---

### Task 2: Vitest test harness

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Install vitest**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm install -D vitest`
Expected: added to devDependencies without errors.

- [ ] **Step 2: Add test script**

In `app/package.json`, change the scripts block to:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Verify harness runs**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npx vitest run --passWithNoTests`
Expected: exits 0 with "No test files found".

- [ ] **Step 4: Commit**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add app/package.json app/package-lock.json
git commit -m "chore: add vitest test harness"
```

---

### Task 3: New types + Apify caption & post-scrape helper

**Files:**
- Modify: `app/src/lib/types.ts` (append at end)
- Modify: `app/src/lib/apify.ts`

- [ ] **Step 1: Append new interfaces to `types.ts`**

```typescript
export interface CreatorVideo {
  id: string;
  link: string;
  videoUrl: string;
  thumbnail: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  datePosted: string;
  topic: string;
  analysis: string;
  dateAdded: string;
}

export interface CreatorProfile {
  username: string;
  profilePicUrl: string;
  followers: number;
  lastRefreshedAt: string;
  accountInsights: string;
}

export interface PipelineRun {
  id: string;
  configName: string;
  maxVideos: number;
  topK: number;
  nDays: number;
  startedAt: string;
  finishedAt: string;
  status: "completed" | "failed";
  videosAdded: number;
  errorCount: number;
}
```

- [ ] **Step 2: Add `caption` to `ApifyReel` in `apify.ts`**

```typescript
export interface ApifyReel {
  videoUrl: string;
  url: string;
  videoPlayCount: number;
  likesCount: number;
  commentsCount: number;
  ownerUsername: string;
  images: string[];
  timestamp: string;
  caption?: string;
}
```

(The `apify~instagram-scraper` actor already returns `caption`; we only surface the field.)

- [ ] **Step 3: Add `scrapePostVideoUrl` at the end of `apify.ts`**

CDN video URLs expire, so on-demand analysis needs a way to re-fetch a fresh `videoUrl` for a single post:

```typescript
export async function scrapePostVideoUrl(postUrl: string): Promise<string> {
  const token = getToken();

  const response = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [postUrl],
        resultsType: "posts",
        resultsLimit: 1,
        addParentData: false,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apify post error ${response.status}: ${text}`);
  }

  const items = (await response.json()) as ApifyReel[];
  const videoUrl = items[0]?.videoUrl;
  if (!videoUrl) throw new Error(`No videoUrl found for post ${postUrl}`);
  return videoUrl;
}
```

- [ ] **Step 4: Lint**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add app/src/lib/types.ts app/src/lib/apify.ts
git commit -m "feat: add creator/run types and apify post video-url helper"
```

---

### Task 4: CSV IO for creator videos + pipeline runs

**Files:**
- Modify: `app/src/lib/csv.ts`

- [ ] **Step 1: Extend the type import at the top of `csv.ts`**

```typescript
import type { Config, Creator, Video, CreatorVideo, PipelineRun } from "./types";
```

- [ ] **Step 2: Append creator-video and run IO at the end of `csv.ts`**

```typescript
// Creator videos (the user's own account)
const CREATOR_VIDEO_COLUMNS = ["id", "link", "videoUrl", "thumbnail", "caption", "views", "likes", "comments", "datePosted", "topic", "analysis", "dateAdded"];

export function readCreatorVideos(): CreatorVideo[] {
  const raw = readCsv<Record<string, string>>("creator-videos.csv");
  return raw.map((r) => ({
    id: r.id || "",
    link: r.link || "",
    videoUrl: r.videoUrl || "",
    thumbnail: r.thumbnail || "",
    caption: r.caption || "",
    views: parseInt(r.views || "0", 10) || 0,
    likes: parseInt(r.likes || "0", 10) || 0,
    comments: parseInt(r.comments || "0", 10) || 0,
    datePosted: r.datePosted || "",
    topic: r.topic || "",
    analysis: r.analysis || "",
    dateAdded: r.dateAdded || "",
  }));
}

export function writeCreatorVideos(videos: CreatorVideo[]) {
  writeCsv("creator-videos.csv", videos as unknown as Record<string, unknown>[], CREATOR_VIDEO_COLUMNS);
}

// Pipeline run history
const RUN_COLUMNS = ["id", "configName", "maxVideos", "topK", "nDays", "startedAt", "finishedAt", "status", "videosAdded", "errorCount"];

export function readRuns(): PipelineRun[] {
  const raw = readCsv<Record<string, string>>("runs.csv");
  return raw.map((r) => ({
    id: r.id || "",
    configName: r.configName || "",
    maxVideos: parseInt(r.maxVideos || "0", 10) || 0,
    topK: parseInt(r.topK || "0", 10) || 0,
    nDays: parseInt(r.nDays || "0", 10) || 0,
    startedAt: r.startedAt || "",
    finishedAt: r.finishedAt || "",
    status: r.status === "failed" ? "failed" as const : "completed" as const,
    videosAdded: parseInt(r.videosAdded || "0", 10) || 0,
    errorCount: parseInt(r.errorCount || "0", 10) || 0,
  }));
}

export function writeRuns(runs: PipelineRun[]) {
  writeCsv("runs.csv", runs as unknown as Record<string, unknown>[], RUN_COLUMNS);
}

export function appendRun(run: PipelineRun) {
  const runs = readRuns();
  runs.push(run);
  writeRuns(runs);
}
```

- [ ] **Step 3: Lint**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add app/src/lib/csv.ts
git commit -m "feat: add creator-videos and runs CSV storage"
```

---

### Task 5: Record run history in the pipeline + GET /api/runs

**Files:**
- Modify: `app/src/lib/pipeline.ts`
- Create: `app/src/app/api/runs/route.ts`

- [ ] **Step 1: Update imports in `pipeline.ts`**

Change line 2 and line 8 to:

```typescript
import { readConfigs, readCreators, readVideos, writeVideos, appendRun } from "./csv";
```

```typescript
import type { PipelineParams, PipelineProgress, Video, ActiveTask, ChecklistResult, ChecklistVerdict } from "./types";
```

(The `PipelineRun` shape is provided inline to `appendRun`; no extra type import needed.)

- [ ] **Step 2: Capture run start time**

In `runPipeline`, immediately after the `const progress: PipelineProgress = {...};` initializer (before `const emit = ...`), add:

```typescript
  const startedAt = new Date().toISOString();
```

- [ ] **Step 3: Record the run in the success path**

In the success path, after the `if (newVideos.length > 0) { ... writeVideos(...) }` block and BEFORE `progress.phase = "done";`, add:

```typescript
    try {
      appendRun({
        id: uuid(),
        configName: params.configName,
        maxVideos: params.maxVideos,
        topK: params.topK,
        nDays: params.nDays,
        startedAt,
        finishedAt: new Date().toISOString(),
        status: "completed",
        videosAdded: newVideos.length,
        errorCount: progress.errors.length,
      });
    } catch {
      // run history must never break the pipeline
    }
```

- [ ] **Step 4: Record the run in the failure path**

In the final `catch (err)` block, after `log(msg);` and before `emit();`, add:

```typescript
    try {
      appendRun({
        id: uuid(),
        configName: params.configName,
        maxVideos: params.maxVideos,
        topK: params.topK,
        nDays: params.nDays,
        startedAt,
        finishedAt: new Date().toISOString(),
        status: "failed",
        videosAdded: 0,
        errorCount: progress.errors.length,
      });
    } catch {
      // run history must never break the pipeline
    }
```

- [ ] **Step 5: Create `app/src/app/api/runs/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { readRuns } from "@/lib/csv";

export async function GET() {
  const runs = readRuns();
  runs.sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
  return NextResponse.json(runs);
}
```

- [ ] **Step 6: Verify**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run lint`
Expected: no new errors.

Then start the dev server (`npm run dev`) and run: `curl -s http://localhost:3000/api/runs`
Expected: `[]` (no runs yet, file missing → empty list). Stop the server.

- [ ] **Step 7: Commit**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add app/src/lib/pipeline.ts app/src/app/api/runs/route.ts
git commit -m "feat: record pipeline run history and expose GET /api/runs"
```

---

### Task 6: Recent runs table on the Run page

**Files:**
- Modify: `app/src/app/run/page.tsx`

- [ ] **Step 1: Update imports**

Add `History` to the lucide-react import (line 17) and add `PipelineRun` to the types import (line 19):

```typescript
import { Play, Loader2, CheckCircle2, XCircle, Terminal, Zap, ChevronDown, ArrowRight, Film, AlertTriangle, History } from "lucide-react";
import { usePipeline } from "@/context/pipeline-context";
import type { Config, PipelineRun } from "@/lib/types";
```

- [ ] **Step 2: Add a duration formatter**

Below the existing `formatViews` helper, add:

```typescript
function formatDuration(startedAt: string, finishedAt: string): string {
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!isFinite(ms) || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
```

- [ ] **Step 3: Load runs**

Inside `RunPage`, after the `const logEndRef = ...` line, add state; after the existing `useEffect` that fetches configs, add the runs effects:

```typescript
  const [runs, setRuns] = useState<PipelineRun[]>([]);
```

```typescript
  useEffect(() => {
    fetch("/api/runs").then((r) => r.json()).then(setRuns).catch(() => {});
  }, []);

  useEffect(() => {
    if (progress?.status === "completed" || progress?.status === "error") {
      fetch("/api/runs").then((r) => r.json()).then(setRuns).catch(() => {});
    }
  }, [progress?.status]);
```

- [ ] **Step 4: Render the table**

After the entire `{progress && (...)}` block, just before the final closing `</div>` of the page, add:

```tsx
      {/* Recent runs */}
      {runs.length > 0 && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-semibold">Recent Runs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-white/[0.06]">
                  <th className="pb-2 pr-4 font-medium">Config</th>
                  <th className="pb-2 pr-4 font-medium">Started</th>
                  <th className="pb-2 pr-4 font-medium">Duration</th>
                  <th className="pb-2 pr-4 font-medium">Params</th>
                  <th className="pb-2 pr-4 font-medium">Videos</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 10).map((run) => (
                  <tr key={run.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{run.configName}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{formatDuration(run.startedAt, run.finishedAt)}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">max {run.maxVideos} · top {run.topK} · {run.nDays}d</td>
                    <td className="py-2.5 pr-4">
                      {run.videosAdded}
                      {run.errorCount > 0 && <span className="text-red-400"> · {run.errorCount} err</span>}
                    </td>
                    <td className="py-2.5">
                      {run.status === "completed" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Completed</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-400"><XCircle className="h-3 w-3" /> Failed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Verify**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run lint`
Expected: no new errors. (The table is empty-state hidden until a run exists; visual check happens in Task 16.)

- [ ] **Step 6: Commit**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add app/src/app/run/page.tsx
git commit -m "feat: show recent run history on the run page"
```

---

### Task 7: creator-merge.ts (TDD)

**Files:**
- Test: `app/src/lib/__tests__/creator-merge.test.ts`
- Create: `app/src/lib/creator-merge.ts`

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/__tests__/creator-merge.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mergeCreatorVideos, type ScrapedReelInput } from "../creator-merge";
import type { CreatorVideo } from "../types";

const existingVideo = (overrides: Partial<CreatorVideo> = {}): CreatorVideo => ({
  id: "existing-1",
  link: "https://instagram.com/p/abc/",
  videoUrl: "https://cdn/old.mp4",
  thumbnail: "old-thumb",
  caption: "old caption",
  views: 100,
  likes: 10,
  comments: 1,
  datePosted: "2026-01-01",
  topic: "Real Estate",
  analysis: "deep analysis",
  dateAdded: "2026-01-02",
  ...overrides,
});

const scrapedReel = (overrides: Partial<ScrapedReelInput> = {}): ScrapedReelInput => ({
  link: "https://instagram.com/p/abc/",
  videoUrl: "https://cdn/new.mp4",
  thumbnail: "new-thumb",
  caption: "new caption",
  views: 200,
  likes: 20,
  comments: 2,
  datePosted: "2026-01-01",
  ...overrides,
});

describe("mergeCreatorVideos", () => {
  it("adds a new video with empty topic/analysis and dateAdded=today", () => {
    const { videos, added, updated } = mergeCreatorVideos([], [scrapedReel()], "2026-06-11");
    expect(added).toBe(1);
    expect(updated).toBe(0);
    expect(videos).toHaveLength(1);
    expect(videos[0].id).toBeTruthy();
    expect(videos[0].topic).toBe("");
    expect(videos[0].analysis).toBe("");
    expect(videos[0].dateAdded).toBe("2026-06-11");
    expect(videos[0].views).toBe(200);
  });

  it("updates metrics on an existing video but preserves id, topic, analysis, dateAdded", () => {
    const { videos, added, updated } = mergeCreatorVideos([existingVideo()], [scrapedReel()], "2026-06-11");
    expect(added).toBe(0);
    expect(updated).toBe(1);
    expect(videos).toHaveLength(1);
    expect(videos[0].id).toBe("existing-1");
    expect(videos[0].views).toBe(200);
    expect(videos[0].likes).toBe(20);
    expect(videos[0].comments).toBe(2);
    expect(videos[0].topic).toBe("Real Estate");
    expect(videos[0].analysis).toBe("deep analysis");
    expect(videos[0].dateAdded).toBe("2026-01-02");
    expect(videos[0].videoUrl).toBe("https://cdn/new.mp4");
  });

  it("does not overwrite caption/thumbnail/videoUrl with empty scraped values", () => {
    const { videos } = mergeCreatorVideos(
      [existingVideo()],
      [scrapedReel({ caption: "", thumbnail: "", videoUrl: "" })],
      "2026-06-11"
    );
    expect(videos[0].caption).toBe("old caption");
    expect(videos[0].thumbnail).toBe("old-thumb");
    expect(videos[0].videoUrl).toBe("https://cdn/old.mp4");
  });

  it("keeps existing videos that were not in the scrape (older than lookback)", () => {
    const old = existingVideo({ link: "https://instagram.com/p/old/" });
    const { videos, added } = mergeCreatorVideos([old], [scrapedReel()], "2026-06-11");
    expect(videos).toHaveLength(2);
    expect(added).toBe(1);
  });

  it("skips scraped items without a link", () => {
    const { videos, added } = mergeCreatorVideos([], [scrapedReel({ link: "" })], "2026-06-11");
    expect(videos).toHaveLength(0);
    expect(added).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run test`
Expected: FAIL — cannot resolve `../creator-merge`.

- [ ] **Step 3: Implement `app/src/lib/creator-merge.ts`**

```typescript
import { v4 as uuid } from "uuid";
import type { CreatorVideo } from "./types";

export interface ScrapedReelInput {
  link: string;
  videoUrl: string;
  thumbnail: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  datePosted: string;
}

export interface MergeResult {
  videos: CreatorVideo[];
  added: number;
  updated: number;
}

// Pure merge: new reels are appended, known reels (matched by post link) get fresh
// metrics while keeping id, topic, analysis, and dateAdded. `today` is injected so
// the function stays deterministic for tests.
export function mergeCreatorVideos(
  existing: CreatorVideo[],
  scraped: ScrapedReelInput[],
  today: string
): MergeResult {
  const byLink = new Map(existing.map((v) => [v.link, v]));
  let added = 0;
  let updated = 0;

  for (const reel of scraped) {
    if (!reel.link) continue;
    const current = byLink.get(reel.link);
    if (current) {
      current.views = reel.views;
      current.likes = reel.likes;
      current.comments = reel.comments;
      if (reel.videoUrl) current.videoUrl = reel.videoUrl;
      if (reel.thumbnail) current.thumbnail = reel.thumbnail;
      if (reel.caption) current.caption = reel.caption;
      updated++;
    } else {
      byLink.set(reel.link, {
        id: uuid(),
        link: reel.link,
        videoUrl: reel.videoUrl,
        thumbnail: reel.thumbnail,
        caption: reel.caption,
        views: reel.views,
        likes: reel.likes,
        comments: reel.comments,
        datePosted: reel.datePosted,
        topic: "",
        analysis: "",
        dateAdded: today,
      });
      added++;
    }
  }

  return { videos: [...byLink.values()], added, updated };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run test`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add app/src/lib/creator-merge.ts app/src/lib/__tests__/creator-merge.test.ts
git commit -m "feat: add creator video merge logic with tests"
```

---

### Task 8: creator-metrics.ts (TDD)

**Files:**
- Test: `app/src/lib/__tests__/creator-metrics.test.ts`
- Create: `app/src/lib/creator-metrics.ts`

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/__tests__/creator-metrics.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  engagementRate,
  computeOverview,
  rankVideos,
  computeTopicStats,
  computeDayOfWeekStats,
  UNCATEGORIZED,
} from "../creator-metrics";
import type { CreatorVideo } from "../types";

const video = (overrides: Partial<CreatorVideo> = {}): CreatorVideo => ({
  id: "v1",
  link: "https://instagram.com/p/x/",
  videoUrl: "",
  thumbnail: "",
  caption: "",
  views: 1000,
  likes: 50,
  comments: 10,
  datePosted: "2026-06-11",
  topic: "",
  analysis: "",
  dateAdded: "2026-06-11",
  ...overrides,
});

describe("engagementRate", () => {
  it("computes (likes+comments)/views", () => {
    expect(engagementRate({ views: 1000, likes: 50, comments: 10 })).toBeCloseTo(0.06);
  });

  it("returns 0 when views is 0", () => {
    expect(engagementRate({ views: 0, likes: 50, comments: 10 })).toBe(0);
  });
});

describe("computeOverview", () => {
  it("returns zeros and null bestVideo for empty input", () => {
    const stats = computeOverview([]);
    expect(stats.videosTracked).toBe(0);
    expect(stats.totalViews).toBe(0);
    expect(stats.avgViews).toBe(0);
    expect(stats.avgEngagementRate).toBe(0);
    expect(stats.bestVideo).toBeNull();
  });

  it("aggregates totals, averages, and finds the best video", () => {
    const a = video({ id: "a", views: 1000, likes: 100, comments: 0 });
    const b = video({ id: "b", views: 3000, likes: 150, comments: 150 });
    const stats = computeOverview([a, b]);
    expect(stats.videosTracked).toBe(2);
    expect(stats.totalViews).toBe(4000);
    expect(stats.avgViews).toBe(2000);
    expect(stats.avgEngagementRate).toBeCloseTo((0.1 + 0.1) / 2);
    expect(stats.bestVideo?.id).toBe("b");
  });
});

describe("rankVideos", () => {
  const a = video({ id: "a", views: 100, likes: 90, comments: 0 });
  const b = video({ id: "b", views: 1000, likes: 10, comments: 0 });

  it("ranks best by views", () => {
    expect(rankVideos([a, b], "views", "best", 2).map((v) => v.id)).toEqual(["b", "a"]);
  });

  it("ranks worst by views", () => {
    expect(rankVideos([a, b], "views", "worst", 2).map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("ranks by engagement rate", () => {
    // a: 90/100 = 0.9, b: 10/1000 = 0.01
    expect(rankVideos([a, b], "engagement", "best", 2).map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("respects the limit", () => {
    expect(rankVideos([a, b], "views", "best", 1)).toHaveLength(1);
  });
});

describe("computeTopicStats", () => {
  it("groups by topic, maps empty topic to Uncategorized, sorts by avgViews desc", () => {
    const videos = [
      video({ id: "a", topic: "Tips", views: 100 }),
      video({ id: "b", topic: "Tips", views: 300 }),
      video({ id: "c", topic: "", views: 5000 }),
    ];
    const stats = computeTopicStats(videos);
    expect(stats[0].topic).toBe(UNCATEGORIZED);
    expect(stats[0].avgViews).toBe(5000);
    const tips = stats.find((s) => s.topic === "Tips")!;
    expect(tips.count).toBe(2);
    expect(tips.avgViews).toBe(200);
    expect(tips.best.id).toBe("b");
    expect(tips.worst.id).toBe("a");
  });
});

describe("computeDayOfWeekStats", () => {
  it("groups by weekday using UTC and averages views", () => {
    const videos = [
      video({ id: "a", datePosted: "2026-06-11", views: 100 }), // Thursday
      video({ id: "b", datePosted: "2026-06-11", views: 300 }), // Thursday
      video({ id: "c", datePosted: "2026-06-07", views: 50 }), // Sunday
    ];
    const stats = computeDayOfWeekStats(videos);
    const thursday = stats.find((s) => s.day === "Thursday")!;
    expect(thursday.count).toBe(2);
    expect(thursday.avgViews).toBe(200);
    expect(stats.find((s) => s.day === "Sunday")!.avgViews).toBe(50);
  });

  it("skips videos with missing or invalid dates", () => {
    expect(computeDayOfWeekStats([video({ datePosted: "" }), video({ datePosted: "not-a-date" })])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run test`
Expected: FAIL — cannot resolve `../creator-metrics`. (creator-merge tests still pass.)

- [ ] **Step 3: Implement `app/src/lib/creator-metrics.ts`**

This module is client-safe (no fs/server imports) — the page imports it directly.

```typescript
import type { CreatorVideo } from "./types";

export const UNCATEGORIZED = "Uncategorized";

export function engagementRate(v: { views: number; likes: number; comments: number }): number {
  if (v.views <= 0) return 0;
  return (v.likes + v.comments) / v.views;
}

export interface OverviewStats {
  videosTracked: number;
  totalViews: number;
  avgViews: number;
  avgEngagementRate: number;
  bestVideo: CreatorVideo | null;
}

export function computeOverview(videos: CreatorVideo[]): OverviewStats {
  if (videos.length === 0) {
    return { videosTracked: 0, totalViews: 0, avgViews: 0, avgEngagementRate: 0, bestVideo: null };
  }
  const totalViews = videos.reduce((s, v) => s + v.views, 0);
  const avgEngagementRate = videos.reduce((s, v) => s + engagementRate(v), 0) / videos.length;
  const bestVideo = videos.reduce((best, v) => (v.views > best.views ? v : best), videos[0]);
  return {
    videosTracked: videos.length,
    totalViews,
    avgViews: Math.round(totalViews / videos.length),
    avgEngagementRate,
    bestVideo,
  };
}

export type RankMetric = "views" | "likes" | "comments" | "engagement";

export function rankVideos(
  videos: CreatorVideo[],
  metric: RankMetric,
  direction: "best" | "worst",
  limit: number
): CreatorVideo[] {
  const value = (v: CreatorVideo) => (metric === "engagement" ? engagementRate(v) : v[metric]);
  const sorted = [...videos].sort((a, b) =>
    direction === "best" ? value(b) - value(a) : value(a) - value(b)
  );
  return sorted.slice(0, limit);
}

export interface TopicStats {
  topic: string;
  count: number;
  avgViews: number;
  avgEngagementRate: number;
  best: CreatorVideo;
  worst: CreatorVideo;
}

export function computeTopicStats(videos: CreatorVideo[]): TopicStats[] {
  const groups = new Map<string, CreatorVideo[]>();
  for (const v of videos) {
    const topic = v.topic || UNCATEGORIZED;
    const group = groups.get(topic) || [];
    group.push(v);
    groups.set(topic, group);
  }
  const stats = [...groups.entries()].map(([topic, group]) => {
    const totalViews = group.reduce((s, v) => s + v.views, 0);
    return {
      topic,
      count: group.length,
      avgViews: Math.round(totalViews / group.length),
      avgEngagementRate: group.reduce((s, v) => s + engagementRate(v), 0) / group.length,
      best: group.reduce((b, v) => (v.views > b.views ? v : b), group[0]),
      worst: group.reduce((w, v) => (v.views < w.views ? v : w), group[0]),
    };
  });
  return stats.sort((a, b) => b.avgViews - a.avgViews);
}

export interface DayStats {
  day: string;
  count: number;
  avgViews: number;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function computeDayOfWeekStats(videos: CreatorVideo[]): DayStats[] {
  const byDay = new Map<number, CreatorVideo[]>();
  for (const v of videos) {
    if (!v.datePosted) continue;
    // Parse as UTC so the weekday doesn't shift with the server timezone
    const d = new Date(`${v.datePosted}T00:00:00Z`);
    if (isNaN(d.getTime())) continue;
    const day = d.getUTCDay();
    const group = byDay.get(day) || [];
    group.push(v);
    byDay.set(day, group);
  }
  return [...byDay.entries()]
    .map(([day, group]) => ({
      day: DAY_NAMES[day],
      count: group.length,
      avgViews: Math.round(group.reduce((s, v) => s + v.views, 0) / group.length),
    }))
    .sort((a, b) => b.avgViews - a.avgViews);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run test`
Expected: all tests PASS (merge + metrics).

- [ ] **Step 5: Commit**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add app/src/lib/creator-metrics.ts app/src/lib/__tests__/creator-metrics.test.ts
git commit -m "feat: add creator metrics computations with tests"
```

---

### Task 9: creator-profile.ts (profile JSON store)

**Files:**
- Create: `app/src/lib/creator-profile.ts`

- [ ] **Step 1: Create the module** (mirrors `checklist.ts`)

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import type { CreatorProfile } from "./types";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const PROFILE_PATH = path.join(DATA_DIR, "creator-profile.json");

export function readCreatorProfile(): CreatorProfile | null {
  if (!existsSync(PROFILE_PATH)) return null;
  try {
    const raw = JSON.parse(readFileSync(PROFILE_PATH, "utf-8"));
    if (!raw?.username) return null;
    return {
      username: raw.username,
      profilePicUrl: raw.profilePicUrl || "",
      followers: raw.followers || 0,
      lastRefreshedAt: raw.lastRefreshedAt || "",
      accountInsights: raw.accountInsights || "",
    };
  } catch {
    return null;
  }
}

export function writeCreatorProfile(profile: CreatorProfile): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2), "utf-8");
}
```

- [ ] **Step 2: Lint + commit**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run lint` — expect no new errors.

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add app/src/lib/creator-profile.ts
git commit -m "feat: add creator profile JSON store"
```

---

### Task 10: creator-ai.ts (topic classification, analysis prompt, insights) — TDD for the parser

**Files:**
- Test: `app/src/lib/__tests__/creator-ai.test.ts`
- Create: `app/src/lib/creator-ai.ts`

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/__tests__/creator-ai.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseTopicAssignments } from "../creator-ai";

describe("parseTopicAssignments", () => {
  it("parses a plain JSON array", () => {
    const text = '[{"id": "a", "topic": "Real Estate"}, {"id": "b", "topic": "Lifestyle"}]';
    expect(parseTopicAssignments(text)).toEqual([
      { id: "a", topic: "Real Estate" },
      { id: "b", topic: "Lifestyle" },
    ]);
  });

  it("extracts the array from surrounding prose and code fences", () => {
    const text = 'Here are the topics:\n```json\n[{"id": "a", "topic": "Tips"}]\n```\nDone.';
    expect(parseTopicAssignments(text)).toEqual([{ id: "a", topic: "Tips" }]);
  });

  it("returns [] for garbage input", () => {
    expect(parseTopicAssignments("no json here")).toEqual([]);
    expect(parseTopicAssignments("[broken json")).toEqual([]);
  });

  it("filters out entries with missing id or empty topic, and trims topics", () => {
    const text = '[{"id": "a", "topic": "  Tips  "}, {"id": "b", "topic": ""}, {"topic": "X"}, {"id": "c"}]';
    expect(parseTopicAssignments(text)).toEqual([{ id: "a", topic: "Tips" }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run test`
Expected: FAIL — cannot resolve `../creator-ai`.

- [ ] **Step 3: Implement `app/src/lib/creator-ai.ts`**

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add app/src/lib/creator-ai.ts app/src/lib/__tests__/creator-ai.test.ts
git commit -m "feat: add creator AI helpers (topics, analysis prompt, insights)"
```

---

### Task 11: /api/creator (GET, PUT) + /api/creator/refresh (SSE)

**Files:**
- Create: `app/src/app/api/creator/route.ts`
- Create: `app/src/app/api/creator/refresh/route.ts`

- [ ] **Step 1: Create `app/src/app/api/creator/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { readCreatorProfile, writeCreatorProfile } from "@/lib/creator-profile";
import { readCreatorVideos, writeCreatorVideos } from "@/lib/csv";
import { scrapeCreatorStats } from "@/lib/apify";

export const maxDuration = 300;

export async function GET() {
  const profile = readCreatorProfile();
  const videos = profile ? readCreatorVideos() : [];
  return NextResponse.json({ profile, videos });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const username = (body.username || "").trim().replace(/^@/, "");
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

  const current = readCreatorProfile();
  const isNewAccount = !current || current.username !== username;

  let profile = {
    username,
    profilePicUrl: isNewAccount ? "" : current!.profilePicUrl,
    followers: isNewAccount ? 0 : current!.followers,
    lastRefreshedAt: isNewAccount ? "" : current!.lastRefreshedAt,
    accountInsights: isNewAccount ? "" : current!.accountInsights,
  };

  // Switching accounts: the stored videos belong to the old account
  if (isNewAccount) writeCreatorVideos([]);

  try {
    const stats = await scrapeCreatorStats(username);
    profile = { ...profile, profilePicUrl: stats.profilePicUrl, followers: stats.followers };
  } catch (err) {
    console.error(`Failed to scrape stats for @${username}:`, err);
  }

  writeCreatorProfile(profile);
  return NextResponse.json(profile);
}
```

- [ ] **Step 2: Create `app/src/app/api/creator/refresh/route.ts`**

Same SSE pattern as `/api/creators/refresh`. Reels are saved BEFORE topic classification so a Claude failure never loses scraped data (topics retry next refresh).

```typescript
import { readCreatorProfile, writeCreatorProfile } from "@/lib/creator-profile";
import { readCreatorVideos, writeCreatorVideos } from "@/lib/csv";
import { scrapeCreatorStats, scrapeReels } from "@/lib/apify";
import { mergeCreatorVideos } from "@/lib/creator-merge";
import { classifyTopics } from "@/lib/creator-ai";

export const maxDuration = 300;

const REFRESH_MAX_REELS = 100;
const REFRESH_DAYS = 90;

export async function POST() {
  const profile = readCreatorProfile();
  if (!profile) {
    return Response.json({ error: "No creator account set" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({ type: "progress", step: "profile", message: `Refreshing @${profile.username} profile stats` });
        try {
          const stats = await scrapeCreatorStats(profile.username);
          profile.profilePicUrl = stats.profilePicUrl;
          profile.followers = stats.followers;
        } catch (err) {
          send({ type: "error", error: `Profile stats failed: ${err instanceof Error ? err.message : err}` });
        }

        send({ type: "progress", step: "reels", message: `Scraping latest reels (last ${REFRESH_DAYS} days)` });
        const reels = await scrapeReels(profile.username, REFRESH_MAX_REELS, REFRESH_DAYS);

        const scraped = reels
          .filter((r) => r.url && r.timestamp)
          .map((r) => ({
            link: r.url,
            videoUrl: r.videoUrl || "",
            thumbnail: r.images?.[0] || "",
            caption: r.caption || "",
            views: r.videoPlayCount || 0,
            likes: r.likesCount || 0,
            comments: r.commentsCount || 0,
            datePosted: r.timestamp?.split("T")[0] || "",
          }));

        const today = new Date().toISOString().slice(0, 10);
        const { videos, added, updated } = mergeCreatorVideos(readCreatorVideos(), scraped, today);
        writeCreatorVideos(videos);
        profile.lastRefreshedAt = new Date().toISOString();
        writeCreatorProfile(profile);
        send({ type: "progress", step: "saving", message: `${added} new videos, ${updated} updated` });

        const untopiced = videos.filter((v) => !v.topic && v.caption);
        if (untopiced.length > 0) {
          send({ type: "progress", step: "topics", message: `Classifying topics for ${untopiced.length} videos` });
          try {
            const existingTopics = [...new Set(videos.map((v) => v.topic).filter(Boolean))];
            const assignments = await classifyTopics(
              untopiced.map((v) => ({ id: v.id, caption: v.caption.slice(0, 500) })),
              existingTopics
            );
            for (const v of videos) {
              const topic = assignments.get(v.id);
              if (topic) v.topic = topic;
            }
            writeCreatorVideos(videos);
          } catch (err) {
            send({ type: "error", error: `Topic classification failed: ${err instanceof Error ? err.message : err}` });
          }
        }

        send({ type: "complete", added, updated });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "Unknown error" });
        send({ type: "complete", added: 0, updated: 0 });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 3: Verify**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run lint` — expect no new errors.

Start `npm run dev`, then:
- `curl -s http://localhost:3000/api/creator` → `{"profile":null,"videos":[]}`
- `curl -s -X POST http://localhost:3000/api/creator/refresh` → `{"error":"No creator account set"}` (HTTP 400)

Stop the server.

- [ ] **Step 4: Commit**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add app/src/app/api/creator
git commit -m "feat: add creator profile and refresh API routes"
```

---

### Task 12: /api/creator/analyze + /api/creator/insights

**Files:**
- Create: `app/src/app/api/creator/analyze/route.ts`
- Create: `app/src/app/api/creator/insights/route.ts`

- [ ] **Step 1: Create `app/src/app/api/creator/analyze/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { readCreatorVideos, writeCreatorVideos } from "@/lib/csv";
import { scrapePostVideoUrl } from "@/lib/apify";
import { uploadVideo, analyzeVideo } from "@/lib/gemini";
import { buildCreatorAnalysisPrompt } from "@/lib/creator-ai";
import { computeOverview } from "@/lib/creator-metrics";

export const maxDuration = 300;

async function downloadVideo(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") || "video/mp4",
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const { videoId } = await request.json();
  const videos = readCreatorVideos();
  const video = videos.find((v) => v.id === videoId);
  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  // CDN video URLs expire — fall back to re-scraping the post for a fresh one
  let download = await downloadVideo(video.videoUrl);
  if (!download) {
    try {
      const freshUrl = await scrapePostVideoUrl(video.link);
      video.videoUrl = freshUrl;
      download = await downloadVideo(freshUrl);
    } catch (err) {
      return NextResponse.json(
        { error: `Could not fetch video: ${err instanceof Error ? err.message : err}` },
        { status: 502 }
      );
    }
  }
  if (!download) return NextResponse.json({ error: "Video download failed" }, { status: 502 });

  try {
    const fileData = await uploadVideo(download.buffer, download.contentType);
    const { avgViews } = computeOverview(videos);
    const analysis = await analyzeVideo(
      fileData.uri,
      fileData.mimeType,
      buildCreatorAnalysisPrompt(video, avgViews)
    );

    video.analysis = analysis;
    writeCreatorVideos(videos);
    return NextResponse.json({ analysis });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create `app/src/app/api/creator/insights/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { readCreatorProfile, writeCreatorProfile } from "@/lib/creator-profile";
import { readCreatorVideos } from "@/lib/csv";
import { generateAccountInsights } from "@/lib/creator-ai";

export const maxDuration = 300;

export async function POST() {
  const profile = readCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No creator account set" }, { status: 400 });

  const videos = readCreatorVideos();
  if (videos.length === 0) {
    return NextResponse.json({ error: "No videos to analyze — refresh first" }, { status: 400 });
  }

  try {
    const insights = await generateAccountInsights(profile, videos);
    profile.accountInsights = insights;
    writeCreatorProfile(profile);
    return NextResponse.json({ insights });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Insights generation failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Verify**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run lint` — expect no new errors.

Start `npm run dev`, then:
- `curl -s -X POST http://localhost:3000/api/creator/insights` → `{"error":"No creator account set"}` (HTTP 400)
- `curl -s -X POST http://localhost:3000/api/creator/analyze -H "Content-Type: application/json" -d '{"videoId":"nope"}'` → `{"error":"Video not found"}` (HTTP 404)

Stop the server.

- [ ] **Step 4: Commit**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add app/src/app/api/creator/analyze app/src/app/api/creator/insights
git commit -m "feat: add creator video analysis and account insights API routes"
```

---

### Task 13: Stats section components

**Files:**
- Create: `app/src/components/creator/stats-sections.tsx`

- [ ] **Step 1: Create `app/src/components/creator/stats-sections.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, CalendarDays, Eye, Film, Heart, TrendingDown, TrendingUp, UserCheck } from "lucide-react";
import {
  computeDayOfWeekStats,
  computeOverview,
  computeTopicStats,
  engagementRate,
  rankVideos,
  type RankMetric,
} from "@/lib/creator-metrics";
import type { CreatorVideo } from "@/lib/types";

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

function formatPercent(rate: number): string {
  return (rate * 100).toFixed(2) + "%";
}

export function OverviewCards({ videos, followers }: { videos: CreatorVideo[]; followers: number }) {
  const stats = computeOverview(videos);
  const cards = [
    { label: "Followers", value: formatNumber(followers), icon: UserCheck, color: "text-blue-400" },
    { label: "Videos Tracked", value: String(stats.videosTracked), icon: Film, color: "text-purple-400" },
    { label: "Total Views", value: formatNumber(stats.totalViews), icon: Eye, color: "text-emerald-400" },
    { label: "Avg Views", value: formatNumber(stats.avgViews), icon: BarChart3, color: "text-indigo-400" },
    { label: "Avg Engagement", value: formatPercent(stats.avgEngagementRate), icon: Heart, color: "text-pink-400" },
    { label: "Best Video", value: stats.bestVideo ? formatNumber(stats.bestVideo.views) : "—", icon: TrendingUp, color: "text-amber-400" },
  ];
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="glass rounded-2xl p-4 text-center">
          <c.icon className={`mx-auto h-4 w-4 mb-2 ${c.color}`} />
          <p className="text-lg font-bold">{c.value}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

function RankingList({
  title,
  icon: Icon,
  iconColor,
  videos,
  metric,
}: {
  title: string;
  icon: typeof TrendingUp;
  iconColor: string;
  videos: CreatorVideo[];
  metric: RankMetric;
}) {
  const value = (v: CreatorVideo) =>
    metric === "engagement" ? formatPercent(engagementRate(v)) : formatNumber(v[metric]);
  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-2">
        {videos.map((v, i) => (
          <a
            key={v.id}
            href={v.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.04] px-3 py-2 hover:bg-white/[0.06] transition-colors"
          >
            <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
            <div className="relative h-10 w-7 shrink-0 rounded-md overflow-hidden bg-white/[0.02]">
              {v.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/proxy-image?url=${encodeURIComponent(v.thumbnail)}`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs truncate">{v.caption || v.link}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {v.topic && (
                  <Badge variant="secondary" className="rounded-md text-[9px] bg-white/[0.05] border border-white/[0.06]">
                    {v.topic}
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground">{v.datePosted}</span>
              </div>
            </div>
            <span className="text-xs font-bold shrink-0">{value(v)}</span>
          </a>
        ))}
        {videos.length === 0 && <p className="text-xs text-muted-foreground">No videos yet.</p>}
      </div>
    </div>
  );
}

export function Rankings({ videos }: { videos: CreatorVideo[] }) {
  const [metric, setMetric] = useState<RankMetric>("views");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Rankings</h2>
        <Select value={metric} onValueChange={(v) => setMetric(v as RankMetric)}>
          <SelectTrigger className="w-[180px] rounded-xl glass border-white/[0.08] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="views">By Views</SelectItem>
            <SelectItem value="likes">By Likes</SelectItem>
            <SelectItem value="comments">By Comments</SelectItem>
            <SelectItem value="engagement">By Engagement</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RankingList
          title="Best Performing"
          icon={TrendingUp}
          iconColor="text-emerald-400"
          videos={rankVideos(videos, metric, "best", 5)}
          metric={metric}
        />
        <RankingList
          title="Worst Performing"
          icon={TrendingDown}
          iconColor="text-red-400"
          videos={rankVideos(videos, metric, "worst", 5)}
          metric={metric}
        />
      </div>
    </div>
  );
}

export function TopicBreakdown({ videos }: { videos: CreatorVideo[] }) {
  const stats = computeTopicStats(videos);
  if (stats.length === 0) return null;
  const maxAvg = Math.max(...stats.map((s) => s.avgViews), 1);
  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-purple-400" />
        <h2 className="text-sm font-semibold">Performance by Topic</h2>
      </div>
      <div className="space-y-3">
        {stats.map((s) => (
          <div key={s.topic} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{s.topic}</span>
              <span className="text-muted-foreground">
                {s.count} video{s.count !== 1 ? "s" : ""} · {formatNumber(s.avgViews)} avg views · {formatPercent(s.avgEngagementRate)} eng.
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                style={{ width: `${(s.avgViews / maxAvg) * 100}%` }}
              />
            </div>
            <div className="flex gap-4 text-[10px] text-muted-foreground">
              <a href={s.best.link} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
                Best: {formatNumber(s.best.views)} views
              </a>
              <a href={s.worst.link} target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">
                Worst: {formatNumber(s.worst.views)} views
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PostingPatterns({ videos }: { videos: CreatorVideo[] }) {
  const stats = computeDayOfWeekStats(videos);
  if (stats.length === 0) return null;
  const maxAvg = Math.max(...stats.map((s) => s.avgViews), 1);
  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-indigo-400" />
        <h2 className="text-sm font-semibold">Avg Views by Posting Day</h2>
      </div>
      <div className="space-y-3">
        {stats.map((s) => (
          <div key={s.day} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{s.day}</span>
              <span className="text-muted-foreground">
                {s.count} video{s.count !== 1 ? "s" : ""} · {formatNumber(s.avgViews)} avg views
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
                style={{ width: `${(s.avgViews / maxAvg) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint + commit**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run lint` — expect no new errors.

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add app/src/components/creator/stats-sections.tsx
git commit -m "feat: add creator stats section components"
```

---

### Task 14: Video grid with on-demand AI analysis

**Files:**
- Create: `app/src/components/creator/video-grid.tsx`

- [ ] **Step 1: Create `app/src/components/creator/video-grid.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ExternalLink, Film, Heart, Loader2, MessageCircle, Play, Search, Sparkles } from "lucide-react";
import { MarkdownContent } from "@/components/markdown-content";
import { engagementRate } from "@/lib/creator-metrics";
import type { CreatorVideo } from "@/lib/types";

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

type SortOption = "views" | "date" | "engagement";

export function CreatorVideoGrid({
  videos,
  onReload,
}: {
  videos: CreatorVideo[];
  onReload: () => Promise<void> | void;
}) {
  const [sortBy, setSortBy] = useState<SortOption>("views");
  const [filterTopic, setFilterTopic] = useState("all");
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState("");
  const [modalVideo, setModalVideo] = useState<CreatorVideo | null>(null);

  const topics = [...new Set(videos.map((v) => v.topic).filter(Boolean))].sort();

  const filtered = videos
    .filter((v) => filterTopic === "all" || v.topic === filterTopic)
    .sort((a, b) => {
      if (sortBy === "views") return b.views - a.views;
      if (sortBy === "engagement") return engagementRate(b) - engagementRate(a);
      return (b.datePosted || "").localeCompare(a.datePosted || "");
    });

  const handleAnalyze = async (video: CreatorVideo) => {
    setAnalyzingId(video.id);
    setAnalyzeError("");
    try {
      const res = await fetch("/api/creator/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.error || "Analysis failed");
        return;
      }
      await onReload();
      setModalVideo({ ...video, analysis: data.analysis });
    } finally {
      setAnalyzingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold mr-auto">My Videos</h2>
        {topics.length > 0 && (
          <Select value={filterTopic} onValueChange={setFilterTopic}>
            <SelectTrigger className="w-[200px] rounded-xl glass border-white/[0.08] h-9">
              <SelectValue placeholder="Filter by topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Topics</SelectItem>
              {topics.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[170px] rounded-xl glass border-white/[0.08] h-9">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="views">Most Views</SelectItem>
            <SelectItem value="engagement">Engagement</SelectItem>
            <SelectItem value="date">Newest</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="rounded-lg px-3 py-1.5 text-xs bg-white/[0.05] border border-white/[0.08]">
          {filtered.length} videos
        </Badge>
      </div>

      {analyzeError && (
        <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-3">
          <p className="text-[11px] text-red-400/80">{analyzeError}</p>
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((video) => (
          <div key={video.id} className="group">
            <div className="glass rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/[0.12]">
              <a
                href={video.link}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block aspect-[9/16] w-full bg-white/[0.02] overflow-hidden"
              >
                {video.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/proxy-image?url=${encodeURIComponent(video.thumbnail)}`}
                    alt={video.caption || "Reel"}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Film className="h-10 w-10 text-muted-foreground/20" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent pt-8 pb-2.5 px-3">
                  <div className="flex items-center gap-1.5">
                    <Play className="h-4 w-4 text-white fill-white" />
                    <span className="text-[15px] font-bold text-white">{formatViews(video.views)}</span>
                  </div>
                </div>
              </a>

              <div className="p-3 space-y-2">
                {video.caption && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{video.caption}</p>
                )}

                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {formatViews(video.likes)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {formatViews(video.comments)}
                  </span>
                  <span className="ml-auto text-[10px]">{video.datePosted}</span>
                </div>

                {video.topic && (
                  <Badge variant="secondary" className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.06] text-muted-foreground">
                    {video.topic}
                  </Badge>
                )}

                <div className="flex gap-1.5 pt-1">
                  {video.analysis ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModalVideo(video)}
                      className="flex-1 rounded-xl text-[11px] h-7 gap-1 transition-all duration-200 glass border-white/[0.06] text-emerald-400/90 hover:text-emerald-300"
                    >
                      <Search className="h-3 w-3" />
                      View Analysis
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAnalyze(video)}
                      disabled={analyzingId !== null}
                      className="flex-1 rounded-xl text-[11px] h-7 gap-1 transition-all duration-200 glass border-white/[0.06] text-muted-foreground hover:text-foreground"
                    >
                      {analyzingId === video.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {analyzingId === video.id ? "Analyzing..." : "Analyze with AI"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center">
          <Film className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <h3 className="mt-4 font-semibold">No videos yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Hit Refresh to pull your latest reels.</p>
        </div>
      )}

      {/* Analysis modal */}
      <Dialog open={!!modalVideo} onOpenChange={(open) => { if (!open) setModalVideo(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden glass-strong rounded-2xl border-white/[0.08] p-0 gap-0">
          <DialogTitle className="sr-only">Video Analysis</DialogTitle>
          {modalVideo && (
            <>
              <div className="flex items-center gap-4 p-5 border-b border-white/[0.06]">
                <div className="relative h-16 w-12 shrink-0 rounded-lg overflow-hidden bg-white/[0.02]">
                  {modalVideo.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/proxy-image?url=${encodeURIComponent(modalVideo.thumbnail)}`}
                      alt="Reel"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Film className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{modalVideo.caption || "Video Analysis"}</p>
                    <a
                      href={modalVideo.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-purple-400 transition-colors shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Play className="h-3 w-3 fill-current" />
                      {formatViews(modalVideo.views)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {formatViews(modalVideo.likes)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {formatViews(modalVideo.comments)}
                    </span>
                    {modalVideo.topic && (
                      <Badge variant="secondary" className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.06]">
                        {modalVideo.topic}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="overflow-y-auto max-h-[calc(90vh-100px)] p-6">
                <MarkdownContent content={modalVideo.analysis} variant="analysis" />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Lint + commit**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run lint` — expect no new errors.

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add app/src/components/creator/video-grid.tsx
git commit -m "feat: add creator video grid with on-demand AI analysis"
```

---

### Task 15: My Creator page + sidebar nav item

**Files:**
- Create: `app/src/app/creator/page.tsx`
- Modify: `app/src/components/app-sidebar.tsx`

- [ ] **Step 1: Add the nav item in `app-sidebar.tsx`**

Update the lucide import (line 6) and `navItems` (lines 19-24):

```typescript
import { Film, Play, Users, Settings2, UserCircle } from "lucide-react";
```

```typescript
const navItems = [
  { title: "Videos", href: "/videos", icon: Film },
  { title: "Run Pipeline", href: "/run", icon: Play },
  { title: "My Creator", href: "/creator", icon: UserCircle },
  { title: "Creators", href: "/creators", icon: Users },
  { title: "Configs", href: "/configs", icon: Settings2 },
];
```

- [ ] **Step 2: Create `app/src/app/creator/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Loader2, Pencil, RefreshCw, Sparkles, UserCircle } from "lucide-react";
import { MarkdownContent } from "@/components/markdown-content";
import {
  formatNumber,
  OverviewCards,
  PostingPatterns,
  Rankings,
  TopicBreakdown,
} from "@/components/creator/stats-sections";
import { CreatorVideoGrid } from "@/components/creator/video-grid";
import type { CreatorProfile, CreatorVideo } from "@/lib/types";

export default function CreatorPage() {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [videos, setVideos] = useState<CreatorVideo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [editingAccount, setEditingAccount] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState("");
  const [refreshErrors, setRefreshErrors] = useState<string[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState("");

  const load = async () => {
    const res = await fetch("/api/creator");
    const data = await res.json();
    setProfile(data.profile);
    setVideos(data.videos || []);
    setLoaded(true);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveAccount = async () => {
    if (!usernameInput.trim()) return;
    setSavingAccount(true);
    try {
      await fetch("/api/creator", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput }),
      });
      setEditingAccount(false);
      setUsernameInput("");
      await load();
    } finally {
      setSavingAccount(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshErrors([]);
    setRefreshStatus("Starting refresh...");
    try {
      const response = await fetch("/api/creator/refresh", { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setRefreshErrors([data.error || `Refresh failed (${response.status})`]);
        return;
      }
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "progress") setRefreshStatus(data.message);
            else if (data.type === "error") setRefreshErrors((prev) => [...prev, data.error]);
            else if (data.type === "complete") setRefreshStatus(`Done — ${data.added} new, ${data.updated} updated`);
          } catch {
            /* skip malformed lines */
          }
        }
      }
    } finally {
      setRefreshing(false);
      await load();
    }
  };

  const handleInsights = async () => {
    setInsightsLoading(true);
    setInsightsError("");
    try {
      const res = await fetch("/api/creator/insights", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setInsightsError(data.error || "Insights generation failed");
        return;
      }
      await load();
    } finally {
      setInsightsLoading(false);
    }
  };

  if (!loaded) return null;

  // Setup / change-account card
  if (!profile || editingAccount) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Creator</h1>
          <p className="mt-1 text-sm text-muted-foreground">Analyze your own Instagram account</p>
        </div>
        <div className="glass rounded-2xl p-6 max-w-md space-y-5">
          <div className="flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-semibold">{profile ? "Change Account" : "Connect Your Account"}</h2>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Instagram Username</Label>
            <Input
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="e.g. my.account"
              className="mt-1.5 rounded-xl glass border-white/[0.08] h-11"
            />
            {profile ? (
              <p className="mt-2 text-[11px] text-amber-400/80">
                Changing to a different account clears the current video list.
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Profile stats are scraped automatically. Then hit Refresh to pull your videos.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSaveAccount}
              disabled={savingAccount || !usernameInput.trim()}
              className="flex-1 rounded-xl h-11 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0"
            >
              {savingAccount ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving & scraping...
                </>
              ) : (
                "Save Account"
              )}
            </Button>
            {profile && (
              <Button
                variant="ghost"
                onClick={() => setEditingAccount(false)}
                className="rounded-xl h-11 glass border-white/[0.08]"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Creator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Performance analytics for your own account
        </p>
      </div>

      {/* Profile header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-white/[0.1]">
            {profile.profilePicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/proxy-image?url=${encodeURIComponent(profile.profilePicUrl)}`}
                alt={`@${profile.username}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-muted-foreground/50">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <a
              href={`https://www.instagram.com/${profile.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-lg font-semibold hover:text-purple-400 transition-colors"
            >
              @{profile.username}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <p className="text-xs text-muted-foreground">
              {formatNumber(profile.followers)} followers
              {profile.lastRefreshedAt && ` · refreshed ${new Date(profile.lastRefreshedAt).toLocaleString()}`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setUsernameInput(profile.username);
              setEditingAccount(true);
            }}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-xl gap-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
        {(refreshing || refreshStatus) && (
          <p className="mt-3 text-xs text-muted-foreground">{refreshStatus}</p>
        )}
        {refreshErrors.length > 0 && (
          <div className="mt-3 rounded-xl bg-red-500/5 border border-red-500/10 p-3 space-y-1">
            {refreshErrors.map((e, i) => (
              <p key={i} className="text-[11px] text-red-400/80">{e}</p>
            ))}
          </div>
        )}
      </div>

      <OverviewCards videos={videos} followers={profile.followers} />
      <Rankings videos={videos} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TopicBreakdown videos={videos} />
        <PostingPatterns videos={videos} />
      </div>

      {/* AI insights */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold">AI Account Insights</h2>
          </div>
          <Button
            onClick={handleInsights}
            disabled={insightsLoading || videos.length === 0}
            variant="ghost"
            className="rounded-xl glass border-white/[0.08] gap-1.5 text-xs"
          >
            {insightsLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating...
              </>
            ) : profile.accountInsights ? (
              "Regenerate"
            ) : (
              "Generate Insights"
            )}
          </Button>
        </div>
        {insightsError && <p className="text-xs text-red-400">{insightsError}</p>}
        {profile.accountInsights ? (
          <MarkdownContent content={profile.accountInsights} variant="analysis" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Generate an AI report on what&apos;s working, what&apos;s not, topic strategy, and recommended next actions.
          </p>
        )}
      </div>

      <CreatorVideoGrid videos={videos} onReload={load} />
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app && npm run lint` — expect no new errors.

Start `npm run dev`, open `http://localhost:3000/creator`:
- Sidebar shows "My Creator" between Run Pipeline and Creators.
- Page shows the "Connect Your Account" card (no profile yet).

Stop the server.

- [ ] **Step 4: Commit**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add app/src/app/creator/page.tsx app/src/components/app-sidebar.tsx
git commit -m "feat: add My Creator page and sidebar nav item"
```

---

### Task 16: Final verification + docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Full test + lint + build**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media/app
npm run test    # expect: all tests pass
npm run lint    # expect: no errors
npm run build   # expect: compiles successfully (type checking included)
```

- [ ] **Step 2: Manual persistence verification (no API keys needed)**

1. `npm run dev`, open `http://localhost:3000/configs` → no seeded FABODXB config; create a test config.
2. Open `/creators` → empty; the old seeded creators are gone.
3. Stop the dev server (Ctrl-C), start it again → the test config is still there (CSV persisted).
4. `cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media && git status` → `data/` changes do NOT appear (gitignored — this is the fix for data disappearing on branch switches).
5. Delete the test config in the UI.

- [ ] **Step 3: Manual creator-flow verification (needs APIFY_API_TOKEN, ANTHROPIC_API_KEY, GEMINI_API_KEY in `.env`)**

1. Open `/creator`, enter the user's Instagram username, Save → profile header appears with follower count.
2. Click Refresh → SSE status messages stream; videos appear; topics get classified.
3. Restart the dev server → profile + videos persist.
4. Click "Analyze with AI" on one video → analysis modal renders markdown; per-video badge switches to "View Analysis".
5. Click "Generate Insights" → markdown report renders.
6. Run a pipeline from `/run` (small params) → "Recent Runs" table shows the run afterward.

If any step fails: STOP and fix before proceeding (use superpowers:systematic-debugging).

- [ ] **Step 4: Update `CLAUDE.md`**

Apply these updates:

1. In **Pipeline Overview**, append a step: `9. **Run History** — Every pipeline run (params, duration, videos added, status) is appended to data/runs.csv and shown on the Run page`.
2. In **Workspace Structure**, under `app/src/app/`, add `│   │   ├── creator/page.tsx     # My Creator: own-account analytics` and under `lib/` add the new modules:
   - `creator-merge.ts` — pure merge of scraped reels into stored creator videos
   - `creator-metrics.ts` — client-safe metrics (overview, rankings, topics, day-of-week)
   - `creator-profile.ts` — own-account profile JSON store
   - `creator-ai.ts` — topic classification, per-video analysis prompt, account insights (Claude)
3. In **Workspace Structure**, under `data/`, add: `runs.csv`, `creator-profile.json`, `creator-videos.csv`, and note that all user data files in `data/` are gitignored (seeded data removed 2026-06-11; git history retains it).
4. In **App Pages** table, add: `| My Creator | /creator | Own-account analytics: refresh latest reels, rankings, topic breakdown, posting patterns, on-demand AI analysis & insights |`.
5. Note under **How The System Works** that there is no seed data; the app starts empty and all data is user-created at runtime.

- [ ] **Step 5: Commit**

```bash
cd /Users/ardaanilboz/Desktop/socialMedia-AI/social-media
git add CLAUDE.md
git commit -m "docs: document My Creator section, run history, and untracked data files"
```

---

## Self-Review Checklist (run after writing, before execution)

- Spec coverage: de-seed ✔ (Task 1), git untrack ✔ (Task 1), runs.csv + API + UI ✔ (Tasks 4-6), profile store ✔ (Task 9), refresh SSE with merge + topics ✔ (Tasks 7, 10, 11), per-video analysis with expired-URL fallback ✔ (Tasks 3, 12), insights ✔ (Tasks 10, 12), page sections ✔ (Tasks 13-15), sidebar ✔ (Task 15), error handling ✔ (per-route), CLAUDE.md ✔ (Task 16).
- Type consistency: `CreatorVideo`/`CreatorProfile`/`PipelineRun` defined in Task 3 and used identically in Tasks 4-15; `mergeCreatorVideos(existing, scraped, today)` signature matches all call sites; `RankMetric` exported from creator-metrics and imported in stats-sections.
