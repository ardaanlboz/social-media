# Creator Analytics & Local Persistence — Design

**Date:** 2026-06-11
**Status:** Approved

## Problem

1. The app ships with seeded data (FABODXB config, dubai-real-estate / ai-creators creators, a large set of analyzed videos). The user wants these gone.
2. User-added configs, creators, and videos "disappear when the app closes." Root cause: `data/configs.csv`, `data/creators.csv`, `data/videos.csv`, and `data/master-checklist.md` are tracked in git, so branch switches, checkouts, and resets revert them to the committed seed state. The data layer itself (`app/src/lib/csv.ts`) writes to disk correctly.
3. There is no record of pipeline runs.
4. There is no way to analyze the user's **own** Instagram account.

## Decisions (user-confirmed)

- Pipeline persistence = a **run history log** (`runs.csv`), plus the git fix for videos.
- Own-account analysis is **metrics-first with on-demand AI**: refresh pulls stats instantly; deep Gemini video analysis is a per-video button.
- **Single** own account.
- Topics are **AI auto-classified** by Claude from captions (reusing existing topic labels for consistency).

## Part A — De-seed + local persistence

### Git changes
- `git rm --cached` (keep on disk, stop tracking): `data/configs.csv`, `data/creators.csv`, `data/videos.csv`, `data/master-checklist.md`.
- `.gitignore` additions: those four files plus `data/runs.csv`, `data/creator-profile.json`, `data/creator-videos.csv`.
- Git history retains the old seeded data; nothing is irrecoverably lost.

### De-seeding
- Truncate `configs.csv`, `creators.csv`, `videos.csv` to header rows only.
- Delete `app/src/scripts/seed.ts`.
- `csv.ts` already returns `[]` for missing/empty files and creates `data/` on write — no data-layer changes needed for fresh starts.

### Run history
- New `data/runs.csv` columns: `id, configName, maxVideos, topK, nDays, startedAt, finishedAt, status, videosAdded, errorCount`. `status` ∈ `completed | failed`.
- `csv.ts` gains `readRuns()` / `writeRuns()` (and a `PipelineRun` interface in `types.ts`).
- `pipeline.ts` appends one record per run — written in both the success and failure paths.
- New route `GET /api/runs` returns runs, newest first.
- The Run page (`/run`) shows a "Recent runs" table (config, params, date, duration, videos added, status) below the runner.

## Part B — "My Creator" section

### Navigation
- New sidebar item **My Creator** → `/creator` (lucide icon: `UserCircle`), added to `app/src/components/app-sidebar.tsx`.

### Storage (both gitignored)
- `data/creator-profile.json` — singleton JSON:
  `{ username, profilePicUrl, followers, lastRefreshedAt, accountInsights }`
  (`accountInsights` is a markdown string, empty until generated).
- `data/creator-videos.csv` — columns:
  `id, link, thumbnail, caption, views, likes, comments, datePosted, topic, analysis, dateAdded`
  (`analysis` empty until the per-video AI analysis is run).
- New lib module `app/src/lib/creator-store.ts` for profile JSON + creator-videos CSV read/write (CSV part delegates to the shared helpers in `csv.ts`).

### Apify extension
- `ApifyReel` gains `caption: string` (the `apify~instagram-scraper` actor already returns it; we just surface the field).

### Flows

**Setup** — if no profile exists, `/creator` shows a username input. `PUT /api/creator` saves the username and scrapes profile stats via the existing `scrapeCreatorStats()`.

**Refresh** (`POST /api/creator/refresh`, SSE — same pattern as `/api/creators/refresh`):
1. Re-scrape profile stats.
2. Scrape latest reels via `scrapeReels()` (defaults: last 90 days, up to 100 reels).
3. Merge by post URL: new videos appended; existing videos get views/likes/comments updated (rankings stay current).
4. Claude batch-classifies topics for videos without one, in a single call that includes the set of already-used topic labels so labels stay consistent.
5. Persist; stream progress events throughout.

**Per-video AI analysis** (`POST /api/creator/analyze`, body `{videoId}`):
- Download reel → upload to Gemini → analyze with a built-in creator-analysis prompt (concept / hook / retention / reward / script, plus "why did this perform the way it did relative to the account average" — the account average is passed into the prompt).
- Result saved to the video's `analysis` column; rendered in an expandable modal like the Videos page.

**Account insights** (`POST /api/creator/insights`):
- One Claude call over the full metrics table (all videos with topics, stats, engagement rates, posting dates) plus any per-video analyses.
- Produces a markdown report: what works, what doesn't, best/worst topics, patterns, recommendations.
- Stored in `creator-profile.json.accountInsights`, rendered on the page.

### Page sections (`/creator`)
All computed client-side from stored metrics — instant, no AI cost:
1. **Profile header** — avatar, username, followers, last refreshed, Refresh button (with SSE progress).
2. **Overview cards** — videos tracked, total views, avg views, avg engagement rate ((likes+comments)/views), best video.
3. **Rankings** — best & worst performing lists, sortable by views / likes / comments / engagement rate.
4. **By topic** — per-topic count, avg views, avg engagement, best & worst video per topic; CSS-bar comparison (no chart dependency).
5. **Posting patterns** — avg views by day-of-week, posting frequency.
6. **AI insights** — "Generate insights" button + rendered markdown report.
7. **Video grid/table** — all videos with thumbnail, caption, stats, topic, "Analyze with AI" button, expandable analysis modal.

### API summary
| Route | Method | Purpose |
|---|---|---|
| `/api/creator` | GET | Profile + videos |
| `/api/creator` | PUT | Set/replace account username (scrapes stats) |
| `/api/creator/refresh` | POST (SSE) | Pull latest reels, update stats, classify topics |
| `/api/creator/analyze` | POST | Deep Gemini analysis for one video |
| `/api/creator/insights` | POST | Claude account-level insights report |
| `/api/runs` | GET | Pipeline run history |

## Error handling
- Refresh SSE: per-step errors streamed as events; partial progress is saved (e.g., reels saved even if topic classification fails — topics stay empty and are retried next refresh).
- `analyze`/`insights`: JSON error responses with status codes; UI shows the error inline and the button becomes retryable.
- Missing env keys produce the same explicit errors the existing clients throw.

## Testing
- Manual verification: fresh start with empty CSVs (pages render empty states), add config/creator → restart dev server → data persists; git branch switch does not revert data files.
- Creator flow: set account, refresh (with real Apify key), verify merge/update on second refresh, run one per-video analysis, generate insights.

## Out of scope
- Multiple own accounts; chart libraries; SQLite migration; auto-AI on refresh; modifying the existing competitor pipeline beyond run-history writes; the unrelated `nate-herk-*` files in `data/` (left as-is).
