import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Exercise } from "@/lib/types";
import { MUSCLE_TR } from "@/lib/tr";
import { cn } from "@/lib/utils";

interface Props {
  muscle: string;
  /** Açılış anındaki mevcut plan — sadece başlangıç değeri olarak kullanılır. */
  currentPlan: Exercise[];
  onClose: () => void;
  /** KAYDET'e basılınca çağrılır. Vazgeçilirse çağrılmaz. */
  onSave: (picked: Exercise[]) => void;
}

/**
 * Egzersiz seçici. Spor salonunda, yüksek adrenalinle kullanılmak üzere:
 *   * satıra bas = seç/kaldır (henüz kaydedilmedi)
 *   * altta KAYDET butonu — kaç tanesinin seçili olduğunu gösterir
 *   * X, ESC veya VAZGEÇ = sessizce kapatır
 *
 * Mobile: tam ekran sheet. Desktop (md+): ortalanmış kart, iki kolon liste.
 */
export default function ExercisePickerSheet({
  muscle,
  currentPlan,
  onClose,
  onSave,
}: Props) {
  const [all, setAll] = useState<Exercise[]>([]);
  const [picked, setPicked] = useState<Exercise[]>(currentPlan);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGet<Exercise[]>(`/exercises?muscle=${muscle}`)
      .then((data) => {
        if (!cancelled) setAll(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setAll([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [muscle]);

  const sameSet = (a: Exercise[], b: Exercise[]) =>
    a.length === b.length && a.every((x) => b.some((y) => y.id === x.id));
  const dirty = !sameSet(picked, currentPlan);

  // ESC ile kapat + arka plan kaydırmayı kilitle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const isPicked = (id: string) => picked.some((p) => p.id === id);

  const toggle = (ex: Exercise) => {
    setPicked((prev) =>
      prev.some((p) => p.id === ex.id)
        ? prev.filter((p) => p.id !== ex.id)
        : [...prev, ex],
    );
  };

  const commit = () => onSave(picked);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 backdrop-blur-sm md:items-center md:p-6"
      onClick={onClose}
      data-testid="exercise-picker-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex w-full flex-col bg-[#0A0A0B]",
          "h-full",
          "md:h-auto md:max-h-[85vh] md:max-w-3xl md:overflow-hidden md:rounded-xl md:border md:border-[#27272A] md:shadow-2xl md:shadow-black/50",
        )}
        data-testid="exercise-picker"
      >
        <header className="flex items-center justify-between border-b border-[#27272A] p-4 md:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-wide text-[#84CC16]">
              EGZERSİZ SEÇ
            </p>
            <h2 className="mt-0.5 truncate font-heading text-xl font-extrabold text-white">
              {MUSCLE_TR[muscle] ?? muscle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            data-testid="picker-close"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-[#27272A] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white active:scale-95"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        <div
          className={cn(
            "flex-1 overflow-y-auto p-4 md:px-6",
            "space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0",
          )}
        >
          {loading && (
            <>
              <div className="h-20 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]" />
              <div className="h-20 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]" />
            </>
          )}

          {!loading && all.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500 md:col-span-2">
              Bu kas grubunda egzersiz bulunamadı.
            </p>
          )}

          {!loading &&
            all.map((e) => {
              const on = isPicked(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggle(e)}
                  aria-pressed={on}
                  data-testid={`picker-item-${e.id}`}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors active:scale-[0.99]",
                    on
                      ? "border-[#84CC16] bg-[#1E2B0E]"
                      : "border-[#27272A] bg-[#141416] hover:border-zinc-700 active:bg-[#18181B]",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition-colors",
                      on
                        ? "border-[#84CC16] bg-[#84CC16] text-[#09090B]"
                        : "border-[#3F3F46] text-transparent",
                    )}
                  >
                    <Check className="h-6 w-6" strokeWidth={3} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-base font-bold text-white">
                      {e.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-400">
                      {e.equipment_label} · %{e.activation}
                    </p>
                  </div>
                </button>
              );
            })}
        </div>

        <div className="flex gap-2 border-t border-[#27272A] bg-[#0A0A0B] p-4 pb-6 md:px-6 md:pb-5">
          <button
            type="button"
            onClick={onClose}
            data-testid="picker-cancel"
            className="min-h-14 shrink-0 rounded-md border border-[#27272A] px-5 font-heading text-sm font-extrabold tracking-wide text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white active:scale-[0.99]"
          >
            VAZGEÇ
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={!dirty}
            data-testid="picker-save"
            className={cn(
              "min-h-14 flex-1 rounded-md font-heading text-base font-extrabold transition-colors active:scale-[0.99]",
              dirty
                ? "bg-[#84CC16] text-[#09090B] hover:bg-[#A3E635]"
                : "cursor-not-allowed border border-[#27272A] bg-[#141416] text-zinc-600",
            )}
          >
            {dirty ? `KAYDET (${picked.length})` : "DEĞİŞİKLİK YOK"}
          </button>
        </div>
      </div>
    </div>
  );
}