# Kişisel Antrenman Takibi — living spec

A private, single-user workout tracker. **Turkish-only UI.** No authentication, no brand
name, no wordmark — the only mark is the athlete's own uploaded lime dumbbell logo.

## Non-negotiables (explicit user requirements)

1. **No brand identity.** No "IRONLOG", no invented name, no generated logo. The header shows
   only `LOGO_URL` from `src/lib/assets.ts` (the user's upload), also used as the favicon.
2. **Turkish only.** All UI text is Turkish, centralised in `src/lib/tr.ts`. Exercise names
   stay in their common English form (the user asked for this). Turkish strings are written in
   final casing — never `uppercase` via CSS, which breaks İ/ı.
3. **NO TIME UI.** No stopwatch, workout timer, rest countdown, seconds counter or `mm:ss`
   anywhere in the workout flow. Training is sets / reps / weight / progression only. The
   backend silently stores `start_clock` / `finish_clock` / `started_at` / `finished_at`,
   surfaced **only** in history. (`RestTimer` was deleted; don't reintroduce it.)
4. **Entry surface is the muscle picker.** `/` shows the greeting and "BUGÜN NE ÇALIŞIYORSUN?"
   with 9 cards. One tap starts a session. No dashboard in the way.
5. **Exactly 2 exercises per session** (`EXERCISES_PER_SESSION` in `models/profile.py`).
6. **No fake data.** Empty states read "Henüz antrenman verisi yok." — never placeholder numbers.
7. **Body visualization** uses the user's uploaded front/back anatomy renders
   (`BODY_FRONT_URL` / `BODY_BACK_URL`). Never generate a replacement figure. They are
   blue-on-white, so `.anatomy-blend` (`mix-blend-mode: screen`) drops the white backdrop.

## Design

- Palette: bg `#09090B`, cards `#141416` / `#18181B`, borders `#27272A`, text `#FAFAFA` /
  `#A1A1AA`. Single accent **lime `#84CC16`** (`#A3E635` hover). The red accent is gone.
- Fonts: Space Grotesk (headings/numbers) + Plus Jakarta Sans (body). Commercial-fitness feel,
  no futuristic/HUD/glow/holographic/cyberpunk elements, no decorative gradients.
- Mobile-first; 6-item bottom nav on phones, top nav on desktop. Source: `design_guidelines.json`.

## Muscle groups (fixed order)

`biceps, triceps, forearms, shoulders, chest, back, legs, abs, glutes`
Turkish: BİSEPS, TRİSEPS, ÖN KOL, OMUZ, GÖĞÜS, SIRT, BACAK, KARIN, KALÇA (`abs` renders as KARIN).

## Frequency rules (computed from stored history)

- **Max 1 session per muscle per calendar day** → card shows "BUGÜN TAMAMLANDI", disabled.
- **Max `weekly_limit` (default 2) per muscle per week** (Monday-anchored `week_start`) →
  "2 / 2 HAFTALIK LİMİT", disabled but still visible.
- `POST /workouts/start` returns **409** with a Turkish reason for either violation.
- Status values: `AVAILABLE` | `TODAY_DONE` | `LIMIT_REACHED`. Limit is configurable 1–4.
- The client sends `local_date` / `local_clock` so day rules and history match the user's clock;
  `/summary` and `/muscles/{m}` accept `?today=YYYY-MM-DD`.

## Equipment

Home kit: **2 × 10 kg dumbbells + 1 bench + bodyweight** (`Profile.owned_equipment`,
`dumbbell_weight_kg`, `dumbbell_count`). `home_ready()` = `equipment_required ⊆ owned` and
`dumbbells_needed ≤ dumbbell_count`. Library toggles **EKİPMANIM** (default, 47 exercises) /
**TÜM EGZERSİZLER** (62). Default plans only use home-ready movements — library `order < 50`
is home-ready, `order >= 50` is gym-only and never enters a plan. Equipment is editable in
Profile, so bands / pull-up bar / barbell can be added later.

## Activation ("Kas Aktivasyonu")

Each exercise carries `activation` (primary-muscle focus %) plus `secondary[]`
(`{muscle, pct}`), from the `ACTIVATION` map in `seed.py` — consistent editorial estimates,
labelled "tahmini değer" and never presented as exact science.

## Progression aids

- `rep_min` / `rep_max`: when every logged set hits `rep_max`, the player shows the
  "ağırlığı artırmaya hazırsın" hint.
- `progression_to` / `progression_note`: when 10 kg has become too light, suggests the harder
  variation instead of heavier dumbbells the athlete doesn't own.
- Per-exercise session note (`PlanExercise.note`, `PATCH /workouts/{id}/note`), shown in history.

## Data model

- `profiles` — singleton (`id: "default"`), auto-created. Identity, `weekly_limit`, equipment,
  `plan_overrides` (muscle → ordered exercise ids), `weight_history`, playlist.
- `exercises` — 62 docs seeded by `backend/seed.py` (idempotent; replaces the library wholesale,
  never touches history). All `video_id`s verified live via YouTube oEmbed at build time.
- `workouts` — `status: active|completed`, `muscle`, `date`, `week_start`, clock fields,
  `exercises[]` (sets with reps/weight/completed + note), `completed_sets`, `total_volume`, `prs[]`.

## Routes

Backend (`/api`): `/summary`, `/muscles/{m}`, `/profile` (GET/PUT), `/profile/weight`,
`/profile/plan/{m}`, `/profile/playlist`, `/exercises` (muscle, equipment, difficulty, q, scope),
`/exercises/{id}` (GET/PATCH), `/exercises/{id}/video`, `/workouts/plan/{m}`, `/workouts/start`,
`/workouts`, `/workouts/{id}`, `/workouts/{id}/sets`, `/workouts/{id}/note`,
`/workouts/{id}/complete`, `/workouts/{id}` (DELETE), `/workouts/reset-week`.

Frontend: `/` picker, `/workout/:muscle`, `/exercises`, `/exercises/:id`, `/progress`,
`/history`, `/history/:id`, `/music`, `/profile`.

## Core flow

`/` → tap muscle → "ANTRENMANA BAŞLA" → player (YouTube demo, activation bars, weight/reps
inputs prefilled from last session, "SETİ TAMAMLA" per set, note, progression hints) →
"SONRAKİ EGZERSİZ" → "ANTRENMANI BİTİR" → completion screen (clock range, sets, volume, PRs,
Turkish data-derived messages) → history and progress update automatically.

## Music

Official Spotify **embed** + "SPOTIFY'DA AÇ". No OAuth, no API keys. Playlist stored on the
profile, editable in `/music`. The embed plays 30-second previews without login.
