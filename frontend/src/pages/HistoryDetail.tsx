import { memo, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock,
  Dumbbell,
  Layers,
  Play,
  StickyNote,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Workout } from "@/lib/types";
import { MUSCLE_TR, fmtDateTr, fmtDurationTr, fmtNumTr } from "@/lib/tr";
import { qk } from "@/lib/queryKeys";

const MUSCLE_ACCENT: Record<string, string> = {
  chest: "#EF4444",
  back: "#3B82F6",
  legs: "#F59E0B",
  shoulders: "#8B5CF6",
  arms: "#06B6D4",
  biceps: "#06B6D4",
  triceps: "#06B6D4",
  core: "#EC4899",
  abs: "#EC4899",
  cardio: "#10B981",
  glutes: "#F97316",
  full_body: "#84CC16",
  fullbody: "#84CC16",
};

const muscleColor = (m: string) =>
  MUSCLE_ACCENT[(m ?? "").toLowerCase()] ?? "#84CC16";

export default function HistoryDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: w, isLoading } = useQuery({
    queryKey: qk.workout(id ?? ""),
    queryFn: () => apiGet<Workout>(`/workouts/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });

  const accent = w ? muscleColor(w.muscle) : "#84CC16";

  const exerciseVolumes = useMemo(() => {
    if (!w) return [];
    const rows = w.exercises.map((e) => {
      const vol = e.sets.reduce(
        (a, s) => a + (s.completed ? (s.weight_kg ?? 0) * (s.reps ?? 0) : 0),
        0
      );
      return { name: e.name, volume: vol };
    });
    const max = Math.max(1, ...rows.map((r) => r.volume));
    return rows.map((r) => ({ ...r, pct: (r.volume / max) * 100 }));
  }, [w]);

  // ---- Loading skeleton ----
  if (isLoading || !w) {
    return (
      <div
        className="mx-auto max-w-2xl space-y-5 pb-10"
        data-testid="history-detail-skeleton"
      >
        <div className="h-4 w-20 animate-pulse rounded bg-[#1A1A1D]" />
        <div className="h-36 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">
      {/* Back */}
      <Link
        to="/history"
        data-testid="history-detail-back-link"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Geçmiş
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-lg border border-[#27272A] bg-[#141416] p-5">
        <span
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="text-xs font-semibold uppercase tracking-wide text-zinc-500"
              data-testid="history-detail-date"
            >
              {fmtDateTr(w.date)}
            </p>
            <h1
              className="mt-1 font-heading text-3xl font-extrabold tracking-tight text-white"
              data-testid="history-detail-title"
            >
              {MUSCLE_TR[w.muscle] ?? w.muscle}
            </h1>
            <p
              className="mt-2 flex items-center gap-1.5 font-heading text-sm font-bold"
              style={{ color: accent }}
              data-testid="history-detail-clock"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Başlangıç {w.start_clock || "—"} · Bitiş {w.finish_clock || "—"}
              {w.duration_sec ? ` · ${fmtDurationTr(w.duration_sec)}` : ""}
            </p>
          </div>
          {w.prs.length > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-md border border-[#84CC16] bg-[#1A2210] px-2.5 py-1.5 text-[11px] font-bold text-[#84CC16]">
              <Trophy className="h-3.5 w-3.5" aria-hidden /> {w.prs.length} PR
            </span>
          )}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile
          icon={<Dumbbell className="h-3.5 w-3.5" />}
          label="Egzersiz"
          value={String(w.exercises.length)}
          testid="detail-exercises"
        />
        <StatTile
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Set"
          value={`${w.completed_sets}/${w.total_sets}`}
          testid="detail-sets"
        />
        <StatTile
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Hacim"
          value={`${fmtNumTr(w.total_volume)} kg`}
          testid="detail-volume"
        />
        <StatTile
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Süre"
          value={w.duration_sec ? fmtDurationTr(w.duration_sec) : "—"}
          testid="detail-duration"
        />
      </div>

      {/* PRs */}
      {w.prs.length > 0 && (
        <div className="space-y-2" data-testid="history-detail-prs">
          {w.prs.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-lg border border-[#84CC16] bg-[#1A2210] p-3"
              data-testid={`history-detail-pr-${i}`}
            >
              <span className="flex items-center gap-2 text-[11px] font-bold text-[#84CC16]">
                <Trophy className="h-4 w-4" aria-hidden /> KİŞİSEL REKOR
              </span>
              <span className="text-right font-heading text-xs font-bold text-white">
                {p.exercise_name} — {fmtNumTr(p.weight_kg)} kg × {p.reps}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Volume breakdown */}
      {exerciseVolumes.length > 0 && (
        <section className="rounded-lg border border-[#27272A] bg-[#141416] p-4">
          <div className="flex items-center gap-2">
            <TrendingUp
              className="h-3.5 w-3.5"
              style={{ color: accent }}
              aria-hidden
            />
            <h2 className="font-heading text-xs font-bold uppercase tracking-wider text-zinc-400">
              Hacim Dağılımı
            </h2>
          </div>
          <div className="mt-3 space-y-2.5">
            {exerciseVolumes.map((r) => (
              <div key={r.name}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-zinc-300">{r.name}</span>
                  <span className="shrink-0 font-heading font-bold text-white">
                    {fmtNumTr(r.volume)} kg
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#27272A]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${r.pct}%`,
                      backgroundColor: accent,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Exercises */}
      <div className="space-y-3" data-testid="history-detail-exercises">
        {w.exercises.map((e, i) => (
          <ExerciseSession key={e.exercise_id} e={e} index={i} />
        ))}
      </div>

      {/* Repeat CTA */}
      <Link
        to={`/workouts/new?from=${w.id}`}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#84CC16]/40 bg-[#1A2210] py-3 font-heading text-sm font-bold text-[#84CC16] transition-colors hover:bg-[#84CC16] hover:text-[#0B0B0D]"
      >
        <Play className="h-4 w-4" aria-hidden />
        Bu Antrenmanı Tekrar Et
      </Link>
    </div>
  );
}

// ---- StatTile ------------------------------------------------------------
function StatTile({
  icon,
  label,
  value,
  testid,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  testid: string;
}) {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#141416] p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        <span className="text-[#84CC16]">{icon}</span>
        {label}
      </div>
      <p
        className="mt-1 truncate font-heading text-base font-extrabold text-white"
        data-testid={testid}
      >
        {value}
      </p>
    </div>
  );
}

// ---- ExerciseSession -----------------------------------------------------
const ExerciseSession = memo(function ExerciseSession({
  e,
  index,
}: {
  e: Workout["exercises"][number];
  index: number;
}) {
  const n = index + 1;
  const completedVolume = e.sets.reduce(
    (a, s) => a + (s.completed ? (s.weight_kg ?? 0) * (s.reps ?? 0) : 0),
    0
  );
  const completedCount = e.sets.filter((s) => s.completed).length;

  return (
    <section
      className="rounded-lg border border-[#27272A] bg-[#141416] p-4"
      data-testid={`history-exercise-${n}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-baseline gap-2 font-heading text-base font-bold text-white">
            <span className="font-heading text-xs font-bold text-[#84CC16]">
              {String(e.order).padStart(2, "0")}
            </span>
            <span className="truncate">{e.name}</span>
          </h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {completedCount}/{e.sets.length} set ·{" "}
            {fmtNumTr(completedVolume)} kg
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="rounded-md bg-[#1A2210] px-2 py-0.5 font-heading text-[11px] font-bold text-[#84CC16]">
            %{e.activation}
          </span>
          <span className="mt-0.5 text-[9px] uppercase tracking-wide text-zinc-500">
            aktivasyon
          </span>
        </div>
      </div>

      {/* Activation bar */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#1F1F23]">
        <div
          className="h-full rounded-full bg-[#84CC16]/70"
          style={{
            width: `${Math.min(100, Math.max(0, e.activation))}%`,
          }}
        />
      </div>

      <div
        className="mt-3 grid grid-cols-3 gap-2"
        data-testid={`history-sets-${n}`}
      >
        {e.sets.map((s) => (
          <div
            key={s.index}
            className={
              s.completed
                ? "rounded-md border border-[#84CC16]/40 bg-[#141A0E] p-2 text-center"
                : "rounded-md border border-[#27272A] bg-[#18181B] p-2 text-center opacity-50"
            }
            data-testid={`history-set-${n}-${s.index + 1}`}
          >
            <p className="text-[10px] text-zinc-400">SET {s.index + 1}</p>
            <p className="mt-0.5 font-heading text-xs font-bold text-white">
              {s.completed
                ? `${fmtNumTr(s.weight_kg ?? 0)} kg × ${s.reps ?? 0}`
                : "—"}
            </p>
          </div>
        ))}
      </div>

      {e.note && (
        <p
          className="mt-3 flex gap-2 rounded-md border border-[#27272A] bg-[#18181B] p-2.5 text-xs leading-relaxed text-zinc-300"
          data-testid={`history-note-${n}`}
        >
          <StickyNote
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500"
            aria-hidden
          />
          {e.note}
        </p>
      )}
    </section>
  );
});