import { useEffect, useState } from "react";
import { defaultView, muscleRender } from "@/lib/assets";
import { MUSCLE_TR } from "@/lib/tr";
import { cn } from "@/lib/utils";

/** The athlete's own anatomy renders with tappable muscle regions.
 *  Selecting a muscle swaps in that muscle's own render and rotates the figure to the side
 *  the muscle actually lives on (chest -> front, back -> back), so the highlight is always
 *  visible. The uploads are blue-on-white, so `anatomy-blend` (mix-blend-mode: screen)
 *  drops the white backdrop. Hotspots are percentage boxes, so they track any size. */

type Region = { muscle: string; left: number; top: number; width: number; height: number };

// Percentages of the image box, measured against the uploaded renders.
const FRONT: Region[] = [
  { muscle: "shoulders", left: 25, top: 18, width: 12, height: 8 },
  { muscle: "shoulders", left: 63, top: 18, width: 12, height: 8 },
  { muscle: "chest", left: 36, top: 19, width: 28, height: 10 },
  { muscle: "biceps", left: 22, top: 27, width: 11, height: 10 },
  { muscle: "biceps", left: 67, top: 27, width: 11, height: 10 },
  { muscle: "forearms", left: 18, top: 38, width: 11, height: 12 },
  { muscle: "forearms", left: 71, top: 38, width: 11, height: 12 },
  { muscle: "abs", left: 41, top: 29, width: 18, height: 15 },
  { muscle: "legs", left: 33, top: 51, width: 15, height: 22 },
  { muscle: "legs", left: 52, top: 51, width: 15, height: 22 },
];

const BACK: Region[] = [
  { muscle: "shoulders", left: 25, top: 18, width: 12, height: 8 },
  { muscle: "shoulders", left: 63, top: 18, width: 12, height: 8 },
  { muscle: "back", left: 36, top: 19, width: 28, height: 20 },
  { muscle: "triceps", left: 22, top: 27, width: 11, height: 10 },
  { muscle: "triceps", left: 67, top: 27, width: 11, height: 10 },
  { muscle: "forearms", left: 18, top: 38, width: 11, height: 12 },
  { muscle: "forearms", left: 71, top: 38, width: 11, height: 12 },
  { muscle: "glutes", left: 38, top: 43, width: 24, height: 9 },
  { muscle: "legs", left: 33, top: 52, width: 15, height: 24 },
  { muscle: "legs", left: 52, top: 52, width: 15, height: 24 },
];

export default function BodyViewer({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (muscle: string) => void;
}) {
  const [view, setView] = useState<"front" | "back">(() => defaultView(selected));

  // Rotate the body automatically to the side the selected muscle is on.
  useEffect(() => {
    setView(defaultView(selected));
  }, [selected]);

  const regions = view === "front" ? FRONT : BACK;

  return (
    <div data-testid="body-viewer">
      <div className="mb-3 grid grid-cols-2 gap-2">
        {([
          { key: "front", label: "ÖN" },
          { key: "back", label: "ARKA" },
        ] as const).map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            data-testid={`body-view-${v.key}`}
            className={cn(
              "rounded-md border px-4 py-2 text-xs font-bold transition-colors duration-150",
              view === v.key
                ? "border-[#84CC16] bg-[#1E2B0E] text-[#84CC16]"
                : "border-[#27272A] bg-[#141416] text-zinc-400 hover:text-white",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-lg border border-[#1E293B] bg-[#0D0E12]">
        <div className="relative mx-auto aspect-[2/3] w-full max-w-[300px]">
          <img
            key={`${selected}-${view}`}
            src={muscleRender(selected, view)}
            alt={`${MUSCLE_TR[selected] ?? selected} — ${view === "front" ? "ön görünüm" : "arka görünüm"}`}
            data-testid="body-image"
            loading="eager"
            decoding="async"
            className="anatomy-blend absolute inset-0 h-full w-full animate-[fade-in_220ms_ease-out] object-contain"
          />

          {regions.map((r, i) => (
            <button
              key={`${r.muscle}-${i}`}
              onClick={() => onSelect(r.muscle)}
              aria-label={MUSCLE_TR[r.muscle] ?? r.muscle}
              data-testid={`body-region-${r.muscle}`}
              className="absolute cursor-pointer"
              style={{
                left: `${r.left}%`,
                top: `${r.top}%`,
                width: `${r.width}%`,
                height: `${r.height}%`,
              }}
            />
          ))}
        </div>

        <p
          className="border-t border-[#1E293B] px-4 py-2.5 text-center text-xs font-bold text-[#84CC16]"
          data-testid="body-selected-label"
        >
          {MUSCLE_TR[selected] ?? selected} · {view === "front" ? "ÖN" : "ARKA"}
        </p>
      </div>
    </div>
  );
}