// Official Spotify embed player — no OAuth, no API keys. Playback starts only from the
// user's own tap inside the iframe (browser autoplay policies respected).

export default function SpotifyEmbed({
  playlistUrl,
  compact = false,
}: {
  playlistUrl: string;
  compact?: boolean;
}) {
  const id = playlistUrl.match(/playlist\/([A-Za-z0-9]+)/)?.[1];
  if (!id) {
    return (
      <p className="rounded-md border border-[#242424] bg-[#111111] p-4 font-mono text-xs uppercase tracking-widest text-muted-foreground" data-testid="spotify-embed-invalid">
        Geçersiz Spotify çalma listesi bağlantısı
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-[#242424] bg-[#111111]" data-testid="spotify-embed">
      <iframe
        title="Spotify workout playlist"
        src={`https://open.spotify.com/embed/playlist/${id}?utm_source=generator&theme=0`}
        width="100%"
        height={compact ? 152 : 352}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        className="block w-full"
      />
    </div>
  );
}
