// User-supplied assets. These are the athlete's own files — never swap them for
// generated replacements, and never render a brand name alongside the logo.

// Assets live in `frontend/public/`, so they're served from the site root.
const BASE = "/anatomy";

export const LOGO_URL = "/dumbell-logo.png"; // ⚠️ bkz. aşağıdaki not

export const BODY_FRONT_URL = `${BASE}/front.png`;
export const BODY_BACK_URL = `${BASE}/back.png`;

/** The athlete's own anatomy renders, one per muscle group: the full figure with that
 *  muscle highlighted in lime. `view` decides whether the body viewer shows the front or
 *  the back render, so selecting a muscle rotates the body automatically. */
export const MUSCLE_RENDERS: Record<string, { view: "front" | "back"; url: string }> = {
  chest: { view: "front", url: `${BASE}/front-gogus.png` },
  abs: { view: "front", url: `${BASE}/front-karın.png` },
  biceps: { view: "front", url: `${BASE}/front-biseps.png` },
  forearms: { view: "front", url: `${BASE}/front-on-kol.png` },
  shoulders: { view: "front", url: `${BASE}/front-omuz.png` },
  legs: { view: "front", url: `${BASE}/front-bacak.png` },
  back: { view: "back", url: `${BASE}/back-sırt.png` },
  triceps: { view: "back", url: `${BASE}/back-triseps.png` },
  glutes: { view: "back", url: `${BASE}/back-kalca.png` },
};

/** Back-view variants that exist for muscles whose main render is the front view. */
export const MUSCLE_RENDERS_BACK: Record<string, string> = {
  shoulders: `${BASE}/back-omuz.png`,
};

export function muscleRender(muscle: string, view: "front" | "back"): string {
  if (view === "back" && MUSCLE_RENDERS_BACK[muscle]) return MUSCLE_RENDERS_BACK[muscle];
  const render = MUSCLE_RENDERS[muscle];
  if (render && render.view === view) return render.url;
  return view === "front" ? BODY_FRONT_URL : BODY_BACK_URL;
}

export function defaultView(muscle: string): "front" | "back" {
  return MUSCLE_RENDERS[muscle]?.view ?? "front";
}