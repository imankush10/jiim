export type ExercisePlan = {
  name: string;
  sets: number;
  minReps: number;
  maxReps: number;
  day?: string;
  sessionType?: string;
  notes?: string;
};

export type WorkoutProgram = {
  _id?: string;
  name: string;
  description?: string;
  exercises: ExercisePlan[];
  createdAt: string;
};

export type WorkoutSet = {
  exerciseName: string;
  setNumber: number;
  reps: number;
  weight: number;
  rpe: number;
  isDropSet?: boolean;
  completed: boolean;
  timestamp: string;
};

export type WorkoutSession = {
  _id?: string;
  programId: string;
  programName: string;
  trainingDay?: string;
  startedAt: string;
  finishedAt?: string;
  status: "active" | "finished";
  sets: WorkoutSet[];
};

export type SetRecommendation = {
  setNumber: number;
  recommendedReps: number;
  recommendedWeight: number;
  recommendedRpe: number;
  progressionNote?: string;
};

export type ExerciseAnalysisPoint = {
  date: string;
  avgWeight: number;
  avgRpe: number;
  totalVolume: number;
  estimated1RM: number;
  hypertrophyScore: number;
};

export type ExerciseAnalysis = {
  points: ExerciseAnalysisPoint[];
  progressiveOverloadScore: number;
  progressiveOverloadStatus: "excellent" | "good" | "flat" | "declining";
  muscleBuildingEfficiency: number;
};
