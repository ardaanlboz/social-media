import { NextResponse } from "next/server";
import { readRuns } from "@/lib/csv";

export async function GET() {
  const runs = readRuns();
  runs.sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
  return NextResponse.json(runs);
}
