import { NextResponse } from "next/server";
import { readCreatorVideos, writeCreatorVideos } from "@/lib/csv";
import { scrapePostVideoUrl } from "@/lib/apify";
import { uploadVideo, analyzeVideo } from "@/lib/gemini";
import { buildCreatorAnalysisPrompt } from "@/lib/creator-ai";
import { computeOverview } from "@/lib/creator-metrics";

export const maxDuration = 300;

async function downloadVideo(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
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

export async function POST(request: Request) {
  const { videoId } = await request.json();
  const videos = readCreatorVideos();
  const video = videos.find((v) => v.id === videoId);
  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  // CDN video URLs expire — fall back to re-scraping the post for a fresh one
  let download = await downloadVideo(video.videoUrl);
  if (!download) {
    try {
      const freshUrl = await scrapePostVideoUrl(video.link);
      video.videoUrl = freshUrl;
      download = await downloadVideo(freshUrl);
    } catch (err) {
      return NextResponse.json(
        { error: `Could not fetch video: ${err instanceof Error ? err.message : err}` },
        { status: 502 }
      );
    }
  }
  if (!download) return NextResponse.json({ error: "Video download failed" }, { status: 502 });

  try {
    const fileData = await uploadVideo(download.buffer, download.contentType);
    const { avgViews } = computeOverview(videos);
    const analysis = await analyzeVideo(
      fileData.uri,
      fileData.mimeType,
      buildCreatorAnalysisPrompt(video, avgViews)
    );

    video.analysis = analysis;
    writeCreatorVideos(videos);
    return NextResponse.json({ analysis });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
