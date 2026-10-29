import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import type { Profile } from "@/lib/types";
import MusicDock from "./MusicDock";

/* ---------------- Spotify iFrame API ---------------- */
let apiPromise: Promise<any> | null = null;

function loadSpotifyIframeApi(): Promise<any> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<any>((resolve) => {
    const w = window as any;
    if (w.SpotifyIframeApi) {
      resolve(w.SpotifyIframeApi);
      return;
    }

    const prev = w.onSpotifyIframeApiReady;
    w.onSpotifyIframeApiReady = (api: any) => {
      prev?.(api);
      resolve(api);
    };

    if (!document.getElementById("spotify-iframe-api")) {
      const s = document.createElement("script");
      s.id = "spotify-iframe-api";
      s.src = "https://open.spotify.com/embed/iframe-api/v1";
      s.async = true;
      document.body.appendChild(s);
    }
  });

  return apiPromise;
}

/* ---------------- URL -> spotify: URI ---------------- */
export function spotifyUriFromUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const url = raw.trim();

  const direct = url.match(/^spotify:(playlist|album|track|artist|show|episode):([A-Za-z0-9]+)$/);
  if (direct) return `spotify:${direct[1]}:${direct[2]}`;

  const web = url.match(
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/,
  );
  if (web) return `spotify:${web[1]}:${web[2]}`;

  return null;
}

/* ---------------- Context ---------------- */
type PlayerValue = {
  playlistUrl: string | null;
  playlistName: string;
  coverUrl: string | null;
  ready: boolean;
  isPlaying: boolean;
  visible: boolean;
  expanded: boolean;
  compact: boolean;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  expand: () => void;
  collapse: () => void;
  shrink: () => void; // panele değil, sadece plağa küçül
  hide: () => void;
};

const PlayerContext = createContext<PlayerValue | null>(null);

export function useMusicPlayer(): PlayerValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("useMusicPlayer sadece <SpotifyPlayerProvider> içinde kullanılabilir.");
  return ctx;
}

/* ---------------- Provider ---------------- */
const DISMISS_KEY = "music-dock-dismissed";

export function SpotifyPlayerProvider({ children }: { children: ReactNode }) {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => apiGet<Profile>("/profile"),
  });

  const playlistUrl = profile?.playlist_url?.trim() || null;
  const playlistName = profile?.playlist_name?.trim() || "Antrenman Listesi";
  const uri = useMemo(() => spotifyUriFromUrl(playlistUrl), [playlistUrl]);

  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [compact, setCompact] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  // ✅ Varsayılan GİZLİ. Kullanıcı açtıysa sessionStorage'da "0", kapattıysa "1".
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem(DISMISS_KEY) !== "0";
  });

  const setDismissedPersist = useCallback((v: boolean) => {
    setDismissed(v);
    try {
      sessionStorage.setItem(DISMISS_KEY, v ? "1" : "0");
    } catch {
      /* noop */
    }
  }, []);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<any>(null);
  const bootRef = useRef(false);
  const loadedUriRef = useRef<string | null>(null);

  /* 1) iframe'i BİR KEZ oluştur */
  useEffect(() => {
    if (bootRef.current || !uri) return;
    const host = hostRef.current;
    if (!host) return;
    bootRef.current = true;

    const mount = document.createElement("div");
    mount.style.width = "100%";
    mount.style.height = "100%";
    host.appendChild(mount);

    loadSpotifyIframeApi().then((api) => {
      api.createController(
        mount,
        { uri, width: 380, height: 352 },
        (controller: any) => {
          controllerRef.current = controller;
          loadedUriRef.current = uri;

          controller.addListener("ready", () => setReady(true));
          controller.addListener("playback_update", (e: any) => {
            setIsPlaying(!e?.data?.isPaused);
          });

          const el = controller.iframeElement as HTMLIFrameElement | undefined;
          if (el) {
            el.style.width = "100%";
            el.style.height = "100%";
            el.style.border = "0";
            el.style.display = "block";
          }
        },
      );
    });
    // cleanup yok: StrictMode'da iframe ölmesin
  }, [uri]);

  /* 2) profil değişince yeni listeyi yükle */
  useEffect(() => {
    const c = controllerRef.current;
    if (!c || !ready || !uri) return;
    if (loadedUriRef.current === uri) return;
    loadedUriRef.current = uri;
    c.loadEntity(uri);
  }, [ready, uri]);

  /* 3) albüm kapağı */
  useEffect(() => {
    if (!playlistUrl) {
      setCoverUrl(null);
      return;
    }
    let alive = true;
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(playlistUrl)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setCoverUrl(d?.thumbnail_url ?? null))
      .catch(() => alive && setCoverUrl(null));
    return () => {
      alive = false;
    };
  }, [playlistUrl]);

  /* 4) ❌ KALDIRILDI — playlistUrl değişince otomatik açma yok.
        Yeni liste kaydedildiğinde Music.tsx zaten player.expand() çağırıyor. */

  /* 5) kontroller */
  const toggle = useCallback(() => {
    const c = controllerRef.current;
    if (!c) return;
    if (typeof c.togglePlay === "function") c.togglePlay();
    else if (isPlaying) c.pause?.();
    else c.play?.();
  }, [isPlaying]);

  const prev = useCallback(() => {
    const c = controllerRef.current;
    if (!c) return;
    c.restart?.();
  }, []);

  const next = useCallback(() => {
    setDismissedPersist(false);
    setCompact(false);
    setExpanded(true);
    toast.info("Şarkı seçmek için listeyi açtım.");
  }, [setDismissedPersist]);

  /* --- görünüm modları --- */
  const expand = useCallback(() => {
    setDismissedPersist(false);
    setCompact(false);
    setExpanded(true);
  }, [setDismissedPersist]);

  const collapse = useCallback(() => {
    // mini player'a dön (kontrollerle)
    setExpanded(false);
    setCompact(false);
  }, []);

  const shrink = useCallback(() => {
    // sadece plağa küçül
    setExpanded(false);
    setCompact(true);
  }, []);

  const hide = useCallback(() => {
    setExpanded(false);
    setCompact(false);
    setDismissedPersist(true);
  }, [setDismissedPersist]);

  const value = useMemo<PlayerValue>(
    () => ({
      playlistUrl,
      playlistName,
      coverUrl,
      ready,
      isPlaying,
      visible: Boolean(playlistUrl) && !dismissed,
      expanded,
      compact,
      toggle,
      next,
      prev,
      expand,
      collapse,
      shrink,
      hide,
    }),
    [
      playlistUrl,
      playlistName,
      coverUrl,
      ready,
      isPlaying,
      dismissed,
      expanded,
      compact,
      toggle,
      next,
      prev,
      expand,
      collapse,
      shrink,
      hide,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <MusicDock hostRef={hostRef} />
    </PlayerContext.Provider>
  );
}