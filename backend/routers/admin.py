"""Admin paneli — sadece yetkili e-postalar için."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.db import db
from lib.dates import today_iso
from lib.scoring import week_start
from routers.auth import ADMIN_EMAILS, require_user

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin(user: dict = Depends(require_user)) -> dict:
    email = (user.get("email") or "").strip().lower()
    if email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Yetkisiz.")
    return user


def _clean(doc: dict) -> dict:
    if doc is None:
        return {}
    doc.pop("_id", None)
    for k, v in list(doc.items()):
        if hasattr(v, "isoformat"):
            doc[k] = v.isoformat()
    return doc


@router.get("/overview")
async def overview(user: dict = Depends(require_admin)) -> dict:
    today = today_iso()
    week = week_start(today)
    return {
        "total_users": await db.users.count_documents({}),
        "total_workouts": await db.workouts.count_documents({"status": "completed"}),
        "today_workouts": await db.workouts.count_documents(
            {"status": "completed", "date": today}
        ),
        "week_workouts": await db.workouts.count_documents(
            {"status": "completed", "week_start": week}
        ),
        "active_workouts": await db.workouts.count_documents({"status": "active"}),
        "total_exercises": await db.exercises.count_documents({}),
    }


@router.get("/users")
async def list_users(user: dict = Depends(require_admin)) -> dict:
    docs = (
        await db.users.find({}, {"password_hash": 0})
        .sort("created_at", -1)
        .to_list(200)
    )
    items = []
    for u in docs:
        uid = u.get("id")
        total = await db.workouts.count_documents(
            {"user_id": uid, "status": "completed"}
        )
        last = await db.workouts.find_one(
            {"user_id": uid, "status": "completed"},
            {"date": 1},
            sort=[("date", -1)],
        )
        profile = await db.profiles.find_one(
            {"user_id": uid},
            {"phone": 1, "weight_kg": 1, "age": 1, "height_cm": 1},
        ) or {}
        items.append(
            {
                "id": uid,
                "name": u.get("name") or "—",
                "email": u.get("email") or "—",
                "created_at": u.get("created_at"),
                "total_workouts": total,
                "last_workout_date": (last or {}).get("date"),
                "phone": profile.get("phone") or "",
                "weight_kg": profile.get("weight_kg"),
                "age": profile.get("age"),
                "height_cm": profile.get("height_cm"),
            }
        )
    return {"items": items}


@router.get("/user/{user_id}")
async def user_detail(user_id: str, user: dict = Depends(require_admin)) -> dict:
    u = await db.users.find_one({"id": user_id}, {"password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    profile = await db.profiles.find_one({"user_id": user_id}) or {}

    # 🆕 user objesine profil alanlarını da ekle (liste endpoint'iyle aynı şekil)
    u["phone"] = profile.get("phone") or ""
    u["weight_kg"] = profile.get("weight_kg")
    u["age"] = profile.get("age")
    u["height_cm"] = profile.get("height_cm")

    # Tüm tamamlanmış antrenmanlar (son 500)
    all_workouts = (
        await db.workouts.find({"user_id": user_id, "status": "completed"})
        .sort([("date", -1), ("started_at", -1)])
        .to_list(500)
    )

    # Kas grubu bazlı istatistikler
    muscle_stats: dict = {}
    for w in all_workouts:
        m = w.get("muscle")
        if not m:
            continue
        if m not in muscle_stats:
            muscle_stats[m] = {
                "sessions": 0,
                "sets": 0,
                "volume": 0.0,
                "last": None,
            }
        muscle_stats[m]["sessions"] += 1
        muscle_stats[m]["sets"] += w.get("completed_sets", 0)
        muscle_stats[m]["volume"] += w.get("total_volume", 0)
        d = w.get("date")
        if d and (not muscle_stats[m]["last"] or d > muscle_stats[m]["last"]):
            muscle_stats[m]["last"] = d

    for k in muscle_stats:
        muscle_stats[k]["volume"] = round(muscle_stats[k]["volume"], 1)

    # PR'lar — her egzersiz için en iyi
    best_prs: dict = {}
    for w in all_workouts:
        for pr in w.get("prs", []):
            name = pr.get("exercise_name")
            if not name:
                continue
            if name not in best_prs or (pr.get("weight_kg") or 0) > (
                best_prs[name].get("weight_kg") or 0
            ):
                best_prs[name] = {
                    "exercise_name": name,
                    "weight_kg": pr.get("weight_kg"),
                    "reps": pr.get("reps"),
                    "date": w.get("date"),
                    "muscle": w.get("muscle"),
                }

    # Streak (bugünden geriye doğru seri)
    dates_sorted = sorted(
        {w.get("date") for w in all_workouts if w.get("date")},
        reverse=True,
    )
    streak = 0
    if dates_sorted:
        try:
            today = datetime.strptime(today_iso(), "%Y-%m-%d").date()
            first = datetime.strptime(dates_sorted[0], "%Y-%m-%d").date()
            if (today - first).days <= 1:
                check = first
                for ds in dates_sorted:
                    dd = datetime.strptime(ds, "%Y-%m-%d").date()
                    if dd == check:
                        streak += 1
                        check -= timedelta(days=1)
                    elif dd < check:
                        break
        except Exception:
            streak = 0

    # Ortalama süre
    durations = [
        w.get("duration_sec") or 0
        for w in all_workouts
        if w.get("duration_sec")
    ]
    avg_duration = int(sum(durations) / len(durations)) if durations else 0

    # Son 30 antrenman (liste için)
    recent = all_workouts[:30]

    # Kilo geçmişi (son 30 kayıt)
    weight_history = list(profile.get("weight_history") or [])[-30:]

    # Kas bazlı istatistikleri liste yapıp sırala
    muscle_list = [{"muscle": k, **v} for k, v in muscle_stats.items()]
    muscle_list.sort(key=lambda x: -x["sessions"])

    return {
        "user": _clean(u),
        "profile": _clean(profile),
        "stats": {
            "total_workouts": len(all_workouts),
            "total_sets": sum(w.get("completed_sets", 0) for w in all_workouts),
            "total_volume": round(
                sum(w.get("total_volume", 0) for w in all_workouts), 1
            ),
            "streak": streak,
            "avg_duration_sec": avg_duration,
            "muscles_trained": len(muscle_stats),
            "muscle_stats": muscle_list,
            "prs": sorted(
                best_prs.values(),
                key=lambda x: -(x.get("weight_kg") or 0),
            ),
        },
        "weight_history": weight_history,
        "workouts": [_clean(w) for w in recent],
    }


@router.delete("/user/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_admin)) -> dict:
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    if (target.get("email") or "").lower() in ADMIN_EMAILS:
        raise HTTPException(status_code=400, detail="Admin kendi hesabını silemez.")

    await db.workouts.delete_many({"user_id": user_id})
    await db.plan_overrides.delete_many({"user_id": user_id})
    await db.profiles.delete_many({"user_id": user_id})
    result = await db.users.delete_one({"id": user_id})
    return {"deleted": result.deleted_count > 0}


@router.get("/workouts")
async def list_workouts(
    limit: int = Query(50, ge=1, le=200),
    status: str | None = None,
    muscle: str | None = None,
    user: dict = Depends(require_admin),
) -> dict:
    query: dict = {}
    if status:
        query["status"] = status
    if muscle:
        query["muscle"] = muscle.lower()

    total = await db.workouts.count_documents(query)
    docs = (
        await db.workouts.find(query, {"_id": 0, "exercises": 0})
        .sort([("date", -1), ("started_at", -1)])
        .limit(limit)
        .to_list(limit)
    )
    user_ids = list({d.get("user_id") for d in docs if d.get("user_id")})
    users = await db.users.find(
        {"id": {"$in": user_ids}}, {"id": 1, "name": 1, "email": 1}
    ).to_list(200)
    by_id = {u["id"]: u for u in users}

    items = []
    for d in docs:
        u = by_id.get(d.get("user_id"))
        items.append(
            {
                "id": d.get("id"),
                "user_id": d.get("user_id"),
                "user_name": u["name"] if u else "—",
                "user_email": u["email"] if u else "—",
                "muscle": d.get("muscle"),
                "date": d.get("date"),
                "status": d.get("status"),
                "completed_sets": d.get("completed_sets", 0),
                "total_sets": d.get("total_sets", 0),
                "total_volume": d.get("total_volume", 0),
                "start_clock": d.get("start_clock", ""),
                "finish_clock": d.get("finish_clock", ""),
            }
        )
    return {"items": items, "total": total}


@router.get("/exercises")
async def list_exercises(
    limit: int = Query(50, ge=1, le=200),
    muscle: str | None = None,
    user: dict = Depends(require_admin),
) -> dict:
    query: dict = {}
    if muscle:
        query["muscle"] = muscle.lower()
    total = await db.exercises.count_documents(query)
    docs = (
        await db.exercises.find(query, {"_id": 0})
        .sort([("muscle", 1), ("order", 1)])
        .limit(limit)
        .to_list(limit)
    )
    return {"items": docs, "total": total}