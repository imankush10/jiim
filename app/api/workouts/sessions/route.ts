import { NextResponse } from "next/server";
import { getFinishedWorkoutsForProgram } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const programId = url.searchParams.get("programId");
  const limit = Number(url.searchParams.get("limit") || "30");

  if (!programId) {
    return NextResponse.json({ message: "Missing programId" }, { status: 400 });
  }

  const sessions = await getFinishedWorkoutsForProgram(programId, limit);
  return NextResponse.json({ sessions });
}
