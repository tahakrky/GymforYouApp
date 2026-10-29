"""Workout session models."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from models.exercise import SecondaryActivation


def _uuid() -> str:
    return str(uuid.uuid4())


class WorkoutSet(BaseModel):
    index: int
    target_reps: int
    reps: int | None = None
    weight_kg: float | None = None
    completed: bool = False


class PlanExercise(BaseModel):
    exercise_id: str
    name: str
    order: int
    video_id: str
    equipment_label: str = ""
    activation: int = 80
    secondary: list[SecondaryActivation] = []
    target_sets: int
    target_reps: int
    rep_min: int = 8
    rep_max: int = 12
    rep_range: str = ""
    rest_sec: int = 90
    progression_to: str | None = None
    progression_note: str | None = None
    previous_weight: float | None = None
    previous_reps: int | None = None
    note: str = ""
    sets: list[WorkoutSet] = []


class PersonalRecord(BaseModel):
    exercise_name: str
    weight_kg: float
    reps: int


class Workout(BaseModel):
    id: str = Field(default_factory=_uuid)
    user_id: str = ""  # 🆕 hangi kullanıcıya ait
    muscle: str
    date: str
    week_start: str
    started_at: datetime
    finished_at: datetime | None = None
    start_clock: str = ""
    finish_clock: str = ""
    duration_sec: int | None = None
    status: str = "active"
    exercises: list[PlanExercise] = []
    total_sets: int = 0
    completed_sets: int = 0
    total_volume: float = 0.0
    prs: list[PersonalRecord] = []


class StartRequest(BaseModel):
    muscle: str
    local_clock: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    local_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class SetCompletion(BaseModel):
    exercise_index: int = Field(ge=0)
    set_index: int = Field(ge=0)
    reps: int = Field(ge=0, le=200)
    weight_kg: float = Field(default=0, ge=0, le=500)


class NoteUpdate(BaseModel):
    exercise_index: int = Field(ge=0)
    note: str = Field(default="", max_length=500)


class CompleteRequest(BaseModel):
    local_clock: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")


class ResetWeekRequest(BaseModel):
    muscle: str | None = None