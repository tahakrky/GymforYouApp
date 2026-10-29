import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Copy,
  Dumbbell,
  Flame,
  LayoutTemplate,
  Loader2,
  Moon,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPut } from "@/lib/api";
import { DAY_KEYS, MUSCLES, type Profile } from "@/lib/types";
import { DAY_FULL_TR, MUSCLE_TR, apiErrTr } from "@/lib/tr";
import { qk } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ────────────────────────────────────────────────────────────── */
/* Types & helpers                                                */
/* ────────────────────────────────────────────────────────────── */

type Plan = Record<string, string[]>;

const normalizePlan = (raw?: Plan | null): Plan => {
  const out: Plan = {};
  for (const [day, muscles] of Object.entries(raw ?? {})) {
    if (muscles && muscles.length > 0) out[day] = [...muscles];
  }
  return out;
};

const plansEqual = (a: Plan, b: Plan): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const av = [...(a[k] ?? [])].sort().join("|");
    const bv = [...(b[k] ?? [])].sort().join("|");
    if (av !== bv) return false;
  }
  return true;
};

const EMPTY_PICKS: string[] = [];

const PALETTE = [
  { on: "border-lime-500/40 bg-lime-500/10 text-lime-300", dot: "bg-lime-400" },
  { on: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300", dot: "bg-cyan-400" },
  { on: "border-violet-500/40 bg-violet-500/10 text-violet-300", dot: "bg-violet-400" },
  { on: "border-amber-500/40 bg-amber-500/10 text-amber-300", dot: "bg-amber-400" },
  { on: "border-rose-500/40 bg-rose-500/10 text-rose-300", dot: "bg-rose-400" },
  { on: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
  { on: "border-sky-500/40 bg-sky-500/10 text-sky-300", dot: "bg-sky-400" },
  { on: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300", dot: "bg-fuchsia-400" },
] as const;

/** MUSCLES literal union tuple'ını `string` üzerinde kullanılabilir hale getirir. */
const MUSCLE_TUPLE = MUSCLES as readonly string[];
const MUSCLE_SET = new Set<string>(MUSCLE_TUPLE);

const muscleTone = (m: string) => {
  const idx = MUSCLE_TUPLE.indexOf(m);
  return PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length];
};

const DAY_SHORT: Record<string, string> = {
  monday: "Pzt",
  tuesday: "Sal",
  wednesday: "Çar",
  thursday: "Per",
  friday: "Cum",
  saturday: "Cmt",
  sunday: "Paz",
};

/** Bugünün gün anahtarını döner (monday..sunday). */
const todayKey = (): string => {
  const idx = new Date().getDay(); // 0 = Pazar
  return [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ][idx];
};

/** Dokunma geri bildirimi. Destek yoksa sessizce geçer. */
const haptic = (ms = 8) => {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(ms);
  } catch {
    /* no-op */
  }
};

/* ────────────────────────────────────────────────────────────── */
/* Auto-save preference (localStorage)                            */
/* ────────────────────────────────────────────────────────────── */

const AUTOSAVE_KEY = "planner:autosave:v1";

function useAutoSavePref() {
  const [on, setOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(AUTOSAVE_KEY);
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(AUTOSAVE_KEY, on ? "1" : "0");
    } catch {
      /* no-op */
    }
  }, [on]);
  return [on, setOn] as const;
}

/* ────────────────────────────────────────────────────────────── */
/* Presets                                                        */
/* ────────────────────────────────────────────────────────────── */

type PresetDef = {
  id: string;
  name: string;
  short: string;
  tag: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  /** 7 elemanlı — her gün için kas grubu listesi (null = dinlenme). */
  days: (string[] | null)[];
};

const PRESETS: PresetDef[] = [
  {
    id: "ppl",
    name: "Push · Pull · Legs",
    short: "PPL",
    tag: "6 gün",
    desc: "İt / çek / bacak — klasik hacim bölünmesi",
    icon: Flame,
    days: [
      ["chest", "shoulders", "triceps"],
      ["back", "biceps"],
      ["legs"],
      ["chest", "shoulders", "triceps"],
      ["back", "biceps"],
      ["legs"],
      null,
    ],
  },
  {
    id: "upper_lower",
    name: "Upper / Lower",
    short: "Upper/Lower",
    tag: "4 gün",
    desc: "Üst vücut / alt vücut — güç odaklı dengeli split",
    icon: TrendingUp,
    days: [
      ["chest", "back", "shoulders", "biceps", "triceps"],
      ["legs"],
      null,
      ["chest", "back", "shoulders", "biceps", "triceps"],
      ["legs"],
      null,
      null,
    ],
  },
  {
    id: "full",
    name: "Full Body",
    short: "Full",
    tag: "3 gün",
    desc: "Tüm vücut — yoğun ve zaman verimli",
    icon: Sparkles,
    days: [
      ["chest", "back", "legs", "shoulders", "abs"],
      null,
      ["chest", "back", "legs", "shoulders", "abs"],
      null,
      ["chest", "back", "legs", "shoulders", "abs"],
      null,
      null,
    ],
  },
  {
    id: "bro",
    name: "Bro Split",
    short: "Bro",
    tag: "5 gün",
    desc: "Her gün tek kas grubu — yoğun izolasyon",
    icon: Dumbbell,
    days: [
      ["chest"],
      ["back"],
      ["legs"],
      ["shoulders"],
      ["biceps", "triceps"],
      null,
      null,
    ],
  },
];

const materializePreset = (preset: PresetDef): Plan => {
  const plan: Plan = {};
  DAY_KEYS.forEach((day, i) => {
    const muscles = preset.days[i];
    if (!muscles) return;
    const valid = muscles.filter((m) => MUSCLE_SET.has(m));
    if (valid.length > 0) plan[day] = valid;
  });
  return plan;
};

/* ────────────────────────────────────────────────────────────── */
/* Mobile-first dialog wrapper                                    */
/* ────────────────────────────────────────────────────────────── */

/**
 * Mobilde bottom-sheet gibi açılır, desktop'ta centered dialog kalır.
 * Safe-area-inset-bottom padding ile iPhone home bar'a yapışmaz.
 */
function SheetContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      {...props}
      className={cn(
        // Mobile: bottom sheet
        "max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:max-h-[85dvh]",
        "max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0",
        "max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0",
        "max-sm:overflow-y-auto",
        "max-sm:pb-[max(env(safe-area-inset-bottom),1rem)]",
        className,
      )}
    />
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Main                                                           */
/* ────────────────────────────────────────────────────────────── */

export default function Planner() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: qk.profile(),
    queryFn: () => apiGet<Profile>("/profile"),
    staleTime: 5 * 60_000,
  });

  const serverPlan = useMemo<Plan>(
    () => normalizePlan((profile?.week_plan as Plan | undefined) ?? undefined),
    [profile],
  );

  const [plan, setPlan] = useState<Plan>({});
  const [justSaved, setJustSaved] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearDayTarget, setClearDayTarget] = useState<string | null>(null);
  const [copyFrom, setCopyFrom] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [autoSaveOn, setAutoSaveOn] = useAutoSavePref();

  const lastServerPlanRef = useRef<Plan | null>(null);
  const savedTimerRef = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

  /* ─── Server ile senkron ────────────────────────────────── */
  useLayoutEffect(() => {
    const previousServer = lastServerPlanRef.current;
    lastServerPlanRef.current = serverPlan;

    if (previousServer === null) {
      setPlan(serverPlan);
      return;
    }
    setPlan((current) =>
      plansEqual(current, previousServer) ? serverPlan : current,
    );
  }, [serverPlan]);

  useEffect(
    () => () => {
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      if (autoSaveTimerRef.current)
        window.clearTimeout(autoSaveTimerRef.current);
    },
    [],
  );

  const dirty = !isLoading && !!profile && !plansEqual(plan, serverPlan);
  const hasSavedPlan = Object.keys(serverPlan).length > 0;

  /* ─── Analitik ──────────────────────────────────────────── */
  const muscleFreq = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const ms of Object.values(plan)) {
      for (const m of ms) freq[m] = (freq[m] ?? 0) + 1;
    }
    return freq;
  }, [plan]);

  const balance = useMemo(() => {
    const entries = Object.entries(muscleFreq)
      .filter(([m]) => MUSCLE_SET.has(m))
      .sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] ?? 1;
    return { entries, max };
  }, [muscleFreq]);

  const totalPlanned = useMemo(
    () => Object.values(plan).reduce((a, v) => a + v.length, 0),
    [plan],
  );
  const isPlanEmpty = Object.keys(plan).length === 0;
  const today = useMemo(todayKey, []);

  /* ─── Kaydetme ──────────────────────────────────────────── */
  const save = useMutation({
    mutationFn: (payload: Plan) =>
      apiPut<Profile>("/profile/week-plan", { week_plan: payload }),
    onSuccess: async () => {
      setJustSaved(true);
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setJustSaved(false), 1800);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.profile() }),
        queryClient.invalidateQueries({ queryKey: ["summary"] }),
      ]);
    },
    onError: (err) => toast.error(apiErrTr(err)),
  });

  /* ─── Otomatik kayıt (debounce) ─────────────────────────── */
  useEffect(() => {
    if (!autoSaveOn) return;
    if (isLoading || !dirty || save.isPending) return;

    if (autoSaveTimerRef.current)
      window.clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = window.setTimeout(() => {
      save.mutate(normalizePlan(plan));
    }, 900);

    return () => {
      if (autoSaveTimerRef.current)
        window.clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, autoSaveOn, dirty, isLoading]);

  /* ─── Toggle chip ───────────────────────────────────────── */
  const toggle = useCallback((day: string, muscle: string) => {
    haptic(8);
    setJustSaved(false);
    setPlan((prev) => {
      const current = prev[day] ?? [];
      const next = current.includes(muscle)
        ? current.filter((m) => m !== muscle)
        : [...current, muscle];
      const copy = { ...prev };
      if (next.length === 0) delete copy[day];
      else copy[day] = next;
      return copy;
    });
  }, []);

  const handleSave = useCallback(() => {
    haptic(12);
    save.mutate(normalizePlan(plan));
  }, [save, plan]);

  /* ─── Cmd/Ctrl + S ──────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !save.isPending) handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, save.isPending, handleSave]);

  /* ─── Tek günü temizle ──────────────────────────────────── */
  const handleClearDayConfirm = useCallback(() => {
    const day = clearDayTarget;
    if (!day) return;

    const previousPlan = plan;
    const nextPlan = { ...plan };
    delete nextPlan[day];

    setClearDayTarget(null);
    setJustSaved(false);
    setPlan(nextPlan);

    save.mutate(normalizePlan(nextPlan), {
      onSuccess: () => {
        toast.success(`${DAY_FULL_TR[day]} planı silindi.`, {
          action: {
            label: "Geri al",
            onClick: () => {
              setPlan(previousPlan);
              save.mutate(normalizePlan(previousPlan));
            },
          },
        });
      },
      onError: () => setPlan(previousPlan),
    });
  }, [clearDayTarget, plan, save]);

  /* ─── Kopyala ───────────────────────────────────────────── */
  const copyDayTo = useCallback(
    (from: string, targets: string[]) => {
      const source = plan[from] ?? [];
      if (source.length === 0) {
        setCopyFrom(null);
        return;
      }
      setJustSaved(false);
      setPlan((prev) => {
        const copy = { ...prev };
        for (const t of targets) {
          if (t === from) continue;
          copy[t] = [...source];
        }
        return copy;
      });
      setCopyFrom(null);
      toast.success(
        targets.length === 1
          ? `${DAY_FULL_TR[targets[0]]} gününe kopyalandı.`
          : `${targets.length} güne kopyalandı.`,
      );
    },
    [plan],
  );

  /* ─── Tümünü temizle ────────────────────────────────────── */
  const handleClearAll = useCallback(() => {
    const previousPlan = plan;
    setClearOpen(false);
    setJustSaved(false);
    setPlan({});
    save.mutate(
      {},
      {
        onSuccess: () => {
          toast.success("Tüm plan temizlendi.", {
            action: {
              label: "Geri al",
              onClick: () => {
                setPlan(previousPlan);
                save.mutate(normalizePlan(previousPlan));
              },
            },
          });
        },
        onError: () => setPlan(previousPlan),
      },
    );
  }, [plan, save]);

  /* ─── Şablon uygula ─────────────────────────────────────── */
  const applyPreset = useCallback((preset: PresetDef) => {
    const next = materializePreset(preset);
    setPresetsOpen(false);
    setJustSaved(false);
    setPlan(next);
    haptic(15);
    toast.success(`${preset.name} şablonu uygulandı.`, {
      description: autoSaveOn
        ? "Otomatik kayıt açık — birkaç saniye içinde kaydedilecek."
        : "İnceleyip kaydetmeyi unutma.",
    });
  }, [autoSaveOn]);

  /* ─── Kaydet butonu durumu ──────────────────────────────── */
  type BtnState = "saving" | "saved" | "clean" | "dirty";
  const state: BtnState = save.isPending
    ? "saving"
    : justSaved
      ? "saved"
      : dirty
        ? "dirty"
        : "clean";

  const copyTargets = copyFrom ? DAY_KEYS.filter((d) => d !== copyFrom) : [];

  /* ──────────────────────────────────────────────────────── */

  return (
    <div className="space-y-4 pb-2" data-testid="planner-page">
      {/* ─── Back link ──────────────────────────────────── */}
      <Link
        to="/"
        data-testid="planner-back-link"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Kas grupları
      </Link>

      {/* ─── Header ──────────────────────────────────────── */}
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="font-heading text-2xl font-extrabold tracking-tight text-white sm:text-4xl"
              data-testid="planner-title"
            >
              PLANLAYICI
            </h1>
            <p className="mt-1 hidden text-sm leading-relaxed text-zinc-400 sm:block">
              Haftalık antrenman planını oluştur. Bir güne birden fazla kas
              grubu ekleyebilir, hazır şablonlarla hızlıca başlayabilirsin.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* Otomatik kayıt toggle */}
            <button
              type="button"
              onClick={() => setAutoSaveOn((v) => !v)}
              aria-pressed={autoSaveOn}
              data-testid="planner-autosave-toggle"
              className={cn(
                "flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/40",
                autoSaveOn
                  ? "border-lime-500/40 bg-lime-500/10 text-lime-300"
                  : "border-[#27272A] bg-[#141416] text-zinc-500 hover:text-zinc-300",
              )}
            >
              <Zap
                className={cn("h-3.5 w-3.5", autoSaveOn && "fill-lime-400/40")}
                aria-hidden
              />
              <span className="hidden xs:inline">Oto</span>
            </button>

            {/* Şablonlar */}
            <button
              type="button"
              onClick={() => setPresetsOpen(true)}
              data-testid="planner-presets-button"
              className="flex min-h-9 items-center gap-1.5 rounded-md border border-[#27272A] bg-[#141416] px-2.5 text-[11px] font-bold text-zinc-300 transition-colors hover:border-lime-500/40 hover:bg-lime-500/10 hover:text-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/40"
            >
              <LayoutTemplate className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden xs:inline">Şablon</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hafta ısı haritası (ince) ───────────────────── */}
      {!isLoading && <WeekHeatmap plan={plan} today={today} />}

      {/* ─── Kas dengesi (mobilde katlanır) ──────────────── */}
      {!isLoading && !isPlanEmpty && balance.entries.length > 0 && (
        <MuscleBalance entries={balance.entries} max={balance.max} />
      )}

      {/* ─── Tümünü temizle ──────────────────────────────── */}
      {hasSavedPlan && !save.isPending && (
        <button
          type="button"
          onClick={() => setClearOpen(true)}
          data-testid="planner-clear-all-button"
          className="flex min-h-10 items-center gap-2 rounded-md border border-red-500/20 bg-red-500/[0.04] px-3 text-[11px] font-bold text-red-400/90 transition-colors hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          TÜM PLANI TEMİZLE
        </button>
      )}

      {/* ─── Günler ──────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-[#27272A] bg-[#141416]"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5" data-testid="planner-days">
          {DAY_KEYS.map((day) => (
            <DayRow
              key={day}
              day={day}
              picked={plan[day] ?? EMPTY_PICKS}
              isToday={day === today}
              onToggle={toggle}
              onClearDay={(d) => setClearDayTarget(d)}
              onCopyDay={(d) => setCopyFrom(d)}
            />
          ))}
        </div>
      )}

      {/* ─── Sticky kaydet çubuğu ────────────────────────── */}
      <div
        className="sticky bottom-20 z-10 md:bottom-4"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Button
          type="button"
          onClick={handleSave}
          disabled={
            isLoading ||
            save.isPending ||
            (!autoSaveOn && !dirty) ||
            (autoSaveOn && !dirty)
          }
          data-testid="planner-save-button"
          className={cn(
            "min-h-14 w-full font-heading text-base font-extrabold transition-colors duration-200",
            state === "saved" &&
              "!bg-emerald-500 !text-white hover:!bg-emerald-500",
            (state === "clean" || (autoSaveOn && state === "dirty")) &&
              "!bg-[#18181B] !text-zinc-500",
          )}
        >
          {state === "saving" && (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {autoSaveOn ? "OTOMATİK KAYDEDİLİYOR…" : "KAYDEDİLİYOR…"}
            </span>
          )}
          {state === "saved" && (
            <span className="flex items-center justify-center gap-2">
              <Check className="h-5 w-5" aria-hidden />
              KAYDEDİLDİ
            </span>
          )}
          {state === "clean" &&
            (autoSaveOn ? "OTOMATİK KAYIT AÇIK" : "DEĞİŞİKLİK YOK")}
          {state === "dirty" &&
            (autoSaveOn
              ? "OTOMATİK KAYDEDİLECEK…"
              : `PLANI KAYDET (${totalPlanned})`)}
        </Button>
      </div>

      {/* ─── Dialog: Şablonlar ───────────────────────────── */}
      <Dialog open={presetsOpen} onOpenChange={setPresetsOpen}>
        <SheetContent
          data-testid="planner-presets-dialog"
          className="sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>Hazır şablonlar</DialogTitle>
            <DialogDescription>
              Tek dokunuşla haftalık planını doldur. Sonra istediğin gibi
              düzenle.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-1">
            {PRESETS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  data-testid={`planner-preset-${p.id}`}
                  className="group flex min-h-16 items-center gap-3 rounded-xl border border-[#27272A] bg-[#141416] p-3 text-left transition-all active:scale-[0.99] hover:border-lime-500/40 hover:bg-lime-500/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/40"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#18181B] text-lime-400 ring-1 ring-inset ring-[#27272A] transition-colors group-hover:bg-lime-500/10 group-hover:ring-lime-500/30">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-heading text-sm font-extrabold text-white">
                        {p.name}
                      </span>
                      <span className="shrink-0 rounded-full bg-[#18181B] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400 ring-1 ring-inset ring-[#27272A]">
                        {p.tag}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                      {p.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPresetsOpen(false)}
              data-testid="planner-presets-cancel-button"
              className="min-h-11 w-full sm:w-auto"
            >
              Kapat
            </Button>
          </DialogFooter>
        </SheetContent>
      </Dialog>

      {/* ─── Dialog: Tümünü temizle ─────────────────────── */}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <SheetContent>
          <DialogHeader>
            <DialogTitle>Tüm planı temizle?</DialogTitle>
            <DialogDescription>
              Bu haftanın tüm günlerindeki kas grupları silinecek ve{" "}
              <strong className="text-white">hemen kaydedilecek</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setClearOpen(false)}
              data-testid="planner-clear-cancel-button"
              className="min-h-12 w-full sm:w-auto"
            >
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              data-testid="planner-clear-confirm-button"
              className="min-h-12 w-full sm:w-auto"
            >
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
              Sil ve Kaydet
            </Button>
          </DialogFooter>
        </SheetContent>
      </Dialog>

      {/* ─── Dialog: Tek günü temizle ───────────────────── */}
      <Dialog
        open={clearDayTarget !== null}
        onOpenChange={(o) => !o && setClearDayTarget(null)}
      >
        <SheetContent data-testid="planner-clear-day-dialog">
          <DialogHeader>
            <DialogTitle>
              {clearDayTarget
                ? `${DAY_FULL_TR[clearDayTarget]} planı silinsin mi?`
                : "Günü temizle"}
            </DialogTitle>
            <DialogDescription>
              Bu gündeki tüm kas grupları silinecek ve{" "}
              <strong className="text-white">otomatik kaydedilecek</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setClearDayTarget(null)}
              data-testid="planner-clear-day-cancel-button"
              className="min-h-12 w-full sm:w-auto"
            >
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearDayConfirm}
              data-testid="planner-clear-day-confirm-button"
              className="min-h-12 w-full sm:w-auto"
            >
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
              Evet, sil
            </Button>
          </DialogFooter>
        </SheetContent>
      </Dialog>

      {/* ─── Dialog: Kopyala ────────────────────────────── */}
      <Dialog
        open={copyFrom !== null}
        onOpenChange={(o) => !o && setCopyFrom(null)}
      >
        <SheetContent data-testid="planner-copy-dialog">
          <DialogHeader>
            <DialogTitle>
              {copyFrom ? `${DAY_FULL_TR[copyFrom]} planını kopyala` : "Kopyala"}
            </DialogTitle>
            <DialogDescription>
              Hedef günü seç. Seçili günün kas grupları bu planla değiştirilir.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 py-1 sm:flex sm:flex-wrap">
            {copyTargets.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  haptic(10);
                  copyDayTo(copyFrom!, [d]);
                }}
                data-testid={`planner-copy-target-${d}`}
                className="min-h-12 rounded-lg border border-[#27272A] bg-[#18181B] px-3 text-sm font-bold text-zinc-200 transition-colors active:scale-[0.98] hover:border-lime-500/40 hover:bg-lime-500/10 hover:text-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/40"
              >
                {DAY_FULL_TR[d]}
              </button>
            ))}
          </div>

          <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setCopyFrom(null)}
              data-testid="planner-copy-cancel-button"
              className="min-h-12 w-full sm:w-auto"
            >
              Vazgeç
            </Button>
            <Button
              onClick={() => copyFrom && copyDayTo(copyFrom, copyTargets)}
              data-testid="planner-copy-all-button"
              className="min-h-12 w-full gap-1.5 sm:w-auto"
            >
              <Copy className="h-4 w-4" aria-hidden />
              Tüm günlere uygula
            </Button>
          </DialogFooter>
        </SheetContent>
      </Dialog>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Sub-components                                                 */
/* ────────────────────────────────────────────────────────────── */

/** 7 günü tek satırda gösteren ısı haritası. */
const WeekHeatmap = memo(function WeekHeatmap({
  plan,
  today,
}: {
  plan: Plan;
  today: string;
}) {
  return (
    <section
      aria-label="Hafta görünümü"
      data-testid="planner-heatmap"
      className="grid grid-cols-7 gap-1 rounded-xl border border-[#27272A] bg-[#141416] p-1.5"
    >
      {DAY_KEYS.map((day) => {
        const count = plan[day]?.length ?? 0;
        const active = count > 0;
        const isToday = day === today;
        const intensity = Math.min(count / 4, 1);
        return (
          <div
            key={day}
            data-testid={`planner-heatmap-${day}`}
            className={cn(
              "flex flex-col items-center justify-center rounded-md py-1.5 transition-colors",
              active
                ? "text-lime-300"
                : "bg-[#18181B] text-zinc-600 ring-1 ring-inset ring-[#27272A]",
              isToday && "ring-2 ring-inset ring-lime-400/50",
            )}
            style={
              active
                ? {
                    background: `rgba(132, 204, 22, ${0.1 + intensity * 0.2})`,
                    boxShadow: "inset 0 0 0 1px rgba(132, 204, 22, 0.18)",
                  }
                : undefined
            }
          >
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
              {DAY_SHORT[day] ?? day.slice(0, 3)}
            </span>
            <span className="mt-0.5 font-heading text-xs font-extrabold tabular-nums">
              {active ? count : "·"}
            </span>
          </div>
        );
      })}
    </section>
  );
});

/** Kas grubu dağılımı — mobilde katlanır. */
const MuscleBalance = memo(function MuscleBalance({
  entries,
  max,
}: {
  entries: [string, number][];
  max: number;
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? entries.slice(0, 8) : entries.slice(0, 3);

  return (
    <section
      aria-label="Kas dengesi"
      data-testid="planner-balance"
      className="space-y-2 rounded-xl border border-[#27272A] bg-[#141416] p-3"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between focus-visible:outline-none"
        aria-expanded={open}
      >
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          Kas dengesi
        </h2>
        <span className="text-[10px] font-semibold text-zinc-600">
          {open ? "Kapat" : `${entries.length} kas ›`}
        </span>
      </button>
      <div className="space-y-1.5">
        {shown.map(([m, n]) => {
          const tone = muscleTone(m);
          return (
            <div key={m} className="flex items-center gap-2">
              <span className="w-20 shrink-0 truncate text-[11px] font-semibold text-zinc-300">
                {MUSCLE_TR[m]}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#18181B]">
                <div
                  className={cn("h-full rounded-full", tone.dot)}
                  style={{ width: `${(n / max) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right font-heading text-[11px] font-bold tabular-nums text-zinc-400">
                {n}×
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
});

/** Tek gün satırı. */
const DayRow = memo(function DayRow({
  day,
  picked,
  isToday,
  onToggle,
  onClearDay,
  onCopyDay,
}: {
  day: string;
  picked: string[];
  isToday: boolean;
  onToggle: (day: string, muscle: string) => void;
  onClearDay: (day: string) => void;
  onCopyDay: (day: string) => void;
}) {
  const hasPicks = picked.length > 0;
  const rowRef = useRef<HTMLElement>(null);

  // Bugünün satırına otomatik scroll (yalnızca görünür değilse)
  useEffect(() => {
    if (!isToday || !rowRef.current) return;
    try {
      rowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch {
      /* no-op */
    }
  }, [isToday]);

  return (
    <section
      ref={rowRef}
      data-testid={`planner-day-${day}`}
      data-today={isToday || undefined}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-[#141416] p-3 transition-colors duration-200 sm:p-4",
        isToday
          ? "border-lime-400/40 shadow-[0_0_0_1px_rgba(132,204,22,0.15)]"
          : hasPicks
            ? "border-lime-500/20"
            : "border-[#27272A]",
      )}
    >
      {hasPicks && (
        <span
          aria-hidden
          className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-lime-400 to-emerald-500"
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-extrabold tabular-nums transition-colors",
              hasPicks
                ? "bg-lime-500/10 text-lime-400 ring-1 ring-inset ring-lime-500/20"
                : "bg-[#18181B] text-zinc-600 ring-1 ring-inset ring-[#27272A]",
            )}
          >
            {hasPicks ? picked.length : <Moon className="h-4 w-4" aria-hidden />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate font-heading text-sm font-extrabold tracking-tight text-white">
                {DAY_FULL_TR[day]}
              </h2>
              {isToday && (
                <span className="shrink-0 rounded-full bg-lime-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-lime-300 ring-1 ring-inset ring-lime-500/30">
                  Bugün
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium text-zinc-500">
              {hasPicks
                ? `${picked.length} kas grubu`
                : "Dinlenme günü"}
            </p>
          </div>
        </div>

        {hasPicks && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => onCopyDay(day)}
              aria-label={`${DAY_FULL_TR[day]} planını başka güne kopyala`}
              data-testid={`planner-copy-day-${day}`}
              className="flex h-10 w-10 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-[#1F1F23] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/40"
            >
              <Copy className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onClearDay(day)}
              aria-label={`${DAY_FULL_TR[day]} gününü temizle`}
              data-testid={`planner-clear-day-${day}`}
              className="flex h-10 w-10 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
        {MUSCLES.map((m) => {
          const on = picked.includes(m);
          const tone = muscleTone(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => onToggle(day, m)}
              data-testid={`planner-chip-${day}-${m}`}
              aria-pressed={on}
              className={cn(
                "group/chip flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-all duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/40 sm:min-h-9 sm:justify-start sm:px-3",
                on
                  ? tone.on
                  : "border-[#27272A] bg-[#18181B] text-zinc-400 hover:border-zinc-700 hover:text-white",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                  on ? tone.dot : "bg-zinc-600 group-hover/chip:bg-zinc-500",
                )}
              />
              <span className="truncate">{MUSCLE_TR[m]}</span>
              {on && <Check className="h-3 w-3 shrink-0" aria-hidden />}
            </button>
          );
        })}
      </div>
    </section>
  );
});