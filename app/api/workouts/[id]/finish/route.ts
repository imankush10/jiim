import { NextResponse } from "next/server";
import { finishWorkout } from "@/lib/db";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: Params) {
  const { id } = await params;
  const workout = await finishWorkout(id);

  if (!workout) {
    return NextResponse.json({ message: "Workout not found" }, { status: 404 });
  }

  return NextResponse.json(workout);
}
