import { engagementRate } from "./creator-metrics";
import { readVideos, readCreators, readCreatorVideos } from "./csv";
import { readCreatorProfile } from "./creator-profile";
import { readMasterChecklist } from "./checklist";
import { readNexusFramework } from "./framework";
import type { Creator, CreatorProfile, CreatorVideo, Video } from "./types";

// Keep the always-on digest bounded. The full text of any single video's analysis
// is fetched on demand via the get_my_video / get_competitor_video tools.
const MAX_ROWS = 100;

export interface DigestInput {
  profile: CreatorProfile | null;
  creatorVideos: CreatorVideo[];
  competitorVideos: Video[];
  creators: Creator[];
  checklist: string;
  framework: string;
}

function num(n: number): string {
  return n.toLocaleString("en-US");
}

function yesNo(v: boolean): string {
  return v ? "yes" : "—";
}

function myVideosTable(videos: CreatorVideo[]): string {
  if (videos.length === 0) {
    return "_No reels tracked yet. Tell the user to hit Refresh on the My Creator page._";
  }
  const rows = [...videos]
    .sort((a, b) => b.views - a.views)
    .slice(0, MAX_ROWS)
    .map((v) => {
      const eng = (engagementRate(v) * 100).toFixed(1);
      const topic = v.topic || "—";
      return `| ${v.id} | ${v.datePosted || "—"} | ${topic} | ${num(v.views)} | ${num(v.likes)} | ${num(v.comments)} | ${eng}% | ${yesNo(!!v.analysis)} | ${yesNo(!!v.viralRescue)} |`;
    })
    .join("\n");
  const capped = videos.length > MAX_ROWS ? `\n_(showing top ${MAX_ROWS} of ${videos.length} by views)_` : "";
  return `| id | date | topic | views | likes | comments | eng | analyzed | rescued |
|---|---|---|---|---|---|---|---|---|
${rows}${capped}`;
}

function competitorVideosTable(videos: Video[]): string {
  if (videos.length === 0) {
    return "_No competitor videos analyzed yet (run the pipeline on the Run page)._";
  }
  const rows = [...videos]
    .sort((a, b) => b.views - a.views)
    .slice(0, MAX_ROWS)
    .map(
      (v) =>
        `| ${v.id} | ${v.creator || "—"} | ${v.datePosted || "—"} | ${num(v.views)} | ${num(v.likes)} | ${v.configName || "—"} | ${yesNo(!!v.analysis)} |`
    )
    .join("\n");
  const capped = videos.length > MAX_ROWS ? `\n_(showing top ${MAX_ROWS} of ${videos.length} by views)_` : "";
  return `| id | creator | date | views | likes | config | analyzed |
|---|---|---|---|---|---|---|
${rows}${capped}`;
}

// Build the markdown digest of everything the assistant should always know.
// Pure: takes already-loaded data so it can be unit-tested without the filesystem.
export function formatDigest(input: DigestInput): string {
  const { profile, creatorVideos, competitorVideos, creators, checklist, framework } = input;

  const totalViews = creatorVideos.reduce((s, v) => s + v.views, 0);
  const avgViews = creatorVideos.length ? Math.round(totalViews / creatorVideos.length) : 0;
  const avgEng = creatorVideos.length
    ? (creatorVideos.reduce((s, v) => s + engagementRate(v), 0) / creatorVideos.length) * 100
    : 0;

  const accountHeader = profile
    ? `@${profile.username} — ${num(profile.followers)} followers.${profile.lastRefreshedAt ? ` Last refreshed ${profile.lastRefreshedAt}.` : ""}`
    : "_No creator account connected yet (set one up on the My Creator page)._";

  const accountStats = creatorVideos.length
    ? `Tracking ${creatorVideos.length} of your reels. Avg ${num(avgViews)} views, ${avgEng.toFixed(1)}% engagement.`
    : "";

  const insights = profile?.accountInsights
    ? profile.accountInsights
    : "_No account insights report generated yet. Use the generate_account_insights tool if the user wants one._";

  const creatorList = creators.length
    ? creators.map((c) => `@${c.username}`).join(", ")
    : "_none added_";

  return `# THE USER'S ACCOUNT
${accountHeader}
${accountStats}

## Account insights (latest generated report)
${insights}

## The user's reels
${myVideosTable(creatorVideos)}

# COMPETITORS
Tracking ${creators.length} competitor account(s): ${creatorList}

## Competitor reels (scraped + AI-analyzed)
${competitorVideosTable(competitorVideos)}

# THE USER'S MASTER SCRIPTING CHECKLIST
${checklist || "_none set_"}

# THE USER'S CONTENT FRAMEWORK (Nexus)
${framework || "_none set_"}`;
}

// Load everything from disk and build the digest. Server-only (uses fs).
export function buildDataDigest(): string {
  return formatDigest({
    profile: readCreatorProfile(),
    creatorVideos: readCreatorVideos(),
    competitorVideos: readVideos(),
    creators: readCreators(),
    checklist: readMasterChecklist(),
    framework: readNexusFramework(),
  });
}
