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
