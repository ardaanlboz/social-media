import { NextResponse } from "next/server";
import { readCreatorProfile, writeCreatorProfile } from "@/lib/creator-profile";
import { readCreatorVideos, writeCreatorVideos } from "@/lib/csv";
import { scrapeCreatorStats } from "@/lib/apify";

export const maxDuration = 300;

export async function GET() {
  const profile = readCreatorProfile();
  const videos = profile ? readCreatorVideos() : [];
  return NextResponse.json({ profile, videos });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const username = (body.username || "").trim().replace(/^@/, "");
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

  const current = readCreatorProfile();
  const isNewAccount = !current || current.username !== username;

  let profile = {
    username,
    profilePicUrl: isNewAccount ? "" : current!.profilePicUrl,
    followers: isNewAccount ? 0 : current!.followers,
    lastRefreshedAt: isNewAccount ? "" : current!.lastRefreshedAt,
    accountInsights: isNewAccount ? "" : current!.accountInsights,
  };

  // Switching accounts: the stored videos belong to the old account
  if (isNewAccount) writeCreatorVideos([]);

  try {
    const stats = await scrapeCreatorStats(username);
    profile = { ...profile, profilePicUrl: stats.profilePicUrl, followers: stats.followers };
  } catch (err) {
    console.error(`Failed to scrape stats for @${username}:`, err);
  }

  writeCreatorProfile(profile);
  return NextResponse.json(profile);
}
