import { memo, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Trophy,
  Search,
  X,
  Flame,
  Dumbbell,
  TrendingUp,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Workout } from "@/lib/types";
import { MUSCLE_TR, fmtDateShortTr, fmtNumTr } from "@/lib/tr";
import { qk } from "@/lib/queryKeys";

// ---- Muscle accent colors ------------------------------------------------
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

// ---- Date grouping helpers ----------------------------------------------
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const startOfWeek = (d: Date) => {
  const x = startOfDay(d);
  const diff = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - diff);
  return x;
};
const startOfMonth = (d: Date) => {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
};

function groupLabel(dateStr: string, now = new Date()): string {
  const d = startOfDay(new Date(dateStr));
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.getTime() === today.getTime()) return "Bugün";
  if (d.getTime() === yesterday.getTime()) return "Dün";

  const week = startOfWeek(now);
  if (d >= week) return "Bu Hafta";

  const lastWeek = new Date(week);
  lastWeek.setDate(lastWeek.getDate() - 7);
  if (d >= lastWeek) return "Geçen Hafta";

  const month = startOfMonth(now);
  if (d >= month) return "Bu Ay";

  return d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

// ---- Page ----------------------------------------------------------------
export default function History() {
  const [query, setQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: qk.workouts("history"),
    queryFn: () => apiGet<Workout[]>("/workouts?status=completed&limit=100"),
    staleTime: 60_000,
  });

  const muscles = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.map((w) => w.muscle)));
  }, [data]);

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const now = new Date();
    const thisMonth = data.filter((w) => {
      const d = new Date(w.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalVolume = thisMonth.reduce((a, w) => a + (w.total_volume || 0), 0);
    const counts = new Map<string, number>();
    thisMonth.forEach((w) => counts.set(w.muscle, (counts.get(w.muscle) ?? 0) + 1));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      monthCount: thisMonth.length,
      totalVolume,
      topMuscle: top?.[0] ?? null,
      topCount: top?.[1] ?? 0,
    };
  }, [data]);

  const groups = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const filtered = data.filter((w) => {
      if (muscleFilter && w.muscle !== muscleFilter) return false;
      if (!q) return true;
      const label = (MUSCLE_TR[w.muscle] ?? w.muscle).toLowerCase();
      return (
        label.includes(q) ||
        w.exercises.some((e) => e.name.toLowerCase().includes(q))
      );
    });
    const out: { label: string; items: Workout[] }[] = [];
    let cur: { label: string; items: Workout[] } | null = null;
    for (const w of filtered) {
      const label = groupLabel(w.date);
      if (!cur || cur.label !== label) {
        cur = { label, items: [] };
        out.push(cur);
      }
      cur.items.push(w);
    }
    return out;
  }, [data, muscleFilter, query]);

  const totalShown = groups.reduce((a, g) => a + g.items.length, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Antrenman Geçmişi
        </h1>
        {data && data.length > 0 && (
          <p className="mt-1 text-sm text-zinc-400">
            {data.length} antrenman kaydı
          </p>
        )}
      </div>

      {/* Monthly summary */}
      {stats && data && data.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard
            icon={<Flame className="h-3.5 w-3.5" />}
            label="Bu Ay"
            value={String(stats.monthCount)}
            suffix="antrenman"
          />
          <StatCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Hacim"
            value={fmtNumTr(stats.totalVolume)}
            suffix="kg"
          />
          <StatCard
            icon={<Dumbbell className="h-3.5 w-3.5" />}
            label="Odak"
            value={
              stats.topMuscle
                ? MUSCLE_TR[stats.topMuscle] ?? stats.topMuscle
                : "—"
            }
            suffix={stats.topCount > 0 ? `${stats.topCount}×` : ""}
            accent={stats.topMuscle ? muscleColor(stats.topMuscle) : undefined}
          />
        </div>
      )}

      {/* Search + filter */}
      {data && data.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Egzersiz veya kas grubu ara..."
              className="w-full rounded-lg border border-[#27272A] bg-[#141416] py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-zinc-500 focus:border-[#84CC16]/60 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-[#27272A] hover:text-white"
                aria-label="Aramayı temizle"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {muscles.length > 1 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              <FilterChip
                active={muscleFilter === null}
                onClick={() => setMuscleFilter(null)}
                label="Tümü"
              />
              {muscles.map((m) => (
                <FilterChip
                  key={m}
                  active={muscleFilter === m}
                  onClick={() =>
                    setMuscleFilter(muscleFilter === m ? null : m)
                  }
                  label={MUSCLE_TR[m] ?? m}
                  color={muscleColor(m)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[84px] animate-pulse rounded-lg border border-[#27272A] bg-[#141416]"
            />
          ))}
        </div>
      )}

      {/* Empty */}
      {data && data.length === 0 && <EmptyState />}

      {/* No results */}
      {data && data.length > 0 && totalShown === 0 && (
        <div className="rounded-lg border border-[#27272A] bg-[#141416] p-6 text-center">
          <p className="text-sm text-zinc-400">Eşleşen antrenman bulunamadı.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setMuscleFilter(null);
            }}
            className="mt-3 text-xs font-semibold text-[#84CC16] hover:underline"
          >
            Filtreleri temizle
          </button>
        </div>
      )}

      {/* Grouped list */}
      <div className="space-y-5" data-testid="history-list">
        {groups.map((g) => (
          <section key={g.label} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <h2 className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                {g.label}
              </h2>
              <span className="text-[10px] text-zinc-600">
                · {g.items.length}
              </span>
              <div className="h-px flex-1 bg-[#27272A]" />
            </div>
            {g.items.map((w) => (
              <HistoryRow key={w.id} w={w} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

// ---- Row -----------------------------------------------------------------
const HistoryRow = memo(function HistoryRow({ w }: { w: Workout }) {
  const accent = muscleColor(w.muscle);
  const hasPR = w.prs.length > 0;

  return (
    <Link
      to={`/history/${w.id}`}
      data-testid={`history-item-${w.id}`}
      className="group relative flex items-center gap-4 overflow-hidden rounded-lg border border-[#27272A] bg-[#141416] p-4 pl-5 transition-all hover:border-[#3F3F46] hover:bg-[#18181B]"
    >
      <span
        className="absolute left-0 top-0 h-full w-1"
        style={{ backgroundColor: accent }}
        aria-hidden
      />

      <div className="w-14 shrink-0 text-center">
        <p className="font-heading text-sm font-extrabold text-white">
          {fmtDateShortTr(w.date)}
        </p>
        <p
          className="mt-0.5 font-heading text-xs font-bold"
          style={{ color: accent }}
          data-testid={`history-clock-${w.id}`}
        >
          {w.start_clock || "—"}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="truncate font-heading text-base font-extrabold tracking-tight text-white"
          data-testid={`history-muscle-${w.id}`}
        >
          {MUSCLE_TR[w.muscle] ?? w.muscle}
        </p>
        <p
          className="truncate text-xs text-zinc-400"
          data-testid={`history-exercises-${w.id}`}
        >
          {w.exercises.map((e) => e.name).join(" · ")}
        </p>
        <p
          className="mt-0.5 text-[11px] text-zinc-500"
          data-testid={`history-meta-${w.id}`}
        >
          {w.completed_sets} set · {fmtNumTr(w.total_volume)} kg
        </p>
      </div>

      {hasPR && (
        <span
          className="flex shrink-0 items-center gap-1 rounded-md border border-[#84CC16] bg-[#1A2210] px-2 py-1 text-[10px] font-bold text-[#84CC16]"
          data-testid={`history-pr-${w.id}`}
        >
          <Trophy className="h-3 w-3" aria-hidden /> {w.prs.length} PR
        </span>
      )}

      <ChevronRight
        className="h-4 w-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400"
        aria-hidden
      />
    </Link>
  );
});

// ---- Bits ----------------------------------------------------------------
function StatCard({
  icon,
  label,
  value,
  suffix,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#141416] p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        <span style={accent ? { color: accent } : { color: "#84CC16" }}>
          {icon}
        </span>
        {label}
      </div>
      <p
        className="mt-1.5 truncate font-heading text-base font-extrabold text-white"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {suffix && <p className="text-[10px] text-zinc-500">{suffix}</p>}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors " +
        (active
          ? "border-[#84CC16] bg-[#1A2210] text-[#84CC16]"
          : "border-[#27272A] bg-[#141416] text-zinc-400 hover:border-[#3F3F46] hover:text-white")
      }
    >
      {color && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-lg border border-[#27272A] bg-[#141416] p-10 text-center"
      data-testid="history-empty"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1A2210]">
        <Dumbbell className="h-5 w-5 text-[#84CC16]" aria-hidden />
      </div>
      <p className="mt-3 font-heading text-sm font-bold text-white">
        Henüz antrenman verisi yok.
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        İlk antrenmanını tamamladığında burada görünecek.
      </p>
    </div>
  );
}