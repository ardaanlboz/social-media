import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import type { Config, Creator, Video, CreatorVideo, PipelineRun } from "./types";

const DATA_DIR = path.join(process.cwd(), "..", "data");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readCsv<T>(filename: string): T[] {
  const filepath = path.join(DATA_DIR, filename);
  if (!existsSync(filepath)) return [];
  const content = readFileSync(filepath, "utf-8");
  if (!content.trim()) return [];
  return parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true }) as T[];
}

function writeCsv(filename: string, data: Record<string, unknown>[], columns: string[]) {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  const output = stringify(data, { header: true, columns });
  writeFileSync(filepath, output, "utf-8");
}

// Configs
const CONFIG_COLUMNS = ["id", "configName", "creatorsCategory", "analysisInstruction", "newConceptsInstruction"];

export function readConfigs(): Config[] {
  return readCsv<Config>("configs.csv");
}

export function writeConfigs(configs: Config[]) {
  writeCsv("configs.csv", configs as unknown as Record<string, unknown>[], CONFIG_COLUMNS);
}

// Creators
const CREATOR_COLUMNS = ["id", "username", "category", "profilePicUrl", "followers", "reelsCount30d", "avgViews30d", "lastScrapedAt"];

export function readCreators(): Creator[] {
  const raw = readCsv<Record<string, string>>("creators.csv");
  return raw.map((r) => ({
    id: r.id || "",
    username: r.username || "",
    category: r.category || "",
    profilePicUrl: r.profilePicUrl || "",
    followers: parseInt(r.followers || "0", 10) || 0,
    reelsCount30d: parseInt(r.reelsCount30d || "0", 10) || 0,
    avgViews30d: parseInt(r.avgViews30d || "0", 10) || 0,
    lastScrapedAt: r.lastScrapedAt || "",
  }));
}

export function writeCreators(creators: Creator[]) {
  writeCsv("creators.csv", creators as unknown as Record<string, unknown>[], CREATOR_COLUMNS);
}

// Videos
const VIDEO_COLUMNS = ["id", "link", "thumbnail", "creator", "views", "likes", "comments", "analysis", "newConcepts", "datePosted", "dateAdded", "configName", "starred", "checklistResult"];

export function readVideos(): Video[] {
  const raw = readCsv<Record<string, string>>("videos.csv");
  return raw.map((r) => ({
    id: r.id || "",
    link: r.link || r.Link || "",
    thumbnail: r.thumbnail || r.Thumbnail || "",
    creator: r.creator || r.Creator || "",
    views: parseInt(r.views || r.Views || "0", 10) || 0,
    likes: parseInt(r.likes || r.Likes || "0", 10) || 0,
    comments: parseInt(r.comments || r.Comments || "0", 10) || 0,
    analysis: r.analysis || r.Analysis || "",
    newConcepts: r.newConcepts || r["newConcepts"] || r["New Concepts"] || "",
    datePosted: r.datePosted || r["Date Posted"] || r["datePosted"] || "",
    dateAdded: r.dateAdded || r["Date Added"] || r["dateAdded"] || "",
    configName: r.configName || r["Config Name"] || r["configName"] || "",
    starred: r.starred === "true",
    checklistResult: r.checklistResult || "",
  }));
}

export function writeVideos(videos: Video[]) {
  writeCsv("videos.csv", videos as unknown as Record<string, unknown>[], VIDEO_COLUMNS);
}

export function appendVideo(video: Video) {
  const videos = readVideos();
  videos.push(video);
  writeVideos(videos);
}

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
