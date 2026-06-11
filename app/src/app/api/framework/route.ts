import { NextResponse } from "next/server";
import { readNexusFramework, writeNexusFramework } from "@/lib/framework";

export async function GET() {
  return NextResponse.json({ content: readNexusFramework() });
}

export async function PUT(request: Request) {
  const body = await request.json();
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content must be a string" }, { status: 400 });
  }
  writeNexusFramework(body.content);
  return NextResponse.json({ content: readNexusFramework() });
}
