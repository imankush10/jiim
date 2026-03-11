import { NextResponse } from "next/server";
import { z } from "zod";
import { getProgramById, updateProgramById } from "@/lib/db";

const updateProgramSchema = z.object({
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

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const program = await getProgramById(id);

  if (!program) {
    return NextResponse.json({ message: "Program not found" }, { status: 404 });
  }

  return NextResponse.json(program);
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const json = await req.json();
    const payload = updateProgramSchema.parse(json);

    const updated = await updateProgramById(id, payload);

    if (!updated) {
      return NextResponse.json(
        { message: "Program not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { message: "Invalid program update payload", error: String(error) },
      { status: 400 },
    );
  }
}
