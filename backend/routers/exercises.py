"""Exercise library: filterable listing, detail, video + prescription editing.

Egzersiz kütüphanesi ORTAKTIR — tüm kullanıcılar aynı listeyi görür.
"""

import re

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.scoring import DIFFICULTIES, EQUIPMENT, MUSCLES, get_profile, home_ready
from models.exercise import Exercise, ExercisePrescriptionUpdate, VideoUpdate
from routers.auth import require_user

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[Exercise])
async def list_exercises(
    muscle: str | None = None,
    equipment: str | None = None,
    difficulty: str | None = None,
    q: str | None = None,
    scope: str = "all",
    user: dict = Depends(require_user),
) -> list[Exercise]:
    query: dict = {}
    if muscle:
        if muscle.lower() not in MUSCLES:
            return []
        query["muscle"] = muscle.lower()
    if equipment:
        if equipment.lower() not in EQUIPMENT:
            return []
        query["equipment_required"] = equipment.lower()
    if difficulty:
        if difficulty.lower() not in DIFFICULTIES:
            return []
        query["difficulty"] = difficulty.lower()
    if q:
        query["name"] = {"$regex": re.escape(q.strip()), "$options": "i"}

    docs = await db.exercises.find(query).sort([("muscle", 1), ("order", 1)]).to_list(400)

    if scope == "mine":
        profile = await get_profile(user["id"])
        owned = set(profile.get("owned_equipment") or [])
        count = profile.get("dumbbell_count", 2)
        docs = [d for d in docs if home_ready(d, owned, count)]

    return [Exercise(**d) for d in docs]


@router.get("/{exercise_id}", response_model=Exercise)
async def get_exercise(exercise_id: str, user: dict = Depends(require_user)) -> Exercise:
    doc = await db.exercises.find_one({"id": exercise_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return Exercise(**doc)


@router.put("/{exercise_id}/video", response_model=Exercise)
async def replace_video(
    exercise_id: str, body: VideoUpdate, user: dict = Depends(require_user)
) -> Exercise:
    doc = await db.exercises.find_one({"id": exercise_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Exercise not found")
    await db.exercises.update_one({"id": exercise_id}, {"$set": {"video_id": body.video_id}})
    return Exercise(**await db.exercises.find_one({"id": exercise_id}))


@router.patch("/{exercise_id}", response_model=Exercise)
async def update_prescription(
    exercise_id: str, body: ExercisePrescriptionUpdate, user: dict = Depends(require_user)
) -> Exercise:
    doc = await db.exercises.find_one({"id": exercise_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Exercise not found")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return Exercise(**doc)
    await db.exercises.update_one({"id": exercise_id}, {"$set": updates})
    return Exercise(**await db.exercises.find_one({"id": exercise_id}))