import { readCreatorVideos, writeCreatorVideos } from "./csv";
import { fetchCreatorVideoMedia } from "./creator-media";
import { uploadVideo, analyzeVideo } from "./gemini";
import {
  buildCreatorAnalysisPrompt,
  buildHookExtractionPrompt,
  generateViralRescue,
  generateAccountInsights,
} from "./creator-ai";
import { computeOverview } from "./creator-metrics";
import { readCreatorProfile, writeCreatorProfile } from "./creator-profile";
import type { CreatorVideo, ViralRescue } from "./types";

// Shared result shape so both the API routes and the chat tools handle outcomes
// the same way. `status` lets routes map failures to the right HTTP code.
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Analyze one of the user's own reels with Gemini and persist the result.
// (Powers POST /api/creator/analyze and the analyze_my_video chat tool.)
export async function runCreatorAnalysis(
  videoId: string
): Promise<ActionResult<{ analysis: string; video: CreatorVideo }>> {
  const videos = readCreatorVideos();
  const video = videos.find((v) => v.id === videoId);
  if (!video) return { ok: false, error: "Video not found", status: 404 };

  let media;
  try {
    media = await fetchCreatorVideoMedia(video);
  } catch (err) {
    return { ok: false, error: `Could not fetch video: ${msg(err)}`, status: 502 };
  }

  try {
    const fileData = await uploadVideo(media.buffer, media.contentType);
    const { avgViews } = computeOverview(videos);
    const analysis = await analyzeVideo(
      fileData.uri,
      fileData.mimeType,
      buildCreatorAnalysisPrompt(video, avgViews)
    );
    video.analysis = analysis;
    writeCreatorVideos(videos);
    return { ok: true, data: { analysis, video } };
  } catch (err) {
    return { ok: false, error: msg(err) || "Analysis failed", status: 500 };
  }
}

// Generate a "Viral Rescue" teardown for one of the user's reels and persist it.
// (Powers POST /api/creator/rescue and the make_video_viral chat tool.)
export async function runViralRescue(
  videoId: string
): Promise<ActionResult<{ rescue: ViralRescue; video: CreatorVideo }>> {
  const videos = readCreatorVideos();
  const video = videos.find((v) => v.id === videoId);
  if (!video) return { ok: false, error: "Video not found", status: 404 };

  let media;
  try {
    media = await fetchCreatorVideoMedia(video);
  } catch (err) {
    return { ok: false, error: `Could not fetch video: ${msg(err)}`, status: 502 };
  }

  try {
    const fileData = await uploadVideo(media.buffer, media.contentType);
    const breakdown = await analyzeVideo(
      fileData.uri,
      fileData.mimeType,
      buildHookExtractionPrompt(video)
    );
    const { avgViews } = computeOverview(videos);
    const rescue = await generateViralRescue(breakdown, video, avgViews, video.caption);
    if (!rescue) {
      return { ok: false, error: "Could not parse rescue output — try again", status: 502 };
    }
    video.viralRescue = JSON.stringify(rescue);
    writeCreatorVideos(videos);
    return { ok: true, data: { rescue, video } };
  } catch (err) {
    return { ok: false, error: msg(err) || "Rescue failed", status: 500 };
  }
}

// Regenerate the account-level insights report and persist it on the profile.
// (Powers POST /api/creator/insights and the generate_account_insights chat tool.)
export async function runAccountInsights(): Promise<ActionResult<{ insights: string }>> {
  const profile = readCreatorProfile();
  if (!profile) return { ok: false, error: "No creator account set", status: 400 };

  const videos = readCreatorVideos();
  if (videos.length === 0) {
    return { ok: false, error: "No videos to analyze — refresh first", status: 400 };
  }

  try {
    const insights = await generateAccountInsights(profile, videos);
    profile.accountInsights = insights;
    writeCreatorProfile(profile);
    return { ok: true, data: { insights } };
  } catch (err) {
    return { ok: false, error: msg(err) || "Insights generation failed", status: 500 };
  }
}
