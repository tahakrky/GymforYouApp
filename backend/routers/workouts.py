"""Workout sessions — per user."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.db import db
from lib.dates import today_iso
from lib.scoring import (
    MUSCLES,
    completed_workouts,
    get_profile,
    home_ready,
    training_score,
    week_start,
)
from models.exercise import Exercise
from models.profile import EXERCISES_PER_SESSION
from models.summary import WorkoutCompleteResponse
from models.workout import (
    CompleteRequest,
    NoteUpdate,
    PersonalRecord,
    PlanExercise,
    ResetWeekRequest,
    SetCompletion,
    StartRequest,
    Workout,
    WorkoutSet,
)
from routers.auth import require_user

router = APIRouter(prefix="/workouts", tags=["workouts"])

MUSCLE_TR: dict[str, str] = {
    "biceps": "Biseps",
    "triceps": "Triseps",
    "forearms": "Ön Kol",
    "shoulders": "Omuz",
    "chest": "Göğüs",
    "back": "Sırt",
    "legs": "Bacak",
    "abs": "Karın",
    "glutes": "Kalça",
}


class PlanOverrideRequest(BaseModel):
    exercise_ids: list[str] = Field(default_factory=list, max_length=20)


def _from_doc(doc: dict) -> Workout:
    doc = dict(doc)
    doc.pop("_id", None)
    for key in ("started_at", "finished_at"):
        value = doc.get(key)
        if value is not None and getattr(value, "tzinfo", None) is None:
            doc[key] = value.replace(tzinfo=timezone.utc)
    return Workout(**doc)


def _totals(doc: dict) -> tuple[int, int, float]:
    exercises = doc.get("exercises", [])
    total = sum(len(e.get("sets", [])) for e in exercises)
    done = sum(1 for e in exercises for s in e.get("sets", []) if s.get("completed"))
    volume = sum(
        (s.get("weight_kg") or 0) * (s.get("reps") or 0)
        for e in exercises
        for s in e.get("sets", [])
        if s.get("completed")
    )
    return total, done, round(volume, 1)


async def _previous_map(user_id: str, muscle: str) -> dict[str, tuple[float, int]]:
    last = await db.workouts.find_one(
        {"user_id": user_id, "muscle": muscle, "status": "completed"},
        sort=[("started_at", -1)],
    )
    if not last:
        return {}
    out: dict[str, tuple[float, int]] = {}
    for e in last.get("exercises", []):
        best_w, best_r = 0.0, 0
        for s in e.get("sets", []):
            weight = s.get("weight_kg") or 0.0
            if s.get("completed") and weight > best_w:
                best_w, best_r = weight, s.get("reps") or 0
        if best_w > 0:
            out[e["name"]] = (best_w, best_r)
    return out


async def _plan_for(user_id: str, muscle: str, profile: dict) -> list[dict]:
    override = await db.plan_overrides.find_one({"user_id": user_id, "muscle": muscle})
    if override and override.get("exercise_ids"):
        ids = list(override["exercise_ids"])
        docs = await db.exercises.find({"id": {"$in": ids}}).to_list(50)
        by_id = {d["id"]: d for d in docs}
        return [by_id[i] for i in ids if i in by_id]

    docs = await db.exercises.find({"muscle": muscle}).sort("order", 1).to_list(100)
    owned = set(profile.get("owned_equipment") or [])
    count = profile.get("dumbbell_count", 2)
    pool = [d for d in docs if home_ready(d, owned, count)] or docs
    if not pool:
        return []

    done = await db.workouts.count_documents({"user_id": user_id, "muscle": muscle, "status": "completed"})
    start = (done * EXERCISES_PER_SESSION) % len(pool)
    return [pool[(start + i) % len(pool)] for i in range(min(EXERCISES_PER_SESSION, len(pool)))]


@router.get("/plan/{muscle}", response_model=list[Exercise])
async def preview_plan(muscle: str, user: dict = Depends(require_user)) -> list[Exercise]:
    m = muscle.strip().lower()
    if m not in MUSCLES:
        raise HTTPException(status_code=404, detail=f"Bilinmeyen kas grubu: {muscle}")
    profile = await get_profile(user["id"])
    return [Exercise(**d) for d in await _plan_for(user["id"], m, profile)]


@router.put("/plan/{muscle}", response_model=list[Exercise])
async def set_plan_override(
    muscle: str, body: PlanOverrideRequest, user: dict = Depends(require_user)
) -> list[Exercise]:
    uid = user["id"]
    m = muscle.strip().lower()
    if m not in MUSCLES:
        raise HTTPException(status_code=404, detail=f"Bilinmeyen kas grubu: {muscle}")

    valid_ids: list[str] = []
    if body.exercise_ids:
        docs = await db.exercises.find({"id": {"$in": body.exercise_ids}}).to_list(100)
        by_id = {d["id"]: d for d in docs}
        for eid in body.exercise_ids:
            doc = by_id.get(eid)
            if doc is None or doc.get("muscle") != m:
                raise HTTPException(status_code=400, detail=f"Geçersiz egzersiz: {eid}")
            valid_ids.append(eid)

    if valid_ids:
        await db.plan_overrides.update_one(
            {"user_id": uid, "muscle": m},
            {"$set": {"user_id": uid, "muscle": m, "exercise_ids": valid_ids}},
            upsert=True,
        )
    else:
        await db.plan_overrides.delete_one({"user_id": uid, "muscle": m})

    profile = await get_profile(uid)
    return [Exercise(**d) for d in await _plan_for(uid, m, profile)]


@router.post("/start", response_model=Workout)
async def start_workout(body: StartRequest, user: dict = Depends(require_user)) -> Workout:
    uid = user["id"]
    muscle = body.muscle.strip().lower()
    if muscle not in MUSCLES:
        raise HTTPException(status_code=422, detail=f"Bilinmeyen kas grubu: {body.muscle}")

    existing = await db.workouts.find_one({"user_id": uid, "muscle": muscle, "status": "active"})
    if existing:
        return _from_doc(existing)

    profile = await get_profile(uid)
    tr = MUSCLE_TR.get(muscle, muscle)
    today = body.local_date or today_iso()
    current_week = week_start(today)
    limit = profile.get("weekly_limit", 2)

    if await db.workouts.count_documents({"user_id": uid, "muscle": muscle, "status": "completed", "date": today}):
        raise HTTPException(
            status_code=409,
            detail=f"{tr} bugün tamamlandı. Aynı kas grubunu günde bir kez çalışabilirsin.",
        )

    done_this_week = await db.workouts.count_documents(
        {"user_id": uid, "muscle": muscle, "status": "completed", "week_start": current_week}
    )
    if done_this_week >= limit:
        raise HTTPException(
            status_code=409,
            detail=f"{tr} için haftalık limit doldu ({done_this_week}/{limit}). Yeni hafta başında tekrar açılacak.",
        )

    library = await _plan_for(uid, muscle, profile)
    if not library:
        raise HTTPException(
            status_code=404,
            detail=f"{tr} için ekipmanına uygun egzersiz bulunamadı. Profilden ekipman ekleyebilir veya egzersizleri kendin seçebilirsin.",
        )

    previous = await _previous_map(uid, muscle)
    plan: list[PlanExercise] = []
    for i, d in enumerate(library):
        ex = Exercise(**d)
        prev_w, prev_r = previous.get(ex.name, (None, None))
        plan.append(PlanExercise(
            exercise_id=ex.id,
            name=ex.name,
            order=i + 1,
            video_id=ex.video_id,
            equipment_label=ex.equipment_label,
            activation=ex.activation,
            secondary=ex.secondary,
            target_sets=ex.target_sets,
            target_reps=ex.target_reps,
            rep_min=ex.rep_min,
            rep_max=ex.rep_max,
            rep_range=ex.rep_range,
            rest_sec=ex.rest_sec,
            progression_to=ex.progression_to,
            progression_note=ex.progression_note,
            previous_weight=prev_w,
            previous_reps=prev_r,
            sets=[WorkoutSet(index=j, target_reps=ex.target_reps) for j in range(ex.target_sets)],
        ))

    now = datetime.now(timezone.utc)
    workout = Workout(
        user_id=uid,
        muscle=muscle,
        date=today,
        week_start=current_week,
        started_at=now,
        start_clock=body.local_clock or now.strftime("%H:%M"),
        exercises=plan,
        total_sets=sum(e.target_sets for e in plan),
    )
    await db.workouts.insert_one(workout.model_dump())
    return workout


@router.get("", response_model=list[Workout])
async def list_workouts(
    muscle: str | None = None,
    status: str | None = None,
    limit: int = 50,
    user: dict = Depends(require_user),
) -> list[Workout]:
    query: dict = {"user_id": user["id"]}
    if muscle:
        query["muscle"] = muscle.lower()
    if status:
        query["status"] = status
    docs = (
        await db.workouts.find(query)
        .sort([("date", -1), ("started_at", -1)])
        .to_list(min(max(limit, 1), 200))
    )
    return [_from_doc(d) for d in docs]


@router.get("/{workout_id}", response_model=Workout)
async def get_workout(workout_id: str, user: dict = Depends(require_user)) -> Workout:
    doc = await db.workouts.find_one({"id": workout_id, "user_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Antrenman bulunamadı")
    return _from_doc(doc)


@router.patch("/{workout_id}/sets", response_model=Workout)
async def log_set(workout_id: str, body: SetCompletion, user: dict = Depends(require_user)) -> Workout:
    uid = user["id"]
    doc = await db.workouts.find_one({"id": workout_id, "user_id": uid})
    if not doc:
        raise HTTPException(status_code=404, detail="Antrenman bulunamadı")
    if doc["status"] != "active":
        raise HTTPException(status_code=409, detail="Bu antrenman zaten tamamlandı")

    if body.exercise_index >= len(doc["exercises"]):
        raise HTTPException(status_code=400, detail="exercise_index aralık dışında")
    sets = doc["exercises"][body.exercise_index]["sets"]
    if body.set_index >= len(sets):
        raise HTTPException(status_code=400, detail="set_index aralık dışında")

    base = f"exercises.{body.exercise_index}.sets.{body.set_index}"
    await db.workouts.update_one(
        {"id": workout_id, "user_id": uid},
        {"$set": {
            f"{base}.reps": body.reps,
            f"{base}.weight_kg": body.weight_kg,
            f"{base}.completed": True,
        }},
    )
    doc = await db.workouts.find_one({"id": workout_id, "user_id": uid})
    total, done, volume = _totals(doc)
    await db.workouts.update_one(
        {"id": workout_id, "user_id": uid},
        {"$set": {"total_sets": total, "completed_sets": done, "total_volume": volume}},
    )
    return _from_doc(await db.workouts.find_one({"id": workout_id, "user_id": uid}))


@router.patch("/{workout_id}/note", response_model=Workout)
async def save_note(workout_id: str, body: NoteUpdate, user: dict = Depends(require_user)) -> Workout:
    uid = user["id"]
    doc = await db.workouts.find_one({"id": workout_id, "user_id": uid})
    if not doc:
        raise HTTPException(status_code=404, detail="Antrenman bulunamadı")
    if body.exercise_index >= len(doc["exercises"]):
        raise HTTPException(status_code=400, detail="exercise_index aralık dışında")
    await db.workouts.update_one(
        {"id": workout_id, "user_id": uid},
        {"$set": {f"exercises.{body.exercise_index}.note": body.note.strip()}},
    )
    return _from_doc(await db.workouts.find_one({"id": workout_id, "user_id": uid}))


@router.post("/{workout_id}/complete", response_model=WorkoutCompleteResponse)
async def complete_workout(
    workout_id: str,
    body: CompleteRequest | None = None,
    user: dict = Depends(require_user),
) -> WorkoutCompleteResponse:
    uid = user["id"]
    doc = await db.workouts.find_one({"id": workout_id, "user_id": uid})
    if not doc:
        raise HTTPException(status_code=404, detail="Antrenman bulunamadı")
    if doc["status"] == "completed":
        raise HTTPException(status_code=409, detail="Bu antrenman zaten tamamlandı")

    now = datetime.now(timezone.utc)
    started = doc["started_at"]
    if getattr(started, "tzinfo", None) is None:
        started = started.replace(tzinfo=timezone.utc)
    duration = max(1, int((now - started).total_seconds()))

    history = await db.workouts.find(
        {"user_id": uid, "id": {"$ne": workout_id}, "status": "completed"}
    ).to_list(1000)
    historical_best: dict[str, float] = {}
    for w in history:
        for e in w.get("exercises", []):
            for s in e.get("sets", []):
                if s.get("completed") and (s.get("weight_kg") or 0) > historical_best.get(e["name"], 0):
                    historical_best[e["name"]] = s["weight_kg"]

    prs: list[PersonalRecord] = []
    for e in doc["exercises"]:
        done_sets = [s for s in e["sets"] if s.get("completed")]
        best_w = max((s.get("weight_kg") or 0 for s in done_sets), default=0)
        if best_w <= 0:
            continue
        if best_w > historical_best.get(e["name"], 0):
            best_reps = max(
                (s.get("reps") or 0 for s in done_sets if (s.get("weight_kg") or 0) == best_w),
                default=0,
            )
            prs.append(PersonalRecord(exercise_name=e["name"], weight_kg=best_w, reps=best_reps))

    total, done, volume = _totals(doc)
    await db.workouts.update_one(
        {"id": workout_id, "user_id": uid},
        {"$set": {
            "status": "completed",
            "finished_at": now,
            "finish_clock": (body.local_clock if body and body.local_clock else now.strftime("%H:%M")),
            "duration_sec": duration,
            "total_sets": total,
            "completed_sets": done,
            "total_volume": volume,
            "prs": [p.model_dump() for p in prs],
        }},
    )

    fresh = await db.workouts.find_one({"id": workout_id, "user_id": uid})
    muscle_docs = await completed_workouts(uid, doc["muscle"])
    profile = await get_profile(uid)
    limit = profile.get("weekly_limit", 2)
    score_after = training_score(muscle_docs, limit, week_start(today_iso()))
    tr = MUSCLE_TR.get(doc["muscle"], doc["muscle"])

    messages: list[str] = []
    previous_sessions = [w for w in muscle_docs if w["id"] != workout_id]
    if previous_sessions:
        prev_volume = previous_sessions[-1].get("total_volume", 0)
        if prev_volume > 0 and volume > prev_volume:
            pct = round((volume - prev_volume) / prev_volume * 100, 1)
            messages.append(f"Toplam hacim önceki {tr} antrenmanına göre %{pct} arttı.")
        elif prev_volume > 0 and volume < prev_volume:
            pct = round((prev_volume - volume) / prev_volume * 100, 1)
            messages.append(f"Toplam hacim önceki {tr} antrenmanına göre %{pct} azaldı.")
        else:
            messages.append(f"Toplam hacim önceki {tr} antrenmanınla aynı.")
    else:
        messages.append(f"İlk {tr} antrenmanın kaydedildi — başlangıç noktası oluştu.")

    for p in prs:
        messages.append(f"Yeni kişisel rekor: {p.exercise_name} — {p.weight_kg} kg × {p.reps}.")

    for e in doc["exercises"]:
        done_sets = [s for s in e["sets"] if s.get("completed")]
        if done_sets and all((s.get("reps") or 0) >= e.get("rep_max", 12) for s in done_sets):
            messages.append(
                f"{e['name']}: tüm setlerde hedef tekrar aralığının üstüne ulaştın — ağırlığı artırma zamanı."
            )

    week_count = sum(1 for w in muscle_docs if w.get("week_start") == doc["week_start"])
    if week_count >= limit:
        messages.append(f"{tr} haftalık hedefi tamamlandı ({week_count}/{limit} antrenman).")
    else:
        messages.append(f"Bu hafta {tr} için {week_count}. antrenman (limit {limit}).")

    return WorkoutCompleteResponse(
        workout=_from_doc(fresh),
        prs=prs,
        score_before=0.0,
        score_after=score_after,
        messages=messages,
    )


@router.delete("/{workout_id}")
async def delete_workout(workout_id: str, user: dict = Depends(require_user)) -> dict:
    result = await db.workouts.delete_one({"id": workout_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Antrenman bulunamadı")
    return {"deleted": True}


@router.post("/reset-week")
async def reset_current_week(
    body: ResetWeekRequest | None = None, user: dict = Depends(require_user)
) -> dict:
    query: dict = {"user_id": user["id"], "week_start": week_start(today_iso())}
    if body and body.muscle:
        query["muscle"] = body.muscle.lower()
    result = await db.workouts.delete_many(query)
    return {"deleted": result.deleted_count, "week_start": query["week_start"]}


@router.post("/reset-today")
async def reset_today(
    body: ResetWeekRequest | None = None, user: dict = Depends(require_user)
) -> dict:
    """Bugünün tüm antrenmanlarını sil (opsiyonel kas grubu filtresiyle)."""
    query: dict = {"user_id": user["id"], "date": today_iso()}
    if body and body.muscle:
        query["muscle"] = body.muscle.lower()
    result = await db.workouts.delete_many(query)
    return {"deleted": result.deleted_count, "date": query["date"]}