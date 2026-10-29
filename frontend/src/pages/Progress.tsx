import {
  memo,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Dumbbell,
  Flame,
  Layers,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Weight,
  type LucideIcon,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { MUSCLES, type MuscleDetail, type Summary } from "@/lib/types";
import { MUSCLE_TR, fmtDateShortTr, fmtNumTr, localDate } from "@/lib/tr";
import { qk } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import BodyViewer from "@/components/progress/BodyViewer";

/* ─────────────────────────── helpers ─────────────────────────── */

type Trend = { dir: "up" | "down" | "flat"; pct: number } | null;

function haptic(ms = 6) {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(ms);
  } catch {
    /* no-op */
  }
}

function computeTrend(progression: MuscleDetail["progression"]): Trend {
  if (progression.length < 2) return null;
  const last = progression[progression.length - 1]?.volume ?? 0;
  const prev = progression[progression.length - 2]?.volume ?? 0;
  if (prev === 0 && last === 0) return null;
  if (prev === 0) return { dir: "up", pct: 100 };
  const change = ((last - prev) / prev) * 100;
  if (Math.abs(change) < 3) return { dir: "flat", pct: Math.abs(change) };
  return { dir: change > 0 ? "up" : "down", pct: Math.abs(change) };
}

function computeStreak(progression: MuscleDetail["progression"]): number {
  let streak = 0;
  for (let i = progression.length - 1; i >= 0; i--) {
    if ((progression[i]?.volume ?? 0) > 0) streak++;
    else break;
  }
  return streak;
}

/* ─────────────────────────── page ─────────────────────────── */

export default function Progress() {
  const [selected, setSelected] = useState<string>("biceps");
  const [chartWeeks, setChartWeeks] = useState<4 | 8 | 12>(8);

  const { data: summary } = useQuery({
    queryKey: qk.summary(localDate()),
    queryFn: () => apiGet<Summary>(`/summary?today=${localDate()}`),
    retry: false,
    staleTime: 30_000,
  });

  const { data: d, isFetching } = useQuery({
    queryKey: qk.muscle(selected, localDate()),
    queryFn: () =>
      apiGet<MuscleDetail>(`/muscles/${selected}?today=${localDate()}`),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const hasAny = (summary?.stats.total_workouts ?? 0) > 0;

  const handleSelect = useCallback((m: string) => {
    haptic(6);
    setSelected(m);
  }, []);

  const trend = useMemo(
    () => computeTrend(d?.progression ?? []),
    [d?.progression],
  );
  const streak = useMemo(
    () => computeStreak(d?.progression ?? []),
    [d?.progression],
  );

  const visibleProgression = useMemo(
    () => (d?.progression ?? []).slice(-chartWeeks),
    [d?.progression, chartWeeks],
  );

  const hasVolume = (d?.progression ?? []).some((p) => p.volume > 0);

  return (
    <div
      className="space-y-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:space-y-6"
      data-testid="progress-page"
    >
      {/* ─── Header ─────────────────────────────────────── */}
      <header>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Gelişim
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">
          Kas grubuna göre ilerlemeni, hacmini ve rekorlarını takip et.
        </p>
      </header>

      {!hasAny && <EmptyOverall />}

      <div className="grid gap-5 md:grid-cols-[300px_1fr]">
        <BodyViewer selected={selected} onSelect={handleSelect} />

        <div className="min-w-0 space-y-4">
          <MuscleTabs selected={selected} onSelect={handleSelect} />

          {d ? (
            <>
              <MuscleHero muscle={selected} d={d} streak={streak} />
              <StatGrid d={d} trend={trend} loading={isFetching} />

              {hasVolume && (
                <VolumeChart
                  progression={visibleProgression}
                  weeks={chartWeeks}
                  onWeeksChange={setChartWeeks}
                />
              )}

              <RecordsList records={d.records} />
            </>
          ) : (
            <DetailSkeleton />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── empty ─────────────────────────── */

function EmptyOverall() {
  return (
    <div
      className="rounded-lg border border-[#27272A] bg-[#141416] p-4"
      data-testid="progress-empty"
    >
      <p className="flex items-center gap-2 font-heading text-sm text-zinc-400">
        <Dumbbell className="h-4 w-4 text-[#84CC16]" aria-hidden />
        Henüz antrenman verisi yok. İlk antrenmanını tamamladığında burada
        ilerlemeni göreceksin.
      </p>
    </div>
  );
}

/* ─────────────────────────── tabs ─────────────────────────── */

function MuscleTabs({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (m: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Kas grupları"
      data-testid="muscle-tabs"
      className="flex flex-wrap gap-1.5"
    >
      {MUSCLES.map((m) => {
        const active = selected === m;
        return (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onSelect(m)}
            data-testid={`muscle-tab-${m}`}
            className={cn(
              "min-h-9 rounded-md border px-2.5 text-[11px] font-bold transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84CC16]/40",
              active
                ? "border-[#84CC16] bg-[#1E2B0E] text-[#84CC16]"
                : "border-[#27272A] bg-[#141416] text-zinc-400 hover:text-white",
            )}
          >
            {MUSCLE_TR[m] ?? m}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── hero ─────────────────────────── */

function MuscleHero({
  muscle,
  d,
  streak,
}: {
  muscle: string;
  d: MuscleDetail;
  streak: number;
}) {
  const ratio =
    d.weekly_limit > 0
      ? Math.min(1, d.sessions_this_week / d.weekly_limit)
      : 0;
  const remaining = Math.max(0, d.weekly_limit - d.sessions_this_week);
  const todayDone = d.status === "TODAY_DONE";
  const limitReached = d.status === "LIMIT_REACHED";

  return (
    <section className="overflow-hidden rounded-xl border border-[#84CC16]/60 bg-gradient-to-br from-[#1A2210] to-[#141A0E] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#84CC16]">
            Bu hafta · {MUSCLE_TR[muscle] ?? muscle}
          </p>
          <p className="mt-1 font-heading text-2xl font-extrabold tabular-nums tracking-tight text-white">
            {d.sessions_this_week}
            <span className="text-zinc-500"> / {d.weekly_limit}</span>
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-zinc-400">
            {todayDone ? (
              <span className="text-[#84CC16]">Bugün tamamlandı</span>
            ) : limitReached ? (
              "Haftalık limit doldu"
            ) : remaining > 0 ? (
              `${remaining} antrenman kaldı`
            ) : (
              "Bu hafta için hazır"
            )}
            {streak >= 2 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                <Flame className="h-3 w-3" aria-hidden />
                {streak} hafta
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-1" aria-hidden>
        {Array.from({ length: Math.max(1, d.weekly_limit) }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < d.sessions_this_week ? "bg-[#84CC16]" : "bg-[#27272A]",
            )}
          />
        ))}
      </div>

      <p className="mt-1.5 text-right text-[10px] font-bold tabular-nums text-zinc-500">
        %{Math.round(ratio * 100)}
      </p>
    </section>
  );
}

/* ─────────────────────────── stats ─────────────────────────── */

type Tile = {
  key: string;
  label: string;
  testid: string;
  icon: LucideIcon;
  value: (d: MuscleDetail) => string;
  progress?: (d: MuscleDetail) => number;
  trend?: Trend;
};

function StatGrid({
  d,
  trend,
  loading,
}: {
  d: MuscleDetail;
  trend: Trend;
  loading: boolean;
}) {
  const tiles: Tile[] = useMemo(
    () => [
      {
        key: "week",
        label: "Bu hafta",
        testid: "stat-week",
        icon: Target,
        value: (x) => `${x.sessions_this_week} / ${x.weekly_limit}`,
        progress: (x) =>
          x.weekly_limit > 0
            ? Math.min(1, x.sessions_this_week / x.weekly_limit)
            : 0,
      },
      {
        key: "sessions",
        label: "Toplam antrenman",
        testid: "stat-sessions",
        icon: Dumbbell,
        value: (x) => String(x.total_sessions),
      },
      {
        key: "sets",
        label: "Toplam set",
        testid: "stat-sets",
        icon: Layers,
        value: (x) => String(x.total_sets),
      },
      {
        key: "volume",
        label: "Toplam hacim",
        testid: "stat-volume",
        icon: Weight,
        value: (x) => `${fmtNumTr(x.total_volume)} kg`,
        trend,
      },
      {
        key: "best",
        label: "En iyi ağırlık",
        testid: "stat-best",
        icon: Trophy,
        value: (x) => (x.best_weight ? `${fmtNumTr(x.best_weight)} kg` : "—"),
      },
      {
        key: "consistency",
        label: "Düzenlilik",
        testid: "stat-consistency",
        icon: Flame,
        value: (x) => `%${x.consistency}`,
        progress: (x) => Math.min(1, Math.max(0, x.consistency / 100)),
      },
    ],
    [trend],
  );

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2.5 sm:grid-cols-3",
        loading && "opacity-70 transition-opacity",
      )}
      data-testid="muscle-stats"
    >
      {tiles.map((t) => (
        <StatTile key={t.key} tile={t} d={d} />
      ))}
    </div>
  );
}

function StatTile({ tile, d }: { tile: Tile; d: MuscleDetail }) {
  const Icon = tile.icon;
  const progress = tile.progress?.(d);

  return (
    <div className="rounded-lg border border-[#27272A] bg-[#141416] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-zinc-400">
          <Icon className="h-3 w-3 text-[#84CC16]" aria-hidden />
          {tile.label}
        </span>
        {tile.trend && <TrendPill trend={tile.trend} />}
      </div>

      <p
        className="mt-1.5 font-heading text-xl font-extrabold tabular-nums tracking-tight text-white sm:text-2xl"
        data-testid={tile.testid}
      >
        {tile.value(d)}
      </p>

      {progress !== undefined && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#18181B]"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-[#84CC16] transition-[width] duration-700 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

function TrendPill({ trend }: { trend: NonNullable<Trend> }) {
  const { dir, pct } = trend;
  const Icon =
    dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;
  const cls =
    dir === "up"
      ? "text-[#84CC16]"
      : dir === "down"
        ? "text-red-400"
        : "text-zinc-500";

  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-[10px] font-bold tabular-nums",
        cls,
      )}
      title="Önceki haftaya göre"
    >
      <Icon className="h-3 w-3" aria-hidden />
      {dir === "flat" ? "0%" : `${pct.toFixed(0)}%`}
    </span>
  );
}

/* ─────────────────────────── records ─────────────────────────── */

function RecordsList({ records }: { records: MuscleDetail["records"] }) {
  return (
    <section className="space-y-2.5">
      <SectionTitle icon={Trophy}>Kişisel rekorlar</SectionTitle>

      {records.length === 0 ? (
        <p
          className="rounded-lg border border-[#27272A] bg-[#141416] p-4 text-sm text-zinc-400"
          data-testid="records-empty"
        >
          Bu kas grubu için henüz rekor yok.
        </p>
      ) : (
        <div className="space-y-2" data-testid="records-list">
          {records.map((r, i) => (
            <RecordItem key={r.exercise_name} record={r} rank={i} />
          ))}
        </div>
      )}
    </section>
  );
}

function RecordItem({
  record,
  rank,
}: {
  record: MuscleDetail["records"][number];
  rank: number;
}) {
  const medal =
    rank === 0 ? "gold" : rank === 1 ? "silver" : rank === 2 ? "bronze" : null;

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-[#27272A] bg-[#141416] p-3"
      data-testid={`record-item-${rank}`}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-heading text-xs font-extrabold tabular-nums",
          medal === "gold" &&
            "border border-amber-500/40 bg-amber-500/10 text-amber-300",
          medal === "silver" &&
            "border border-zinc-400/40 bg-zinc-400/10 text-zinc-200",
          medal === "bronze" &&
            "border border-orange-500/40 bg-orange-500/10 text-orange-300",
          !medal &&
            "border border-[#27272A] bg-[#18181B] text-[#84CC16]",
        )}
        aria-hidden
      >
        {rank + 1}
      </span>

      <span className="min-w-0 flex-1 truncate font-heading text-sm font-bold text-white">
        {record.exercise_name}
      </span>

      <span className="shrink-0 text-right">
        <span className="block font-heading text-sm font-extrabold tabular-nums text-[#84CC16]">
          {fmtNumTr(record.weight_kg)} kg
        </span>
        <span className="block text-[10px] text-zinc-500">
          × {record.reps} tekrar
        </span>
      </span>
    </div>
  );
}

function SectionTitle({
  children,
  icon: Icon,
}: {
  children: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <h2 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-zinc-400">
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </h2>
  );
}

/* ─────────────────────────── chart ─────────────────────────── */

const VolumeChart = memo(function VolumeChart({
  progression,
  weeks,
  onWeeksChange,
}: {
  progression: MuscleDetail["progression"];
  weeks: 4 | 8 | 12;
  onWeeksChange: (w: 4 | 8 | 12) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const maxVolume = useMemo(
    () => Math.max(1, ...progression.map((p) => p.volume)),
    [progression],
  );
  const avg = useMemo(
    () =>
      progression.length
        ? progression.reduce((s, p) => s + p.volume, 0) / progression.length
        : 0,
    [progression],
  );
  const avgPct = (avg / maxVolume) * 100;
  const labelEvery = progression.length <= 8 ? 1 : 2;

  return (
    <section className="rounded-lg border border-[#27272A] bg-[#141416] p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-extrabold text-white">
            Haftalık hacim
          </h2>
          <p className="mt-0.5 text-[11px] font-semibold text-zinc-500">
            Ortalama{" "}
            <span className="tabular-nums text-zinc-300">
              {fmtNumTr(Math.round(avg))} kg
            </span>
          </p>
        </div>

        <div className="flex gap-0.5 rounded-md border border-[#27272A] bg-[#18181B] p-0.5">
          {([4, 8, 12] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => {
                haptic(6);
                onWeeksChange(w);
              }}
              aria-pressed={weeks === w}
              className={cn(
                "min-h-7 rounded px-2 text-[10px] font-bold tabular-nums transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84CC16]/40",
                weeks === w
                  ? "bg-[#84CC16] text-[#09090B]"
                  : "text-zinc-500 hover:text-white",
              )}
            >
              {w}H
            </button>
          ))}
        </div>
      </header>

      <div className="relative mt-5">
        <div
          className="relative flex h-32 items-end gap-1 sm:h-40 sm:gap-1.5"
          data-testid="volume-bars"
          onMouseLeave={() => setHover(null)}
        >
          {avg > 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 z-0 border-t border-dashed border-zinc-700/70"
              style={{ bottom: `${avgPct}%` }}
            />
          )}

          {progression.map((p, i) => {
            const heightPct =
              p.volume > 0 ? Math.max(6, (p.volume / maxVolume) * 100) : 3;
            const isLast = i === progression.length - 1;
            const isHover = hover === i;

            return (
              <button
                key={p.week_start}
                type="button"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${fmtDateShortTr(p.week_start)}: ${fmtNumTr(
                  p.volume,
                )} kg`}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "w-full max-w-[44px] rounded-t-md transition-all duration-300",
                    p.volume > 0
                      ? isHover
                        ? "bg-[#A3E635]"
                        : isLast
                          ? "bg-[#84CC16]"
                          : "bg-[#84CC16]/55 group-hover:bg-[#84CC16]/85"
                      : "bg-[#27272A]",
                  )}
                  style={{ height: `${heightPct}%` }}
                />
              </button>
            );
          })}
        </div>

        {hover !== null && progression[hover] && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-2"
            style={{
              left: `${((hover + 0.5) / progression.length) * 100}%`,
              bottom: `${(progression[hover].volume / maxVolume) * 100}%`,
            }}
          >
            <div className="whitespace-nowrap rounded-md border border-[#27272A] bg-[#141416] px-2 py-1 text-center shadow-xl">
              <p className="font-heading text-[10px] font-extrabold tabular-nums text-white">
                {fmtNumTr(progression[hover].volume)} kg
              </p>
              <p className="text-[9px] text-zinc-500">
                {fmtDateShortTr(progression[hover].week_start)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-1" aria-hidden>
        {progression.map((p, i) => (
          <div key={p.week_start} className="flex-1 text-center">
            {i % labelEvery === 0 && (
              <span className="text-[9px] text-zinc-500">
                {fmtDateShortTr(p.week_start)}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
});

/* ─────────────────────────── skeleton ─────────────────────────── */

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]"
          />
        ))}
      </div>
      <div className="h-52 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]" />
    </div>
  );
}