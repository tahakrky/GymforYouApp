import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Calendar,
  CalendarCheck,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Mail,
  Phone,
  Ruler,
  Scale,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, ApiError } from "@/lib/api";
import { MUSCLES, type Muscle } from "@/lib/types";
import { MUSCLE_TR, fmtDateShortTr, fmtNumTr } from "@/lib/tr";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* ─────────────────────────── types ─────────────────────────── */

type Overview = {
  total_users: number;
  total_workouts: number;
  today_workouts: number;
  week_workouts: number;
  active_workouts: number;
  total_exercises: number;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  total_workouts: number;
  last_workout_date: string | null;
  phone: string;
  weight_kg: number | null;
  age: number | null;
  height_cm: number | null;
};

type AdminWorkout = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  muscle: string;
  date: string;
  status: string;
  completed_sets: number;
  total_sets: number;
  total_volume: number;
  start_clock: string;
  finish_clock: string;
  duration_sec?: number | null;
};

type MuscleStat = {
  muscle: string;
  sessions: number;
  sets: number;
  volume: number;
  last: string | null;
};

type PersonalRecord = {
  exercise_name: string;
  weight_kg: number;
  reps: number;
  date: string;
  muscle: string;
};

type WeightEntry = { date: string; weight_kg: number };

type AdminExercise = {
  id: string;
  name: string;
  muscle: string;
  equipment_label?: string;
  activation: number;
};

type UserDetail = {
  user: AdminUser;
  profile: Record<string, unknown>;
  stats: {
    total_workouts: number;
    total_sets: number;
    total_volume: number;
    streak: number;
    avg_duration_sec: number;
    muscles_trained: number;
    muscle_stats: MuscleStat[];
    prs: PersonalRecord[];
  };
  weight_history: WeightEntry[];
  workouts: AdminWorkout[];
};

type Tab = "users" | "workouts" | "exercises";

/* ─────────────────────────── page ─────────────────────────── */

export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("users");

  const { error } = useQuery<Overview>({
    queryKey: ["admin", "overview"],
    queryFn: () => apiGet<Overview>("/admin/overview"),
    retry: false,
  });

  useEffect(() => {
    if (error instanceof ApiError && error.status === 403) {
      navigate("/", { replace: true });
    }
  }, [error, navigate]);

  if (error instanceof ApiError && error.status === 403) {
    return <div className="h-64" aria-hidden />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Admin Paneli
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Sistem genel bakışı ve tüm kullanıcı verileri.
        </p>
      </header>

      <OverviewCards />

      <Tabs tab={tab} onChange={setTab} />

      {tab === "users" && <UsersPanel />}
      {tab === "workouts" && <WorkoutsPanel />}
      {tab === "exercises" && <ExercisesPanel />}
    </div>
  );
}

/* ─────────────────────────── overview cards ─────────────────────────── */

function OverviewCards() {
  const { data, isLoading } = useQuery<Overview>({
    queryKey: ["admin", "overview"],
    queryFn: () => apiGet<Overview>("/admin/overview"),
    refetchInterval: 30_000,
  });

  const cards = [
    { label: "Kullanıcı", value: data?.total_users, icon: Users, accent: "text-sky-400" },
    { label: "Bugün", value: data?.today_workouts, icon: Flame, accent: "text-[#84CC16]" },
    { label: "Bu Hafta", value: data?.week_workouts, icon: CalendarCheck, accent: "text-[#84CC16]" },
    { label: "Şu An Aktif", value: data?.active_workouts, icon: Activity, accent: "text-amber-400" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="group rounded-lg border border-[#27272A] bg-[#141416] p-4 transition-colors hover:border-[#3F3F46]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {c.label}
              </span>
              <Icon className={cn("h-3.5 w-3.5", c.accent)} aria-hidden />
            </div>
            <p className="mt-2 font-heading text-3xl font-extrabold tabular-nums tracking-tight text-white">
              {isLoading ? "—" : (c.value ?? 0)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── tabs ─────────────────────────── */

function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "users", label: "Kullanıcılar", icon: Users },
    { key: "workouts", label: "Antrenmanlar", icon: Dumbbell },
    { key: "exercises", label: "Egzersizler", icon: Flame },
  ];

  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg border border-[#27272A] bg-[#141416] p-1">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-bold transition-colors",
              active ? "bg-[#1E2B0E] text-[#84CC16]" : "text-zinc-400 hover:text-white",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── users ─────────────────────────── */

function UsersPanel() {
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ items: AdminUser[] }>({
    queryKey: ["admin", "users"],
    queryFn: () => apiGet<{ items: AdminUser[] }>("/admin/users"),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/user/${id}`),
    onSuccess: async () => {
      toast.success("Kullanıcı ve tüm verileri silindi.");
      setDeleteTarget(null);
      setSelected(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "overview"] }),
      ]);
    },
    onError: () => toast.error("Silme başarısız."),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {data?.items.map((u) => {
          const initials = (u.name || u.email || "?")
            .split(" ")
            .map((s) => s[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <button
              key={u.id}
              onClick={() => setSelected(u)}
              className="group flex w-full items-center gap-3 rounded-lg border border-[#27272A] bg-[#141416] p-3.5 text-left transition-all hover:border-[#84CC16]/40 hover:bg-[#18181B]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1E2B0E] to-[#141A0E] font-heading text-sm font-extrabold text-[#84CC16] ring-1 ring-inset ring-[#84CC16]/30">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-bold text-white">{u.name}</p>
                <p className="truncate text-xs text-zinc-400">{u.email}</p>
              </div>
              <div className="hidden shrink-0 flex-col items-end sm:flex">
                <p className="font-heading text-base font-extrabold tabular-nums text-[#84CC16]">
                  {u.total_workouts}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">antrenman</p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-[#84CC16]"
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <UserProfileSheet
        user={selected}
        onClose={() => setSelected(null)}
        onDelete={(u) => setDeleteTarget(u)}
        deleting={deleteUser.isPending}
      />

      <DeleteUserDialog
        user={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteUser.mutate(deleteTarget.id)}
        deleting={deleteUser.isPending}
      />
    </>
  );
}

/* ─────────────────────────── user profile sheet ─────────────────────────── */

type DetailTab = "overview" | "workouts" | "records" | "settings";

function UserProfileSheet({
  user,
  onClose,
  onDelete,
  deleting,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onDelete: (u: AdminUser) => void;
  deleting: boolean;
}) {
  const [tab, setTab] = useState<DetailTab>("overview");

  const { data, isLoading } = useQuery<UserDetail>({
    queryKey: ["admin", "user", user?.id],
    queryFn: () => apiGet<UserDetail>(`/admin/user/${user!.id}`),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, onClose]);

  useEffect(() => {
    if (!user) return;
    setTab("overview");
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [user]);

  if (!user) return null;

  const initials = (user.name || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const registeredDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  const profile = (data?.profile ?? {}) as {
    experience?: string;
    weekly_limit?: number;
    owned_equipment?: string[];
    dumbbell_weight_kg?: number;
    dumbbell_count?: number;
    playlist_url?: string;
    playlist_name?: string;
    week_plan?: Record<string, string[]>;
    muscle_order?: string[];
  };

  const tabs: { key: DetailTab; label: string }[] = [
    { key: "overview", label: "Genel" },
    { key: "workouts", label: "Antrenman" },
    { key: "records", label: "Rekorlar" },
    { key: "settings", label: "Ayarlar" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex h-full w-full max-w-lg flex-col border-l border-[#27272A] bg-[#0B0B0D] shadow-2xl",
          "animate-in slide-in-from-right duration-300 ease-out",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#27272A] px-5 py-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Kullanıcı Detayı
          </span>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Hero */}
        <div className="border-b border-[#27272A] bg-gradient-to-b from-[#141A0E] to-[#0B0B0D] px-5 pb-4 pt-5">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#1E2B0E] to-[#0E1707] font-heading text-xl font-extrabold text-[#84CC16] ring-2 ring-inset ring-[#84CC16]/40">
                {initials}
              </div>
              {data && data.stats.streak > 0 && (
                <span className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-full border-2 border-[#0B0B0D] bg-amber-500 px-1.5 py-0.5 text-[9px] font-extrabold text-black">
                  <Flame className="h-2.5 w-2.5" aria-hidden />
                  {data.stats.streak}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate font-heading text-lg font-extrabold tracking-tight text-white">
                {user.name}
              </h2>
              <p className="truncate text-xs text-zinc-400">{user.email}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" aria-hidden />
                  {registeredDate}
                </span>
                {user.last_workout_date && (
                  <span className="flex items-center gap-1">
                    <Dumbbell className="h-3 w-3" aria-hidden />
                    {fmtDateShortTr(user.last_workout_date)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          {data && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <QuickStat
                label="Antrenman"
                value={String(data.stats.total_workouts)}
              />
              <QuickStat
                label="Set"
                value={String(data.stats.total_sets)}
              />
              <QuickStat
                label="Hacim"
                value={`${fmtNumTr(Math.round(data.stats.total_volume / 1000))}t`}
              />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-[#27272A] px-3">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative shrink-0 px-3 py-3 text-xs font-bold transition-colors",
                  active ? "text-white" : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {t.label}
                {active && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#84CC16]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]"
                />
              ))}
            </div>
          ) : data ? (
            <>
              {tab === "overview" && <OverviewTab data={data} />}
              {tab === "workouts" && <WorkoutsTab data={data} />}
              {tab === "records" && <RecordsTab data={data} />}
              {tab === "settings" && <SettingsTab data={data} />}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-[#27272A] bg-[#0B0B0D] p-4">
          <Button
            variant="destructive"
            onClick={() => onDelete(user)}
            disabled={deleting}
            className="w-full gap-2"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Kullanıcıyı Sil
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── sheet tabs ─────────────────────────── */

function OverviewTab({ data }: { data: UserDetail }) {
  const { stats } = data;

  return (
    <div className="space-y-5 p-5">
      {/* Big stat grid */}
      <section>
        <SectionHeader label="İstatistikler" />
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={Dumbbell}
            label="Antrenman"
            value={String(stats.total_workouts)}
            accent
          />
          <StatCard
            icon={TrendingUp}
            label="Toplam Hacim"
            value={`${fmtNumTr(Math.round(stats.total_volume))} kg`}
            accent
          />
          <StatCard
            icon={Activity}
            label="Toplam Set"
            value={String(stats.total_sets)}
          />
          <StatCard
            icon={Flame}
            label="Streak"
            value={stats.streak > 0 ? `${stats.streak} gün` : "—"}
          />
          <StatCard
            icon={Clock}
            label="Ort. Süre"
            value={
              stats.avg_duration_sec > 0
                ? `${Math.round(stats.avg_duration_sec / 60)} dk`
                : "—"
            }
          />
          <StatCard
            icon={Target}
            label="Kas Grubu"
            value={`${stats.muscles_trained} / ${MUSCLES.length}`}
          />
        </div>
      </section>

      {/* Personal info */}
      <section>
        <SectionHeader label="Kişisel Bilgiler" />
        <div className="space-y-1.5">
          <InfoRow icon={Phone} label="Telefon" value={data.user.phone || "—"} />
          <InfoRow
            icon={Scale}
            label="Kilo"
            value={data.user.weight_kg ? `${fmtNumTr(data.user.weight_kg)} kg` : "—"}
          />
          <InfoRow
            icon={UserIcon}
            label="Yaş"
            value={data.user.age ? String(data.user.age) : "—"}
          />
          <InfoRow
            icon={Ruler}
            label="Boy"
            value={data.user.height_cm ? `${data.user.height_cm} cm` : "—"}
          />
          <InfoRow icon={Mail} label="E-posta" value={data.user.email} />
        </div>
      </section>

      {/* Weight history */}
      {data.weight_history.length > 1 && (
        <section>
          <SectionHeader label="Kilo Geçmişi" />
          <WeightSparkline entries={data.weight_history} />
        </section>
      )}
    </div>
  );
}

function WorkoutsTab({ data }: { data: UserDetail }) {
  const { stats } = data;
  const maxSessions = Math.max(1, ...stats.muscle_stats.map((m) => m.sessions));

  return (
    <div className="space-y-5 p-5">
      {/* Muscle distribution */}
      {stats.muscle_stats.length > 0 && (
        <section>
          <SectionHeader label="Kas Dağılımı" />
          <div className="space-y-2">
            {stats.muscle_stats.map((m) => {
              const pct = (m.sessions / maxSessions) * 100;
              return (
                <div key={m.muscle} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-heading text-xs font-bold text-white">
                      {MUSCLE_TR[m.muscle] ?? m.muscle}
                    </span>
                    <span className="text-[10px] font-semibold text-zinc-500">
                      {m.sessions}× · {m.sets} set · {fmtNumTr(m.volume)} kg
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#18181B]">
                    <div
                      className="h-full rounded-full bg-[#84CC16] transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent workouts */}
      <section>
        <SectionHeader
          label="Son Antrenmanlar"
          count={data.workouts.length}
        />
        {data.workouts.length === 0 ? (
          <EmptyRow text="Henüz antrenman kaydı yok." />
        ) : (
          <div className="space-y-1.5">
            {data.workouts.map((w) => (
              <WorkoutRow key={w.id} w={w} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RecordsTab({ data }: { data: UserDetail }) {
  const prs = data.stats.prs;
  return (
    <div className="p-5">
      <SectionHeader label="Kişisel Rekorlar" count={prs.length} />
      {prs.length === 0 ? (
        <EmptyRow text="Henüz rekor yok." />
      ) : (
        <div className="space-y-1.5">
          {prs.map((pr, i) => (
            <div
              key={`${pr.exercise_name}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-[#27272A] bg-[#141416] px-3 py-2.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/10 font-heading text-[10px] font-extrabold text-amber-300">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-xs font-bold text-white">
                  {pr.exercise_name}
                </p>
                <p className="text-[10px] text-zinc-500">
                  {MUSCLE_TR[pr.muscle] ?? pr.muscle} · {fmtDateShortTr(pr.date)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-heading text-xs font-extrabold tabular-nums text-[#84CC16]">
                  {fmtNumTr(pr.weight_kg)} kg
                </p>
                <p className="text-[10px] text-zinc-500">× {pr.reps}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab({ data }: { data: UserDetail }) {
  const profile = data.profile as {
    experience?: string;
    weekly_limit?: number;
    owned_equipment?: string[];
    dumbbell_weight_kg?: number;
    dumbbell_count?: number;
    playlist_url?: string;
    playlist_name?: string;
    week_plan?: Record<string, string[]>;
  };

  const EQUIPMENT_TR: Record<string, string> = {
    dumbbell: "Dambıl",
    bench: "Sehpa",
    bodyweight: "Vücut ağırlığı",
    band: "Direnç lastiği",
    pullup_bar: "Barfiks",
    barbell: "Halter",
    cable: "Kablo makinesi",
    machine: "Makine",
  };

  return (
    <div className="space-y-5 p-5">
      <section>
        <SectionHeader label="Antrenman Ayarları" />
        <div className="space-y-1.5">
          <InfoRow
            label="Deneyim"
            value={
              profile.experience === "BEGINNER"
                ? "Başlangıç"
                : profile.experience === "ADVANCED"
                  ? "İleri"
                  : "Orta"
            }
          />
          <InfoRow
            label="Haftalık Limit"
            value={profile.weekly_limit ? `${profile.weekly_limit} / kas` : "—"}
          />
          <InfoRow
            label="Dambıl"
            value={
              profile.dumbbell_weight_kg
                ? `${profile.dumbbell_count ?? 1} × ${profile.dumbbell_weight_kg} kg`
                : "—"
            }
          />
        </div>
      </section>

      {profile.owned_equipment && profile.owned_equipment.length > 0 && (
        <section>
          <SectionHeader
            label="Sahip Olduğu Ekipman"
            count={profile.owned_equipment.length}
          />
          <div className="flex flex-wrap gap-1.5">
            {profile.owned_equipment.map((e) => (
              <span
                key={e}
                className="rounded-md border border-[#27272A] bg-[#18181B] px-2 py-1 text-[11px] font-bold text-zinc-300"
              >
                {EQUIPMENT_TR[e] ?? e}
              </span>
            ))}
          </div>
        </section>
      )}

      {profile.week_plan && Object.keys(profile.week_plan).length > 0 && (
        <section>
          <SectionHeader label="Haftalık Plan" />
          <div className="space-y-1">
            {(
              [
                ["mon", "Pazartesi"],
                ["tue", "Salı"],
                ["wed", "Çarşamba"],
                ["thu", "Perşembe"],
                ["fri", "Cuma"],
                ["sat", "Cumartesi"],
                ["sun", "Pazar"],
              ] as const
            ).map(([key, label]) => {
              const muscles = profile.week_plan?.[key] ?? [];
              if (muscles.length === 0) return null;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#27272A] bg-[#141416] px-3 py-2"
                >
                  <span className="text-xs font-semibold text-zinc-400">
                    {label}
                  </span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {muscles.map((m) => (
                      <span
                        key={m}
                        className="rounded-md bg-[#1E2B0E] px-1.5 py-0.5 text-[10px] font-bold text-[#84CC16]"
                      >
                        {MUSCLE_TR[m] ?? m}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {profile.playlist_url && (
        <section>
          <SectionHeader label="Çalma Listesi" />
          <div className="rounded-lg border border-[#84CC16]/40 bg-[#1A2210] p-3">
            <p className="truncate font-heading text-xs font-bold text-[#84CC16]">
              {profile.playlist_name || "Antrenman Listesi"}
            </p>
            <a
              href={profile.playlist_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-[10px] text-[#84CC16] underline underline-offset-4"
            >
              {profile.playlist_url}
            </a>
          </div>
        </section>
      )}
    </div>
  );
}

/* ─────────────────────────── small pieces ─────────────────────────── */

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#141416]/70 p-2.5 text-center">
      <p className="font-heading text-base font-extrabold tabular-nums text-white">
        {value}
      </p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h3 className="font-heading text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </h3>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] text-zinc-600">· {count}</span>
      )}
      <div className="h-px flex-1 bg-[#27272A]" />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Dumbbell;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        accent ? "border-[#84CC16]/30 bg-[#141A0E]" : "border-[#27272A] bg-[#141416]",
      )}
    >
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
        <Icon
          className={cn("h-3 w-3", accent ? "text-[#84CC16]" : "text-zinc-500")}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn(
          "mt-1.5 truncate font-heading text-lg font-extrabold tabular-nums tracking-tight",
          accent ? "text-[#84CC16]" : "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#27272A] bg-[#141416] px-3 py-2.5">
      <span className="flex items-center gap-2 text-xs text-zinc-500">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        {label}
      </span>
      <span className="truncate text-right text-xs font-semibold text-white">
        {value}
      </span>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#27272A] bg-[#0F0F11] p-5 text-center">
      <p className="text-xs text-zinc-500">{text}</p>
    </div>
  );
}

function WorkoutRow({ w }: { w: AdminWorkout }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#27272A] bg-[#141416] px-3 py-2.5">
      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-zinc-600" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-xs font-bold text-white">
          {MUSCLE_TR[w.muscle] ?? w.muscle}
        </p>
        <p className="truncate text-[10px] text-zinc-500">
          {fmtDateShortTr(w.date)} · {w.start_clock || "—"}
          {w.finish_clock ? ` → ${w.finish_clock}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-heading text-[11px] font-bold tabular-nums text-[#84CC16]">
          {w.completed_sets}/{w.total_sets}
        </p>
        <p className="text-[9px] text-zinc-500">{fmtNumTr(w.total_volume)} kg</p>
      </div>
    </div>
  );
}

function WeightSparkline({ entries }: { entries: WeightEntry[] }) {
  const values = entries.map((e) => e.weight_kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(0.1, max - min);
  const first = entries[0];
  const last = entries[entries.length - 1];
  const diff = last.weight_kg - first.weight_kg;

  return (
    <div className="rounded-lg border border-[#27272A] bg-[#141416] p-3">
      <div className="flex items-baseline justify-between">
        <span className="font-heading text-lg font-extrabold tabular-nums text-white">
          {fmtNumTr(last.weight_kg)} kg
        </span>
        <span
          className={cn(
            "text-[11px] font-bold tabular-nums",
            diff < 0 ? "text-[#84CC16]" : diff > 0 ? "text-amber-400" : "text-zinc-500",
          )}
        >
          {diff > 0 ? "+" : ""}
          {diff.toFixed(1)} kg
        </span>
      </div>

      <div className="mt-3 flex h-12 items-end gap-0.5">
        {entries.map((e, i) => {
          const h = ((e.weight_kg - min) / range) * 100;
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-[#84CC16]/60"
              style={{ height: `${Math.max(8, h)}%` }}
              title={`${fmtDateShortTr(e.date)}: ${fmtNumTr(e.weight_kg)} kg`}
            />
          );
        })}
      </div>

      <div className="mt-1.5 flex justify-between text-[9px] text-zinc-500">
        <span>{fmtDateShortTr(first.date)}</span>
        <span>{fmtDateShortTr(last.date)}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── delete user dialog ─────────────────────────── */

function DeleteUserDialog({
  user,
  onCancel,
  onConfirm,
  deleting,
}: {
  user: AdminUser | null;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  useEffect(() => {
    if (!user) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, onCancel, deleting]);

  if (!user) return null;

  const initials = (user.name || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={() => !deleting && onCancel()}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-sm overflow-hidden rounded-2xl border border-[#27272A] bg-[#111113] shadow-2xl shadow-black/70",
          "animate-in fade-in-0 zoom-in-95 duration-200",
        )}
      >
        <div className="flex flex-col items-center px-6 pb-4 pt-6 text-center">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#1E2B0E] to-[#141A0E] font-heading text-base font-extrabold text-[#84CC16] ring-2 ring-inset ring-[#84CC16]/30">
              {initials}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#111113] bg-red-500/90">
              <Trash2 className="h-3 w-3 text-white" aria-hidden />
            </span>
          </div>

          <h3 className="mt-4 font-heading text-lg font-extrabold tracking-tight text-white">
            Kullanıcıyı sil?
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            <span className="font-semibold text-white">{user.name}</span>{" "}
            kullanıcısının tüm verileri kalıcı olarak silinecek.
          </p>
        </div>

        <div className="mx-6 mb-5 rounded-lg border border-red-500/20 bg-red-500/[0.04] p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-red-400">
            Silinecek veriler
          </p>
          <ul className="space-y-1 text-xs text-zinc-400">
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-red-400" aria-hidden />
              Hesap ({user.email})
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-red-400" aria-hidden />
              Profil ve kilo geçmişi
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-red-400" aria-hidden />
              {user.total_workouts} antrenman kaydı
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-red-400" aria-hidden />
              Kas bazlı egzersiz seçimleri
            </li>
          </ul>
          <p className="mt-2.5 border-t border-red-500/20 pt-2 text-[11px] font-semibold text-red-300">
            ⚠ Bu işlem geri alınamaz.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-[#1F1F23] bg-[#0B0B0D] p-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={deleting}
            className="min-h-11"
          >
            Vazgeç
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
            className="min-h-11 gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            {deleting ? "Siliniyor…" : "Kalıcı Olarak Sil"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── workouts panel ─────────────────────────── */

function WorkoutsPanel() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [muscleFilter, setMuscleFilter] = useState<string>("all");

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (muscleFilter !== "all") p.set("muscle", muscleFilter);
    return p.toString();
  }, [statusFilter, muscleFilter]);

  const { data, isLoading } = useQuery<{
    items: AdminWorkout[];
    total: number;
  }>({
    queryKey: ["admin", "workouts", queryString],
    queryFn: () =>
      apiGet<{ items: AdminWorkout[]; total: number }>(
        `/admin/workouts?limit=100&${queryString}`,
      ),
  });

  const STATUS = [
    { key: "all", label: "Tümü" },
    { key: "completed", label: "Tamamlanmış" },
    { key: "active", label: "Aktif" },
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUS.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                statusFilter === s.key
                  ? "border-[#84CC16] bg-[#1E2B0E] text-[#84CC16]"
                  : "border-[#27272A] bg-[#141416] text-zinc-400 hover:text-white",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setMuscleFilter("all")}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
              muscleFilter === "all"
                ? "border-[#84CC16] bg-[#1E2B0E] text-[#84CC16]"
                : "border-[#27272A] bg-[#141416] text-zinc-400 hover:text-white",
            )}
          >
            Tüm Kaslar
          </button>
          {MUSCLES.map((m: Muscle) => (
            <button
              key={m}
              onClick={() => setMuscleFilter(m)}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                muscleFilter === m
                  ? "border-[#84CC16] bg-[#1E2B0E] text-[#84CC16]"
                  : "border-[#27272A] bg-[#141416] text-zinc-400 hover:text-white",
              )}
            >
              {MUSCLE_TR[m]}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <p className="text-[11px] font-semibold text-zinc-500">
          {data.total} kayıt
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]"
            />
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="rounded-lg border border-[#27272A] bg-[#141416] p-6 text-center text-sm text-zinc-500">
          Kayıt bulunamadı.
        </div>
      ) : (
        <div className="space-y-1.5">
          {data?.items.map((w) => (
            <div
              key={w.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors",
                w.status === "active"
                  ? "border-[#84CC16]/40 bg-[#141A0E]"
                  : "border-[#27272A] bg-[#141416] hover:border-[#3F3F46]",
              )}
            >
              <span
                className={cn(
                  "inline-block h-2 w-2 shrink-0 rounded-full",
                  w.status === "active"
                    ? "bg-[#84CC16] shadow-[0_0_8px_rgba(132,204,22,0.8)]"
                    : "bg-zinc-600",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-bold text-white">
                  {MUSCLE_TR[w.muscle] ?? w.muscle}
                  <span className="ml-2 font-sans text-xs font-normal text-zinc-400">
                    · {w.user_name}
                  </span>
                </p>
                <p className="truncate text-[11px] text-zinc-500">
                  {fmtDateShortTr(w.date)} · {w.start_clock || "—"}
                  {w.finish_clock ? ` → ${w.finish_clock}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-heading text-xs font-bold tabular-nums text-[#84CC16]">
                  {w.completed_sets}/{w.total_sets} set
                </p>
                <p className="text-[10px] text-zinc-500">
                  {fmtNumTr(w.total_volume)} kg
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── exercises panel ─────────────────────────── */

function ExercisesPanel() {
  const [muscleFilter, setMuscleFilter] = useState<string>("all");

  const queryString = muscleFilter === "all" ? "" : `&muscle=${muscleFilter}`;

  const { data, isLoading } = useQuery<{
    items: AdminExercise[];
    total: number;
  }>({
    queryKey: ["admin", "exercises", queryString],
    queryFn: () =>
      apiGet<{ items: AdminExercise[]; total: number }>(
        `/admin/exercises?limit=100${queryString}`,
      ),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setMuscleFilter("all")}
          className={cn(
            "rounded-md border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
            muscleFilter === "all"
              ? "border-[#84CC16] bg-[#1E2B0E] text-[#84CC16]"
              : "border-[#27272A] bg-[#141416] text-zinc-400 hover:text-white",
          )}
        >
          TÜMÜ
        </button>
        {MUSCLES.map((m: Muscle) => (
          <button
            key={m}
            onClick={() => setMuscleFilter(m)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
              muscleFilter === m
                ? "border-[#84CC16] bg-[#1E2B0E] text-[#84CC16]"
                : "border-[#27272A] bg-[#141416] text-zinc-400 hover:text-white",
            )}
          >
            {MUSCLE_TR[m]}
          </button>
        ))}
      </div>

      {data && (
        <p className="text-[11px] font-semibold text-zinc-500">
          {data.total} egzersiz
        </p>
      )}

      {isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((e) => (
            <div
              key={e.id}
              className="rounded-lg border border-[#27272A] bg-[#141416] p-3 transition-colors hover:border-[#3F3F46]"
            >
              <p className="truncate font-heading text-sm font-bold text-white">
                {e.name}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="rounded-md bg-[#1E2B0E] px-1.5 py-0.5 text-[10px] font-bold text-[#84CC16]">
                  {MUSCLE_TR[e.muscle] ?? e.muscle}
                </span>
                <span className="text-[10px] font-semibold text-zinc-500">
                  %{e.activation}
                </span>
              </div>
              {e.equipment_label && (
                <p className="mt-1 truncate text-[11px] text-zinc-500">
                  {e.equipment_label}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}