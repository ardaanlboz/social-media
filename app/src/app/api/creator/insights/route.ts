import { NextResponse } from "next/server";
import { readCreatorProfile, writeCreatorProfile } from "@/lib/creator-profile";
import { readCreatorVideos } from "@/lib/csv";
import { generateAccountInsights } from "@/lib/creator-ai";

export const maxDuration = 300;

export async function POST() {
  const profile = readCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No creator account set" }, { status: 400 });

  const videos = readCreatorVideos();
  if (videos.length === 0) {
    return NextResponse.json({ error: "No videos to analyze — refresh first" }, { status: 400 });
  }

  try {
    const insights = await generateAccountInsights(profile, videos);
    profile.accountInsights = insights;
    writeCreatorProfile(profile);
    return NextResponse.json({ insights });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Insights generation failed" },
      { status: 500 }
    );
  }
}
