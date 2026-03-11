import { NextResponse } from "next/server";
import { z } from "zod";
import { createProgram, listPrograms } from "@/lib/db";

const createProgramSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  exercises: z
    .array(
      z.object({
        name: z.string().min(2),
        sets: z.number().int().min(1).max(10),
        minReps: z.number().int().min(1).max(30),
        maxReps: z.number().int().min(1).max(40),
        day: z.string().min(1).optional(),
        sessionType: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .min(1),
});

export async function GET() {
  const programs = await listPrograms();
  return NextResponse.json(programs);
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const payload = createProgramSchema.parse(json);

    const program = await createProgram(payload);
    return NextResponse.json(program, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: "Invalid program payload", error: String(error) },
      { status: 400 },
    );
  }
}
