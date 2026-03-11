import { NextResponse } from "next/server";
import { getActiveWorkout } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const programId = url.searchParams.get("programId") || undefined;
  const trainingDay = url.searchParams.get("trainingDay") || undefined;

  const workout = await getActiveWorkout(programId, trainingDay);
  return NextResponse.json(workout);
}
