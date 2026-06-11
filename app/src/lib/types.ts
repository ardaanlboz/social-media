export interface Config {
  id: string;
  configName: string;
  creatorsCategory: string;
  analysisInstruction: string;
  newConceptsInstruction: string;
}

export interface Creator {
  id: string;
  username: string;
  category: string;
  profilePicUrl: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
  lastScrapedAt: string;
}

export interface Video {
  id: string;
  link: string;
  thumbnail: string;
  creator: string;
  views: number;
  likes: number;
  comments: number;
  analysis: string;
  newConcepts: string;
  datePosted: string;
  dateAdded: string;
  configName: string;
  starred: boolean;
  checklistResult: string;
}

export interface PipelineParams {
  configName: string;
  maxVideos: number;
  topK: number;
  nDays: number;
}

export interface ActiveTask {
  id: string;
  creator: string;
  step: string;
  views?: number;
}

export interface PipelineProgress {
  status: "idle" | "running" | "completed" | "error";
  phase: "scraping" | "analyzing" | "done";
  activeTasks: ActiveTask[];
  creatorsCompleted: number;
  creatorsTotal: number;
  creatorsScraped: number;
  videosAnalyzed: number;
  videosTotal: number;
  errors: string[];
  log: string[];
}

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
  viralRescue: string;
}

export interface ViralRescueHook {
  angle: string;
  spokenLine: string;
  onScreenText: string;
  openingVisual: string;
  whyItWorks: string;
}

export interface ViralRescueRetentionFix {
  timestamp: string;
  issue: string;
  fix: string;
}

export interface ViralRescuePriority {
  rank: number;
  change: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  expectedEffect: string;
}

export interface ViralRescue {
  viralityScore: { current: number; potential: number; oneLineVerdict: string };
  hookAutopsy: {
    whatYouDid: string;
    firstFrameVerdict: string;
    whyItFlopped: string[];
    scrollStopScore: number;
  };
  newHooks: ViralRescueHook[];
  recommendedHookIndex: number;
  recommendedReason: string;
  retentionFixes: ViralRescueRetentionFix[];
  rewrittenScript: string;
  captionAndCta: { caption: string; cta: string };
  priorityChanges: ViralRescuePriority[];
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
