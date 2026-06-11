# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Is

**Social Media AI** — a tool that helps create viral Instagram Reels by analyzing competitor content. It scrapes competitors' recent videos, identifies the most viral ones, analyzes them with AI (video understanding + content breakdown), and generates new adapted video concepts for a given brand.

---

## How to Run

```bash
cd app
npm install
npm run dev
# Open http://localhost:3000
```

**Required environment variables** (in `.env` at project root):
- `APIFY_API_TOKEN` — Apify Instagram scraper
- `GEMINI_API_KEY` — Google Gemini video analysis
- `ANTHROPIC_API_KEY` — Claude concept generation

---

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** components
- **CSV files** for data storage (in `data/` directory)
- **Apify** — Instagram scraping
- **Google Gemini 3.5 Flash** — Video analysis (upload + multimodal)
- **Claude Sonnet** — New concept generation

---

## How The System Works

### Pipeline Overview

1. **Input** — Select a config and parameters (max videos, top-K, days lookback) via the Run page
2. **Load Config** — Retrieve analysis prompt, new concepts prompt, and creator list from CSV
3. **Scrape** — For each competitor creator, scrape recent Instagram Reels via Apify
4. **Filter & Rank** — Filter by date, sort by views, take top-K most viral
5. **Analyze** — Download video, upload to Gemini, analyze (extracts Concept, Hook, Retention, Reward, Script)
6. **Generate** — Send analysis + brand context to Claude for adapted video concepts (master scripting checklist injected as mandatory rules)
7. **Verify** — Independent Claude verifier grades every concept against the master checklist; failing concepts are revised with the verifier's feedback (max 2 rounds); the final scorecard is saved with the video
8. **Save** — Append results to `data/videos.csv`, viewable in the Videos page with thumbnails and checklist scorecards
9. **Run History** — Every run (params, duration, videos added, status) is appended to `data/runs.csv` and shown in a "Recent Runs" table on the Run page

### Data Persistence

All user data lives in `data/` as CSV/JSON/markdown files and is **gitignored** (seeded data was removed 2026-06-11; git history retains it). The app starts empty — configs, creators, videos, runs, and the creator profile are all user-created at runtime and survive restarts and branch switches. Missing files are treated as empty and created on first write.

### My Creator (Own-Account Analytics)

The `/creator` page analyzes the user's own Instagram account (single account, stored in `data/creator-profile.json` + `data/creator-videos.csv`):
- **Refresh** (SSE) — re-scrapes profile stats and the latest reels (90 days / up to 100), merges by post URL (new rows added, metrics updated on known rows), then Claude batch-classifies topics from captions, reusing existing topic labels
- **Metrics views** (instant, no AI cost) — overview cards, best/worst rankings by views/likes/comments/engagement, per-topic breakdown with CSS bars, avg views by posting day
- **Analyze with AI** (per video) — downloads the reel (re-scrapes a fresh CDN URL via Apify if expired), runs Gemini with a built-in creator-analysis prompt incl. performance diagnosis vs account average
- **Make It Viral / Viral Rescue** (per video, hook-focused) — two-stage: Gemini watches the reel and reports ground truth, then Claude (`VIRAL_RESCUE_SYSTEM_PROMPT`, brutally-honest strategist) returns structured JSON — virality score, hook autopsy, **5 ready-to-film replacement hooks**, retention fixes, a rewritten script, caption/CTA, ranked priority changes. Rendered in `ViralRescueModal`; saved to the video's `viralRescue` column so "View Rescue" reopens instantly. The button gets a flame accent on below-average (flopped) videos.
- **Generate Insights** (account level) — one Claude call over the full metrics table + analyses → markdown report stored on the profile

### Two Customizable Prompts Per Config

- **Analysis Instruction** — How Gemini should break down the video
- **New Concepts Instruction** — How Claude should adapt the reference for the brand

### Master Scripting Checklist

A global checklist (`data/master-checklist.md`, editable on the Configs page) that oversees every generation:
- Injected into the Gemini analysis prompt (reference video is evaluated against it)
- Injected into the Claude concepts prompt as mandatory rules
- Enforced by `lib/verifier.ts`: independent grading + up to 2 automatic revision rounds
- Verdict saved per video as JSON in the `checklistResult` column, rendered as a scorecard in the Videos page
- Item line format: `- [item-id] Label: criterion`; an empty/missing file disables the feature entirely

### Nexus Framework

A global content-creation framework (`data/nexus-framework.md`, editable on the Configs page) injected as guidance — not graded:
- Appended to the Gemini analysis prompt as descriptive vocabulary/context
- Injected into the Claude generation and revision prompts as mandatory writing rules (You-form, conviction, linear storytelling, power words, simplicity, visual-in-mind)
- The checklist verifier does NOT grade framework adherence; an empty/missing file disables the layer

---

## Workspace Structure

```
.
├── CLAUDE.md                              # This file
├── .env                                   # API keys (not committed)
├── app/                                   # Next.js application
│   ├── src/
│   │   ├── app/                           # Pages and API routes
│   │   │   ├── page.tsx                   # Dashboard
│   │   │   ├── videos/page.tsx            # Videos browser with thumbnails
│   │   │   ├── run/page.tsx               # Pipeline runner with live progress + run history
│   │   │   ├── creator/page.tsx           # My Creator: own-account analytics
│   │   │   ├── configs/page.tsx           # Config management
│   │   │   ├── creators/page.tsx          # Creator management
│   │   │   └── api/                       # API routes (configs, creators, videos, pipeline, checklist, framework, runs, creator + creator/refresh|analyze|insights)
│   │   ├── lib/                           # Core logic
│   │   │   ├── pipeline.ts               # Pipeline orchestration (+ run history)
│   │   │   ├── apify.ts                  # Apify scraper client (+ single-post re-scrape)
│   │   │   ├── gemini.ts                 # Gemini video analysis client
│   │   │   ├── claude.ts                 # Claude concept generation client
│   │   │   ├── checklist.ts              # Master checklist file read/write
│   │   │   ├── checklist-parse.ts        # Client-safe checklist item parser
│   │   │   ├── framework.ts              # Nexus framework file read/write
│   │   │   ├── verifier.ts               # Checklist verify-and-revise (Claude)
│   │   │   ├── creator-merge.ts          # Pure merge of scraped reels into stored creator videos (tested)
│   │   │   ├── creator-metrics.ts        # Client-safe own-account metrics (tested)
│   │   │   ├── creator-profile.ts        # Own-account profile JSON store
│   │   │   ├── creator-ai.ts             # Topics, creator analysis prompt, insights, viral-rescue prompts+parser (Claude)
│   │   │   ├── creator-media.ts          # Shared reel download w/ expired-URL re-scrape (analyze + rescue)
│   │   │   ├── csv.ts                    # CSV read/write utilities (incl. creator-videos, runs)
│   │   │   └── types.ts                  # TypeScript interfaces
│   │   ├── components/                    # UI components (shadcn + custom, creator/ sections)
│   │   └── lib/__tests__/                 # Vitest unit tests (npm run test)
│   └── package.json
├── data/                                  # User data — ALL gitignored, created at runtime
│   ├── configs.csv                        # Pipeline configurations
│   ├── creators.csv                       # Instagram creator accounts
│   ├── master-checklist.md                # Global scripting checklist
│   ├── nexus-framework.md                 # Global content-creation framework
│   ├── videos.csv                         # Analyzed video results
│   ├── runs.csv                           # Pipeline run history
│   ├── creator-profile.json               # Own-account profile + insights
│   └── creator-videos.csv                 # Own-account scraped reels + analyses
├── context/                               # Background context for Claude
├── plans/                                 # Implementation plans
└── .claude/commands/                      # Slash commands (prime, create-plan, implement)
```

---

## App Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Summary stats, recent videos |
| Videos | `/videos` | Browse results with thumbnails, expandable analysis & concepts |
| Run Pipeline | `/run` | Select config, set params, run with live progress streaming + recent run history |
| My Creator | `/creator` | Own-account analytics: refresh latest reels, rankings, topic breakdown, posting patterns, on-demand AI analysis, viral rescue (Make It Viral), & insights |
| Configs | `/configs` | CRUD for pipeline configs (prompts, categories) |
| Creators | `/creators` | CRUD for competitor Instagram accounts |

---

## Commands

### /prime
Initialize a new session with full context awareness.

### /create-plan [request]
Create a detailed implementation plan in `plans/`.

### /implement [plan-path]
Execute a plan step by step.

---

## Critical Instruction: Maintain This File

After any change to the workspace, ask:
1. Does this change add new functionality?
2. Does it modify the workspace structure documented above?
3. Should a new command be listed?
4. Does context/ need updates?

If yes, update the relevant sections.

---

## Session Workflow

1. **Start**: Run `/prime` to load context
2. **Work**: Use commands or direct Claude with tasks
3. **Plan changes**: Use `/create-plan` before significant additions
4. **Execute**: Use `/implement` to execute plans
5. **Maintain**: Claude updates CLAUDE.md and context/ as the workspace evolves
