// Turkish UI vocabulary. The interface is Turkish-only; exercise names keep their
// commonly used English names, which is what the athlete reads in the gym.
// Turkish strings are written in their final casing — never uppercased via CSS, because
// text-transform breaks the dotted/dotless i (İ/ı).

export const MUSCLE_TR: Record<string, string> = {
  biceps: "BİSEPS",
  triceps: "TRİSEPS",
  forearms: "ÖN KOL",
  shoulders: "OMUZ",
  chest: "GÖĞÜS",
  back: "SIRT",
  legs: "BACAK",
  abs: "KARIN",
  glutes: "KALÇA",
};

// Sentence-case form, for use inside running text.
export const MUSCLE_TR_SOFT: Record<string, string> = {
  biceps: "Biseps",
  triceps: "Triseps",
  forearms: "Ön Kol",
  shoulders: "Omuz",
  chest: "Göğüs",
  back: "Sırt",
  legs: "Bacak",
  abs: "Karın",
  glutes: "Kalça",
};

export const MUSCLE_SHORT: Record<string, string> = {
  biceps: "Bİ",
  triceps: "TR",
  forearms: "ÖK",
  shoulders: "OM",
  chest: "GÖ",
  back: "SI",
  legs: "BA",
  abs: "KA",
  glutes: "KL",
};

export const EQUIPMENT_TR: Record<string, string> = {
  dumbbell: "Dambıl",
  bench: "Sehpa",
  bodyweight: "Vücut ağırlığı",
  band: "Direnç lastiği",
  pullup_bar: "Barfiks",
  barbell: "Halter",
  cable: "Kablo makinesi",
  machine: "Makine",
};

export const DIFFICULTY_TR: Record<string, string> = {
  beginner: "Başlangıç",
  intermediate: "Orta",
  advanced: "İleri",
};

export const DAY_TR: Record<string, string> = {
  MON: "PZT",
  TUE: "SAL",
  WED: "ÇAR",
  THU: "PER",
  FRI: "CUM",
  SAT: "CMT",
  SUN: "PAZ",
};

export const DAY_FULL_TR: Record<string, string> = {
  mon: "PAZARTESİ",
  tue: "SALI",
  wed: "ÇARŞAMBA",
  thu: "PERŞEMBE",
  fri: "CUMA",
  sat: "CUMARTESİ",
  sun: "PAZAR",
};

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const MONTHS_TR_SHORT = [
  "OCA", "ŞUB", "MAR", "NİS", "MAY", "HAZ",
  "TEM", "AĞU", "EYL", "EKİ", "KAS", "ARA",
];

export function greetingTr(): string {
  const h = new Date().getHours();
  if (h < 6) return "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

export function fmtDateTr(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDateShortTr(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_TR_SHORT[d.getMonth()]}`;
}

export function fmtNumTr(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

export function fmtDurationTr(sec: number | null | undefined): string {
  if (!sec) return "—";
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return `${m} dk`;
  return `${Math.floor(m / 60)} sa ${m % 60} dk`;
}

// The athlete's own clock, sent with start/finish so history shows their local time.
export function localClock(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ytThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function ytWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// Error text from the backend's HTTPException detail (already Turkish), so the athlete
// sees the real reason — e.g. the daily or weekly limit message.
export function apiErrTr(err: unknown, fallback = "Bir hata oluştu. Tekrar dene."): string {
  const body = (err as { body?: unknown })?.body;
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    if (typeof first?.msg === "string") return first.msg;
  }
  return fallback;
}
