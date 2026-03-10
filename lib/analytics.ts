import {
  ExerciseAnalysis,
  ExerciseAnalysisPoint,
  WorkoutSession,
} from "@/lib/types";

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function estimate1RM(weight: number, reps: number) {
  return weight * (1 + reps / 30);
}

export function buildExerciseAnalysis(
  sessions: WorkoutSession[],
  exerciseName: string,
): ExerciseAnalysis {
  const points: ExerciseAnalysisPoint[] = sessions
    .map((session) => {
      const sets = session.sets.filter(
        (s) =>
          s.completed &&
          s.exerciseName.toLowerCase() === exerciseName.toLowerCase(),
      );

      if (!sets.length) return null;

      const totalVolume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      const avgWeight =
        sets.reduce((sum, s) => sum + s.weight, 0) / sets.length;
      const avgRpe = sets.reduce((sum, s) => sum + s.rpe, 0) / sets.length;
      const avg1RM =
        sets.reduce((sum, s) => sum + estimate1RM(s.weight, s.reps), 0) /
        sets.length;

      // Hypertrophy score blends volume, effort proximity, and moderate rep bias.
      const hypertrophyScore =
        sets.reduce((sum, s) => {
          const repQuality = s.reps >= 5 && s.reps <= 15 ? 1 : 0.8;
          const effortQuality = Math.min(1.15, Math.max(0.7, s.rpe / 8));
          return sum + s.weight * s.reps * repQuality * effortQuality;
        }, 0) / Math.max(1, sets.length);

      return {
        date: session.finishedAt || session.startedAt,
        avgWeight: round(avgWeight),
        avgRpe: round(avgRpe),
        totalVolume: round(totalVolume),
        estimated1RM: round(avg1RM),
        hypertrophyScore: round(hypertrophyScore),
      };
    })
    .filter((v): v is ExerciseAnalysisPoint => Boolean(v))
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));

  const first = points[0];
  const last = points[points.length - 1];
  const progressiveOverloadScore =
    first && last && first.estimated1RM > 0
      ? round(
          ((last.estimated1RM - first.estimated1RM) / first.estimated1RM) * 100,
        )
      : 0;

  let progressiveOverloadStatus: ExerciseAnalysis["progressiveOverloadStatus"] =
    "flat";
  if (progressiveOverloadScore >= 8) progressiveOverloadStatus = "excellent";
  else if (progressiveOverloadScore >= 3) progressiveOverloadStatus = "good";
  else if (progressiveOverloadScore <= -3)
    progressiveOverloadStatus = "declining";

  const muscleBuildingEfficiency = round(
    points.length
      ? points.reduce((sum, p) => {
          const recoveryAdjustedStimulus =
            p.hypertrophyScore / Math.max(1, p.avgRpe - 5);
          return sum + recoveryAdjustedStimulus;
        }, 0) / points.length
      : 0,
  );

  return {
    points,
    progressiveOverloadScore,
    progressiveOverloadStatus,
    muscleBuildingEfficiency,
  };
}

export function getSetRecommendations(
  sessions: WorkoutSession[],
  exerciseName: string,
  maxSets: number,
) {
  const relevant = sessions
    .slice()
    .sort(
      (a, b) =>
        +new Date(b.finishedAt || b.startedAt) -
        +new Date(a.finishedAt || a.startedAt),
    )
    .filter((session) =>
      session.sets.some(
        (set) =>
          set.completed &&
          set.exerciseName.toLowerCase() === exerciseName.toLowerCase(),
      ),
    )
    .slice(0, 3);

  return Array.from({ length: maxSets }, (_, idx) => {
    const setNumber = idx + 1;
    const setMatches = relevant
      .flatMap((session) => session.sets)
      .filter(
        (set) =>
          set.completed &&
          set.exerciseName.toLowerCase() === exerciseName.toLowerCase() &&
          set.setNumber === setNumber,
      );

    if (!setMatches.length) {
      return {
        setNumber,
        recommendedReps: 10,
        recommendedWeight: 20,
        recommendedRpe: 7,
      };
    }

    const avg = (values: number[]) =>
      values.reduce((a, b) => a + b, 0) / values.length;

    return {
      setNumber,
      recommendedReps: round(avg(setMatches.map((s) => s.reps)), 0),
      recommendedWeight: round(avg(setMatches.map((s) => s.weight)), 1),
      recommendedRpe: round(avg(setMatches.map((s) => s.rpe)), 1),
    };
  });
}
