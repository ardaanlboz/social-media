import { describe, it, expect } from "vitest";
import { mergeCreatorVideos, type ScrapedReelInput } from "../creator-merge";
import type { CreatorVideo } from "../types";

const existingVideo = (overrides: Partial<CreatorVideo> = {}): CreatorVideo => ({
  id: "existing-1",
  link: "https://instagram.com/p/abc/",
  videoUrl: "https://cdn/old.mp4",
  thumbnail: "old-thumb",
  caption: "old caption",
  views: 100,
  likes: 10,
  comments: 1,
  datePosted: "2026-01-01",
  topic: "Real Estate",
  analysis: "deep analysis",
  dateAdded: "2026-01-02",
  ...overrides,
});

const scrapedReel = (overrides: Partial<ScrapedReelInput> = {}): ScrapedReelInput => ({
  link: "https://instagram.com/p/abc/",
  videoUrl: "https://cdn/new.mp4",
  thumbnail: "new-thumb",
  caption: "new caption",
  views: 200,
  likes: 20,
  comments: 2,
  datePosted: "2026-01-01",
  ...overrides,
});

describe("mergeCreatorVideos", () => {
  it("adds a new video with empty topic/analysis and dateAdded=today", () => {
    const { videos, added, updated } = mergeCreatorVideos([], [scrapedReel()], "2026-06-11");
    expect(added).toBe(1);
    expect(updated).toBe(0);
    expect(videos).toHaveLength(1);
    expect(videos[0].id).toBeTruthy();
    expect(videos[0].topic).toBe("");
    expect(videos[0].analysis).toBe("");
    expect(videos[0].dateAdded).toBe("2026-06-11");
    expect(videos[0].views).toBe(200);
  });

  it("updates metrics on an existing video but preserves id, topic, analysis, dateAdded", () => {
    const { videos, added, updated } = mergeCreatorVideos([existingVideo()], [scrapedReel()], "2026-06-11");
    expect(added).toBe(0);
    expect(updated).toBe(1);
    expect(videos).toHaveLength(1);
    expect(videos[0].id).toBe("existing-1");
    expect(videos[0].views).toBe(200);
    expect(videos[0].likes).toBe(20);
    expect(videos[0].comments).toBe(2);
    expect(videos[0].topic).toBe("Real Estate");
    expect(videos[0].analysis).toBe("deep analysis");
    expect(videos[0].dateAdded).toBe("2026-01-02");
    expect(videos[0].videoUrl).toBe("https://cdn/new.mp4");
  });

  it("does not overwrite caption/thumbnail/videoUrl with empty scraped values", () => {
    const { videos } = mergeCreatorVideos(
      [existingVideo()],
      [scrapedReel({ caption: "", thumbnail: "", videoUrl: "" })],
      "2026-06-11"
    );
    expect(videos[0].caption).toBe("old caption");
    expect(videos[0].thumbnail).toBe("old-thumb");
    expect(videos[0].videoUrl).toBe("https://cdn/old.mp4");
  });

  it("keeps existing videos that were not in the scrape (older than lookback)", () => {
    const old = existingVideo({ link: "https://instagram.com/p/old/" });
    const { videos, added } = mergeCreatorVideos([old], [scrapedReel()], "2026-06-11");
    expect(videos).toHaveLength(2);
    expect(added).toBe(1);
  });

  it("skips scraped items without a link", () => {
    const { videos, added } = mergeCreatorVideos([], [scrapedReel({ link: "" })], "2026-06-11");
    expect(videos).toHaveLength(0);
    expect(added).toBe(0);
  });
});
