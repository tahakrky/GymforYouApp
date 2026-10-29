import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { qk } from "@/lib/queryKeys";
import { localDate } from "@/lib/tr";
import type { Exercise, MuscleDetail, Workout } from "@/lib/types";

/**
 * Kas kartına hover/touch → Workout sayfasının tüm verilerini arka planda çek.
 * Kullanıcı tıkladığında sayfa ZATEN HAZIR olur.
 */
export function usePrefetchWorkout() {
  const qc = useQueryClient();
  return useCallback(
    (muscle: string) => {
      // Aktif antrenman var mı?
      void qc.prefetchQuery({
        queryKey: qk.workouts("active", muscle),
        queryFn: () =>
          apiGet<Workout[]>(`/workouts?muscle=${muscle}&status=active`),
        staleTime: 15_000,
      });
      // Günlük plan
      void qc.prefetchQuery({
        queryKey: qk.plan(muscle),
        queryFn: () => apiGet<Exercise[]>(`/workouts/plan/${muscle}`),
        staleTime: 60_000,
      });
      // Kas detayı (limit/today durumu)
      void qc.prefetchQuery({
        queryKey: qk.muscle(muscle, localDate()),
        queryFn: () =>
          apiGet<MuscleDetail>(`/muscles/${muscle}?today=${localDate()}`),
        staleTime: 60_000,
      });
    },
    [qc],
  );
}

/**
 * Egzersiz kartına hover → detay sayfasının verisini arka planda çek.
 */
export function usePrefetchExercise() {
  const qc = useQueryClient();
  return useCallback(
    (id: string) => {
      void qc.prefetchQuery({
        queryKey: qk.exercise(id),
        queryFn: () => apiGet<Exercise>(`/exercises/${id}`),
        staleTime: 5 * 60_000,
      });
    },
    [qc],
  );
}