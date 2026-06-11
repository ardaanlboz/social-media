"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MarkdownContent } from "@/components/markdown-content";
import {
  AlertTriangle,
  Clapperboard,
  Eye,
  Film,
  Flame,
  Gauge,
  Heart,
  Loader2,
  MessageCircle,
  Quote,
  RefreshCw,
  Rocket,
  Star,
  Type,
} from "lucide-react";
import type { CreatorVideo, ViralRescue } from "@/lib/types";

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

const LEVEL_STYLES: Record<string, string> = {
  high: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
  medium: "bg-amber-500/10 border-amber-500/20 text-amber-300",
  low: "bg-white/[0.05] border-white/[0.08] text-muted-foreground",
};

function scoreColor(score: number): string {
  if (score >= 7) return "text-emerald-400";
  if (score >= 4) return "text-amber-400";
  return "text-red-400";
}

export function ViralRescueModal({
  video,
  rescue,
  open,
  onClose,
  onRegenerate,
  regenerating,
}: {
  video: CreatorVideo | null;
  rescue: ViralRescue | null;
  open: boolean;
  onClose: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden glass-strong rounded-2xl border-white/[0.08] p-0 gap-0">
        <DialogTitle className="sr-only">Viral Rescue</DialogTitle>
        {video && rescue && (
          <>
            {/* Header */}
            <div className="flex items-center gap-4 p-5 border-b border-white/[0.06]">
              <div className="relative h-16 w-12 shrink-0 rounded-lg overflow-hidden bg-white/[0.02]">
                {video.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/proxy-image?url=${encodeURIComponent(video.thumbnail)}`}
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
                  <Flame className="h-4 w-4 text-orange-400" />
                  <p className="text-sm font-semibold truncate">{video.caption || "Viral Rescue"}</p>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{formatViews(video.views)}</span>
                  <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{formatViews(video.likes)}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{formatViews(video.comments)}</span>
                </div>
              </div>
              <Button
                onClick={onRegenerate}
                disabled={regenerating}
                variant="ghost"
                size="sm"
                className="rounded-xl glass border-white/[0.08] gap-1.5 text-xs shrink-0"
              >
                {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Regenerate
              </Button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto max-h-[calc(92vh-92px)] p-6 space-y-7">
              {/* Virality score */}
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Gauge className="h-4 w-4 text-orange-400" />
                  <h3 className="text-sm font-semibold">Virality Verdict</h3>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className={`text-3xl font-bold ${scoreColor(rescue.viralityScore.current)}`}>{rescue.viralityScore.current}<span className="text-base text-muted-foreground">/10</span></p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">As Posted</p>
                  </div>
                  <Rocket className="h-5 w-5 text-muted-foreground/40" />
                  <div className="text-center">
                    <p className="text-3xl font-bold text-emerald-400">{rescue.viralityScore.potential}<span className="text-base text-muted-foreground">/10</span></p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Potential</p>
                  </div>
                  <p className="flex-1 text-sm text-foreground/80 italic">&ldquo;{rescue.viralityScore.oneLineVerdict}&rdquo;</p>
                </div>
              </div>

              {/* Hook autopsy */}
              <div className="glass rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <h3 className="text-sm font-semibold">Hook Autopsy</h3>
                  </div>
                  <span className={`text-xs font-bold ${scoreColor(rescue.hookAutopsy.scrollStopScore)}`}>
                    Scroll-stop {rescue.hookAutopsy.scrollStopScore}/10
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">What you did</p>
                  <p className="text-sm text-foreground/80">{rescue.hookAutopsy.whatYouDid}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">First frame</p>
                  <p className="text-sm text-foreground/80">{rescue.hookAutopsy.firstFrameVerdict}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Why it flopped</p>
                  <ul className="space-y-1.5">
                    {rescue.hookAutopsy.whyItFlopped.map((reason, i) => (
                      <li key={i} className="flex gap-2 text-sm text-red-300/90">
                        <span className="text-red-400 shrink-0">✗</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* New hooks — the hero */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-400" />
                  <h3 className="text-sm font-semibold">{rescue.newHooks.length} Hooks That Would Stop the Scroll</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {rescue.newHooks.map((hook, i) => {
                    const recommended = i + 1 === rescue.recommendedHookIndex;
                    return (
                      <div
                        key={i}
                        className={`rounded-2xl p-4 space-y-3 border ${
                          recommended
                            ? "bg-orange-500/[0.07] border-orange-500/30"
                            : "glass border-white/[0.06]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.06]">
                            {hook.angle}
                          </Badge>
                          {recommended && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-300">
                              <Star className="h-3 w-3 fill-orange-300" /> RECOMMENDED
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Quote className="h-3.5 w-3.5 text-orange-400/70 shrink-0 mt-0.5" />
                          <p className="text-sm font-semibold leading-snug">{hook.spokenLine}</p>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Type className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span><span className="text-foreground/60">On screen:</span> {hook.onScreenText}</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Clapperboard className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span><span className="text-foreground/60">First shot:</span> {hook.openingVisual}</span>
                        </div>
                        <p className="text-[11px] text-foreground/60 leading-relaxed border-t border-white/[0.05] pt-2">{hook.whyItWorks}</p>
                      </div>
                    );
                  })}
                </div>
                {rescue.recommendedReason && (
                  <p className="text-xs text-muted-foreground">
                    <span className="text-orange-300 font-medium">Why #{rescue.recommendedHookIndex}:</span> {rescue.recommendedReason}
                  </p>
                )}
              </div>

              {/* Retention fixes */}
              {rescue.retentionFixes.length > 0 && (
                <div className="glass rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-semibold">Keep Them Watching</h3>
                  <div className="space-y-2.5">
                    {rescue.retentionFixes.map((fix, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <span className="shrink-0 font-mono text-[11px] text-orange-300/80 mt-0.5 w-10">{fix.timestamp}</span>
                        <div>
                          <p className="text-foreground/80">{fix.issue}</p>
                          <p className="text-muted-foreground text-xs mt-0.5">→ {fix.fix}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rewritten script */}
              <div className="glass rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Clapperboard className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-semibold">The Rewritten Video</h3>
                </div>
                <MarkdownContent content={rescue.rewrittenScript} variant="analysis" />
              </div>

              {/* Caption & CTA */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="glass rounded-2xl p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Caption</p>
                  <p className="text-sm text-foreground/80">{rescue.captionAndCta.caption}</p>
                </div>
                <div className="glass rounded-2xl p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Call to Action</p>
                  <p className="text-sm text-foreground/80">{rescue.captionAndCta.cta}</p>
                </div>
              </div>

              {/* Priority changes */}
              {rescue.priorityChanges.length > 0 && (
                <div className="glass rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-semibold">Do This First</h3>
                  <div className="space-y-2">
                    {[...rescue.priorityChanges].sort((a, b) => a.rank - b.rank).map((p) => (
                      <div key={p.rank} className="flex items-start gap-3 rounded-xl bg-white/[0.03] border border-white/[0.04] px-3 py-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-xs font-bold text-orange-300">{p.rank}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground/85">{p.change}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{p.expectedEffect}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <span className={`rounded-md px-1.5 py-0.5 text-[9px] border ${LEVEL_STYLES[p.impact] || LEVEL_STYLES.low}`}>{p.impact} impact</span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[9px] border ${LEVEL_STYLES[p.effort] || LEVEL_STYLES.low}`}>{p.effort} effort</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
