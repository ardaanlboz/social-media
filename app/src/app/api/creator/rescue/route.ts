import { NextResponse } from "next/server";
import { runViralRescue } from "@/lib/creator-actions";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { videoId } = await request.json();
  const result = await runViralRescue(videoId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ rescue: result.data.rescue });
}
