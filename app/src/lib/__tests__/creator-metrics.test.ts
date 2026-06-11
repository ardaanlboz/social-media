import { describe, it, expect } from "vitest";
import {
  engagementRate,
  computeOverview,
  rankVideos,
  computeTopicStats,
  computeDayOfWeekStats,
  UNCATEGORIZED,
} from "../creator-metrics";
import type { CreatorVideo } from "../types";

const video = (overrides: Partial<CreatorVideo> = {}): CreatorVideo => ({
  id: "v1",
  link: "https://instagram.com/p/x/",
  videoUrl: "",
  thumbnail: "",
  caption: "",
  views: 1000,
  likes: 50,
  comments: 10,
  datePosted: "2026-06-11",
  topic: "",
  analysis: "",
  dateAdded: "2026-06-11",
  viralRescue: "",
  ...overrides,
});

describe("engagementRate", () => {
  it("computes (likes+comments)/views", () => {
    expect(engagementRate({ views: 1000, likes: 50, comments: 10 })).toBeCloseTo(0.06);
  });

  it("returns 0 when views is 0", () => {
    expect(engagementRate({ views: 0, likes: 50, comments: 10 })).toBe(0);
  });
});

describe("computeOverview", () => {
  it("returns zeros and null bestVideo for empty input", () => {
    const stats = computeOverview([]);
    expect(stats.videosTracked).toBe(0);
    expect(stats.totalViews).toBe(0);
    expect(stats.avgViews).toBe(0);
    expect(stats.avgEngagementRate).toBe(0);
    expect(stats.bestVideo).toBeNull();
  });

  it("aggregates totals, averages, and finds the best video", () => {
    const a = video({ id: "a", views: 1000, likes: 100, comments: 0 });
    const b = video({ id: "b", views: 3000, likes: 150, comments: 150 });
    const stats = computeOverview([a, b]);
    expect(stats.videosTracked).toBe(2);
    expect(stats.totalViews).toBe(4000);
    expect(stats.avgViews).toBe(2000);
    expect(stats.avgEngagementRate).toBeCloseTo((0.1 + 0.1) / 2);
    expect(stats.bestVideo?.id).toBe("b");
  });
});

describe("rankVideos", () => {
  const a = video({ id: "a", views: 100, likes: 90, comments: 0 });
  const b = video({ id: "b", views: 1000, likes: 10, comments: 0 });

  it("ranks best by views", () => {
    expect(rankVideos([a, b], "views", "best", 2).map((v) => v.id)).toEqual(["b", "a"]);
  });

  it("ranks worst by views", () => {
    expect(rankVideos([a, b], "views", "worst", 2).map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("ranks by engagement rate", () => {
    // a: 90/100 = 0.9, b: 10/1000 = 0.01
    expect(rankVideos([a, b], "engagement", "best", 2).map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("respects the limit", () => {
    expect(rankVideos([a, b], "views", "best", 1)).toHaveLength(1);
  });
});

describe("computeTopicStats", () => {
  it("groups by topic, maps empty topic to Uncategorized, sorts by avgViews desc", () => {
    const videos = [
      video({ id: "a", topic: "Tips", views: 100 }),
      video({ id: "b", topic: "Tips", views: 300 }),
      video({ id: "c", topic: "", views: 5000 }),
    ];
    const stats = computeTopicStats(videos);
    expect(stats[0].topic).toBe(UNCATEGORIZED);
    expect(stats[0].avgViews).toBe(5000);
    const tips = stats.find((s) => s.topic === "Tips")!;
    expect(tips.count).toBe(2);
    expect(tips.avgViews).toBe(200);
    expect(tips.best.id).toBe("b");
    expect(tips.worst.id).toBe("a");
  });
});

describe("computeDayOfWeekStats", () => {
  it("groups by weekday using UTC and averages views", () => {
    const videos = [
      video({ id: "a", datePosted: "2026-06-11", views: 100 }), // Thursday
      video({ id: "b", datePosted: "2026-06-11", views: 300 }), // Thursday
      video({ id: "c", datePosted: "2026-06-07", views: 50 }), // Sunday
    ];
    const stats = computeDayOfWeekStats(videos);
    const thursday = stats.find((s) => s.day === "Thursday")!;
    expect(thursday.count).toBe(2);
    expect(thursday.avgViews).toBe(200);
    expect(stats.find((s) => s.day === "Sunday")!.avgViews).toBe(50);
  });

  it("skips videos with missing or invalid dates", () => {
    expect(computeDayOfWeekStats([video({ datePosted: "" }), video({ datePosted: "not-a-date" })])).toEqual([]);
  });
});
