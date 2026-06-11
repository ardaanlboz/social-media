import { scrapePostVideoUrl } from "./apify";
import type { CreatorVideo } from "./types";

async function download(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") || "video/mp4",
    };
  } catch {
    return null;
  }
}

// Download a creator video's media. Instagram CDN URLs expire, so on failure we
// re-scrape a fresh URL from the post link and mutate video.videoUrl in place.
// Throws if the video cannot be fetched even after re-scraping.
export async function fetchCreatorVideoMedia(
  video: CreatorVideo
): Promise<{ buffer: Buffer; contentType: string }> {
  let media = await download(video.videoUrl);
  if (!media) {
    const freshUrl = await scrapePostVideoUrl(video.link);
    video.videoUrl = freshUrl;
    media = await download(freshUrl);
  }
  if (!media) throw new Error("Video download failed");
  return media;
}
