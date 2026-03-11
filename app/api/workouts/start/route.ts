import { NextResponse } from "next/server";
import { z } from "zod";
import { getProgramById, getActiveWorkout, startWorkout } from "@/lib/db";

const schema = z.object({
  programId: z.string().min(1),
  trainingDay: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { programId, trainingDay } = schema.parse(json);

    const normalizedDay = trainingDay || "General";

    const existing = await getActiveWorkout(programId, normalizedDay);
    if (existing) {
      return NextResponse.json(existing);
    }

    const program = await getProgramById(programId);
    if (!program) {
      return NextResponse.json(
        { message: "Program not found" },
        { status: 404 },
      );
    }

    const workout = await startWorkout(programId, program.name, normalizedDay);
    return NextResponse.json(workout, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: "Invalid workout start payload", error: String(error) },
      { status: 400 },
    );
  }
}
