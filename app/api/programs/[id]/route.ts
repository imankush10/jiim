import { NextResponse } from "next/server";
import { getProgramById } from "@/lib/db";

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
