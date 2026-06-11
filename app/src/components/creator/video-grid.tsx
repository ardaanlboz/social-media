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
import { ArrowUpDown, ExternalLink, Film, Flame, Heart, Loader2, MessageCircle, Play, Search, Sparkles } from "lucide-react";
import { MarkdownContent } from "@/components/markdown-content";
import { ViralRescueModal } from "@/components/creator/viral-rescue-modal";
import { computeOverview, engagementRate } from "@/lib/creator-metrics";
import type { CreatorVideo, ViralRescue } from "@/lib/types";

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

function parseRescue(raw: string): ViralRescue | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ViralRescue;
  } catch {
    return null;
  }
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
  const [rescuingId, setRescuingId] = useState<string | null>(null);
  const [rescueError, setRescueError] = useState("");
  const [rescueModal, setRescueModal] = useState<{ video: CreatorVideo; rescue: ViralRescue } | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const topics = [...new Set(videos.map((v) => v.topic).filter(Boolean))].sort();
  const accountAvgViews = computeOverview(videos).avgViews;

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

  const runRescue = async (video: CreatorVideo): Promise<ViralRescue | null> => {
    const res = await fetch("/api/creator/rescue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: video.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRescueError(data.error || "Rescue failed");
      return null;
    }
    return data.rescue as ViralRescue;
  };

  const handleRescue = async (video: CreatorVideo) => {
    setRescueError("");
    const existing = parseRescue(video.viralRescue);
    if (existing) {
      setRescueModal({ video, rescue: existing });
      return;
    }
    setRescuingId(video.id);
    try {
      const rescue = await runRescue(video);
      if (rescue) {
        await onReload();
        setRescueModal({ video, rescue });
      }
    } finally {
      setRescuingId(null);
    }
  };

  const handleRegenerate = async () => {
    if (!rescueModal) return;
    setRescueError("");
    setRegenerating(true);
    try {
      const rescue = await runRescue(rescueModal.video);
      if (rescue) {
        await onReload();
        setRescueModal({ video: rescueModal.video, rescue });
      }
    } finally {
      setRegenerating(false);
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

      {rescueError && (
        <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-3">
          <p className="text-[11px] text-red-400/80">{rescueError}</p>
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

                <div className="flex flex-col gap-1.5 pt-1">
                  {video.analysis ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModalVideo(video)}
                      className="w-full rounded-xl text-[11px] h-7 gap-1 transition-all duration-200 glass border-white/[0.06] text-emerald-400/90 hover:text-emerald-300"
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
                      className="w-full rounded-xl text-[11px] h-7 gap-1 transition-all duration-200 glass border-white/[0.06] text-muted-foreground hover:text-foreground"
                    >
                      {analyzingId === video.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {analyzingId === video.id ? "Analyzing..." : "Analyze with AI"}
                    </Button>
                  )}
                  {(() => {
                    const hasRescue = !!parseRescue(video.viralRescue);
                    const isFlop = accountAvgViews > 0 && video.views < accountAvgViews;
                    return (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRescue(video)}
                        disabled={rescuingId !== null}
                        className={`w-full rounded-xl text-[11px] h-7 gap-1 transition-all duration-200 border ${
                          hasRescue
                            ? "border-orange-500/20 bg-orange-500/[0.06] text-orange-300/90 hover:text-orange-200"
                            : isFlop
                            ? "border-orange-500/30 bg-orange-500/[0.08] text-orange-300 hover:bg-orange-500/[0.14]"
                            : "glass border-white/[0.06] text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {rescuingId === video.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flame className="h-3 w-3" />}
                        {rescuingId === video.id ? "Rescuing..." : hasRescue ? "View Rescue" : "Make It Viral"}
                      </Button>
                    );
                  })()}
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

      <ViralRescueModal
        video={rescueModal?.video || null}
        rescue={rescueModal?.rescue || null}
        open={!!rescueModal}
        onClose={() => setRescueModal(null)}
        onRegenerate={handleRegenerate}
        regenerating={regenerating}
      />
    </div>
  );
}
