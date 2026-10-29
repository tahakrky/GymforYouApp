import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, ListMusic } from "lucide-react";
import { toast } from "sonner";
import { apiPut } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { apiErrTr } from "@/lib/tr";
import { qk } from "@/lib/queryKeys";
import { useMusicPlayer } from "@/components/music/SpotifyPlayerProvider";
import Vinyl from "@/components/music/Vinyl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Music() {
  const queryClient = useQueryClient();
  const player = useMusicPlayer();

  const [url, setUrl] = useState("");
  const [name, setName] = useState("");

  const save = useMutation({
    mutationFn: () =>
      apiPut<Profile>("/profile/playlist", {
        playlist_url: url.trim(),
        playlist_name: name.trim() || "Antrenman Listesi",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.profile() });
      toast.success("Çalma listesi güncellendi.");
      setUrl("");
      setName("");
      player.expand();
    },
    onError: (err) => toast.error(apiErrTr(err)),
  });

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
        Müzik
      </h1>

      {player.playlistUrl && (
        <section className="space-y-3" data-testid="music-current">
          <div className="flex items-center gap-3 rounded-lg border border-[#27272A] bg-[#141416] p-3">
            <button
              type="button"
              onClick={player.expand}
              aria-label="Oynatıcıyı aç"
              className="grid shrink-0 place-items-center rounded-full transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84CC16] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141416]"
            >
              <Vinyl playing={player.isPlaying} cover={player.coverUrl} />
            </button>

            <div className="min-w-0 flex-1">
              <p
                className="truncate font-heading text-base font-extrabold tracking-tight text-white"
                data-testid="music-playlist-name"
              >
                {player.playlistName}
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {player.isPlaying ? "Şu an çalıyor" : "Duraklatıldı"}
              </p>
            </div>

            <Button
              onClick={player.expand}
              data-testid="music-open-player-button"
              className="min-h-11 shrink-0"
            >
              <ListMusic className="mr-1.5 h-4 w-4" />
              OYNATICI
            </Button>
          </div>

          <a
            href={player.playlistUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="music-open-spotify-button"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#84CC16] bg-[#1E2B0E] px-4 text-xs font-bold text-[#84CC16] transition-colors hover:bg-[#2A3A14]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden /> SPOTIFY'DA AÇ
          </a>

          <p
            className="text-xs leading-relaxed text-zinc-500"
            data-testid="music-note"
          >
            Müzik sekmeler arasında gezerken çalmaya devam eder. Sağ alttaki
            mini oynatıcıdan durdurabilir, şarkı değiştirebilir veya listeyi
            açabilirsin. Spotify yerleşik oynatıcı girişsiz 30 saniyelik
            önizleme çalar.
          </p>
        </section>
      )}

      <section
        className="space-y-3 rounded-lg border border-[#27272A] bg-[#141416] p-4"
        data-testid="music-change"
      >
        <p className="text-[11px] font-semibold text-zinc-400">
          Çalma listesini değiştir
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="playlist-url">Spotify çalma listesi bağlantısı</Label>
          <Input
            id="playlist-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://open.spotify.com/playlist/…"
            data-testid="music-url-input"
            className="min-h-12"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="playlist-name">Görünen ad</Label>
          <Input
            id="playlist-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spor listesi"
            data-testid="music-name-input"
            className="min-h-12"
          />
        </div>
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || !url.trim()}
          data-testid="music-save-button"
          className="min-h-12"
        >
          {save.isPending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </section>
    </div>
  );
}