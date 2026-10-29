import { ArrowRight, Trophy } from "lucide-react";
import type { WorkoutCompleteResponse } from "@/lib/types";
import { MUSCLE_TR, fmtNumTr } from "@/lib/tr";
import { Button } from "@/components/ui/button";

export default function WorkoutCompleteOverlay({
  resp,
  onDone,
}: {
  resp: WorkoutCompleteResponse;
  onDone: () => void;
}) {
  const w = resp.workout;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#09090B]/97 px-4 py-10"
      data-testid="workout-complete-overlay"
    >
      <div className="mx-auto w-full max-w-md rounded-xl border border-[#27272A] bg-[#141416] p-6">
        <p className="text-xs font-bold text-[#84CC16]">ANTRENMAN TAMAMLANDI</p>
        <h2 className="mt-1.5 font-heading text-3xl font-extrabold tracking-tight text-white" data-testid="complete-muscle-name">
          {MUSCLE_TR[w.muscle] ?? w.muscle}
        </h2>
        <p className="mt-1 text-sm text-zinc-400" data-testid="complete-clock">
          {w.start_clock} — {w.finish_clock}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {[
            { label: "Egzersiz", value: String(w.exercises.length), testid: "complete-exercises" },
            { label: "Set", value: `${w.completed_sets}/${w.total_sets}`, testid: "complete-sets" },
            { label: "Hacim", value: `${fmtNumTr(w.total_volume)} kg`, testid: "complete-volume" },
          ].map((t) => (
            <div key={t.label} className="rounded-lg border border-[#27272A] bg-[#18181B] p-3 text-center">
              <p className="text-[10px] font-semibold text-zinc-400">{t.label}</p>
              <p className="mt-0.5 font-heading text-lg font-extrabold text-white" data-testid={t.testid}>{t.value}</p>
            </div>
          ))}
        </div>

        {resp.prs.length > 0 && (
          <div className="mt-3 space-y-2" data-testid="complete-prs">
            {resp.prs.map((pr) => (
              <div
                key={pr.exercise_name}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#84CC16] bg-[#1A2210] p-3"
                data-testid={`pr-badge-${pr.exercise_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                <span className="flex items-center gap-2 text-[11px] font-bold text-[#84CC16]">
                  <Trophy className="h-4 w-4" aria-hidden /> KİŞİSEL REKOR
                </span>
                <span className="text-right font-heading text-xs font-bold text-white">
                  {pr.exercise_name}
                  <span className="block font-sans text-[11px] font-medium text-[#D9F99D]">
                    {fmtNumTr(pr.weight_kg)} kg × {pr.reps}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        <ul className="mt-4 space-y-2" data-testid="complete-messages">
          {resp.messages.map((m, i) => (
            <li key={i} className="text-sm leading-relaxed text-zinc-400">
              {m}
            </li>
          ))}
        </ul>

        <Button className="mt-6 min-h-12 w-full font-heading text-sm font-extrabold" onClick={onDone} data-testid="workout-complete-done-button">
          BİTİR <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
