import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/api";
import type { Exercise } from "@/lib/types";
import { DIFFICULTY_TR, EQUIPMENT_TR, MUSCLE_TR, apiErrTr } from "@/lib/tr";
import { qk } from "@/lib/queryKeys";
import YouTubeVideo, {
  YouTubeFallbackLink,
} from "@/components/common/YouTubeVideo";
import ActivationBar from "@/components/workout/ActivationBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ✅ Modül seviyesi — render başına obje yaratmıyoruz.
function buildStatTiles(ex: Exercise) {
  return [
    { label: "Set", value: String(ex.target_sets) },
    { label: "Tekrar", value: ex.rep_range || String(ex.target_reps) },
    { label: "Aktivasyon", value: `%${ex.activation}` },
  ] as const;
}

export default function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: ex, isLoading } = useQuery({
    queryKey: qk.exercise(id ?? ""),
    queryFn: () => apiGet<Exercise>(`/exercises/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });

  // ✅ ex.id değişince formu sıfırlayan iç component (aşağıda).
  if (isLoading || !ex) {
    return (
      <div
        className="h-64 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]"
        data-testid="exercise-skeleton"
      />
    );
  }

  return <ExerciseDetailBody key={ex.id} ex={ex} queryClient={queryClient} />;
}

function ExerciseDetailBody({
  ex,
  queryClient,
}: {
  ex: Exercise;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [sets, setSets] = useState(String(ex.target_sets));
  const [reps, setReps] = useState(String(ex.target_reps));

  // ex.id sabit (key ile mount), tekrar senkron gerekmez ama sunucudan güncelleme
  // gelirse (invalidate) yakalamak için:
  useEffect(() => {
    setSets(String(ex.target_sets));
    setReps(String(ex.target_reps));
  }, [ex.target_sets, ex.target_reps]);

  const save = useMutation({
    mutationFn: () =>
      apiPatch<Exercise>(`/exercises/${ex.id}`, {
        target_sets: Number(sets),
        target_reps: Number(reps),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.exercise(ex.id) }),
        queryClient.invalidateQueries({ queryKey: ["exercises"] }),
        queryClient.invalidateQueries({ queryKey: ["plan"] }),
      ]);
      toast.success("Set ve tekrar kaydedildi.");
    },
    onError: (err) => toast.error(apiErrTr(err)),
  });

  const statTiles = useMemo(() => buildStatTiles(ex), [ex]);

  const equipmentLine = useMemo(
    () => ex.equipment_required.map((r) => EQUIPMENT_TR[r] ?? r).join(" · "),
    [ex.equipment_required],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        to="/exercises"
        data-testid="exercise-back-link"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Kütüphane
      </Link>

      <div>
        <h1
          className="font-heading text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
          data-testid="exercise-name"
        >
          {ex.name}
        </h1>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="rounded-md border border-[#84CC16] bg-[#1E2B0E] px-2 py-1 text-[#84CC16]">
            {MUSCLE_TR[ex.muscle] ?? ex.muscle}
          </span>
          <span className="rounded-md border border-[#27272A] bg-[#18181B] px-2 py-1 text-zinc-300">
            {DIFFICULTY_TR[ex.difficulty] ?? ex.difficulty}
          </span>
        </div>
      </div>

      <div>
        <YouTubeVideo videoId={ex.video_id} title={ex.name} />
        <div className="mt-2 flex justify-end">
          <YouTubeFallbackLink videoId={ex.video_id} />
        </div>
      </div>

      <div
        className="rounded-lg border border-[#27272A] bg-[#141416] p-4"
        data-testid="exercise-equipment"
      >
        <p className="text-[11px] font-semibold text-zinc-400">
          Gerekli ekipman
        </p>
        <p className="mt-1 flex items-center gap-2 font-heading text-base font-bold text-white">
          <Dumbbell className="h-4 w-4 text-[#84CC16]" aria-hidden />{" "}
          {ex.equipment_label}
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">{equipmentLine}</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {statTiles.map((t) => (
          <div
            key={t.label}
            className="rounded-lg border border-[#27272A] bg-[#141416] p-3 text-center"
          >
            <p className="text-[10px] font-semibold text-zinc-400">{t.label}</p>
            <p className="mt-0.5 font-heading text-base font-extrabold text-white">
              {t.value}
            </p>
          </div>
        ))}
      </div>

      <ActivationBar
        muscle={ex.muscle}
        activation={ex.activation}
        secondary={ex.secondary}
      />

      <p
        className="text-sm leading-relaxed text-zinc-300"
        data-testid="exercise-description"
      >
        {ex.description}
      </p>

      <section className="space-y-2">
        <p className="text-[11px] font-semibold text-zinc-400">Nasıl yapılır</p>
        <ol className="space-y-2" data-testid="exercise-instructions">
          {ex.instructions.map((step, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-lg border border-[#27272A] bg-[#141416] p-3"
            >
              <span className="font-heading text-xs font-bold text-[#84CC16]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm leading-relaxed text-zinc-300">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {ex.progression_to && (
        <p
          className="rounded-lg border border-[#27272A] bg-[#141416] p-3.5 text-sm leading-relaxed text-zinc-400"
          data-testid="exercise-progression"
        >
          <span className="font-bold text-white">Zorlaştırmak için:</span>{" "}
          {ex.progression_to}
          {ex.progression_note ? ` — ${ex.progression_note}` : ""}
        </p>
      )}

      <section
        className="space-y-3 rounded-lg border border-[#27272A] bg-[#141416] p-4"
        data-testid="prescription-editor"
      >
        <p className="text-[11px] font-semibold text-zinc-400">
          Set ve tekrarı kendine göre ayarla
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1.5">
            <Label htmlFor="pr-sets">Set</Label>
            <Input
              id="pr-sets"
              type="number"
              min={1}
              max={10}
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              data-testid="prescription-sets-input"
              className="min-h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-reps">Tekrar</Label>
            <Input
              id="pr-reps"
              type="number"
              min={1}
              max={100}
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              data-testid="prescription-reps-input"
              className="min-h-12"
            />
          </div>
        </div>
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          data-testid="prescription-save-button"
          className="min-h-12"
        >
          {save.isPending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </section>
    </div>
  );
}