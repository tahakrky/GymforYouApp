import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Dumbbell, Search } from "lucide-react";
import { apiGet } from "@/lib/api";
import { MUSCLES, type Exercise, type Profile } from "@/lib/types";
import { DIFFICULTY_TR, MUSCLE_TR, ytThumb } from "@/lib/tr";
import { qk } from "@/lib/queryKeys";
import { usePrefetchExercise } from "@/lib/hooks/usePrefetch";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const SCOPE_OPTIONS = [
  { key: "mine", label: "EKİPMANIM" },
  { key: "all", label: "TÜM EGZERSİZLER" },
] as const;

const MUSCLE_FILTERS = ["all", ...MUSCLES] as const;

export default function Library() {
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState(searchParams.get("muscle") ?? "all");
  const [scope, setScope] = useState<"mine" | "all">("mine");

  // 🆕 Hover'da egzersiz detayını ön-yükle
  const prefetchExercise = usePrefetchExercise();

  const { data: profile } = useQuery({
    queryKey: qk.profile(),
    queryFn: () => apiGet<Profile>("/profile"),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (profile?.equipment_filter_default === "all") setScope("all");
  }, [profile?.equipment_filter_default]);

  // ✅ Arama query'e DAHİL DEĞİL — client-side filtreliyoruz
  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (muscle !== "all") p.set("muscle", muscle);
    p.set("scope", scope);
    return p.toString();
  }, [muscle, scope]);

  const { data, isLoading } = useQuery({
    queryKey: qk.exercises(queryString),
    queryFn: () => apiGet<Exercise[]>(`/exercises?${queryString}`),
    staleTime: 5 * 60_000,
  });

  // ✅ Anında filtre — 0ms gecikme
  const filtered = useMemo(() => {
    if (!data) return data;
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter((e) => {
      const name = e.name.toLowerCase();
      const equipment = (e.equipment_label ?? "").toLowerCase();
      const muscleTr = (MUSCLE_TR[e.muscle] ?? "").toLowerCase();
      return (
        name.includes(term) ||
        equipment.includes(term) ||
        muscleTr.includes(term)
      );
    });
  }, [data, q]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Egzersiz Kütüphanesi
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {filtered ? `${filtered.length} egzersiz` : "Yükleniyor…"}
          {scope === "mine" && profile
            ? ` · ${profile.dumbbell_count} × ${profile.dumbbell_weight_kg} kg dambıl${
                profile.owned_equipment.includes("bench") ? " + sehpa" : ""
              }`
            : ""}
        </p>
      </div>

      <div
        className="grid grid-cols-2 gap-2"
        data-testid="library-scope-toggle"
      >
        {SCOPE_OPTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            data-testid={`library-scope-${s.key}`}
            className={cn(
              "min-h-12 rounded-md border px-4 font-heading text-xs font-bold transition-colors duration-150",
              scope === s.key
                ? "border-[#84CC16] bg-[#84CC16] text-[#09090B]"
                : "border-[#27272A] bg-[#141416] text-zinc-400 hover:text-white",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {scope === "mine" && (
        <p
          className="rounded-lg border border-[#27272A] bg-[#141416] p-3 text-xs leading-relaxed text-zinc-400"
          data-testid="library-scope-note"
        >
          Sadece ekipmanınla yapabileceğin hareketler gösteriliyor.{" "}
          <Link
            to="/profile"
            className="text-[#84CC16] underline underline-offset-4"
          >
            Profil → Ekipman
          </Link>{" "}
          bölümünden yeni ekipman ekleyebilirsin.
        </p>
      )}

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Egzersiz ara…"
          data-testid="library-search-input"
          className="min-h-12 pl-9"
        />
      </div>

      <div
        className="flex flex-wrap gap-1.5"
        data-testid="library-muscle-filters"
      >
        {MUSCLE_FILTERS.map((mKey) => (
          <button
            key={mKey}
            onClick={() => setMuscle(mKey)}
            data-testid={`library-filter-${mKey}`}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-[11px] font-bold transition-colors duration-150",
              muscle === mKey
                ? "border-[#84CC16] bg-[#1E2B0E] text-[#84CC16]"
                : "border-[#27272A] bg-[#141416] text-zinc-400 hover:text-white",
            )}
          >
            {mKey === "all" ? "TÜMÜ" : MUSCLE_TR[mKey]}
          </button>
        ))}
      </div>

      {isLoading && !data && (
        <div className="h-48 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]" />
      )}

      <div
        className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="library-grid"
      >
        {filtered?.map((e) => (
          <Link
            key={e.id}
            to={`/exercises/${e.id}`}
            onPointerEnter={() => prefetchExercise(e.id)}
            onTouchStart={() => prefetchExercise(e.id)}
            data-testid={`exercise-card-${e.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")}`}
            className="group flex flex-col overflow-hidden rounded-lg border border-[#27272A] bg-[#141416] transition-colors hover:border-[#84CC16]/50"
          >
            <div className="relative">
              <img
                src={ytThumb(e.video_id)}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-video w-full object-cover"
                aria-hidden
              />
              <span className="absolute left-2 top-2 rounded-md bg-[#09090B]/85 px-2 py-0.5 text-[10px] font-bold text-white">
                {MUSCLE_TR[e.muscle] ?? e.muscle}
              </span>
              <span className="absolute right-2 top-2 rounded-md bg-[#84CC16] px-2 py-0.5 font-heading text-[10px] font-bold text-[#09090B]">
                %{e.activation}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-heading text-sm font-bold text-white">
                    {e.name}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {e.target_sets} set × {e.rep_range || e.target_reps} ·{" "}
                    {DIFFICULTY_TR[e.difficulty] ?? e.difficulty}
                  </p>
                </div>
                <ChevronRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600"
                  aria-hidden
                />
              </div>
              <p
                className="mt-auto flex items-center gap-1.5 truncate text-[11px] text-zinc-500"
                data-testid={`equipment-label-${e.id}`}
              >
                <Dumbbell className="h-3 w-3 shrink-0" aria-hidden />{" "}
                {e.equipment_label}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {filtered && filtered.length === 0 && (
        <p
          className="rounded-lg border border-[#27272A] bg-[#141416] p-5 text-center text-sm text-zinc-400"
          data-testid="library-empty"
        >
          Bu filtrelere uygun egzersiz bulunamadı.
        </p>
      )}
    </div>
  );
}