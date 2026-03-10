import { NextResponse } from "next/server";
import { z } from "zod";
import { getProgramById, getActiveWorkout, startWorkout } from "@/lib/db";

const schema = z.object({
  programId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { programId } = schema.parse(json);

    const existing = await getActiveWorkout(programId);
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

    const workout = await startWorkout(programId, program.name);
    return NextResponse.json(workout, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: "Invalid workout start payload", error: String(error) },
      { status: 400 },
    );
  }
}
