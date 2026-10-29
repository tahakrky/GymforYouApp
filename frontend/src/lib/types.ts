// Hand-written mirrors of the Pydantic models in backend/models/ — nothing infers across
// the HTTP boundary, so every interface here is kept in sync with its Python twin by hand.

export const MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "legs",
  "glutes",
  "abs",
  "forearms",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENT_OPTIONS = [
  "dumbbell",
  "bench",
  "bodyweight",
  "band",
  "pullup_bar",
  "barbell",
  "cable",
  "machine",
] as const;
export type EquipmentKey = (typeof EQUIPMENT_OPTIONS)[number];

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export interface WeightEntry {
  date: string;
  weight_kg: number;
}

export interface Profile {
  id: string;
  name: string;
  phone: string; // 🆕
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  experience: string;
  weekly_limit: number;
  exercises_per_session: number;
  muscle_order: string[];
  week_plan: Record<string, string[]>;
  schedule: Record<string, string>;
  owned_equipment: string[];
  dumbbell_weight_kg: number;
  dumbbell_count: number;
  equipment_filter_default: string;
  plan_overrides: Record<string, string[]>;
  weight_history: WeightEntry[];
  measurements: Record<string, number>;
  playlist_url: string;
  playlist_name: string;
}

export interface SecondaryActivation {
  muscle: string;
  pct: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  equipment_required: string[];
  equipment_label: string;
  dumbbells_needed: number;
  difficulty: string;
  video_id: string;
  description: string;
  instructions: string[];
  order: number;
  activation: number;
  secondary: SecondaryActivation[];
  target_sets: number;
  target_reps: number;
  rep_min: number;
  rep_max: number;
  rep_range: string;
  rest_sec: number;
  progression_to: string | null;
  progression_note: string | null;
}

export interface WorkoutSet {
  index: number;
  target_reps: number;
  reps: number | null;
  weight_kg: number | null;
  completed: boolean;
}

export interface PlanExercise {
  exercise_id: string;
  name: string;
  order: number;
  video_id: string;
  equipment_label: string;
  activation: number;
  secondary: SecondaryActivation[];
  target_sets: number;
  target_reps: number;
  rep_min: number;
  rep_max: number;
  rep_range: string;
  rest_sec: number;
  progression_to: string | null;
  progression_note: string | null;
  previous_weight: number | null;
  previous_reps: number | null;
  note: string;
  sets: WorkoutSet[];
}

export interface PersonalRecord {
  exercise_name: string;
  weight_kg: number;
  reps: number;
}

export interface Workout {
  id: string;
  muscle: string;
  date: string;
  week_start: string;
  started_at: string;
  finished_at: string | null;
  start_clock: string;
  finish_clock: string;
  duration_sec: number | null;
  status: string;
  exercises: PlanExercise[];
  total_sets: number;
  completed_sets: number;
  total_volume: number;
  prs: PersonalRecord[];
}

export interface MuscleStatus {
  muscle: string;
  trained_today: boolean;
  sessions_this_week: number;
  weekly_limit: number;
  status: string;
  sets_this_week: number;
  volume_this_week: number;
  last_trained: string | null;
  training_score: number;
}

export interface DayOverview {
  day: string;
  date: string;
  scheduled_muscle: string | null;
  planned_muscles: string[];
  muscles_trained: string[];
  is_today: boolean;
  is_future: boolean;
}

export interface Stats {
  total_workouts: number;
  total_sets: number;
  total_volume: number;
  current_streak: number;
  pr_count: number;
}

export interface Summary {
  name: string;
  today: string;
  weekly_limit: number;
  today_scheduled_muscle: string | null;
  today_planned_muscles: string[];
  muscle_order: string[];
  muscles: MuscleStatus[];
  week_overview: DayOverview[];
  stats: Stats;
}

export interface WeekPoint {
  week_start: string;
  sets: number;
  volume: number;
  top_weight: number;
}

export interface MuscleDetail {
  muscle: string;
  training_score: number;
  sessions_this_week: number;
  total_sessions: number;
  weekly_limit: number;
  status: string;
  trained_today: boolean;
  total_sets: number;
  total_volume: number;
  best_weight: number | null;
  consistency: number;
  last_trained: string | null;
  next_available: string | null;
  records: PersonalRecord[];
  progression: WeekPoint[];
}

export interface WorkoutCompleteResponse {
  workout: Workout;
  prs: PersonalRecord[];
  score_before: number;
  score_after: number;
  messages: string[];
}