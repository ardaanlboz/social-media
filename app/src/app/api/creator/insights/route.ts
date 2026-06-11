import { NextResponse } from "next/server";
import { runAccountInsights } from "@/lib/creator-actions";

export const maxDuration = 300;

export async function POST() {
  const result = await runAccountInsights();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ insights: result.data.insights });
}
