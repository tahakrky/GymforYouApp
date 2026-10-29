import { memo, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Dumbbell,
  ExternalLink,
  Lock,
  Music,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import {
  MUSCLES,
  type Exercise,
  type MuscleDetail,
  type Profile,
  type Workout as WorkoutT,
  type WorkoutCompleteResponse,
} from "@/lib/types";
import {
  MUSCLE_TR,
  apiErrTr,
  fmtDateShortTr,
  localClock,
  localDate,
  ytThumb,
} from "@/lib/tr";
import { qk } from "@/lib/queryKeys";
import { usePrefetchExercise } from "@/lib/hooks/usePrefetch";
import { useActiveWorkoutGuard } from "@/lib/hooks/useActiveWorkoutGuard";
import { setActiveWorkout, clearActiveWorkout } from "@/lib/activeWorkout";
import WorkoutPlayer from "@/components/workout/WorkoutPlayer";
import WorkoutCompleteOverlay from "@/components/workout/WorkoutCompleteOverlay";
import ExercisePickerSheet from "@/components/workout/ExercisePickerSheet";

export default function Workout() {
  const { muscle } = useParams<{ muscle: string }>();
  const m = (muscle ?? "").toLowerCase();
  const valid = (MUSCLES as readonly string[]).includes(m);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [completeResp, setCompleteResp] =
    useState<WorkoutCompleteResponse | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const prefetchExercise = usePrefetchExercise();

  // 🆕 Aktif antrenman — localStorage + backend doğrulaması
  const {
    info: activeInfo,
    workout: activeWorkout,
    isVerifying: isVerifyingActive,
    isMissing: isActiveMissing,
  } = useActiveWorkoutGuard();

  const isThisMuscleActive = activeInfo?.muscle === m;

  // 🆕 Başka kasın antrenmanı devam ediyorsa → oraya yönlendir
  useEffect(() => {
    if (activeInfo && activeInfo.muscle !== m) {
      navigate(`/workout/${activeInfo.muscle}`, { replace: true });
    }
  }, [activeInfo, m, navigate]);

  // 🆕 localStorage'daki antrenman backend'de yok (iptal edilmiş) → ana sayfaya dön
  useEffect(() => {
    if (isActiveMissing && isThisMuscleActive) {
      toast.error("Antrenman iptal edilmiş veya bulunamadı.");
      navigate("/", { replace: true });
    }
  }, [isActiveMissing, isThisMuscleActive, navigate]);

  const profileQ = useQuery({
    queryKey: qk.profile(),
    queryFn: () => apiGet<Profile>("/profile"),
    staleTime: 5 * 60_000,
  });

  const detailQ = useQuery({
    queryKey: qk.muscle(m, localDate()),
    queryFn: () => apiGet<MuscleDetail>(`/muscles/${m}?today=${localDate()}`),
    enabled: valid && !isThisMuscleActive,
    staleTime: 60_000,
  });
  const planQ = useQuery({
    queryKey: qk.plan(m),
    queryFn: () => apiGet<Exercise[]>(`/workouts/plan/${m}`),
    enabled: valid && !isThisMuscleActive,
    staleTime: 60_000,
  });

  const start = useMutation({
    mutationFn: () =>
      apiPost<WorkoutT>("/workouts/start", {
        muscle: m,
        local_clock: localClock(),
        local_date: localDate(),
      }),
    onSuccess: async (newWorkout) => {
      // 🆕 localStorage'a yaz — artık her sayfa bu antrenmanı bilecek
      setActiveWorkout({
        workoutId: newWorkout.id,
        muscle: newWorkout.muscle,
        startClock: newWorkout.start_clock,
        startedAt: Date.now(),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workouts"] }),
        queryClient.invalidateQueries({ queryKey: ["muscle"] }),
        queryClient.invalidateQueries({ queryKey: ["summary"] }),
      ]);
    },
    onError: (err) => toast.error(apiErrTr(err)),
  });

  const savePlan = useMutation({
    mutationFn: (items: Exercise[]) =>
      apiPut<Exercise[]>(`/workouts/plan/${m}`, {
        exercise_ids: items.map((e) => e.id),
      }),
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: qk.plan(m) });
      const prev = queryClient.getQueryData<Exercise[]>(qk.plan(m));
      queryClient.setQueryData(qk.plan(m), items);
      return { prev };
    },
    onError: (err, _items, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(qk.plan(m), ctx.prev);
      toast.error(apiErrTr(err));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.plan(m) });
      queryClient.invalidateQueries({ queryKey: qk.muscle(m, localDate()) });
    },
  });

  const handleFinished = useCallback(
    (resp: WorkoutCompleteResponse) => setCompleteResp(resp),
    [],
  );

  const handleOverlayDone = useCallback(() => {
    // 🆕 Antrenman bitti → localStorage'dan sil
    clearActiveWorkout();
    setCompleteResp(null);
    window.location.href = "/history";
  }, []);

  const handleOpenPicker = useCallback(() => setPickerOpen(true), []);
  const handleClosePicker = useCallback(() => setPickerOpen(false), []);

  if (!valid) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-2xl font-extrabold text-white">
          Bilinmeyen kas grubu
        </h1>
        <Link
          to="/"
          data-testid="back-home-link"
          className="text-sm text-[#84CC16] underline underline-offset-4"
        >
          Ana sayfaya dön
        </Link>
      </div>
    );
  }

  const label = MUSCLE_TR[m] ?? m;
  const plan = planQ.data ?? [];
  const totalSets = plan.reduce((a, e) => a + e.target_sets, 0);

  const overlay = completeResp ? (
    <WorkoutCompleteOverlay resp={completeResp} onDone={handleOverlayDone} />
  ) : null;

  // 🆕 Başka kasın antrenmanı → yönlendirme yapılana kadar loading göster
  //    (yanlışlıkla başka kasın "başla" ekranı görünmesin)
  if (activeInfo && activeInfo.muscle !== m) {
    return (
      <div className="h-64 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]" />
    );
  }

  // 🆕 Bu kasın antrenmanı aktif
  if (isThisMuscleActive) {
    // Backend'den doğrulandı → player
    if (activeWorkout) {
      const playlistUrl = profileQ.data?.playlist_url;
      const playlistName = profileQ.data?.playlist_name || "Çalma Listesi";

      return (
        <>
          {playlistUrl && (
            <a
              href={playlistUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="workout-playlist-link"
              className="mb-3 flex min-h-12 items-center justify-between gap-2 rounded-lg border border-[#84CC16]/40 bg-[#1A2210] px-4 transition-colors hover:bg-[#22300E]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Music className="h-4 w-4 shrink-0 text-[#84CC16]" aria-hidden />
                <span className="truncate font-heading text-sm font-bold text-[#84CC16]">
                  {playlistName}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#84CC16]">
                SPOTIFY
                <ExternalLink className="h-3 w-3" aria-hidden />
              </span>
            </a>
          )}
          <WorkoutPlayer workout={activeWorkout} onFinished={handleFinished} />
          {overlay}
        </>
      );
    }

    // Doğrulama sürüyor → loading
    // (404 ise yukarıdaki effect temizleyip yönlendirecek)
    if (isVerifyingActive || !isActiveMissing) {
      return (
        <div className="h-64 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]" />
      );
    }
  }

  const d = detailQ.data;
  const blocked = d?.status === "TODAY_DONE" || d?.status === "LIMIT_REACHED";

  return (
    <div className="space-y-5">
      {overlay}

      <Link
        to="/"
        data-testid="workout-back-link"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Kas grupları
      </Link>

      <div>
        <p className="text-xs font-bold text-[#84CC16]">BUGÜNKÜ ANTRENMAN</p>
        <h1
          className="mt-1 font-heading text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
          data-testid="workout-title"
        >
          {label}
        </h1>
        <p
          className="mt-1.5 text-sm font-medium text-zinc-400"
          data-testid="workout-plan-meta"
        >
          {plan.length} egzersiz · {totalSets} set
        </p>
      </div>

      {blocked ? (
        <div
          className="rounded-lg border border-[#27272A] bg-[#141416] p-5"
          data-testid="workout-blocked-panel"
        >
          <p className="flex items-center gap-2 font-heading text-lg font-extrabold tracking-tight text-white">
            {d?.status === "TODAY_DONE" ? (
              <>
                <Check className="h-5 w-5 text-[#84CC16]" aria-hidden /> Bugün
                tamamlandı
              </>
            ) : (
              <>
                <Lock className="h-5 w-5 text-zinc-500" aria-hidden /> Haftalık
                limit doldu
              </>
            )}
          </p>
          <p
            className="mt-2 text-sm leading-relaxed text-zinc-400"
            data-testid="workout-blocked-detail"
          >
            {d?.status === "TODAY_DONE"
              ? `${label} bugün çalışıldı. Aynı kas grubunu günde bir kez çalışabilirsin — yarın tekrar açılacak.`
              : `Bu hafta ${d?.sessions_this_week} / ${d?.weekly_limit} antrenman tamamlandı.${
                  d?.next_available
                    ? ` Yeni hafta: ${fmtDateShortTr(d.next_available)}.`
                    : ""
                }`}
          </p>
          <button
            disabled
            data-testid="start-workout-button-disabled"
            className="mt-4 min-h-12 w-full cursor-not-allowed rounded-md border border-[#27272A] bg-[#18181B] px-6 font-heading text-sm font-bold text-zinc-500"
          >
            {d?.status === "TODAY_DONE" ? "BUGÜN TAMAMLANDI" : "HAFTALIK LİMİT"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => start.mutate()}
          disabled={start.isPending || planQ.isLoading || plan.length === 0}
          data-testid="start-workout-button"
          className="flex min-h-14 w-full items-center justify-center gap-2.5 rounded-md bg-[#84CC16] px-8 font-heading text-base font-extrabold text-[#09090B] transition-colors duration-150 hover:bg-[#A3E635] active:scale-[0.99] disabled:opacity-50"
        >
          {start.isPending ? "BAŞLATILIYOR…" : "ANTRENMANA BAŞLA"}
          <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      )}

      <section className="space-y-2.5">
        <p className="text-[11px] font-semibold tracking-wide text-zinc-400">
          BUGÜNKÜ EGZERSİZLER
        </p>

        {planQ.isLoading && (
          <div className="h-32 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]" />
        )}

        {!planQ.isLoading && plan.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#27272A] bg-[#141416]/50 p-5 text-center text-sm text-zinc-500">
            Henüz egzersiz yok. Aşağıdan ekle.
          </p>
        )}

        <div className="space-y-2" data-testid="workout-plan-list">
          {plan.map((e, i) => (
            <PlanRow
              key={e.id}
              e={e}
              index={i}
              plan={plan}
              onRemove={savePlan.mutate}
              onHover={prefetchExercise}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleOpenPicker}
          disabled={planQ.isLoading}
          data-testid="plan-add-button"
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#3F3F46] bg-[#141416]/50 font-heading text-sm font-extrabold tracking-wide text-zinc-300 transition-colors hover:border-[#84CC16] hover:text-[#84CC16] active:scale-[0.99] disabled:opacity-50"
        >
          <Plus className="h-5 w-5" strokeWidth={3} />
          EGZERSİZ EKLE
        </button>
      </section>

      {pickerOpen && (
        <ExercisePickerSheet
          muscle={m}
          currentPlan={plan}
          onClose={handleClosePicker}
          onSave={(items) => {
            savePlan.mutate(items, {
              onSuccess: () => {
                setPickerOpen(false);
                toast.success("Plan kaydedildi.");
              },
            });
          }}
        />
      )}
    </div>
  );
}

const PlanRow = memo(function PlanRow({
  e,
  index,
  plan,
  onRemove,
  onHover,
}: {
  e: Exercise;
  index: number;
  plan: Exercise[];
  onRemove: (items: Exercise[]) => void;
  onHover: (id: string) => void;
}) {
  const handleRemove = useCallback(() => {
    const before = plan;
    const next = before.filter((x) => x.id !== e.id);
    onRemove(next);
    toast("Egzersiz kaldırıldı", {
      description: e.name,
      action: { label: "GERİ AL", onClick: () => onRemove(before) },
    });
  }, [plan, e, onRemove]);

  const handleHover = useCallback(() => onHover(e.id), [onHover, e.id]);

  return (
    <div
      data-testid={`plan-exercise-${index + 1}`}
      className="flex items-center gap-1.5 rounded-lg border border-[#27272A] bg-[#141416] p-1.5"
    >
      <Link
        to={`/exercises/${e.id}`}
        onPointerEnter={handleHover}
        onTouchStart={handleHover}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 transition-colors hover:bg-[#18181B] sm:gap-3.5 sm:p-2"
      >
        <span className="shrink-0 font-heading text-xs font-extrabold text-[#84CC16] sm:text-sm">
          {String(index + 1).padStart(2, "0")}
        </span>
        <img
          src={ytThumb(e.video_id)}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-14 w-14 shrink-0 rounded-md object-cover sm:w-24"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-bold text-white">
            {e.name}
          </p>
          <p className="truncate text-[11px] text-zinc-400 sm:text-xs">
            {e.target_sets} set × {e.rep_range || e.target_reps} tekrar
            <span className="text-[#84CC16] sm:hidden">
              {" · "}%{e.activation}
            </span>
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-zinc-500 sm:text-[11px]">
            <Dumbbell className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{e.equipment_label}</span>
          </p>
        </div>
        <span
          className="hidden shrink-0 rounded-md bg-[#1A2210] px-2 py-1 font-heading text-xs font-bold text-[#84CC16] sm:inline-block"
          data-testid={`plan-activation-${index + 1}`}
        >
          %{e.activation}
        </span>
      </Link>

      <button
        type="button"
        onClick={handleRemove}
        aria-label={`${e.name} egzersizini kaldır`}
        data-testid={`plan-remove-${index + 1}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#3F3F46] text-zinc-400 transition-colors hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-400 active:scale-95 sm:h-14 sm:w-14"
      >
        <X className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.5} />
      </button>
    </div>
  );
});