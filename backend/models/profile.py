"""Profile models — one document per user."""

from pydantic import BaseModel, Field

from lib.scoring import DEFAULT_OWNED_EQUIPMENT

EXERCISES_PER_SESSION = 2

DEFAULT_SCHEDULE: dict[str, str] = {
    "mon": "chest",
    "tue": "back",
    "wed": "rest",
    "thu": "shoulders",
    "fri": "legs",
    "sat": "biceps",
    "sun": "rest",
}


class WeightEntry(BaseModel):
    date: str
    weight_kg: float


class Profile(BaseModel):
    user_id: str = ""
    name: str = ""
    phone: str = ""
    age: int | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    experience: str = "INTERMEDIATE"
    weekly_limit: int = 2
    exercises_per_session: int = EXERCISES_PER_SESSION
    muscle_order: list[str] = []
    week_plan: dict[str, list[str]] = {}
    schedule: dict[str, str] = Field(default_factory=lambda: dict(DEFAULT_SCHEDULE))
    owned_equipment: list[str] = Field(default_factory=lambda: list(DEFAULT_OWNED_EQUIPMENT))
    dumbbell_weight_kg: float = 10.0
    dumbbell_count: int = 2
    equipment_filter_default: str = "mine"
    plan_overrides: dict[str, list[str]] = {}
    weight_history: list[WeightEntry] = []
    measurements: dict[str, float] = {}
    # 🆕 Default YOK — kullanıcı kendisi eklerse dolar
    playlist_url: str = ""
    playlist_name: str = ""


class ProfileUpdate(BaseModel):
    name: str | None = None
    phone: str | None = Field(default=None, max_length=30)
    age: int | None = Field(default=None, ge=10, le=100)
    height_cm: float | None = Field(default=None, gt=0, le=250)
    weight_kg: float | None = Field(default=None, gt=0, le=300)
    experience: str | None = None
    weekly_limit: int | None = Field(default=None, ge=1, le=6)
    exercises_per_session: int | None = Field(default=None, ge=1, le=12)
    schedule: dict[str, str] | None = None
    owned_equipment: list[str] | None = None
    dumbbell_weight_kg: float | None = Field(default=None, gt=0, le=100)
    dumbbell_count: int | None = Field(default=None, ge=1, le=4)
    equipment_filter_default: str | None = None
    measurements: dict[str, float] | None = None
    playlist_url: str | None = None
    playlist_name: str | None = None


class PlanOverrideUpdate(BaseModel):
    exercise_ids: list[str] = Field(max_length=20)


class WeightAdd(BaseModel):
    weight_kg: float = Field(gt=0, le=300)


class MuscleOrderUpdate(BaseModel):
    muscle_order: list[str] = Field(max_length=20)


class WeekPlanUpdate(BaseModel):
    week_plan: dict[str, list[str]]