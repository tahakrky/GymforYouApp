export const qk = {
  summary: (d: string) => ["summary", d] as const,
  profile: () => ["profile"] as const,
  exercises: (qs: string) => ["exercises", qs] as const,
  exercise: (id: string) => ["exercise", id] as const,
  plan: (m: string) => ["plan", m] as const,
  muscle: (m: string, d: string) => ["muscle", m, d] as const,
  workouts: (...parts: (string | undefined)[]) =>
    ["workouts", ...parts.filter(Boolean)] as const,
  workout: (id: string) => ["workout", id] as const,
} as const;