import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Dumbbell, Lightbulb, StickyNote, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import type { Workout, WorkoutCompleteResponse } from "@/lib/types";
import { MUSCLE_TR, apiErrTr, fmtNumTr, localClock } from "@/lib/tr";
import { cn } from "@/lib/utils";
import YouTubeVideo, { YouTubeFallbackLink } from "@/components/common/YouTubeVideo";
import ActivationBar from "@/components/workout/ActivationBar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Mobile-first session player. Sets / reps / weight only — no timer, stopwatch,
 *  countdown or seconds anywhere. The athlete decides their own rest. */
export default function WorkoutPlayer({
  workout,
  onFinished,
}: {
  workout: Workout;
  onFinished: (resp: WorkoutCompleteResponse) => void;
}) {
  const queryClient = useQueryClient();
  const [exIdx, setExIdx] = useState(() => {
    const i = workout.exercises.findIndex((e) => e.sets.some((s) => !s.completed));
    return i === -1 ? Math.max(0, workout.exercises.length - 1) : i;
  });
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");

  const exercise = workout.exercises[exIdx];
  const currentSetIdx = exercise ? exercise.sets.findIndex((s) => !s.completed) : -1;
  const exerciseDone = currentSetIdx === -1;
  const isLastExercise = exIdx === workout.exercises.length - 1;

  // Reset inputs when the visible exercise changes — deliberately not re-synced on refetch
  // so an invalidation never clobbers what the athlete is typing.
  useEffect(() => {
    const ex = workout.exercises[exIdx];
    setWeight(ex?.previous_weight != null ? String(ex.previous_weight) : "10");
    setReps(ex ? String(ex.target_reps) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exIdx]);

  const finish = useMutation({
    mutationFn: () =>
      apiPost<WorkoutCompleteResponse>(`/workouts/${workout.id}/complete`, { local_clock: localClock() }),
    onSuccess: async (resp) => {
      await queryClient.invalidateQueries({ queryKey: ["workouts"] });
      await queryClient.invalidateQueries({ queryKey: ["summary"] });
      await queryClient.invalidateQueries({ queryKey: ["muscle"] });
      onFinished(resp);
    },
    onError: () => toast.error("Antrenman tamamlanamadı. Bağlantını kontrol et."),
  });

  const logSet = useMutation({
    mutationFn: (setIdx: number) =>
      apiPatch<Workout>(`/workouts/${workout.id}/sets`, {
        exercise_index: exIdx,
        set_index: setIdx,
        reps: Math.max(0, Number.parseInt(reps, 10) || 0),
        weight_kg: Math.max(0, Number.parseFloat(weight) || 0),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workouts"] });
    },
    onError: () => toast.error("Set kaydedilemedi. Tekrar dene."),
  });

  const saveNote = useMutation({
    mutationFn: () =>
      apiPatch<Workout>(`/workouts/${workout.id}/note`, {
        exercise_index: exIdx,
        note: noteDraft,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workouts"] });
      toast.success("Not kaydedildi.");
      setNoteOpen(false);
    },
    onError: () => toast.error("Not kaydedilemedi."),
  });

  if (!exercise) return null;

  const muscleLabel = MUSCLE_TR[workout.muscle] ?? workout.muscle;
  const doneSets = exercise.sets.filter((s) => s.completed);
  // Rep-range ceiling hit on every logged set => time to add weight.
  const atRepCeiling =
    doneSets.length > 0 && doneSets.every((s) => (s.reps ?? 0) >= exercise.rep_max);
  // 10 kg has become too light => graduate to the harder variation.
  const tooLight =
    atRepCeiling && exercise.progression_to != null && (exercise.previous_weight ?? 0) >= 10;

  return (
    <div className="space-y-4" data-testid="workout-player">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#84CC16]" data-testid="player-progress-label">
            {muscleLabel} · EGZERSİZ {exIdx + 1} / {workout.exercises.length}
          </p>
          <h1 className="mt-1 font-heading text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl" data-testid="player-exercise-name">
            {exercise.name}
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-400" data-testid="player-equipment">
            <Dumbbell className="h-3.5 w-3.5" aria-hidden /> {exercise.equipment_label}
          </p>
        </div>
        <button
          onClick={() => setAbandonOpen(true)}
          data-testid="abandon-workout-button"
          aria-label="Antrenmanı iptal et"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#27272A] bg-[#141416] text-zinc-400 transition-colors hover:text-white"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* Session progress */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#27272A]">
          <div
            className="h-full rounded-full bg-[#84CC16] transition-[width] duration-300"
            style={{ width: `${workout.total_sets ? (workout.completed_sets / workout.total_sets) * 100 : 0}%` }}
          />
        </div>
        <span className="font-heading text-xs font-bold text-zinc-400" data-testid="player-set-counter">
          {workout.completed_sets}/{workout.total_sets} SET
        </span>
      </div>

      {/* Video */}
      <div>
        <YouTubeVideo key={exercise.exercise_id} videoId={exercise.video_id} title={exercise.name} />
        <div className="mt-2 flex justify-end">
          <YouTubeFallbackLink videoId={exercise.video_id} />
        </div>
      </div>

      {/* Prescription */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Set", value: String(exercise.target_sets), testid: "plan-sets" },
          { label: "Tekrar", value: exercise.rep_range || String(exercise.target_reps), testid: "plan-reps" },
          {
            label: "Önceki",
            value: exercise.previous_weight != null ? `${fmtNumTr(exercise.previous_weight)} kg` : "—",
            testid: "plan-previous",
          },
        ].map((t) => (
          <div key={t.label} className="rounded-lg border border-[#27272A] bg-[#141416] p-3 text-center">
            <p className="text-[10px] font-semibold tracking-wide text-zinc-400">{t.label}</p>
            <p className="mt-0.5 font-heading text-base font-extrabold text-white" data-testid={t.testid}>{t.value}</p>
          </div>
        ))}
      </div>

      <ActivationBar muscle={workout.muscle} activation={exercise.activation} secondary={exercise.secondary} />

      {/* Progression hints — only when the stored numbers actually warrant them */}
      {tooLight && (
        <div className="flex gap-3 rounded-lg border border-[#EAB308]/50 bg-[#2A2109] p-3.5" data-testid="hint-too-light">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#EAB308]" aria-hidden />
          <p className="text-sm leading-relaxed text-[#FDE68A]">
            <span className="font-bold">10 kg bu hareket için hafif geliyor.</span>{" "}
            Sıradaki adım: <span className="font-bold">{exercise.progression_to}</span>.{" "}
            {exercise.progression_note}
          </p>
        </div>
      )}
      {atRepCeiling && !tooLight && (
        <div className="flex gap-3 rounded-lg border border-[#84CC16]/50 bg-[#1A2210] p-3.5" data-testid="hint-rep-ceiling">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[#84CC16]" aria-hidden />
          <p className="text-sm leading-relaxed text-[#D9F99D]">
            Hedef tekrar aralığının üst sınırına ({exercise.rep_max}) ulaştın — ağırlığı artırmaya hazırsın.
          </p>
        </div>
      )}

      {/* Sets */}
      <div className="space-y-2" data-testid="sets-list">
        {exercise.sets.map((s, si) => {
          const isCurrent = si === currentSetIdx;
          return (
            <div
              key={si}
              data-testid={`set-row-${si + 1}`}
              className={cn(
                "rounded-lg border p-3.5",
                s.completed
                  ? "border-[#84CC16]/40 bg-[#141A0E]"
                  : isCurrent
                    ? "border-[#3F3F46] bg-[#18181B]"
                    : "border-[#27272A] bg-[#141416] opacity-50",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-heading text-sm font-bold text-white">SET {si + 1}</span>
                {s.completed ? (
                  <span className="flex items-center gap-2 font-heading text-sm font-bold text-[#84CC16]" data-testid={`set-done-${si + 1}`}>
                    <Check className="h-4 w-4" aria-hidden />
                    {s.reps ?? 0} tekrar × {fmtNumTr(s.weight_kg ?? 0)} kg
                  </span>
                ) : (
                  <span className="text-xs font-medium text-zinc-500">hedef {s.target_reps} tekrar</span>
                )}
              </div>

              {isCurrent && (
                <div className="mt-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-zinc-400">Ağırlık (kg)</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.5}
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        data-testid="set-weight-input"
                        className="mt-1 min-h-12 font-heading text-base font-bold"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-zinc-400">Tekrar</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        data-testid="set-reps-input"
                        className="mt-1 min-h-12 font-heading text-base font-bold"
                      />
                    </label>
                  </div>
                  <Button
                    className="min-h-12 w-full font-heading text-sm font-extrabold"
                    onClick={() => logSet.mutate(currentSetIdx)}
                    disabled={logSet.isPending || finish.isPending}
                    data-testid="complete-set-button"
                  >
                    {logSet.isPending ? "KAYDEDİLİYOR…" : "SETİ TAMAMLA"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Note */}
      <button
        onClick={() => {
          setNoteDraft(exercise.note ?? "");
          setNoteOpen(true);
        }}
        data-testid="add-note-button"
        className="flex w-full items-center gap-2.5 rounded-lg border border-[#27272A] bg-[#141416] p-3.5 text-left transition-colors hover:border-[#84CC16]/50"
      >
        <StickyNote className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-300" data-testid="note-preview">
          {exercise.note ? exercise.note : "Not ekle — bu hareket nasıl geçti?"}
        </span>
      </button>

      {/* Advance */}
      {exerciseDone && (
        <div className="rounded-lg border border-[#84CC16]/50 bg-[#1A2210] p-4" data-testid="exercise-complete-card">
          <p className="font-heading text-lg font-extrabold tracking-tight text-[#84CC16]">EGZERSİZ TAMAMLANDI</p>
          {isLastExercise ? (
            <Button
              className="mt-3 min-h-12 w-full font-heading text-sm font-extrabold"
              onClick={() => finish.mutate()}
              disabled={finish.isPending}
              data-testid="finish-workout-button"
            >
              {finish.isPending ? "KAYDEDİLİYOR…" : "ANTRENMANI BİTİR"}
            </Button>
          ) : (
            <>
              <p className="mt-1 text-sm text-zinc-400" data-testid="next-exercise-name">
                Sıradaki: {workout.exercises[exIdx + 1].name}
              </p>
              <Button
                className="mt-3 min-h-12 w-full font-heading text-sm font-extrabold"
                onClick={() => setExIdx((i) => i + 1)}
                data-testid="next-exercise-button"
              >
                SONRAKİ EGZERSİZ <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
              </Button>
            </>
          )}
        </div>
      )}

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Egzersiz notu</DialogTitle>
            <DialogDescription>{exercise.name} — bir sonraki antrenmanda hatırlamak istediklerin.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Örn: son set zorlandım, formu korumak için 8 tekrarda kestim."
            data-testid="note-input"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)} data-testid="note-cancel-button">
              Vazgeç
            </Button>
            <Button onClick={() => saveNote.mutate()} disabled={saveNote.isPending} data-testid="note-save-button">
              {saveNote.isPending ? "Kaydediliyor…" : "Notu Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={abandonOpen} onOpenChange={setAbandonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Antrenmanı iptal et?</DialogTitle>
            <DialogDescription>
              Bu oturum silinir. Kaydettiğin setler geçmişe ve haftalık limite sayılmaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbandonOpen(false)} data-testid="abandon-cancel-button">
              Devam Et
            </Button>
            <Button
              variant="destructive"
              data-testid="abandon-confirm-button"
              onClick={async () => {
                await apiDelete(`/workouts/${workout.id}`);
                await queryClient.invalidateQueries({ queryKey: ["workouts"] });
                await queryClient.invalidateQueries({ queryKey: ["summary"] });
                setAbandonOpen(false);
                window.location.href = "/";
              }}
            >
              İptal Et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
