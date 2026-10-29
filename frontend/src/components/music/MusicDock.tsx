import type { RefObject } from "react";
import { ChevronDown, ListMusic, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMusicPlayer } from "./SpotifyPlayerProvider";
import Vinyl from "./Vinyl";

type Props = { hostRef: RefObject<HTMLDivElement | null> };

const iconBtn =
  "grid h-10 w-10 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/5 hover:text-white";
const iconBtnSm =
  "grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/5 hover:text-white";

const vinylBtn =
  "grid shrink-0 place-items-center rounded-full transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84CC16] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141416]";

export default function MusicDock({ hostRef }: Props) {
  const p = useMusicPlayer();

  const showPanel = Boolean(p.playlistUrl) && p.expanded;
  const showCompact = p.visible && p.compact && !p.expanded;
  const showMini = p.visible && !p.expanded && !p.compact;

  return (
    <>
      {/* ---- iframe kabı ---- */}
      <div
        aria-hidden={!showPanel}
        className={cn(
          "z-40 bg-[#141416]",
          showPanel
            ? cn(
                "fixed inset-x-0 top-0 flex flex-col border-b border-[#27272A] px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[0_8px_40px_rgba(0,0,0,0.6)]",
                "md:inset-x-auto md:bottom-4 md:right-4 md:top-auto md:w-[min(92vw,380px)] md:rounded-2xl md:border md:p-3 md:pt-3 md:pb-3 md:shadow-2xl",
              )
            : "pointer-events-none fixed left-[-9999px] top-0 h-[420px] w-[380px] opacity-0",
        )}
      >
        {showPanel && (
          <div className="mb-2 flex items-center gap-2">
            {/* Dekoratif plak — tıklanamaz */}
            <Vinyl playing={p.isPlaying} cover={p.coverUrl} size="sm" />

            <p className="min-w-0 flex-1 truncate text-sm font-bold text-white">
              {p.playlistName}
            </p>

            {/* Chevron → MİNİ */}
            <button
              type="button"
              onClick={p.collapse}
              aria-label="Mini oynatıcıya küçült"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}

        <div ref={hostRef} className="h-[352px] w-full overflow-hidden rounded-lg bg-black" />

        {showPanel && (
          <div className="mt-3 flex items-center justify-center gap-3">
            <button type="button" onClick={p.prev} aria-label="Önceki / başa al" className={iconBtn}>
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={p.toggle}
              aria-label={p.isPlaying ? "Duraklat" : "Çal"}
              className="grid h-11 w-11 place-items-center rounded-full bg-[#84CC16] text-black transition-transform hover:scale-105"
            >
              {p.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px]" />}
            </button>
            <button type="button" onClick={p.next} aria-label="Sonraki" className={iconBtn}>
              <SkipForward className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* ---- SADECE PLAK: plak → MİNİ ---- */}
      {showCompact && (
        <button
          type="button"
          onClick={p.collapse}
          aria-label="Mini oynatıcıya geç"
          data-testid="vinyl-only"
          className={cn(
            "fixed z-50 rounded-full border border-[#27272A] bg-[#141416]/95 p-1.5 shadow-2xl backdrop-blur",
            "right-3 top-[max(0.5rem,env(safe-area-inset-top))]",
            "md:bottom-4 md:right-4 md:top-auto",
            "transition-transform hover:scale-105 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84CC16] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0E11]",
          )}
        >
          <Vinyl playing={p.isPlaying} cover={p.coverUrl} />
        </button>
      )}

      {/* ---- MİNİ OYNATICI ---- */}
      {showMini && (
        <div
          data-testid="mini-player"
          className={cn(
            "fixed z-50 flex items-center gap-2 border-[#27272A] bg-[#141416]/95 shadow-2xl backdrop-blur",
            "inset-x-0 top-0 border-b px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]",
            "md:inset-x-auto md:left-auto md:top-auto md:bottom-4 md:right-4 md:w-auto md:rounded-2xl md:border md:p-2",
          )}
        >
          {/* MİNİ plak → SADECE PLAK */}
          <button
            type="button"
            onClick={p.shrink}
            aria-label="Sadece plağı göster"
            className={vinylBtn}
          >
            <Vinyl playing={p.isPlaying} cover={p.coverUrl} />
          </button>

          <div className="min-w-0 flex-1 pr-1 md:max-w-[132px] md:flex-none">
            <p className="truncate text-xs font-bold text-white">{p.playlistName}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {p.isPlaying ? "Çalıyor" : "Duraklatıldı"}
            </p>
          </div>

          <div className="flex items-center gap-0.5">
            <button type="button" onClick={p.prev} aria-label="Önceki" className={iconBtnSm}>
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={p.toggle}
              aria-label={p.isPlaying ? "Duraklat" : "Çal"}
              className="grid h-9 w-9 place-items-center rounded-full bg-[#84CC16] text-black transition-transform hover:scale-105"
            >
              {p.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
            </button>
            <button type="button" onClick={p.next} aria-label="Sonraki" className={iconBtnSm}>
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          {/* ListMusic → PANEL | X → gizle */}
          <div className="flex items-center gap-0.5 md:ml-1 md:border-l md:border-[#27272A] md:pl-2">
            <button type="button" onClick={p.expand} aria-label="Listeyi aç" className={iconBtnSm}>
              <ListMusic className="h-4 w-4" />
            </button>
            <button type="button" onClick={p.hide} aria-label="Oynatıcıyı gizle" className={iconBtnSm}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}