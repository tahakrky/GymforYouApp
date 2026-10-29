import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { Workout } from "@/lib/types";
import {
  readActiveWorkout,
  clearActiveWorkout,
  type ActiveWorkoutInfo,
} from "@/lib/activeWorkout";

/**
 * localStorage'daki aktif antrenmanı okur, backend'de gerçekten var mı diye
 * doğrular. Backend "yok" (404) derse localStorage'ı temizler.
 *
 * Home ve Workout sayfaları bunu kullanır → tek kaynak, tek doğruluk.
 */
export function useActiveWorkoutGuard() {
  const [info, setInfo] = useState<ActiveWorkoutInfo | null>(() =>
    readActiveWorkout(),
  );

  // localStorage değişince state'i güncelle
  useEffect(() => {
    const refresh = () => setInfo(readActiveWorkout());
    window.addEventListener("active-workout-changed", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("active-workout-changed", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // Backend'de gerçekten var mı? — arka planda periyodik doğrula
  const verifyQ = useQuery({
    queryKey: ["workouts", "verify-active", info?.workoutId],
    queryFn: () => apiGet<Workout>(`/workouts/${info!.workoutId}`),
    enabled: !!info?.workoutId,
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: false,
  });

  // Backend'de yok → localStorage'ı temizle
  useEffect(() => {
    if (info && verifyQ.isError) {
      clearActiveWorkout();
      setInfo(null);
    }
  }, [info, verifyQ.isError]);

  return {
    /** localStorage'daki bilgi (varsa). */
    info,
    /** Backend'den doğrulanmış tam workout (varsa). */
    workout: verifyQ.data ?? null,
    /** Backend'e soruyoruz, cevap bekliyoruz. */
    isVerifying: !!info && verifyQ.isLoading,
    /** Backend "yok" dedi (404) — effect tetiklendi, temizlenecek. */
    isMissing: !!info && verifyQ.isError,
  };
}