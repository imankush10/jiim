import { NextResponse } from "next/server";
import { z } from "zod";
import { addWorkoutSet } from "@/lib/db";

const schema = z.object({
  exerciseName: z.string().min(1),
  setNumber: z.number().int().min(1).max(20),
  reps: z.number().int().min(0).max(100),
  weight: z.number().min(0).max(1000),
  rpe: z.number().min(1).max(10),
  completed: z.boolean().default(true),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const json = await req.json();
    const payload = schema.parse(json);

    const workout = await addWorkoutSet(id, {
      ...payload,
      timestamp: new Date().toISOString(),
    });

    if (!workout) {
      return NextResponse.json(
        { message: "Workout not found or already finished" },
        { status: 404 },
      );
    }

    return NextResponse.json(workout);
  } catch (error) {
    return NextResponse.json(
      { message: "Invalid set payload", error: String(error) },
      { status: 400 },
    );
  }
}
