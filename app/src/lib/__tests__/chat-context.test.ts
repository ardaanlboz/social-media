import { describe, it, expect } from "vitest";
import { formatDigest } from "../chat-context";
import type { Creator, CreatorProfile, CreatorVideo, Video } from "../types";

const myVideo = (o: Partial<CreatorVideo> = {}): CreatorVideo => ({
  id: "mv1",
  link: "https://instagram.com/p/x/",
  videoUrl: "",
  thumbnail: "",
  caption: "my caption",
  views: 5000,
  likes: 200,
  comments: 30,
  datePosted: "2026-06-10",
  topic: "Productivity",
  analysis: "",
  dateAdded: "2026-06-10",
  viralRescue: "",
  ...o,
});

const compVideo = (o: Partial<Video> = {}): Video => ({
  id: "cv1",
  link: "https://instagram.com/p/y/",
  thumbnail: "",
  creator: "rival",
  views: 90000,
  likes: 4000,
  comments: 120,
  analysis: "deep analysis text",
  newConcepts: "",
  datePosted: "2026-06-01",
  dateAdded: "2026-06-02",
  configName: "Fitness",
  starred: false,
  checklistResult: "",
  ...o,
});

const profile = (o: Partial<CreatorProfile> = {}): CreatorProfile => ({
  username: "me",
  profilePicUrl: "",
  followers: 12345,
  lastRefreshedAt: "2026-06-11",
  accountInsights: "",
  ...o,
});

const creator = (username: string): Creator => ({
  id: username,
  username,
  category: "",
  profilePicUrl: "",
  followers: 0,
  reelsCount30d: 0,
  avgViews30d: 0,
  lastScrapedAt: "",
});

describe("formatDigest", () => {
  it("includes account header, reel ids, and competitor ids", () => {
    const out = formatDigest({
      profile: profile(),
      creatorVideos: [myVideo()],
      competitorVideos: [compVideo()],
      creators: [creator("rival")],
      checklist: "- [hook] Hook: first 5s",
      framework: "Write in You-form",
    });
    expect(out).toContain("@me — 12,345 followers");
    expect(out).toContain("mv1"); // own reel id is addressable by tools
    expect(out).toContain("cv1"); // competitor reel id is addressable by tools
    expect(out).toContain("@rival");
    expect(out).toContain("- [hook] Hook: first 5s");
    expect(out).toContain("Write in You-form");
  });

  it("shows the analyzed/rescued flags for own reels", () => {
    const out = formatDigest({
      profile: profile(),
      creatorVideos: [myVideo({ analysis: "done", viralRescue: '{"x":1}' })],
      competitorVideos: [],
      creators: [],
      checklist: "",
      framework: "",
    });
    // row: | id | date | topic | views | likes | comments | eng | yes | yes |
    expect(out).toMatch(/mv1 \|.*\| yes \| yes \|/);
  });

  it("falls back gracefully with no data", () => {
    const out = formatDigest({
      profile: null,
      creatorVideos: [],
      competitorVideos: [],
      creators: [],
      checklist: "",
      framework: "",
    });
    expect(out).toContain("No creator account connected yet");
    expect(out).toContain("No reels tracked yet");
    expect(out).toContain("No competitor videos analyzed yet");
  });

  it("surfaces the latest insights report when present", () => {
    const out = formatDigest({
      profile: profile({ accountInsights: "# WHAT'S WORKING\nShort hooks." }),
      creatorVideos: [],
      competitorVideos: [],
      creators: [],
      checklist: "",
      framework: "",
    });
    expect(out).toContain("Short hooks.");
  });
});
