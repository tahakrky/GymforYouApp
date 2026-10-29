"""Training analytics computed from real workout history."""

from datetime import datetime, timedelta

from lib.db import db
from lib.dates import today_iso

MUSCLES = [
    "biceps",
    "triceps",
    "forearms",
    "shoulders",
    "chest",
    "back",
    "legs",
    "abs",
    "glutes",
]
EQUIPMENT = ["dumbbell", "bench", "bodyweight", "barbell", "cable", "machine", "band", "pullup_bar"]
DIFFICULTIES = ["beginner", "intermediate", "advanced"]
DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

DEFAULT_OWNED_EQUIPMENT = ["dumbbell", "bench", "bodyweight"]


def week_start(date_str: str) -> str:
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    return (d - timedelta(days=d.weekday())).strftime("%Y-%m-%d")


def shift_week(week_start_str: str, weeks: int) -> str:
    d = datetime.strptime(week_start_str, "%Y-%m-%d").date() + timedelta(weeks=weeks)
    return d.strftime("%Y-%m-%d")


def home_ready(doc: dict, owned: set[str], dumbbell_count: int) -> bool:
    required = set(doc.get("equipment_required") or [])
    if not required.issubset(owned):
        return False
    return doc.get("dumbbells_needed", 0) <= dumbbell_count


async def get_profile(user_id: str) -> dict:
    """Per-user profile, auto-created with defaults on first read."""
    doc = await db.profiles.find_one({"user_id": user_id})
    if not doc:
        from models.profile import Profile

        doc = Profile(user_id=user_id).model_dump()
        await db.profiles.insert_one(doc)
    return doc


async def completed_workouts(user_id: str, muscle: str | None = None) -> list[dict]:
    """Completed sessions for one user, oldest -> newest."""
    query: dict = {"user_id": user_id, "status": "completed"}
    if muscle:
        query["muscle"] = muscle
    return await db.workouts.find(query).sort([("date", 1), ("started_at", 1)]).to_list(1000)


def _set_weight(s: dict) -> float:
    return s.get("weight_kg") or 0.0


def consistency_ratio(docs: list[dict], current_week: str) -> float:
    if not docs:
        return 0.0
    first_week = docs[0].get("week_start") or week_start(docs[0]["date"])
    d0 = datetime.strptime(first_week, "%Y-%m-%d").date()
    d1 = datetime.strptime(current_week, "%Y-%m-%d").date()
    weeks_active = max(1, min(((d1 - d0).days // 7) + 1, 8))
    week_set = {(w.get("week_start") or week_start(w["date"])) for w in docs}
    cursor, trained = d1, 0
    for _ in range(weeks_active):
        if cursor.strftime("%Y-%m-%d") in week_set:
            trained += 1
        cursor -= timedelta(days=7)
    return trained / weeks_active


def training_score(docs: list[dict], weekly_limit: int, current_week: str) -> float:
    if weekly_limit <= 0:
        return 0.0
    sessions_this_week = sum(1 for w in docs if w.get("week_start") == current_week)
    session_ratio = min(1.0, sessions_this_week / weekly_limit)

    consistency = 0.0
    progression = 0.5
    completion = 0.0
    if docs:
        consistency = consistency_ratio(docs, current_week)
        ratios = []
        for w in docs:
            planned = sum(e.get("target_sets", 0) for e in w.get("exercises", []))
            done = w.get("completed_sets", 0)
            if planned > 0:
                ratios.append(min(1.0, done / planned))
        completion = sum(ratios) / len(ratios) if ratios else 0.0

        weekly_top: dict[str, float] = {}
        for w in docs:
            wk = w.get("week_start") or week_start(w["date"])
            for e in w.get("exercises", []):
                for s in e.get("sets", []):
                    if s.get("completed"):
                        weekly_top[wk] = max(weekly_top.get(wk, 0.0), _set_weight(s))
        weeks_sorted = sorted(weekly_top)
        recent, prior = weeks_sorted[-2:], weeks_sorted[:-2][-4:]
        if recent and prior:
            cur_mean = sum(weekly_top[w] for w in recent) / len(recent)
            prev_mean = sum(weekly_top[w] for w in prior) / len(prior)
            if prev_mean > 0:
                progression = min(1.0, cur_mean / prev_mean)
        elif recent:
            progression = 0.75

    score = 0.35 * consistency + 0.30 * session_ratio + 0.20 * progression + 0.15 * completion
    return round(100 * score, 1)


async def current_streak(user_id: str) -> int:
    """Consecutive days with a completed workout for this user."""
    dates = set(await db.workouts.distinct("date", {"user_id": user_id, "status": "completed"}))
    d = datetime.strptime(today_iso(), "%Y-%m-%d").date()
    if d.strftime("%Y-%m-%d") not in dates:
        d -= timedelta(days=1)
    streak = 0
    while d.strftime("%Y-%m-%d") in dates:
        streak += 1
        d -= timedelta(days=1)
    return streak