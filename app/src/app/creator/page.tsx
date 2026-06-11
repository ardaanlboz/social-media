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
                  Saving &amp; scraping...
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
