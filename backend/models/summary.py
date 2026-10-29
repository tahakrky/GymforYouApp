"""Dashboard summary + muscle analytics response models."""

from pydantic import BaseModel

from models.workout import PersonalRecord, Workout


class MuscleStatus(BaseModel):
    muscle: str
    sessions_this_week: int
    weekly_limit: int
    status: str  # AVAILABLE | TODAY_DONE | LIMIT_REACHED
    trained_today: bool
    sets_this_week: int
    volume_this_week: float
    last_trained: str | None
    training_score: float


class DayOverview(BaseModel):
    day: str  # MON..SUN
    date: str  # YYYY-MM-DD
    scheduled_muscle: str | None
    planned_muscles: list[str] = []  # from the weekly planner — guidance, never a lock
    muscles_trained: list[str]
    is_today: bool
    is_future: bool


class Stats(BaseModel):
    total_workouts: int
    total_sets: int
    total_volume: float
    current_streak: int
    pr_count: int


class Summary(BaseModel):
    name: str
    today: str
    weekly_limit: int
    today_scheduled_muscle: str | None
    today_planned_muscles: list[str] = []
    muscle_order: list[str] = []
    muscles: list[MuscleStatus]
    week_overview: list[DayOverview]
    stats: Stats


class WeekPoint(BaseModel):
    week_start: str
    sets: int
    volume: float
    top_weight: float


class MuscleDetail(BaseModel):
    muscle: str
    training_score: float
    sessions_this_week: int
    total_sessions: int
    weekly_limit: int
    status: str  # AVAILABLE | TODAY_DONE | LIMIT_REACHED
    trained_today: bool
    total_sets: int
    total_volume: float
    best_weight: float | None
    consistency: float
    last_trained: str | None
    next_available: str | None
    records: list[PersonalRecord]
    progression: list[WeekPoint]


class WorkoutCompleteResponse(BaseModel):
    workout: Workout
    prs: list[PersonalRecord]
    score_before: float
    score_after: float
    messages: list[str]
