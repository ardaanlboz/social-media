import { v4 as uuid } from "uuid";
import type { CreatorVideo } from "./types";

export interface ScrapedReelInput {
  link: string;
  videoUrl: string;
  thumbnail: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  datePosted: string;
}

export interface MergeResult {
  videos: CreatorVideo[];
  added: number;
  updated: number;
}

// Pure merge: new reels are appended, known reels (matched by post link) get fresh
// metrics while keeping id, topic, analysis, and dateAdded. `today` is injected so
// the function stays deterministic for tests.
export function mergeCreatorVideos(
  existing: CreatorVideo[],
  scraped: ScrapedReelInput[],
  today: string
): MergeResult {
  const byLink = new Map(existing.map((v) => [v.link, v]));
  let added = 0;
  let updated = 0;

  for (const reel of scraped) {
    if (!reel.link) continue;
    const current = byLink.get(reel.link);
    if (current) {
      current.views = reel.views;
      current.likes = reel.likes;
      current.comments = reel.comments;
      if (reel.videoUrl) current.videoUrl = reel.videoUrl;
      if (reel.thumbnail) current.thumbnail = reel.thumbnail;
      if (reel.caption) current.caption = reel.caption;
      updated++;
    } else {
      byLink.set(reel.link, {
        id: uuid(),
        link: reel.link,
        videoUrl: reel.videoUrl,
        thumbnail: reel.thumbnail,
        caption: reel.caption,
        views: reel.views,
        likes: reel.likes,
        comments: reel.comments,
        datePosted: reel.datePosted,
        topic: "",
        analysis: "",
        dateAdded: today,
        viralRescue: "",
      });
      added++;
    }
  }

  return { videos: [...byLink.values()], added, updated };
}
