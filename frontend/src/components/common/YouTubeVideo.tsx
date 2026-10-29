import { cn } from "@/lib/utils";
import { ytWatchUrl } from "@/lib/tr";

// Official YouTube IFrame embed, privacy-enhanced host, lazy-loaded, never autoplays.
// If the embed cannot load, the "watch on youtube" fallback keeps the user moving.
export default function YouTubeVideo({
  videoId,
  title,
  className,
}: {
  videoId: string;
  title: string;
  className?: string;
}) {
  if (!videoId) {
    return (
      <div
        className={cn(
          "flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-md border border-[#242424] bg-[#111111]",
          className,
        )}
        data-testid="video-unavailable"
      >
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Video bulunamadı
        </p>
      </div>
    );
  }

  return (
    <iframe
      title={title}
      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&playsinline=1`}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      data-testid="exercise-video"
      className={cn("aspect-video w-full rounded-md border border-[#242424] bg-[#111111]", className)}
    />
  );
}

export function YouTubeFallbackLink({ videoId }: { videoId: string }) {
  return (
    <a
      href={ytWatchUrl(videoId)}
      target="_blank"
      rel="noreferrer"
      data-testid="video-fallback-link"
      className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
    >
      Video açılmıyorsa YouTube'da izle
    </a>
  );
}
