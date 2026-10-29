import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const LOGO_URL = "/dumbell%20logo.png";

/** Splash ekranı toplam süreleri (ms) */
const HOLD_MS = 1400; // ekranda kalma süresi
const EXIT_MS = 400; // fade-out animasyonu

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setExiting(true), HOLD_MS);
    const t2 = window.setTimeout(onDone, HOLD_MS + EXIT_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-[#09090B]",
        "transition-opacity duration-[400ms] ease-out",
        exiting ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      {/* Arka ışık halkası */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(132,204,22,0.12) 0%, rgba(132,204,22,0.03) 40%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-5">
        <img
          src={LOGO_URL}
          alt=""
          className="h-20 w-20 object-contain drop-shadow-[0_0_40px_rgba(132,204,22,0.55)]"
          style={{
            animation:
              "splash-pop 700ms cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        />
        <span
          className="font-heading text-3xl font-extrabold tracking-tight text-white"
          style={{
            animation: "splash-fade-up 500ms 200ms ease-out both",
          }}
        >
          Gym<span className="text-[#84CC16]">ForYou</span>
        </span>
      </div>
    </div>
  );
}