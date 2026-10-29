import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  Check,
  GripVertical,
  Lock,
  Play,
} from "lucide-react";
import { apiGet, apiPut } from "@/lib/api";
import {
  MUSCLES,
  type MuscleStatus,
  type Profile,
  type Summary,
} from "@/lib/types";
import { MUSCLE_TR, fmtNumTr, greetingTr, localDate } from "@/lib/tr";
import { qk } from "@/lib/queryKeys";
import { usePrefetchWorkout } from "@/lib/hooks/usePrefetch";
import { useActiveWorkoutGuard } from "@/lib/hooks/useActiveWorkoutGuard";
import type { ActiveWorkoutInfo } from "@/lib/activeWorkout";
import { cn } from "@/lib/utils";

const FULL_STATES = new Set(["TODAY_DONE", "LIMIT_REACHED"]);

const isFullStatus = (s: MuscleStatus | undefined) =>
  FULL_STATES.has(s?.status ?? "AVAILABLE");

/** Profilden gelen muscle_order'ı normalize et (eksikleri sona ekle). */
function normalizeOrder(saved: string[] | undefined): string[] {
  const valid = (saved ?? []).filter(
    (m): m is string =>
      typeof m === "string" && (MUSCLES as readonly string[]).includes(m),
  );
  return [...valid, ...MUSCLES.filter((m) => !valid.includes(m))];
}

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: qk.summary(localDate()),
    queryFn: () => apiGet<Summary>(`/summary?today=${localDate()}`),
    retry: false,
    staleTime: 30_000,
  });

  // 🆕 Profil (kas sırası buradan geliyor)
  const { data: profile } = useQuery({
    queryKey: qk.profile(),
    queryFn: () => apiGet<Profile>("/profile"),
    staleTime: 5 * 60_000,
  });

  const { info: activeInfo } = useActiveWorkoutGuard();

  // Yerel sıra state'i (optimistic — drag anında görsel değişsin diye)
  const [order, setOrder] = useState<string[]>(() => normalizeOrder(undefined));

  // Profile yüklendiğinde sırayı ondan al
  useEffect(() => {
    if (profile?.muscle_order) {
      setOrder(normalizeOrder(profile.muscle_order));
    }
  }, [profile?.muscle_order]);

  // 🆕 Drag sonunda sırayı backend'e kaydet (optimistic update)
  const saveOrder = useMutation({
    mutationFn: (muscleOrder: string[]) =>
      apiPut<Profile>("/profile/muscle-order", {
        muscle_order: muscleOrder,
      }),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: qk.profile() });
      const prev = queryClient.getQueryData<Profile>(qk.profile());
      if (prev) {
        queryClient.setQueryData<Profile>(qk.profile(), {
          ...prev,
          muscle_order: next,
        });
      }
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(qk.profile(), ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.profile() });
    },
  });

  const byMuscle = useMemo(
    () =>
      new Map<string, MuscleStatus>(
        (data?.muscles ?? []).map((m) => [m.muscle, m]),
      ),
    [data?.muscles],
  );

  const limit = data?.weekly_limit ?? 2;
  const hasHistory = (data?.stats.total_workouts ?? 0) > 0;
  const planned = data?.today_planned_muscles ?? [];

  const nextPlanned = useMemo(
    () =>
      planned.find(
        (m) => (byMuscle.get(m)?.status ?? "AVAILABLE") === "AVAILABLE",
      ),
    [planned, byMuscle],
  );

  const isActiveInPlan = !!activeInfo && planned.includes(activeInfo.muscle);

  const orderedMuscles = useMemo(() => {
    const rank = new Map(order.map((m, i) => [m, i]));
    const sorted = [...MUSCLES].sort(
      (a, b) =>
        (rank.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b) ?? Number.MAX_SAFE_INTEGER),
    );
    const free: string[] = [];
    const full: string[] = [];
    for (const m of sorted) {
      (isFullStatus(byMuscle.get(m)) ? full : free).push(m);
    }
    return [...free, ...full];
  }, [order, byMuscle]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{
    x: number;
    y: number;
    label: string;
  } | null>(null);

  const prefetchWorkout = usePrefetchWorkout();

  const handlePick = useCallback(
    (muscle: string) => {
      if (activeInfo && activeInfo.muscle !== muscle) {
        navigate(`/workout/${activeInfo.muscle}`);
        return;
      }
      navigate(`/workout/${muscle}`);
    },
    [navigate, activeInfo],
  );

  const handleHover = useCallback(
    (muscle: string) => prefetchWorkout(muscle),
    [prefetchWorkout],
  );

  const handleDragStart = useCallback(
    (e: React.PointerEvent, muscle: string) => {
      if (isLoading) return;
      e.preventDefault();

      const muscleIsFull = isFullStatus(byMuscle.get(muscle));
      const label = MUSCLE_TR[muscle] ?? muscle;
      let currentOver: string | null = null;
      let rafId: number | null = null;
      let lastEv: PointerEvent | null = null;

      const process = () => {
        rafId = null;
        const ev = lastEv;
        if (!ev) return;
        setGhost({ x: ev.clientX, y: ev.clientY, label });
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const target =
          (el?.closest("[data-muscle]") as HTMLElement | null)?.dataset
            .muscle ?? null;
        if (
          target &&
          target !== muscle &&
          isFullStatus(byMuscle.get(target)) === muscleIsFull
        ) {
          currentOver = target;
          setOverId(target);
        } else {
          currentOver = null;
          setOverId(null);
        }
      };

      const onMove = (ev: PointerEvent) => {
        ev.preventDefault();
        lastEv = ev;
        if (rafId === null) rafId = requestAnimationFrame(process);
      };

      const finish = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        document.body.classList.remove("select-none");

        const target = currentOver;
        setDragId(null);
        setOverId(null);
        setGhost(null);

        if (target) {
          setOrder((prev) => {
            const from = prev.indexOf(muscle);
            const to = prev.indexOf(target);
            if (from < 0 || to < 0 || from === to) return prev;
            const next = prev.slice();
            next.splice(from, 1);
            next.splice(to, 0, muscle);
            // 🆕 Backend'e kaydet
            saveOrder.mutate(next);
            return next;
          });
        }
      };

      document.body.classList.add("select-none");
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
      setDragId(muscle);
      setGhost({ x: e.clientX, y: e.clientY, label });
    },
    [isLoading, byMuscle, saveOrder],
  );

  return (
    <div className="space-y-7">
      {activeInfo && !isActiveInPlan && (
        <ActiveWorkoutBanner info={activeInfo} />
      )}

      <header>
        <p className="text-sm font-medium text-zinc-400" data-testid="greeting">
          {greetingTr()}
        </p>
        <h1
          className="mt-1.5 font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl"
          data-testid="home-headline"
        >
          BUGÜN NE ÇALIŞIYORSUN?
        </h1>
      </header>

      <TodayPlanCard
        planned={planned}
        byMuscle={byMuscle}
        nextPlanned={nextPlanned}
        activeInfo={activeInfo}
        isActiveInPlan={isActiveInPlan}
        onFollow={handlePick}
        onHover={handleHover}
      />

      <div
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
        data-testid="muscle-picker"
      >
        {orderedMuscles.map((m) => (
          <MuscleCard
            key={m}
            muscle={m}
            status={byMuscle.get(m)}
            limit={limit}
            loading={isLoading}
            dragging={dragId === m}
            isOver={overId === m}
            onPick={handlePick}
            onHover={handleHover}
            onDragStart={handleDragStart}
          />
        ))}
      </div>

      {hasHistory ? (
        <section className="grid grid-cols-3 gap-2.5" data-testid="home-stats">
          {[
            {
              label: "Antrenman",
              value: String(data!.stats.total_workouts),
              testid: "home-stat-workouts",
            },
            {
              label: "Toplam set",
              value: String(data!.stats.total_sets),
              testid: "home-stat-sets",
            },
            {
              label: "Toplam hacim",
              value: `${fmtNumTr(data!.stats.total_volume)} kg`,
              testid: "home-stat-volume",
            },
          ].map((t) => (
            <div
              key={t.label}
              className="rounded-lg border border-[#27272A] bg-[#141416] p-3.5"
            >
              <p className="text-[11px] font-semibold tracking-wide text-zinc-400">
                {t.label}
              </p>
              <p
                className="mt-1 font-heading text-xl font-extrabold tracking-tight text-white sm:text-2xl"
                data-testid={t.testid}
              >
                {t.value}
              </p>
            </div>
          ))}
        </section>
      ) : (
        !isLoading && (
          <p
            className="rounded-lg border border-[#27272A] bg-[#141416] p-4 text-sm text-zinc-400"
            data-testid="home-empty"
          >
            Henüz antrenman verisi yok.
          </p>
        )
      )}

      {ghost && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[#84CC16]/70 bg-[#141416] px-4 py-3 font-heading text-lg font-extrabold tracking-tight text-white shadow-2xl shadow-black/60"
          style={{ left: ghost.x, top: ghost.y }}
        >
          {ghost.label}
        </div>
      )}
    </div>
  );
}

/* Aktif antrenman kartı — SADECE plan dışı antrenmanlar için görünür */
const ActiveWorkoutBanner = memo(function ActiveWorkoutBanner({
  info,
}: {
  info: ActiveWorkoutInfo;
}) {
  const label = MUSCLE_TR[info.muscle] ?? info.muscle;
  return (
    <Link
      to={`/workout/${info.muscle}`}
      data-testid="active-workout-banner"
      className="group block overflow-hidden rounded-xl border border-[#84CC16]/60 bg-gradient-to-br from-[#1A2210] to-[#141A0E] p-4 transition-all duration-200 hover:border-[#84CC16] hover:shadow-[0_0_24px_-4px_rgba(132,204,22,0.4)]"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#84CC16] opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#84CC16]" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#84CC16]">
            PLAN DIŞI ANTRENMAN DEVAM EDİYOR
          </p>
          <p className="mt-0.5 truncate font-heading text-lg font-extrabold tracking-tight text-white">
            {label}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-zinc-400">
            Başlangıç {info.startClock || "—"}
          </p>
        </div>

        <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-[#84CC16] px-3 py-2 font-heading text-xs font-extrabold text-[#09090B] transition-transform group-hover:scale-[1.03]">
          <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
          DEVAM ET
        </span>
      </div>
    </Link>
  );
});

const MuscleCard = memo(function MuscleCard({
  muscle,
  status,
  limit,
  loading,
  dragging,
  isOver,
  onPick,
  onHover,
  onDragStart,
}: {
  muscle: string;
  status: MuscleStatus | undefined;
  limit: number;
  loading: boolean;
  dragging: boolean;
  isOver: boolean;
  onPick: (muscle: string) => void;
  onHover: (muscle: string) => void;
  onDragStart: (e: React.PointerEvent, muscle: string) => void;
}) {
  const sessions = status?.sessions_this_week ?? 0;
  const state = status?.status ?? "AVAILABLE";
  const todayDone = state === "TODAY_DONE";
  const limitReached = state === "LIMIT_REACHED";
  const disabled = todayDone || limitReached;
  const label = MUSCLE_TR[muscle] ?? muscle;

  const handleClick = useCallback(() => onPick(muscle), [onPick, muscle]);
  const handleHover = useCallback(
    () => !disabled && onHover(muscle),
    [disabled, onHover, muscle],
  );
  const handleDrag = useCallback(
    (e: React.PointerEvent) => onDragStart(e, muscle),
    [onDragStart, muscle],
  );

  return (
    <div
      data-muscle={muscle}
      data-testid={`muscle-card-${muscle}`}
      aria-disabled={disabled}
      onPointerEnter={handleHover}
      onTouchStart={handleHover}
      className={cn(
        "relative flex min-h-[112px] flex-col justify-between rounded-lg border p-4 text-left transition-all duration-150",
        todayDone && "border-[#84CC16]/40 bg-[#141A0E]",
        limitReached && "border-[#27272A]/60 bg-[#121214] opacity-60",
        !disabled && "border-[#27272A] bg-[#141416] hover:border-[#84CC16]/60",
        dragging && "opacity-30",
        isOver && "ring-2 ring-[#84CC16] ring-offset-2 ring-offset-[#0A0A0B]",
      )}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        aria-label={`${label} antrenmanına başla`}
        className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84CC16] disabled:cursor-not-allowed"
      />

      <span className="pointer-events-none relative z-0 pr-6 font-heading text-lg font-extrabold tracking-tight text-white sm:text-xl">
        {label}
      </span>

      <span className="pointer-events-none relative z-0 space-y-1.5">
        <span className="flex items-center gap-1" aria-hidden>
          {Array.from({ length: limit }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i < sessions ? "bg-[#84CC16]" : "bg-[#27272A]",
              )}
            />
          ))}
        </span>

        {todayDone ? (
          <span
            className="flex items-center gap-1.5 text-[11px] font-bold text-[#84CC16]"
            data-testid={`muscle-state-${muscle}`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden /> BUGÜN TAMAMLANDI
          </span>
        ) : limitReached ? (
          <span
            className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500"
            data-testid={`muscle-state-${muscle}`}
          >
            <Lock className="h-3.5 w-3.5" aria-hidden /> {sessions} / {limit}{" "}
            HAFTALIK LİMİT
          </span>
        ) : (
          <span
            className="block text-[11px] font-semibold text-zinc-400"
            data-testid={`muscle-state-${muscle}`}
          >
            {sessions} / {limit} ANTRENMAN
          </span>
        )}
      </span>

      <button
        type="button"
        tabIndex={-1}
        aria-label={`${label} sırasını değiştir`}
        onPointerDown={handleDrag}
        data-testid={`muscle-drag-${muscle}`}
        className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
});

const TodayPlanCard = memo(function TodayPlanCard({
  planned,
  byMuscle,
  nextPlanned,
  activeInfo,
  isActiveInPlan,
  onFollow,
  onHover,
}: {
  planned: string[];
  byMuscle: Map<string, MuscleStatus>;
  nextPlanned: string | undefined;
  activeInfo: ActiveWorkoutInfo | null;
  isActiveInPlan: boolean;
  onFollow: (m: string) => void;
  onHover: (m: string) => void;
}) {
  const activeInPlan = activeInfo && isActiveInPlan;
  const buttonTarget = activeInPlan ? activeInfo!.muscle : nextPlanned;
  const buttonIsResume = !!activeInPlan;

  const handleFollow = useCallback(() => {
    if (buttonTarget) onFollow(buttonTarget);
  }, [buttonTarget, onFollow]);

  const handleFollowHover = useCallback(() => {
    if (buttonTarget) onHover(buttonTarget);
  }, [buttonTarget, onHover]);

  return (
    <section
      className="rounded-lg border border-[#27272A] bg-[#141416] p-4"
      data-testid="today-plan-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-wide text-[#84CC16]">
            BUGÜNÜN PLANI
          </p>
          {planned.length > 0 ? (
            <p
              className="mt-1 font-heading text-xl font-extrabold tracking-tight text-white"
              data-testid="today-plan-muscles"
            >
              {planned.map((m) => MUSCLE_TR[m] ?? m).join(" + ")}
            </p>
          ) : (
            <p
              className="mt-1 text-sm text-zinc-400"
              data-testid="today-plan-empty"
            >
              Bugün için bir planın yok.
            </p>
          )}
        </div>
        <Link
          to="/planner"
          data-testid="open-planner-link"
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-[#27272A] bg-[#18181B] px-3 py-2 text-[11px] font-bold text-zinc-300 transition-colors hover:border-[#84CC16]/60 hover:text-white"
        >
          <CalendarDays className="h-3.5 w-3.5" aria-hidden /> PLANLAYICI
        </Link>
      </div>

      {planned.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {planned.map((m) => {
              const done = byMuscle.get(m)?.trained_today;
              const isActive = activeInPlan && activeInfo?.muscle === m;
              return (
                <span
                  key={m}
                  data-testid={`today-plan-chip-${m}`}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold",
                    isActive
                      ? "border-[#84CC16] bg-[#84CC16] text-[#09090B]"
                      : done
                        ? "border-[#84CC16]/50 bg-[#1A2210] text-[#84CC16]"
                        : "border-[#27272A] bg-[#18181B] text-zinc-300",
                  )}
                >
                  {isActive ? (
                    <Play className="h-3 w-3 fill-current" aria-hidden />
                  ) : done ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : null}
                  {MUSCLE_TR[m] ?? m}
                </span>
              );
            })}
          </div>
          <button
            onClick={handleFollow}
            onPointerEnter={handleFollowHover}
            onTouchStart={handleFollowHover}
            disabled={!buttonTarget}
            data-testid="follow-plan-button"
            className="flex min-h-12 w-full items-center justify-center rounded-md bg-[#84CC16] font-heading text-sm font-extrabold text-[#09090B] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {buttonTarget ? (
              <>
                {buttonIsResume ? (
                  <>
                    <Play className="mr-1.5 h-4 w-4 fill-current" aria-hidden />
                    ANTRENMANA DEVAM ET · {MUSCLE_TR[buttonTarget]}
                  </>
                ) : (
                  <>
                    PLANA SADIK KAL · {MUSCLE_TR[buttonTarget]}
                    <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
                  </>
                )}
              </>
            ) : (
              "PLANIN BUGÜN TAMAMLANDI"
            )}
          </button>
        </div>
      )}
    </section>
  );
});