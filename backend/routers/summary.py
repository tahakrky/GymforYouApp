"""Home summary and per-muscle analytics — per user."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException

from lib.dates import today_iso
from lib.scoring import (
    DAY_KEYS,
    MUSCLES,
    completed_workouts,
    consistency_ratio,
    current_streak,
    get_profile,
    shift_week,
    training_score,
    week_start,
)
from models.summary import MuscleDetail, Summary, WeekPoint
from models.workout import PersonalRecord
from routers.auth import require_user


def _status(sessions_this_week: int, limit: int, trained_today: bool) -> str:
    if trained_today:
        return "TODAY_DONE"
    if sessions_this_week >= limit:
        return "LIMIT_REACHED"
    return "AVAILABLE"


router = APIRouter(tags=["summary"])


@router.get("/summary", response_model=Summary)
async def summary(today: str | None = None, user: dict = Depends(require_user)) -> Summary:
    uid = user["id"]
    profile = await get_profile(uid)
    day = today or today_iso()
    current_week = week_start(day)
    limit = profile.get("weekly_limit", 2)
    all_done = await completed_workouts(uid)

    muscles = []
    for m in MUSCLES:
        docs = [w for w in all_done if w["muscle"] == m]
        week_docs = [w for w in docs if w.get("week_start") == current_week]
        trained_today = any(w["date"] == day for w in docs)
        muscles.append({
            "muscle": m,
            "sessions_this_week": len(week_docs),
            "weekly_limit": limit,
            "status": _status(len(week_docs), limit, trained_today),
            "trained_today": trained_today,
            "sets_this_week": sum(w.get("completed_sets", 0) for w in week_docs),
            "volume_this_week": sum(w.get("total_volume", 0) for w in week_docs),
            "last_trained": max((w["date"] for w in docs), default=None),
            "training_score": training_score(docs, limit, current_week),
        })

    today_date = datetime.strptime(day, "%Y-%m-%d").date()
    monday = datetime.strptime(current_week, "%Y-%m-%d").date()
    week_plan = profile.get("week_plan") or {}
    week_overview = []
    for i in range(7):
        d = monday + timedelta(days=i)
        ds = d.strftime("%Y-%m-%d")
        week_overview.append({
            "day": DAY_KEYS[i].upper(),
            "date": ds,
            "scheduled_muscle": None,
            "planned_muscles": [m for m in (week_plan.get(DAY_KEYS[i]) or []) if m in MUSCLES],
            "muscles_trained": sorted({w["muscle"] for w in all_done if w["date"] == ds}),
            "is_today": ds == day,
            "is_future": d > today_date,
        })

    stats = {
        "total_workouts": len(all_done),
        "total_sets": sum(w.get("completed_sets", 0) for w in all_done),
        "total_volume": round(sum(w.get("total_volume", 0) for w in all_done), 1),
        "current_streak": await current_streak(uid),
        "pr_count": sum(len(w.get("prs", [])) for w in all_done),
    }

    order = [m for m in (profile.get("muscle_order") or []) if m in MUSCLES]
    muscle_order = order + [m for m in MUSCLES if m not in order]
    today_key = DAY_KEYS[datetime.strptime(day, "%Y-%m-%d").date().weekday()]

    return Summary(
        name=profile.get("name", ""),
        today=day,
        weekly_limit=limit,
        today_scheduled_muscle=None,
        today_planned_muscles=[m for m in (week_plan.get(today_key) or []) if m in MUSCLES],
        muscle_order=muscle_order,
        muscles=muscles,
        week_overview=week_overview,
        stats=stats,
    )


@router.get("/muscles/{muscle}", response_model=MuscleDetail)
async def muscle_detail(
    muscle: str, today: str | None = None, user: dict = Depends(require_user)
) -> MuscleDetail:
    uid = user["id"]
    m = muscle.strip().lower()
    if m not in MUSCLES:
        raise HTTPException(status_code=404, detail=f"Bilinmeyen kas grubu: {muscle}")
    profile = await get_profile(uid)
    day = today or today_iso()
    current_week = week_start(day)
    limit = profile.get("weekly_limit", 2)
    docs = await completed_workouts(uid, m)

    week_docs = [w for w in docs if w.get("week_start") == current_week]
    sessions_this_week = len(week_docs)
    trained_today = any(w["date"] == day for w in docs)

    best_weight = 0.0
    weekly_top: dict[str, float] = {}
    best_per_exercise: dict[str, tuple[float, int]] = {}
    for w in docs:
        key = w.get("week_start") or week_start(w["date"])
        for e in w.get("exercises", []):
            for s in e.get("sets", []):
                if not s.get("completed"):
                    continue
                weight = s.get("weight_kg") or 0.0
                reps = s.get("reps") or 0
                best_weight = max(best_weight, weight)
                if weight > weekly_top.get(key, 0.0):
                    weekly_top[key] = weight
                prev = best_per_exercise.get(e["name"])
                if prev is None or weight > prev[0]:
                    best_per_exercise[e["name"]] = (weight, reps)

    records = [
        PersonalRecord(exercise_name=name, weight_kg=w, reps=r)
        for name, (w, r) in sorted(best_per_exercise.items(), key=lambda kv: -kv[1][0])
        if w > 0
    ]

    last_trained = max((w["date"] for w in docs), default=None)
    next_available = shift_week(current_week, 1) if sessions_this_week >= limit else None

    progression: list[WeekPoint] = []
    if docs:
        buckets: dict[str, dict] = {}
        cursor = datetime.strptime(current_week, "%Y-%m-%d").date()
        for _ in range(8):
            buckets[cursor.strftime("%Y-%m-%d")] = {"sets": 0, "volume": 0.0}
            cursor -= timedelta(days=7)
        for w in docs:
            key = w.get("week_start") or week_start(w["date"])
            if key in buckets:
                buckets[key]["sets"] += w.get("completed_sets", 0)
                buckets[key]["volume"] += w.get("total_volume", 0)
        progression = [
            WeekPoint(
                week_start=key,
                sets=v["sets"],
                volume=round(v["volume"], 1),
                top_weight=weekly_top.get(key, 0.0),
            )
            for key, v in sorted(buckets.items())
        ]

    return MuscleDetail(
        muscle=m,
        training_score=training_score(docs, limit, current_week),
        sessions_this_week=sessions_this_week,
        total_sessions=len(docs),
        weekly_limit=limit,
        status=_status(sessions_this_week, limit, trained_today),
        trained_today=trained_today,
        total_sets=sum(w.get("completed_sets", 0) for w in docs),
        total_volume=round(sum(w.get("total_volume", 0) for w in docs), 1),
        best_weight=best_weight if best_weight > 0 else None,
        consistency=round(100 * consistency_ratio(docs, current_week), 1),
        last_trained=last_trained,
        next_available=next_available,
        records=records,
        progression=progression,
    )