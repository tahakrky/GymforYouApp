import { cn } from "@/lib/utils";

type Props = {
  playing?: boolean;
  cover?: string | null;
  size?: "sm" | "md";
  className?: string;
};

export default function Vinyl({ playing = false, cover, size = "md", className }: Props) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative shrink-0 rounded-full bg-zinc-950 ring-1 ring-white/10",
        size === "md" ? "h-12 w-12" : "h-8 w-8",
        className,
      )}
      style={{
        animation: "vinyl-spin 4s linear infinite",
        animationPlayState: playing ? "running" : "paused",
      }}
    >
      {/* plak olukları */}
      <div
        className="absolute inset-0 rounded-full opacity-70"
        style={{
          background:
            "repeating-radial-gradient(circle at center, rgba(255,255,255,0.08) 0 1px, transparent 1px 3px)",
        }}
      />
      {/* albüm kapağı */}
      <div
        className="absolute inset-[28%] rounded-full bg-gradient-to-br from-[#84CC16] to-emerald-800"
        style={
          cover
            ? { backgroundImage: `url("${cover}")`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      />
      {/* göbek deliği */}
      <div className="absolute left-1/2 top-1/2 h-[16%] w-[16%] min-h-[3px] min-w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-800 ring-1 ring-white/25" />
    </div>
  );
}