"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ExerciseAnalysis,
  SetRecommendation,
  WorkoutProgram,
  WorkoutSession,
} from "@/lib/types";

type ProgramFormExercise = {
  name: string;
  sets: number;
  minReps: number;
  maxReps: number;
  day: string;
  sessionType: string;
  notes: string;
};

type ProgramForm = {
  name: string;
  description: string;
  exercises: ProgramFormExercise[];
};

type HistoryPayload = {
  analysis: ExerciseAnalysis;
  recommendations: SetRecommendation[];
  workouts: WorkoutSession[];
};

const emptyExercise = {
  name: "",
  sets: 3,
  minReps: 8,
  maxReps: 12,
  day: "Day 1",
  sessionType: "",
  notes: "",
};

const starterForm: ProgramForm = {
  name: "Upper Strength",
  description: "Mobile-first logging program",
  exercises: [
    { ...emptyExercise, day: "Day 1", name: "Bench Press" },
    { ...emptyExercise, day: "Day 1", name: "Barbell Row" },
  ],
};

function getExerciseDay(exercise: {
  day?: string;
  notes?: string;
}) {
  if (exercise.day?.trim()) return exercise.day.trim();

  const notePrefix = exercise.notes?.split("|")[0]?.trim();
  return notePrefix || "General";
}

function getExerciseSessionType(exercise: {
  sessionType?: string;
  notes?: string;
}) {
  if (exercise.sessionType?.trim()) return exercise.sessionType.trim();

  const parts = exercise.notes?.split("|").map((part) => part.trim()) || [];
  return parts[1] || "";
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"maker" | "workout">("maker");
  const [programs, setPrograms] = useState<WorkoutProgram[]>([]);
  const [programForm, setProgramForm] = useState<ProgramForm>(starterForm);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>("General");
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(
    null,
  );
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [setInputs, setSetInputs] = useState<
    Record<string, { reps: number; weight: number; rpe: number; isDropSet: boolean }>
  >({});
  const [extraSets, setExtraSets] = useState<Record<string, number>>({});

  const selectedProgram = useMemo(
    () => programs.find((program) => program._id === selectedProgramId) || null,
    [programs, selectedProgramId],
  );

  const availableDays = useMemo(() => {
    if (!selectedProgram) return [];

    return Array.from(
      new Set(selectedProgram.exercises.map((exercise) => getExerciseDay(exercise))),
    );
  }, [selectedProgram]);

  const exercisesForSelectedDay = useMemo(() => {
    if (!selectedProgram) return [];

    return selectedProgram.exercises.filter(
      (exercise) => getExerciseDay(exercise) === selectedDay,
    );
  }, [selectedProgram, selectedDay]);

  const refreshPrograms = useCallback(async () => {
    const response = await fetch("/api/programs");
    const data = (await response.json()) as WorkoutProgram[];
    setPrograms(data);

    if (data.length > 0 && !selectedProgramId) {
      setSelectedProgramId(data[0]._id || "");
    }
  }, [selectedProgramId]);

  useEffect(() => {
    void refreshPrograms();
  }, [refreshPrograms]);

  useEffect(() => {
    if (!selectedProgramId || !selectedDay) return;
    void fetchActiveWorkout(selectedProgramId, selectedDay);
  }, [selectedProgramId, selectedDay]);

  useEffect(() => {
    if (!availableDays.length) {
      setSelectedDay("General");
      return;
    }

    setSelectedDay((prev) => (availableDays.includes(prev) ? prev : availableDays[0]));
  }, [availableDays]);

  useEffect(() => {
    if (!exercisesForSelectedDay.length) {
      setSelectedExercise("");
      return;
    }

    setSelectedExercise((prev) =>
      exercisesForSelectedDay.some((exercise) => exercise.name === prev)
        ? prev
        : exercisesForSelectedDay[0].name,
    );
  }, [exercisesForSelectedDay]);

  useEffect(() => {
    if (!selectedExercise) return;
    const exerciseConfig = exercisesForSelectedDay.find(
      (e) => e.name === selectedExercise,
    );
    if (!exerciseConfig) return;

    void fetchHistory(selectedExercise, exerciseConfig.sets);
  }, [selectedExercise, exercisesForSelectedDay]);

  useEffect(() => {
    if (!activeWorkout || !selectedDay || !exercisesForSelectedDay.length) return;

    const computed: Record<string, number> = {};

    for (const exercise of exercisesForSelectedDay) {
      const planned = exercise.sets;
      const maxLogged = activeWorkout.sets
        .filter((set) => set.exerciseName === exercise.name)
        .reduce((max, set) => Math.max(max, set.setNumber), 0);

      const extra = Math.max(0, maxLogged - planned);
      if (extra > 0) {
        computed[getExerciseKey(selectedDay, exercise.name)] = extra;
      }
    }

    setExtraSets((prev) => ({ ...prev, ...computed }));
  }, [activeWorkout, selectedDay, exercisesForSelectedDay]);

  async function fetchActiveWorkout(programId: string, trainingDay: string) {
    const response = await fetch(
      `/api/workouts/active?programId=${programId}&trainingDay=${encodeURIComponent(trainingDay)}`,
    );
    const data = (await response.json()) as WorkoutSession | null;
    setActiveWorkout(data);
  }

  async function fetchHistory(exerciseName: string, sets: number) {
    const response = await fetch(
      `/api/history/exercise?name=${encodeURIComponent(exerciseName)}&sets=${sets}`,
    );
    const data = (await response.json()) as HistoryPayload;
    setHistory(data);
  }

  async function handleProgramCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        name: programForm.name,
        description: programForm.description,
        exercises: programForm.exercises,
      };

      const response = await fetch(
        editingProgramId ? `/api/programs/${editingProgramId}` : "/api/programs",
        {
          method: editingProgramId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) throw new Error("Failed to save program");

      await refreshPrograms();
      setProgramForm(starterForm);
      setEditingProgramId(null);
      setActiveTab("workout");
    } catch (createError) {
      setError(String(createError));
    } finally {
      setLoading(false);
    }
  }

  function handleEditProgram(program: WorkoutProgram) {
    setEditingProgramId(program._id || null);
    setProgramForm({
      name: program.name,
      description: program.description || "",
      exercises: program.exercises.map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets,
        minReps: exercise.minReps,
        maxReps: exercise.maxReps,
        day: getExerciseDay(exercise),
        sessionType: getExerciseSessionType(exercise),
        notes: exercise.notes || "",
      })),
    });
    setActiveTab("maker");
  }

  function cancelEditProgram() {
    setEditingProgramId(null);
    setProgramForm(starterForm);
  }

  async function handleStartWorkout() {
    if (!selectedProgramId || !selectedDay) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workouts/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: selectedProgramId,
          trainingDay: selectedDay,
        }),
      });
      const data = (await response.json()) as WorkoutSession;
      setActiveWorkout(data);
    } catch (startError) {
      setError(String(startError));
    } finally {
      setLoading(false);
    }
  }

  async function handleFinishWorkout() {
    if (!activeWorkout?._id) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/workouts/${activeWorkout._id}/finish`,
        {
          method: "POST",
        },
      );
      if (!response.ok) throw new Error("Failed to finish workout");

      const finished = (await response.json()) as WorkoutSession;
      setActiveWorkout(null);

      if (selectedExercise) {
        const config = exercisesForSelectedDay.find(
          (e) => e.name === selectedExercise,
        );
        if (config) {
          await fetchHistory(selectedExercise, config.sets);
        }
      }

      window.alert(
        `Workout finished at ${new Date(finished.finishedAt || "").toLocaleTimeString()}`,
      );
    } catch (finishError) {
      setError(String(finishError));
    } finally {
      setLoading(false);
    }
  }

  function getSetInputKey(
    trainingDay: string,
    exerciseName: string,
    setNumber: number,
  ) {
    return `${trainingDay}__${exerciseName}__${setNumber}`;
  }

  function getExerciseKey(trainingDay: string, exerciseName: string) {
    return `${trainingDay}__${exerciseName}`;
  }

  function plannedSetCount(exerciseName: string) {
    return (
      exercisesForSelectedDay.find((exercise) => exercise.name === exerciseName)
        ?.sets || 0
    );
  }

  function renderedSetCount(exerciseName: string) {
    const key = getExerciseKey(selectedDay, exerciseName);
    return plannedSetCount(exerciseName) + (extraSets[key] || 0);
  }

  function updateSetInput(
    trainingDay: string,
    exerciseName: string,
    setNumber: number,
    field: "reps" | "weight" | "rpe",
    value: number,
  ) {
    const key = getSetInputKey(trainingDay, exerciseName, setNumber);
    setSetInputs((prev) => ({
      ...prev,
      [key]: {
        reps: prev[key]?.reps ?? 10,
        weight: prev[key]?.weight ?? 20,
        rpe: prev[key]?.rpe ?? 7,
        isDropSet: prev[key]?.isDropSet ?? false,
        [field]: value,
      },
    }));
  }

  function setDropFlag(
    trainingDay: string,
    exerciseName: string,
    setNumber: number,
    isDropSet: boolean,
  ) {
    const key = getSetInputKey(trainingDay, exerciseName, setNumber);
    setSetInputs((prev) => ({
      ...prev,
      [key]: {
        reps: prev[key]?.reps ?? 10,
        weight: prev[key]?.weight ?? 20,
        rpe: prev[key]?.rpe ?? 7,
        isDropSet,
      },
    }));
  }

  function applyRecommendation(
    trainingDay: string,
    exerciseName: string,
    recommendation: SetRecommendation,
  ) {
    const key = getSetInputKey(
      trainingDay,
      exerciseName,
      recommendation.setNumber,
    );
    setSetInputs((prev) => ({
      ...prev,
      [key]: {
        reps: recommendation.recommendedReps,
        weight: recommendation.recommendedWeight,
        rpe: recommendation.recommendedRpe,
        isDropSet: prev[key]?.isDropSet ?? false,
      },
    }));
  }

  function addSetRow(exerciseName: string, isDropSet: boolean) {
    const current = renderedSetCount(exerciseName);
    const nextSetNumber = current + 1;
    const exerciseKey = getExerciseKey(selectedDay, exerciseName);
    const setKey = getSetInputKey(selectedDay, exerciseName, nextSetNumber);

    setExtraSets((prev) => ({
      ...prev,
      [exerciseKey]: (prev[exerciseKey] || 0) + 1,
    }));

    setSetInputs((prev) => {
      if (prev[setKey]) return prev;

      return {
        ...prev,
        [setKey]: {
          reps: isDropSet ? 12 : 10,
          weight: isDropSet ? 15 : 20,
          rpe: isDropSet ? 8 : 7,
          isDropSet,
        },
      };
    });
  }

  async function saveSet(
    trainingDay: string,
    exerciseName: string,
    setNumber: number,
  ) {
    if (!activeWorkout?._id) return;

    const key = getSetInputKey(trainingDay, exerciseName, setNumber);
    const values = setInputs[key] || {
      reps: 10,
      weight: 20,
      rpe: 7,
      isDropSet: false,
    };

    const response = await fetch(`/api/workouts/${activeWorkout._id}/set`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exerciseName,
        setNumber,
        reps: Number(values.reps),
        weight: Number(values.weight),
        rpe: Number(values.rpe),
        isDropSet: values.isDropSet,
        completed: true,
      }),
    });

    if (!response.ok) {
      setError("Could not save set. Please retry.");
      return;
    }

    const workout = (await response.json()) as WorkoutSession;
    setActiveWorkout(workout);
  }

  function completedCount(exerciseName: string) {
    return (
      activeWorkout?.sets.filter(
        (set) => set.exerciseName === exerciseName && set.completed,
      ).length || 0
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_20%,#fbf4dd_0%,#f4fbff_40%,#eef8ee_100%)] p-4 text-slate-900 sm:p-8">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="glass rounded-3xl p-4 sm:p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-700">
            JiiM Lab
          </p>
          <h1 className="text-3xl font-black sm:text-5xl">
            Workout Builder and Smart Tracker
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-700 sm:text-base">
            Build your own programs, run workouts non-sequentially, log reps,
            weight and RPE, then check progressive overload and muscle-building
            efficiency on charts.
          </p>
        </header>

        <nav className="grid grid-cols-2 gap-2 rounded-2xl bg-white/60 p-2 shadow-sm backdrop-blur sm:max-w-md">
          <button
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${
              activeTab === "maker"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-800"
            }`}
            onClick={() => setActiveTab("maker")}
          >
            Program Maker
          </button>
          <button
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${
              activeTab === "workout"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-800"
            }`}
            onClick={() => setActiveTab("workout")}
          >
            Start Workout
          </button>
        </nav>

        {error ? (
          <p className="rounded-xl bg-red-100 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {activeTab === "maker" ? (
          <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <form
              className="glass rounded-3xl p-4 sm:p-6"
              onSubmit={handleProgramCreate}
            >
              <h2 className="text-xl font-bold">
                {editingProgramId ? "Edit Workout Program" : "Create Workout Program"}
              </h2>
              <div className="mt-4 grid gap-3">
                <input
                  className="field"
                  value={programForm.name}
                  onChange={(e) =>
                    setProgramForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Program name"
                  required
                />
                <textarea
                  className="field min-h-20"
                  value={programForm.description}
                  onChange={(e) =>
                    setProgramForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="What is this phase focused on?"
                />
              </div>

              <div className="mt-5 space-y-3">
                {programForm.exercises.map((exercise, idx) => (
                  <div
                    key={`${exercise.name}-${idx}`}
                    className="rounded-2xl border border-white/50 bg-white/70 p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        className="field"
                        placeholder="Exercise"
                        value={exercise.name}
                        onChange={(e) => {
                          const value = e.target.value;
                          setProgramForm((prev) => ({
                            ...prev,
                            exercises: prev.exercises.map((row, rowIdx) =>
                              rowIdx === idx ? { ...row, name: value } : row,
                            ),
                          }));
                        }}
                        required
                      />
                      <input
                        className="field"
                        type="number"
                        min={1}
                        max={10}
                        placeholder="Sets"
                        value={exercise.sets}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setProgramForm((prev) => ({
                            ...prev,
                            exercises: prev.exercises.map((row, rowIdx) =>
                              rowIdx === idx ? { ...row, sets: value } : row,
                            ),
                          }));
                        }}
                        required
                      />
                      <input
                        className="field"
                        type="number"
                        min={1}
                        max={30}
                        placeholder="Min reps"
                        value={exercise.minReps}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setProgramForm((prev) => ({
                            ...prev,
                            exercises: prev.exercises.map((row, rowIdx) =>
                              rowIdx === idx ? { ...row, minReps: value } : row,
                            ),
                          }));
                        }}
                        required
                      />
                      <input
                        className="field"
                        type="number"
                        min={1}
                        max={40}
                        placeholder="Max reps"
                        value={exercise.maxReps}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setProgramForm((prev) => ({
                            ...prev,
                            exercises: prev.exercises.map((row, rowIdx) =>
                              rowIdx === idx ? { ...row, maxReps: value } : row,
                            ),
                          }));
                        }}
                        required
                      />
                      <input
                        className="field"
                        placeholder="Day (e.g. Monday or Day 1)"
                        value={exercise.day}
                        onChange={(e) => {
                          const value = e.target.value;
                          setProgramForm((prev) => ({
                            ...prev,
                            exercises: prev.exercises.map((row, rowIdx) =>
                              rowIdx === idx ? { ...row, day: value } : row,
                            ),
                          }));
                        }}
                        required
                      />
                      <input
                        className="field"
                        placeholder="Session type (optional)"
                        value={exercise.sessionType}
                        onChange={(e) => {
                          const value = e.target.value;
                          setProgramForm((prev) => ({
                            ...prev,
                            exercises: prev.exercises.map((row, rowIdx) =>
                              rowIdx === idx
                                ? { ...row, sessionType: value }
                                : row,
                            ),
                          }));
                        }}
                      />
                    </div>
                    <textarea
                      className="field mt-2 min-h-16"
                      placeholder="Notes"
                      value={exercise.notes}
                      onChange={(e) => {
                        const value = e.target.value;
                        setProgramForm((prev) => ({
                          ...prev,
                          exercises: prev.exercises.map((row, rowIdx) =>
                            rowIdx === idx ? { ...row, notes: value } : row,
                          ),
                        }));
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold"
                  onClick={() =>
                    setProgramForm((prev) => ({
                      ...prev,
                      exercises: [...prev.exercises, { ...emptyExercise }],
                    }))
                  }
                >
                  Add Exercise
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {loading
                    ? "Saving..."
                    : editingProgramId
                      ? "Update Program"
                      : "Save Program"}
                </button>
                {editingProgramId ? (
                  <button
                    type="button"
                    className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800"
                    onClick={cancelEditProgram}
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </form>

            <aside className="glass rounded-3xl p-4 sm:p-6">
              <h3 className="text-lg font-bold">Saved Programs</h3>
              <div className="mt-3 space-y-2">
                {programs.map((program) => (
                  <div
                    key={program._id}
                    className="w-full rounded-xl border border-white/40 bg-white/80 p-3 text-left"
                  >
                    <p className="font-semibold">{program.name}</p>
                    <p className="text-xs text-slate-600">
                      {program.exercises.length} exercises
                    </p>

                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                        onClick={() => {
                          setSelectedProgramId(program._id || "");
                          setActiveTab("workout");
                        }}
                      >
                        Track
                      </button>
                      <button
                        className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                        onClick={() => handleEditProgram(program)}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </section>
        ) : (
          <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <div className="space-y-4">
              <div className="glass rounded-3xl p-4 sm:p-6">
                <h2 className="text-xl font-bold">Start or Resume Workout</h2>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <select
                    className="field flex-1"
                    value={selectedProgramId}
                    onChange={(e) => setSelectedProgramId(e.target.value)}
                  >
                    <option value="">Select Program</option>
                    {programs.map((program) => (
                      <option key={program._id} value={program._id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleStartWorkout}
                    disabled={!selectedProgramId || !selectedDay || loading}
                    className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {activeWorkout ? "Workout Active" : "Start Workout"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {availableDays.map((day) => (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        selectedDay === day
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                {selectedDay ? (
                  <p className="mt-2 text-xs text-slate-600">
                    Tracking day: <span className="font-semibold">{selectedDay}</span>
                  </p>
                ) : null}

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {exercisesForSelectedDay.map((exercise, idx) => {
                    const done = completedCount(exercise.name);
                    const isCurrent = exercise.name === selectedExercise;
                    const totalSets = renderedSetCount(exercise.name);
                    return (
                      <button
                        key={`${exercise.name}-${idx}`}
                        onClick={() => setSelectedExercise(exercise.name)}
                        className={`rounded-2xl border p-3 text-left ${
                          isCurrent
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-white/40 bg-white/80"
                        }`}
                      >
                        <p className="font-semibold">{exercise.name}</p>
                        <p className="text-xs text-slate-600">
                          {done}/{totalSets} sets completed {done >= totalSets ? "✓" : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedExercise && selectedProgram && activeWorkout ? (
                <div className="glass rounded-3xl p-4 sm:p-6">
                  <h3 className="text-lg font-bold">
                    Record: {selectedExercise}
                  </h3>
                  <p className="text-sm text-slate-700">
                    You can log this exercise in any order. Recommendations use
                    your past 3 workouts.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                      onClick={() => addSetRow(selectedExercise, false)}
                    >
                      + Add Set
                    </button>
                    <button
                      className="rounded-lg bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-800"
                      onClick={() => addSetRow(selectedExercise, true)}
                    >
                      + Add Drop Set
                    </button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {Array.from(
                      {
                        length: renderedSetCount(selectedExercise),
                      },
                      (_, idx) => {
                        const setNumber = idx + 1;
                        const key = getSetInputKey(
                          selectedDay,
                          selectedExercise,
                          setNumber,
                        );
                        const recommendation = history?.recommendations.find(
                          (r) => r.setNumber === setNumber,
                        );
                        const input = setInputs[key] || {
                          reps: recommendation?.recommendedReps || 10,
                          weight: recommendation?.recommendedWeight || 20,
                          rpe: recommendation?.recommendedRpe || 7,
                          isDropSet: false,
                        };

                        const matchedSet = activeWorkout.sets.find(
                          (set) =>
                            set.exerciseName === selectedExercise &&
                            set.setNumber === setNumber,
                        );

                        const completed = Boolean(matchedSet?.completed);
                        const isDropSet = input.isDropSet || Boolean(matchedSet?.isDropSet);

                        return (
                          <div
                            key={setNumber}
                            className="rounded-2xl border border-white/40 bg-white/80 p-3"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <p className="font-semibold">Set {setNumber}</p>
                              <p className="text-xs text-slate-600">
                                {completed ? "Saved ✓" : "Pending"}
                              </p>
                            </div>

                            <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={isDropSet}
                                onChange={(e) =>
                                  setDropFlag(
                                    selectedDay,
                                    selectedExercise,
                                    setNumber,
                                    e.target.checked,
                                  )
                                }
                              />
                              Mark as Drop Set
                            </label>

                            <div className="grid grid-cols-3 gap-2">
                              <input
                                className="field"
                                type="number"
                                min={0}
                                value={input.reps}
                                onChange={(e) =>
                                  updateSetInput(
                                    selectedDay,
                                    selectedExercise,
                                    setNumber,
                                    "reps",
                                    Number(e.target.value),
                                  )
                                }
                              />
                              <input
                                className="field"
                                type="number"
                                min={0}
                                step="0.5"
                                value={input.weight}
                                onChange={(e) =>
                                  updateSetInput(
                                    selectedDay,
                                    selectedExercise,
                                    setNumber,
                                    "weight",
                                    Number(e.target.value),
                                  )
                                }
                              />
                              <input
                                className="field"
                                type="number"
                                min={1}
                                max={10}
                                step="0.5"
                                value={input.rpe}
                                onChange={(e) =>
                                  updateSetInput(
                                    selectedDay,
                                    selectedExercise,
                                    setNumber,
                                    "rpe",
                                    Number(e.target.value),
                                  )
                                }
                              />
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
                              {isDropSet ? (
                                <span className="badge bg-orange-100 text-orange-800">
                                  Drop Set
                                </span>
                              ) : null}
                              <span className="badge">
                                Suggested:{" "}
                                {recommendation?.recommendedReps || 10} reps
                              </span>
                              <span className="badge">
                                {recommendation?.recommendedWeight || 20} kg
                              </span>
                              <span className="badge">
                                RPE {recommendation?.recommendedRpe || 7}
                              </span>
                            </div>

                            <div className="mt-3 flex gap-2">
                              <button
                                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                                onClick={() =>
                                  saveSet(
                                    selectedDay,
                                    selectedExercise,
                                    setNumber,
                                  )
                                }
                              >
                                Save Set
                              </button>
                              <button
                                className="rounded-lg bg-white px-3 py-2 text-xs font-semibold"
                                onClick={() =>
                                  recommendation &&
                                  applyRecommendation(
                                    selectedDay,
                                    selectedExercise,
                                    recommendation,
                                  )
                                }
                              >
                                Use Suggestion
                              </button>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>

                  <button
                    onClick={handleFinishWorkout}
                    className="mt-4 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-900"
                  >
                    Finish Workout
                  </button>
                </div>
              ) : null}
            </div>

            <div className="glass rounded-3xl p-4 sm:p-6">
              <h3 className="text-xl font-bold">History and Analysis</h3>
              <p className="mt-1 text-sm text-slate-700">
                Desktop view gives you deeper chart detail, while mobile keeps
                key metrics compact.
              </p>

              {history?.analysis ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <div className="metric-card">
                      <p className="text-xs uppercase tracking-wide text-slate-600">
                        Overload
                      </p>
                      <p className="text-lg font-black">
                        {history.analysis.progressiveOverloadScore}%
                      </p>
                      <p className="text-xs text-slate-700">
                        {history.analysis.progressiveOverloadStatus}
                      </p>
                    </div>
                    <div className="metric-card">
                      <p className="text-xs uppercase tracking-wide text-slate-600">
                        Efficiency
                      </p>
                      <p className="text-lg font-black">
                        {history.analysis.muscleBuildingEfficiency}
                      </p>
                      <p className="text-xs text-slate-700">
                        Stimulus/recovery
                      </p>
                    </div>
                    <div className="metric-card col-span-2 sm:col-span-1">
                      <p className="text-xs uppercase tracking-wide text-slate-600">
                        Sessions
                      </p>
                      <p className="text-lg font-black">
                        {history.analysis.points.length}
                      </p>
                      <p className="text-xs text-slate-700">
                        for {selectedExercise || "exercise"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 h-72 w-full rounded-2xl border border-white/50 bg-white/80 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history.analysis.points}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value) =>
                            new Date(value).toLocaleDateString()
                          }
                          minTickGap={20}
                        />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip
                          labelFormatter={(value) =>
                            new Date(String(value)).toLocaleString()
                          }
                        />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="avgWeight"
                          stroke="#0f766e"
                          strokeWidth={2}
                          name="Avg Weight"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="avgRpe"
                          stroke="#b45309"
                          strokeWidth={2}
                          name="Avg RPE"
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="estimated1RM"
                          stroke="#1d4ed8"
                          strokeWidth={2}
                          name="Est. 1RM"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-700">
                  Select an exercise to view analysis.
                </p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
