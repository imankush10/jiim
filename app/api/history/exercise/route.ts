import { NextResponse } from "next/server";
import { buildExerciseAnalysis, getSetRecommendations } from "@/lib/analytics";
import { getFinishedWorkoutsByExercise } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const exerciseName = url.searchParams.get("name");
  const sets = Number(url.searchParams.get("sets") || "4");
  const minReps = Number(url.searchParams.get("minReps") || "8");
  const maxReps = Number(url.searchParams.get("maxReps") || "12");

  if (!exerciseName) {
    return NextResponse.json(
      { message: "Missing exercise name" },
      { status: 400 },
    );
  }

  const workouts = await getFinishedWorkoutsByExercise(exerciseName, 30);
  const analysis = buildExerciseAnalysis(workouts, exerciseName);
  const recommendations = getSetRecommendations(workouts, exerciseName, sets, {
    minReps,
    maxReps,
  });

  return NextResponse.json({
    exerciseName,
    workouts,
    analysis,
    recommendations,
  });
}
