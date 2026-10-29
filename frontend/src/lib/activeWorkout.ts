const KEY = "gymforyou-active-workout";

export interface ActiveWorkoutInfo {
  workoutId: string;
  muscle: string;
  startClock: string;
  startedAt: number; // Date.now()
}

export function setActiveWorkout(info: ActiveWorkoutInfo): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(info));
    // Aynı sekmede dinleyicilere haber ver
    window.dispatchEvent(new Event("active-workout-changed"));
  } catch {
    /* private mode vs. */
  }
}

export function readActiveWorkout(): ActiveWorkoutInfo | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveWorkoutInfo;
    if (!parsed?.muscle || !parsed?.workoutId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveWorkout(): void {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("active-workout-changed"));
  } catch {
    /* yut */
  }
}