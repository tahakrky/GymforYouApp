import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Eye, EyeOff, LogOut, Music, Phone } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { EQUIPMENT_OPTIONS, type Profile as ProfileT } from "@/lib/types";
import { EQUIPMENT_TR, apiErrTr, fmtNumTr } from "@/lib/tr";
import { qk } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WEEKLY_LIMITS = [1, 2, 3, 4];
const DUMBBELL_COUNTS = [1, 2];

function formatTrPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("90")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  d = d.slice(0, 10);
  const parts: string[] = [];
  if (d.length > 0) parts.push(d.slice(0, 3));
  if (d.length > 3) parts.push(d.slice(3, 6));
  if (d.length > 6) parts.push(d.slice(6, 8));
  if (d.length > 8) parts.push(d.slice(8, 10));
  return parts.join(" ");
}

const sortedKey = (list: string[] | undefined) =>
  [...(list ?? [])].sort().join("|");

function translateApiErrors(err: unknown): string {
  const e = err as {
    status?: number;
    body?: {
      detail?:
        | string
        | {
            type?: string;
            msg?: string;
            loc?: (string | number)[];
            ctx?: Record<string, unknown>;
          }[];
    };
  };

  if (e.status === 422 && Array.isArray(e.body?.detail)) {
    const FIELD_TR: Record<string, string> = {
      name: "İsim",
      age: "Yaş",
      height_cm: "Boy",
      weight_kg: "Kilo",
      phone: "Telefon",
      weekly_limit: "Haftalık limit",
      dumbbell_weight_kg: "Dambıl ağırlığı",
      dumbbell_count: "Dambıl sayısı",
      playlist_url: "Çalma listesi bağlantısı",
      new_password: "Yeni şifre",
    };

    const messages = e.body.detail.map((d) => {
      const key = d.loc?.[d.loc.length - 1];
      const field = typeof key === "string" ? key : "";
      const label = FIELD_TR[field] ?? field ?? "Alan";

      switch (d.type) {
        case "greater_than_equal": {
          const min = d.ctx?.ge;
          return `${label} en az ${min} olmalı.`;
        }
        case "less_than_equal": {
          const max = d.ctx?.le;
          return `${label} en fazla ${max} olabilir.`;
        }
        case "string_too_short": {
          const min = d.ctx?.min_length;
          return `${label} en az ${min} karakter olmalı.`;
        }
        case "string_too_long": {
          const max = d.ctx?.max_length;
          return `${label} en fazla ${max} karakter olabilir.`;
        }
        case "missing":
          return `${label} zorunlu.`;
        case "int_parsing":
        case "int_type":
        case "float_parsing":
        case "float_type":
          return `${label} sayı olmalı.`;
        default:
          return d.msg ?? `${label} geçersiz.`;
      }
    });

    return messages.join(" ");
  }

  return apiErrTr(err);
}

export default function Profile() {
  const queryClient = useQueryClient();
  const { user, logout, isLoggingOut } = useAuth();

  const { data: profile } = useQuery({
    queryKey: qk.profile(),
    queryFn: () => apiGet<ProfileT>("/profile"),
    staleTime: 5 * 60_000,
  });

  const [form, setForm] = useState<Partial<ProfileT>>({});
  const [phone, setPhone] = useState("");
  const [weightInput, setWeightInput] = useState("");

  const [resetWeekOpen, setResetWeekOpen] = useState(false);
  const [resetTodayOpen, setResetTodayOpen] = useState(false);

  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistName, setPlaylistName] = useState("");

  const [pwdOpen, setPwdOpen] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError] = useState("");

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || user?.name || "",
        age: profile.age,
        height_cm: profile.height_cm,
        weekly_limit: profile.weekly_limit,
        owned_equipment: [...profile.owned_equipment],
        dumbbell_weight_kg: profile.dumbbell_weight_kg,
        dumbbell_count: profile.dumbbell_count,
        equipment_filter_default: profile.equipment_filter_default,
      });
      setPhone(formatTrPhone(profile.phone ?? ""));
      setPlaylistUrl(profile.playlist_url ?? "");
      setPlaylistName(profile.playlist_name ?? "");
    }
  }, [profile, user]);

  const isDirty = useMemo(() => {
    if (!profile) return false;

    const formSame =
      (form.name ?? "") === (profile.name ?? "") &&
      (form.age ?? null) === (profile.age ?? null) &&
      (form.height_cm ?? null) === (profile.height_cm ?? null) &&
      (form.dumbbell_weight_kg ?? null) ===
        (profile.dumbbell_weight_kg ?? null) &&
      (form.dumbbell_count ?? 2) === (profile.dumbbell_count ?? 2) &&
      (form.weekly_limit ?? 2) === (profile.weekly_limit ?? 2) &&
      (form.equipment_filter_default ?? "mine") ===
        (profile.equipment_filter_default ?? "mine") &&
      sortedKey(form.owned_equipment) === sortedKey(profile.owned_equipment);

    const phoneSame = phone === formatTrPhone(profile.phone ?? "");
    const playlistUrlSame =
      playlistUrl.trim() === (profile.playlist_url ?? "");
    const playlistNameSame =
      playlistName.trim() === (profile.playlist_name ?? "");

    return !(formSame && phoneSame && playlistUrlSame && playlistNameSame);
  }, [form, phone, playlistUrl, playlistName, profile]);

  const [showSaveBar, setShowSaveBar] = useState(false);

  useEffect(() => {
    if (isDirty) {
      setShowSaveBar(true);
      return;
    }
    const t = window.setTimeout(() => setShowSaveBar(false), 250);
    return () => window.clearTimeout(t);
  }, [isDirty]);

  const save = useMutation({
    mutationFn: () =>
      apiPut<ProfileT>("/profile", {
        name: form.name,
        phone: phone ? `+90 ${phone}` : null,
        age: form.age != null ? Number(form.age) : null,
        height_cm: form.height_cm != null ? Number(form.height_cm) : null,
        weekly_limit:
          form.weekly_limit != null ? Number(form.weekly_limit) : null,
        owned_equipment: form.owned_equipment,
        dumbbell_weight_kg:
          form.dumbbell_weight_kg != null
            ? Number(form.dumbbell_weight_kg)
            : null,
        dumbbell_count:
          form.dumbbell_count != null ? Number(form.dumbbell_count) : null,
        equipment_filter_default: form.equipment_filter_default,
        playlist_url: playlistUrl.trim(),
        playlist_name: playlistUrl.trim()
          ? playlistName.trim() || "Antrenman Listesi"
          : "",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.profile() }),
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
        queryClient.invalidateQueries({ queryKey: ["summary"] }),
        queryClient.invalidateQueries({ queryKey: ["exercises"] }),
        queryClient.invalidateQueries({ queryKey: ["plan"] }),
      ]);
      toast.success("Profil kaydedildi.");
    },
    onError: (err) => toast.error(translateApiErrors(err)),
  });

  const addWeight = useMutation({
    mutationFn: () =>
      apiPost<ProfileT>("/profile/weight", { weight_kg: Number(weightInput) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.profile() });
      toast.success("Kilo kaydedildi.");
      setWeightInput("");
    },
    onError: (err) => toast.error(translateApiErrors(err)),
  });

  const resetWeek = useMutation({
    mutationFn: () => apiPost<{ deleted: number }>("/workouts/reset-week", {}),
    onSuccess: async (r) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["summary"] }),
        queryClient.invalidateQueries({ queryKey: ["workouts"] }),
        queryClient.invalidateQueries({ queryKey: ["muscle"] }),
      ]);
      toast.success(`Bu hafta sıfırlandı — ${r.deleted} kayıt silindi.`);
      setResetWeekOpen(false);
    },
    onError: (err) => toast.error(apiErrTr(err)),
  });

  const resetToday = useMutation({
    mutationFn: () =>
      apiPost<{ deleted: number }>("/workouts/reset-today", {}),
    onSuccess: async (r) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["summary"] }),
        queryClient.invalidateQueries({ queryKey: ["workouts"] }),
        queryClient.invalidateQueries({ queryKey: ["muscle"] }),
      ]);
      toast.success(
        r.deleted > 0
          ? `Bugünün kayıtları silindi — ${r.deleted} antrenman.`
          : "Bugün için silinecek kayıt yoktu.",
      );
      setResetTodayOpen(false);
    },
    onError: (err) => toast.error(apiErrTr(err)),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      apiPost<void>("/auth/change-password", {
        new_password: newPwd,
      }),
    onSuccess: () => {
      toast.success("Şifren güncellendi.");
      resetPwdDialog();
    },
    onError: (err: unknown) => {
      setPwdError(translateApiErrors(err));
    },
  });

  const resetPwdDialog = useCallback(() => {
    setPwdOpen(false);
    setNewPwd("");
    setConfirmPwd("");
    setPwdError("");
    setShowNew(false);
    setShowConfirm(false);
  }, []);

  const submitPassword = useCallback(() => {
    setPwdError("");
    if (newPwd.length < 8) {
      setPwdError("Yeni şifre en az 8 karakter olmalı.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("Yeni şifreler birbiriyle uyuşmuyor.");
      return;
    }
    changePassword.mutate();
  }, [newPwd, confirmPwd, changePassword]);

  const toggleEquipment = useCallback((item: string) => {
    setForm((f) => {
      const list = new Set(f.owned_equipment ?? []);
      if (list.has(item)) list.delete(item);
      else list.add(item);
      list.add("bodyweight");
      return { ...f, owned_equipment: Array.from(list) };
    });
  }, []);

  const handleSave = useCallback(() => save.mutate(), [save]);

  if (!profile) {
    return (
      <div
        className="h-64 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]"
        data-testid="profile-skeleton"
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Profil
        </h1>
        <button
          type="button"
          onClick={logout}
          disabled={isLoggingOut}
          aria-label="Çıkış yap"
          title="Çıkış yap"
          data-testid="logout-button"
          className={cn(
            "group flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold",
            "text-zinc-500 transition-colors",
            "hover:bg-red-500/[0.08] hover:text-red-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40",
            isLoggingOut && "opacity-50",
          )}
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Çıkış
        </button>
      </div>

      <section className="space-y-3" data-testid="profile-form">
        <p className="text-[11px] font-semibold text-zinc-400">
          Kişisel bilgiler
        </p>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">İsim</Label>
            <Input
              id="pf-name"
              value={form.name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              data-testid="profile-name-input"
              className="min-h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-age">Yaş</Label>
            <Input
              id="pf-age"
              type="number"
              value={form.age ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  age: e.target.value ? Number(e.target.value) : null,
                }))
              }
              data-testid="profile-age-input"
              className="min-h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-height">Boy (cm)</Label>
            <Input
              id="pf-height"
              type="number"
              value={form.height_cm ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  height_cm: e.target.value ? Number(e.target.value) : null,
                }))
              }
              data-testid="profile-height-input"
              className="min-h-12"
            />
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pf-email">E-posta</Label>
            <Input
              id="pf-email"
              type="email"
              value={user?.email ?? ""}
              readOnly
              disabled
              data-testid="profile-email-input"
              className="min-h-12 cursor-not-allowed opacity-70"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-phone">Telefon</Label>
            <label
              htmlFor="pf-phone"
              className={cn(
                "flex h-12 items-center gap-2 rounded-md border border-[#27272A] bg-transparent px-3.5",
                "transition-colors focus-within:border-[#84CC16]/60",
              )}
            >
              <Phone className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
              <span className="select-none text-xs font-medium tabular-nums text-zinc-400">
                +90
              </span>
              <span className="h-4 w-px shrink-0 bg-[#27272A]" aria-hidden />
              <input
                id="pf-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={phone}
                onChange={(e) => setPhone(formatTrPhone(e.target.value))}
                placeholder="5XX XXX XX XX"
                data-testid="profile-phone-input"
                className={cn(
                  "h-full min-w-0 flex-1 bg-transparent text-sm tabular-nums text-white",
                  "outline-none placeholder:text-zinc-600",
                )}
              />
            </label>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pf-password">Şifre</Label>
          <button
            id="pf-password"
            type="button"
            onClick={() => setPwdOpen(true)}
            data-testid="change-password-button"
            className={cn(
              "flex h-12 w-full items-center justify-between gap-3 rounded-md border border-[#27272A] bg-transparent px-3.5",
              "text-sm transition-colors",
              "hover:border-[#84CC16]/60 hover:bg-white/[0.02]",
              "focus-visible:border-[#84CC16]/60 focus-visible:outline-none",
            )}
          >
            <span
              className="select-none tracking-[0.35em] text-zinc-500"
              aria-hidden
            >
              ••••••••
            </span>
            <span className="text-xs font-semibold text-[#84CC16]">
              Değiştir
            </span>
          </button>
        </div>
      </section>

      <section className="space-y-3" data-testid="weight-section">
        <p className="text-[11px] font-semibold text-zinc-400">
          Vücut ağırlığı
        </p>
        <p className="text-sm text-zinc-300">
          Güncel:{" "}
          <span
            className="font-heading text-xl font-extrabold text-white"
            data-testid="weight-current"
          >
            {profile.weight_kg ? `${fmtNumTr(profile.weight_kg)} kg` : "—"}
          </span>
        </p>
        <div className="flex gap-2">
          <Input
            type="number"
            step={0.1}
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder="Yeni kilo"
            data-testid="weight-input"
            className="min-h-12 max-w-40"
          />
          <Button
            variant="outline"
            onClick={() => addWeight.mutate()}
            disabled={addWeight.isPending || !weightInput}
            data-testid="weight-add-button"
            className="min-h-12"
          >
            {addWeight.isPending ? "Ekleniyor…" : "Ekle"}
          </Button>
        </div>
      </section>

      <section className="space-y-3" data-testid="equipment-settings">
        <p className="text-[11px] font-semibold text-zinc-400">Ekipmanım</p>
        <p className="text-xs leading-relaxed text-zinc-500">
          Antrenman planları ve "Ekipmanım" filtresi sadece sahip olduğun
          ekipmanı kullanır. Yeni ekipman aldıkça buradan ekle.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-db">Dambıl ağırlığı (kg)</Label>
            <Input
              id="pf-db"
              type="number"
              step={0.5}
              value={form.dumbbell_weight_kg ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  dumbbell_weight_kg: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
              data-testid="equipment-dumbbell-weight-input"
              className="min-h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Dambıl sayısı</Label>
            <Select
              modal={false}
              value={String(form.dumbbell_count ?? 2)}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, dumbbell_count: Number(v) }))
              }
            >
              <SelectTrigger
                data-testid="equipment-dumbbell-count-select"
                className="min-h-12 w-full"
              >
                <SelectValue>{(v: string) => `${v} dambıl`}</SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {DUMBBELL_COUNTS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} dambıl
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Sahip olduğum ekipman</Label>
          <div
            className="flex flex-wrap gap-1.5"
            data-testid="equipment-toggles"
          >
            {EQUIPMENT_OPTIONS.map((item) => {
              const owned = (form.owned_equipment ?? []).includes(item);
              const locked = item === "bodyweight";
              return (
                <button
                  key={item}
                  disabled={locked}
                  onClick={() => toggleEquipment(item)}
                  data-testid={`equipment-toggle-${item}`}
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs font-bold transition-colors duration-150",
                    owned
                      ? "border-[#84CC16] bg-[#1E2B0E] text-[#84CC16]"
                      : "border-[#27272A] bg-[#141416] text-zinc-400 hover:text-white",
                    locked && "cursor-not-allowed opacity-70",
                  )}
                >
                  {EQUIPMENT_TR[item] ?? item}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Haftalık limit (kas grubu başına)</Label>
            <Select
              modal={false}
              value={String(form.weekly_limit ?? 2)}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, weekly_limit: Number(v) }))
              }
            >
              <SelectTrigger
                data-testid="profile-weekly-limit-select"
                className="min-h-12 w-full"
              >
                <SelectValue>{(v: string) => `haftada ${v}`}</SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {WEEKLY_LIMITS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    haftada {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Kütüphane varsayılan filtresi</Label>
            <Select
              modal={false}
              value={form.equipment_filter_default ?? "mine"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, equipment_filter_default: v }))
              }
            >
              <SelectTrigger
                data-testid="equipment-default-filter-select"
                className="min-h-12 w-full"
              >
                <SelectValue>
                  {(v: string) =>
                    v === "mine" ? "Ekipmanım" : "Tüm egzersizler"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="mine">Ekipmanım</SelectItem>
                <SelectItem value="all">Tüm egzersizler</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section
        className="space-y-3 rounded-lg border border-[#27272A] bg-[#141416] p-4"
        data-testid="playlist-section"
      >
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-[#84CC16]" aria-hidden />
          <p className="text-[11px] font-semibold text-zinc-400">
            ANTRENMAN ÇALMA LİSTEM
          </p>
        </div>
        <p className="text-xs leading-relaxed text-zinc-500">
          Spotify'dan bir çalma listesi linkini buraya yapıştır. Antrenman
          başlattığında üstte küçük bir buton görünür — tıklayınca Spotify
          uygulamasında açılır ve müzik kesintisiz çalar.
        </p>

        {profile.playlist_url && (
          <div className="flex items-center gap-2 rounded-md border border-[#84CC16]/40 bg-[#1A2210] p-2.5">
            <span className="min-w-0 flex-1 truncate font-heading text-xs font-bold text-[#84CC16]">
              {profile.playlist_name || "Antrenman Listesi"}
            </span>
            <a
              href={profile.playlist_url}
              target="_blank"
              rel="noreferrer"
              className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#84CC16] underline underline-offset-4"
            >
              <ExternalLink className="h-3 w-3" aria-hidden /> AÇ
            </a>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="playlist-url">Spotify çalma listesi bağlantısı</Label>
          <Input
            id="playlist-url"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            placeholder="https://open.spotify.com/playlist/…"
            data-testid="playlist-url-input"
            className="min-h-12"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="playlist-name">Görünen ad (isteğe bağlı)</Label>
          <Input
            id="playlist-name"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            placeholder="Spor listesi"
            data-testid="playlist-name-input"
            className="min-h-12"
          />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-[#27272A] bg-[#141416] p-4">
        <p className="text-[11px] font-semibold text-zinc-400">Bakım</p>
        <p className="text-xs leading-relaxed text-zinc-500">
          Kayıtları sil ve haftalık limitleri yeniden aç. Bu işlem geri
          alınamaz.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Button
            variant="destructive"
            onClick={() => setResetTodayOpen(true)}
            data-testid="reset-today-button"
            className="min-h-12"
          >
            Bugünü Sıfırla
          </Button>
          <Button
            variant="destructive"
            onClick={() => setResetWeekOpen(true)}
            data-testid="reset-week-button"
            className="min-h-12"
          >
            Bu Haftayı Sıfırla
          </Button>
        </div>
      </section>

      <div
        className={cn(
          "sticky bottom-20 z-10 md:bottom-4",
          "transition-all duration-300 ease-out",
          showSaveBar && isDirty
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-hidden={!isDirty}
      >
        <Button
          onClick={handleSave}
          disabled={save.isPending || !isDirty}
          tabIndex={isDirty ? 0 : -1}
          data-testid="profile-save-button"
          className="min-h-14 w-full font-heading text-base font-extrabold shadow-2xl shadow-black/50"
        >
          {save.isPending ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
        </Button>
      </div>

      <Dialog open={resetTodayOpen} onOpenChange={setResetTodayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bugünü sıfırla?</DialogTitle>
            <DialogDescription>
              Bugün kaydedilen tüm antrenmanlar silinir. Aynı kas grupları
              hemen tekrar açılır. Geçmiş haftalar etkilenmez.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetTodayOpen(false)}
              data-testid="reset-today-cancel-button"
            >
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={() => resetToday.mutate()}
              data-testid="reset-today-confirm-button"
            >
              {resetToday.isPending ? "Siliniyor…" : "Bugünü Sıfırla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetWeekOpen} onOpenChange={setResetWeekOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bu haftayı sıfırla?</DialogTitle>
            <DialogDescription>
              Bu hafta kaydedilen tüm antrenmanlar silinir ve limitler yeniden
              açılır. Önceki haftalar korunur.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetWeekOpen(false)}
              data-testid="reset-week-cancel-button"
            >
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={() => resetWeek.mutate()}
              data-testid="reset-week-confirm-button"
            >
              {resetWeek.isPending ? "Siliniyor…" : "Sıfırla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pwdOpen}
        onOpenChange={(open) => (open ? setPwdOpen(true) : resetPwdDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Şifre Değiştir</DialogTitle>
            <DialogDescription>
              Yeni şifreni belirle. Değişiklikten sonra hemen geçerli olur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-pwd">Yeni şifre</Label>
              <div
                className={cn(
                  "flex h-12 items-center gap-3 rounded-md border border-[#27272A] bg-[#09090B] px-3.5",
                  "transition-colors focus-within:border-[#84CC16]/60",
                )}
              >
                <input
                  id="new-pwd"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="En az 8 karakter"
                  data-testid="new-password-input"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:text-white"
                  aria-label={showNew ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showNew ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-pwd">Yeni şifre (tekrar)</Label>
              <div
                className={cn(
                  "flex h-12 items-center gap-3 rounded-md border border-[#27272A] bg-[#09090B] px-3.5",
                  "transition-colors focus-within:border-[#84CC16]/60",
                )}
              >
                <input
                  id="confirm-pwd"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  data-testid="confirm-password-input"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:text-white"
                  aria-label={showConfirm ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {pwdError && (
              <p
                role="alert"
                className="rounded-lg border border-red-500/20 bg-red-500/[0.08] px-3 py-2.5 text-sm text-red-300"
              >
                {pwdError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={resetPwdDialog}
              data-testid="change-password-cancel-button"
            >
              Vazgeç
            </Button>
            <Button
              onClick={submitPassword}
              disabled={changePassword.isPending || !newPwd || !confirmPwd}
              data-testid="change-password-confirm-button"
            >
              {changePassword.isPending ? "Kaydediliyor…" : "Şifreyi Değiştir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}