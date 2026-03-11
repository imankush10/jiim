import { NextResponse } from "next/server";
import { z } from "zod";
import { finishWorkout } from "@/lib/db";

const finishSchema = z.object({
  sets: z
    .array(
      z.object({
        exerciseName: z.string().min(1),
        setNumber: z.number().int().min(1).max(50),
        reps: z.number().int().min(0).max(100),
        weight: z.number().min(0).max(1000),
        rpe: z.number().min(1).max(10),
        isDropSet: z.boolean().optional(),
        completed: z.boolean(),
        timestamp: z.string(),
      }),
    )
    .optional(),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  let parsed: z.infer<typeof finishSchema> = {};
  try {
    const json = await req.json();
    parsed = finishSchema.parse(json);
  } catch {
    parsed = {};
  }

  const workout = await finishWorkout(id, parsed.sets);

  if (!workout) {
    return NextResponse.json({ message: "Workout not found" }, { status: 404 });
  }

  return NextResponse.json(workout);
}
