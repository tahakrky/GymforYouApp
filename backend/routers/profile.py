"""Per-user profile: identity, weekly rule config, weight history, playlist."""

import re

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.dates import today_iso
from lib.scoring import DAY_KEYS, EQUIPMENT, MUSCLES, get_profile
from models.profile import (
    MuscleOrderUpdate,
    PlanOverrideUpdate,
    Profile,
    ProfileUpdate,
    WeekPlanUpdate,
    WeightAdd,
)
from routers.auth import require_user

router = APIRouter(prefix="/profile", tags=["profile"])

VALID_SCHEDULE_VALUES = set(MUSCLES) | {"rest"}


def normalize_playlist_url(raw: str) -> str:
    value = raw.strip()
    if "open.spotify.com" not in value:
        if re.fullmatch(r"[A-Za-z0-9]{16,30}", value):
            return f"https://open.spotify.com/playlist/{value}"
        raise HTTPException(status_code=422, detail="Use a https://open.spotify.com/playlist/... URL")
    match = re.search(r"playlist/([A-Za-z0-9]+)", value)
    if not match:
        raise HTTPException(status_code=422, detail="Use a https://open.spotify.com/playlist/... URL")
    return f"https://open.spotify.com/playlist/{match.group(1)}"


@router.get("", response_model=Profile)
async def get_profile_route(user: dict = Depends(require_user)) -> Profile:
    doc = await get_profile(user["id"])
    if user.get("name"):
        doc["name"] = user["name"]
    return Profile(**doc)


@router.put("", response_model=Profile)
async def update_profile(
    body: ProfileUpdate,
    user: dict = Depends(require_user),
) -> Profile:
    uid = user["id"]
    current = await get_profile(uid)
    updates = body.model_dump(exclude_none=True)

    if "schedule" in updates:
        for day, muscle in updates["schedule"].items():
            if day not in DAY_KEYS:
                raise HTTPException(status_code=422, detail=f"Invalid schedule day: {day}")
            if muscle not in VALID_SCHEDULE_VALUES:
                raise HTTPException(status_code=422, detail=f"Invalid schedule value: {muscle}")

    if "experience" in updates:
        updates["experience"] = (updates["experience"] or "").upper()

    if "owned_equipment" in updates:
        owned = [e.lower() for e in updates["owned_equipment"]]
        for item in owned:
            if item not in EQUIPMENT:
                raise HTTPException(status_code=422, detail=f"Unknown equipment: {item}")
        if "bodyweight" not in owned:
            owned.append("bodyweight")
        updates["owned_equipment"] = owned

    if "equipment_filter_default" in updates and updates["equipment_filter_default"] not in ("mine", "all"):
        raise HTTPException(status_code=422, detail="equipment_filter_default must be 'mine' or 'all'")

    if "playlist_url" in updates:
        raw = (updates["playlist_url"] or "").strip()
        updates["playlist_url"] = normalize_playlist_url(raw) if raw else ""
        if not updates["playlist_url"]:
            updates["playlist_name"] = ""

    if "name" in updates and updates["name"]:
        clean_name = updates["name"].strip()
        if not clean_name:
            raise HTTPException(status_code=422, detail="İsim boş olamaz.")
        updates["name"] = clean_name
        await db.users.update_one({"id": uid}, {"$set": {"name": clean_name}})

    merged = {**current, **updates}
    if "name" not in updates:
        merged["name"] = user.get("name") or current.get("name") or ""

    await db.profiles.update_one({"user_id": uid}, {"$set": updates}, upsert=True)
    return Profile(**merged)


@router.post("/weight", response_model=Profile)
async def add_weight(body: WeightAdd, user: dict = Depends(require_user)) -> Profile:
    uid = user["id"]
    await get_profile(uid)
    entry = {"date": today_iso(), "weight_kg": body.weight_kg}
    await db.profiles.update_one(
        {"user_id": uid},
        {"$set": {"weight_kg": body.weight_kg}, "$push": {"weight_history": entry}},
        upsert=True,
    )
    return Profile(**await get_profile(uid))


@router.put("/plan/{muscle}", response_model=Profile)
async def set_plan_override(
    muscle: str, body: PlanOverrideUpdate, user: dict = Depends(require_user)
) -> Profile:
    uid = user["id"]
    m = muscle.strip().lower()
    if m not in MUSCLES:
        raise HTTPException(status_code=404, detail=f"Unknown muscle group: {muscle}")
    current = await get_profile(uid)
    overrides = dict(current.get("plan_overrides") or {})

    if body.exercise_ids:
        found = await db.exercises.find({"id": {"$in": body.exercise_ids}, "muscle": m}).to_list(50)
        found_ids = {d["id"] for d in found}
        missing = [i for i in body.exercise_ids if i not in found_ids]
        if missing:
            raise HTTPException(status_code=422, detail=f"Not {m} exercises: {', '.join(missing)}")
        overrides[m] = body.exercise_ids
    else:
        overrides.pop(m, None)

    await db.profiles.update_one({"user_id": uid}, {"$set": {"plan_overrides": overrides}}, upsert=True)
    return Profile(**await get_profile(uid))


@router.put("/muscle-order", response_model=Profile)
async def set_muscle_order(body: MuscleOrderUpdate, user: dict = Depends(require_user)) -> Profile:
    uid = user["id"]
    order = [m.strip().lower() for m in body.muscle_order]
    for m in order:
        if m not in MUSCLES:
            raise HTTPException(status_code=422, detail=f"Bilinmeyen kas grubu: {m}")
    seen: list[str] = []
    for m in order:
        if m not in seen:
            seen.append(m)
    final = seen + [m for m in MUSCLES if m not in seen]
    await db.profiles.update_one({"user_id": uid}, {"$set": {"muscle_order": final}}, upsert=True)
    return Profile(**await get_profile(uid))


@router.put("/week-plan", response_model=Profile)
async def set_week_plan(body: WeekPlanUpdate, user: dict = Depends(require_user)) -> Profile:
    uid = user["id"]
    cleaned: dict[str, list[str]] = {}
    for day, muscles in body.week_plan.items():
        key = day.strip().lower()
        if key not in DAY_KEYS:
            raise HTTPException(status_code=422, detail=f"Geçersiz gün: {day}")
        picked: list[str] = []
        for m in muscles:
            ml = m.strip().lower()
            if ml not in MUSCLES:
                raise HTTPException(status_code=422, detail=f"Bilinmeyen kas grubu: {m}")
            if ml not in picked:
                picked.append(ml)
        cleaned[key] = picked
    await db.profiles.update_one({"user_id": uid}, {"$set": {"week_plan": cleaned}}, upsert=True)
    return Profile(**await get_profile(uid))


@router.put("/playlist", response_model=Profile)
async def set_playlist(body: dict, user: dict = Depends(require_user)) -> Profile:
    """Çalma listesini kaydet. Boş URL gönderilirse çalma listesi kaldırılır."""
    uid = user["id"]
    raw = str(body.get("playlist_url") or "").strip()

    # 🆕 Boş URL → çalma listesi silinir
    if not raw:
        await db.profiles.update_one(
            {"user_id": uid},
            {"$set": {"playlist_url": "", "playlist_name": ""}},
            upsert=True,
        )
        return Profile(**await get_profile(uid))

    url = normalize_playlist_url(raw)
    name = str(body.get("playlist_name") or "Workout Playlist").strip() or "Workout Playlist"
    await db.profiles.update_one(
        {"user_id": uid},
        {"$set": {"playlist_url": url, "playlist_name": name}},
        upsert=True,
    )
    return Profile(**await get_profile(uid))