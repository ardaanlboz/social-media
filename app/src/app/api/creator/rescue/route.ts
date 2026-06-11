import { NextResponse } from "next/server";
import { readCreatorVideos, writeCreatorVideos } from "@/lib/csv";
import { fetchCreatorVideoMedia } from "@/lib/creator-media";
import { uploadVideo, analyzeVideo } from "@/lib/gemini";
import { buildHookExtractionPrompt, generateViralRescue } from "@/lib/creator-ai";
import { computeOverview } from "@/lib/creator-metrics";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { videoId } = await request.json();
  const videos = readCreatorVideos();
  const video = videos.find((v) => v.id === videoId);
  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  // Stage 0: get the media (re-scrapes a fresh CDN URL if the stored one expired)
  let media;
  try {
    media = await fetchCreatorVideoMedia(video);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not fetch video: ${err instanceof Error ? err.message : err}` },
      { status: 502 }
    );
  }

  try {
    // Stage 1: Gemini watches and reports ground truth
    const fileData = await uploadVideo(media.buffer, media.contentType);
    const breakdown = await analyzeVideo(
      fileData.uri,
      fileData.mimeType,
      buildHookExtractionPrompt(video)
    );

    // Stage 2: Claude turns the breakdown + metrics into the rescue strategy
    const { avgViews } = computeOverview(videos);
    const rescue = await generateViralRescue(breakdown, video, avgViews, video.caption);
    if (!rescue) {
      return NextResponse.json(
        { error: "Could not parse rescue output — try again" },
        { status: 502 }
      );
    }

    video.viralRescue = JSON.stringify(rescue);
    writeCreatorVideos(videos);
    return NextResponse.json({ rescue });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rescue failed" },
      { status: 500 }
    );
  }
}
