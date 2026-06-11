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
