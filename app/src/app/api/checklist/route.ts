import { NextResponse } from "next/server";
import { readMasterChecklist, writeMasterChecklist } from "@/lib/checklist";

export async function GET() {
  return NextResponse.json({ content: readMasterChecklist() });
}

export async function PUT(request: Request) {
  const body = await request.json();
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content must be a string" }, { status: 400 });
  }
  writeMasterChecklist(body.content);
  return NextResponse.json({ content: readMasterChecklist() });
}
