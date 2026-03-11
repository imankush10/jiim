import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { WorkoutProgram, WorkoutSession, WorkoutSet } from "@/lib/types";

type ProgramDocument = Omit<WorkoutProgram, "_id"> & { _id: ObjectId };
type SessionDocument = Omit<WorkoutSession, "_id"> & { _id: ObjectId };

function toStringId<T extends { _id?: ObjectId }>(doc: T) {
  return {
    ...doc,
    _id: doc._id?.toString(),
  };
}

export async function listPrograms() {
  const db = await getDb();
  const rows = await db
    .collection<ProgramDocument>("programs")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  return rows.map((row) => toStringId(row));
}

export async function getProgramById(programId: string) {
  const db = await getDb();
  const row = await db
    .collection<ProgramDocument>("programs")
    .findOne({ _id: new ObjectId(programId) });

  return row ? toStringId(row) : null;
}

export async function createProgram(
  input: Omit<WorkoutProgram, "_id" | "createdAt">,
) {
  const db = await getDb();
  const payload: Omit<WorkoutProgram, "_id"> = {
    ...input,
    createdAt: new Date().toISOString(),
  };

  const inserted = await db
    .collection<Omit<WorkoutProgram, "_id">>("programs")
    .insertOne(payload);
  return {
    ...payload,
    _id: inserted.insertedId.toString(),
  };
}

export async function updateProgramById(
  programId: string,
  input: Omit<WorkoutProgram, "_id" | "createdAt">,
) {
  const db = await getDb();

  const res = await db.collection<ProgramDocument>("programs").findOneAndUpdate(
    { _id: new ObjectId(programId) },
    {
      $set: {
        name: input.name,
        description: input.description,
        exercises: input.exercises,
      },
    },
    { returnDocument: "after" },
  );

  return res ? toStringId(res) : null;
}

export async function startWorkout(
  programId: string,
  programName: string,
  trainingDay?: string,
) {
  const db = await getDb();
  const payload: Omit<WorkoutSession, "_id"> = {
    programId,
    programName,
    trainingDay,
    startedAt: new Date().toISOString(),
    status: "active",
    sets: [],
  };

  const inserted = await db
    .collection<Omit<WorkoutSession, "_id">>("workouts")
    .insertOne(payload);
  return {
    ...payload,
    _id: inserted.insertedId.toString(),
  };
}

export async function getActiveWorkout(
  programId?: string,
  trainingDay?: string,
) {
  const db = await getDb();
  const filter: Pick<SessionDocument, "status"> &
    Partial<Pick<SessionDocument, "programId" | "trainingDay">> = {
    status: "active",
  };

  if (programId) {
    filter.programId = programId;
  }

  if (trainingDay) {
    filter.trainingDay = trainingDay;
  }

  const row = await db
    .collection<SessionDocument>("workouts")
    .find(filter)
    .sort({ startedAt: -1 })
    .limit(1)
    .next();

  return row ? toStringId(row) : null;
}

export async function getWorkoutById(workoutId: string) {
  const db = await getDb();
  const row = await db
    .collection<SessionDocument>("workouts")
    .findOne({ _id: new ObjectId(workoutId) });

  return row ? toStringId(row) : null;
}

export async function finishWorkout(workoutId: string, sets?: WorkoutSet[]) {
  const db = await getDb();
  const updatePayload: {
    status: "finished";
    finishedAt: string;
    sets?: WorkoutSet[];
  } = {
    status: "finished",
    finishedAt: new Date().toISOString(),
  };

  if (sets) {
    updatePayload.sets = sets;
  }

  await db.collection("workouts").updateOne(
    { _id: new ObjectId(workoutId) },
    {
      $set: updatePayload,
    },
  );

  return getWorkoutById(workoutId);
}

export async function getFinishedWorkoutsForProgram(
  programId: string,
  limit = 20,
) {
  const db = await getDb();
  const rows = await db
    .collection<SessionDocument>("workouts")
    .find({ programId, status: "finished" })
    .sort({ finishedAt: -1 })
    .limit(limit)
    .toArray();

  return rows.map((row) => toStringId(row));
}

export async function getFinishedWorkoutsByExercise(
  exerciseName: string,
  limit = 30,
) {
  const db = await getDb();
  const rows = await db
    .collection<SessionDocument>("workouts")
    .find({
      status: "finished",
      sets: {
        $elemMatch: {
          exerciseName,
          completed: true,
        },
      },
    })
    .sort({ finishedAt: -1 })
    .limit(limit)
    .toArray();

  return rows.map((row) => toStringId(row));
}
