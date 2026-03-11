import {
  ExerciseAnalysis,
  ExerciseAnalysisPoint,
  SetRecommendation,
  WorkoutSession,
} from "@/lib/types";

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Blended 1RM estimator — average of Epley (1985) and Brzycki formulas.
 *
 * Epley:   w * (1 + r/30)
 * Brzycki: w * 36 / (37 - r)
 *
 * Blending the two reduces the overestimation Epley produces at low rep
 * ranges and the underestimation Brzycki produces near its limit (~36 reps).
 * At r=1 both formulas return w exactly, so the blend is always anchored.
 */
function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  const epley = weight * (1 + reps / 30);
  const brzycki = reps < 37 ? weight * (36 / (37 - reps)) : epley;
  return (epley + brzycki) / 2;
}

/** Rounds a weight to the nearest 0.5 kg (smallest usable plate pairing). */
function roundToPlate(weight: number): number {
  return Math.round(weight * 2) / 2;
}

/**
 * Per-session weight increment, load-dependent and capped at 2%.
 *
 * Empirical increments drawn from Prilepin-adjacent guidelines and practical
 * gym plate availability:
 *   ≥100 kg  → +2.5 kg   (heavy barbell compounds)
 *    60–99 kg → +1.25 kg  (medium barbell compounds)
 *    20–59 kg → +1.0 kg   (light compounds / heavier DBs)
 *    <20 kg   → +0.5 kg   (light isolations)
 *
 * The 2% cap prevents unrealistically large jumps at any load.
 */
function weightIncrement(currentWeight: number): number {
  let base: number;
  if (currentWeight >= 100) base = 2.5;
  else if (currentWeight >= 60) base = 1.25;
  else if (currentWeight >= 20) base = 1.0;
  else base = 0.5;

  const capped = Math.min(base, Math.max(0.5, currentWeight * 0.02));
  return roundToPlate(capped);
}

// ─── Exercise analysis ──────────────────────────────────────────────────────

export function buildExerciseAnalysis(
  sessions: WorkoutSession[],
  exerciseName: string,
): ExerciseAnalysis {
  const points: ExerciseAnalysisPoint[] = sessions
    .map((session) => {
      // Exclude drop sets from analysis — they inflate volume and distort RPE.
      const sets = session.sets.filter(
        (s) =>
          s.completed &&
          !s.isDropSet &&
          s.exerciseName.toLowerCase() === exerciseName.toLowerCase(),
      );

      if (!sets.length) return null;

      const totalVolume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      const avgWeight =
        sets.reduce((sum, s) => sum + s.weight, 0) / sets.length;
      const avgRpe = sets.reduce((sum, s) => sum + s.rpe, 0) / sets.length;

      // Use the TOP SET (highest e1RM in the session) rather than the average.
      // The average includes back-off sets which systematically underestimate
      // peak strength — the top set is what actually reflects 1RM progress.
      const topSet1RM = sets.reduce((best, s) => {
        const e = estimate1RM(s.weight, s.reps);
        return e > best ? e : best;
      }, 0);

      // Hypertrophy score: volume × rep quality × effort proximity.
      // Rep quality peaks in the 5–15 hypertrophy window.
      // Effort quality is highest near RPE 8 (close to failure without grinding).
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
        estimated1RM: round(topSet1RM),
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

// ─── Progressive overload recommendation engine ─────────────────────────────

type PlanContext = {
  minReps: number;
  maxReps: number;
  /** RPE the athlete is targeting. Defaults to 8.0 if not supplied. */
  targetRpe?: number;
};

/**
 * Produces per-set progressive overload recommendations.
 *
 * ## Model
 *
 * ### Double progression (rep-first)
 * Borrowed from Borge Fagerli / RP Strength methodology:
 * 1. Keep weight constant and accumulate reps until the top of the rep range
 *    is reached at an acceptable RPE.
 * 2. Only then increase the load; reps reset to the bottom of the range.
 *
 * ### RPE gating (Israetel-style)
 * RPE (6–10 scale, 10 = max effort) determines whether progression is safe:
 *
 *   last RPE > 9.0             → overreaching deload (−5% weight)
 *   weighted-avg RPE ≥ 8.5     → ceiling: hold weight regardless of reps hit
 *   weighted-avg RPE 7.0–8.4   → optimal zone: apply double progression
 *   weighted-avg RPE < 7.0     → undertrained: same double progression,
 *                                 but weight is bumped even if only 1 rep
 *                                 below max (effort is well within reserve)
 *
 * ### Trend weighting
 * RPE is averaged across the last 3 sessions with exponential decay weights
 * (3 : 2 : 1) so the most recent session dominates.
 *
 * ### Load increments
 * See `weightIncrement()` above — load-dependent, capped at 2%, rounded
 * to nearest 0.5 kg.
 *
 * ### Drop sets
 * Excluded from all calculations — they are technique sets, not effort sets.
 */
export function getSetRecommendations(
  sessions: WorkoutSession[],
  exerciseName: string,
  maxSets: number,
  plan?: PlanContext,
): SetRecommendation[] {
  const minReps = plan?.minReps ?? 8;
  const maxReps = plan?.maxReps ?? 12;
  const targetRpe = plan?.targetRpe ?? 8.0;
  // If weighted-avg RPE is at or above this threshold, do NOT increase load.
  const rpeCeiling = 8.5;

  // Sort descending (most recent first), keep non-drop working sets only.
  const relevant = sessions
    .slice()
    .sort(
      (a, b) =>
        +new Date(b.finishedAt || b.startedAt) -
        +new Date(a.finishedAt || a.startedAt),
    )
    .filter((session) =>
      session.sets.some(
        (s) =>
          s.completed &&
          !s.isDropSet &&
          s.exerciseName.toLowerCase() === exerciseName.toLowerCase(),
      ),
    )
    .slice(0, 5); // 5 sessions gives enough trend data without stale dilution

  return Array.from({ length: maxSets }, (_, idx): SetRecommendation => {
    const setNumber = idx + 1;

    // Per-session arrays of matching working sets (index 0 = most recent)
    const sessionSets = relevant.map((session) =>
      session.sets.filter(
        (s) =>
          s.completed &&
          !s.isDropSet &&
          s.exerciseName.toLowerCase() === exerciseName.toLowerCase() &&
          s.setNumber === setNumber,
      ),
    );

    const mostRecentSetArr = sessionSets.find((arr) => arr.length > 0);

    if (!mostRecentSetArr || !mostRecentSetArr.length) {
      return {
        setNumber,
        recommendedReps: minReps,
        recommendedWeight: 20,
        recommendedRpe: targetRpe,
        progressionNote: "No history — starting weight",
      };
    }

    const last = mostRecentSetArr[0];
    const lastReps = last.reps;
    const lastWeight = last.weight;
    const lastRpe = last.rpe;

    // ── Weighted RPE trend (3 : 2 : 1 decay over last 3 available sessions) ──
    const trendData = sessionSets
      .filter((arr) => arr.length > 0)
      .slice(0, 3)
      .map((arr, i) => ({ rpe: arr[0].rpe, w: 3 - i }));

    const totalW = trendData.reduce((s, d) => s + d.w, 0);
    const weightedRpe = trendData.reduce((s, d) => s + d.rpe * d.w, 0) / totalW;

    // ── RPE classification ──────────────────────────────────────────────────
    type RpeStatus = "overreaching" | "ceiling" | "optimal" | "undertrained";
    let rpeStatus: RpeStatus;

    if (lastRpe > 9.0) {
      // Single-session hard cap — if they barely survived the last set, back off.
      rpeStatus = "overreaching";
    } else if (weightedRpe >= rpeCeiling) {
      // Sustained effort at ceiling — hold weight even if reps were achieved.
      rpeStatus = "ceiling";
    } else if (weightedRpe < 7.0) {
      rpeStatus = "undertrained";
    } else {
      rpeStatus = "optimal";
    }

    // ── Rep range classification ─────────────────────────────────────────────
    type RepStatus = "below_min" | "progressing" | "at_max";
    let repStatus: RepStatus;

    if (lastReps < minReps) repStatus = "below_min";
    else if (lastReps >= maxReps) repStatus = "at_max";
    else repStatus = "progressing";

    // ── Decision matrix ──────────────────────────────────────────────────────
    let recWeight = lastWeight;
    let recReps = lastReps;
    let progressionNote: string;

    if (rpeStatus === "overreaching") {
      // Hard deload: reduce load ~5%, target the bottom of the rep range.
      recWeight = roundToPlate(lastWeight * 0.95);
      recReps = minReps;
      progressionNote = "Deload — RPE exceeded 9 last session";
    } else if (rpeStatus === "ceiling") {
      if (repStatus === "below_min") {
        // Too heavy AND consistently high RPE — reduce weight.
        recWeight = roundToPlate(lastWeight * 0.95);
        recReps = minReps;
        progressionNote = "Reduce weight — below rep target at high RPE";
      } else {
        // Hold weight; RPE won't allow a load increase even at max reps.
        recWeight = lastWeight;
        recReps = Math.min(maxReps, lastReps);
        progressionNote = "Hold weight — RPE at ceiling";
      }
    } else {
      // rpeStatus === "optimal" | "undertrained"
      if (repStatus === "at_max") {
        // Hit the rep ceiling at safe RPE → time to add weight.
        const inc = weightIncrement(lastWeight);
        recWeight = roundToPlate(lastWeight + inc);
        recReps = minReps; // Classic double progression: reset reps on weight bump
        progressionNote = `+${inc} kg — hit rep ceiling (${lastReps} reps)`;
      } else if (repStatus === "below_min") {
        // Fell below the rep floor — ease back slightly.
        recWeight = roundToPlate(lastWeight * 0.975);
        recReps = minReps;
        progressionNote = "Slight weight reduction — missed rep minimum";
      } else {
        // progressing: same weight, aim for one more rep.
        recWeight = lastWeight;
        recReps = Math.min(maxReps, lastReps + 1);
        progressionNote = `+1 rep target (${lastReps} → ${recReps})`;
      }
    }

    // ── Recommended RPE ──────────────────────────────────────────────────────
    // After a deload or weight increase, effort naturally rises; cap at 9.
    // After a rep increment at same weight, effort should stay close to last.
    let recRpe: number;
    if (rpeStatus === "overreaching") {
      recRpe = Math.min(targetRpe, 8.0);
    } else if (repStatus === "at_max" && rpeStatus !== "ceiling") {
      // New weight → expect RPE to climb a bit; aim for target.
      recRpe = targetRpe;
    } else {
      // Small adjustments — carry the last RPE trend toward the target gently.
      recRpe = round(weightedRpe * 0.6 + targetRpe * 0.4, 1);
    }

    // ── Clamp all outputs to sane ranges ────────────────────────────────────
    recReps = Math.max(1, Math.min(50, Math.round(recReps)));
    recWeight = Math.max(0.5, recWeight);
    recRpe = round(Math.min(9.5, Math.max(6.0, recRpe)), 1);

    return {
      setNumber,
      recommendedReps: recReps,
      recommendedWeight: round(recWeight, 1),
      recommendedRpe: recRpe,
      progressionNote,
    };
  });
}
