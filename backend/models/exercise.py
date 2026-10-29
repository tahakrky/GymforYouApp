"""Exercise library models."""

import uuid

from pydantic import BaseModel, Field


def _uuid() -> str:
    return str(uuid.uuid4())


class SecondaryActivation(BaseModel):
    muscle: str
    pct: int  # share of the effort this supporting muscle takes


class Exercise(BaseModel):
    id: str = Field(default_factory=_uuid)
    name: str
    muscle: str  # biceps|triceps|forearms|shoulders|chest|back|legs|abs|glutes
    equipment: str  # primary tag: dumbbell|bench|bodyweight|barbell|cable|machine|band|pullup_bar
    # Everything the movement actually needs. A movement is "home ready" when this list is a
    # subset of the profile's owned_equipment — that is what the MY EQUIPMENT filter checks.
    equipment_required: list[str] = []
    equipment_label: str  # human-readable, e.g. "2 × Dambıl + Sehpa"
    dumbbells_needed: int = 0  # 0 = none, 1 = single dumbbell, 2 = pair
    difficulty: str  # beginner|intermediate|advanced
    video_id: str  # 11-char YouTube id — replaceable via PUT /api/exercises/{id}/video
    description: str
    instructions: list[str]  # setup -> movement -> breathing -> mistake to avoid
    order: int  # sequence inside the muscle's workout plan
    # How strongly the movement targets `muscle` relative to the other muscles involved.
    # An editorial estimate from the exercise database — never presented as exact science.
    activation: int = 80
    secondary: list[SecondaryActivation] = []
    target_sets: int
    target_reps: int
    rep_min: int = 8  # rep-range floor / ceiling drive the "ready to add weight" hint
    rep_max: int = 12
    rep_range: str = ""  # display hint, e.g. "8–12"
    rest_sec: int = 90  # stored for reference only — never surfaced as a timer
    # When 10 kg stops being challenging, this is the harder movement to graduate to.
    progression_to: str | None = None
    progression_note: str | None = None


class VideoUpdate(BaseModel):
    video_id: str = Field(pattern=r"^[A-Za-z0-9_-]{11}$")


class ExercisePrescriptionUpdate(BaseModel):
    """User-editable sets/reps for an exercise in the library."""

    target_sets: int | None = Field(default=None, ge=1, le=10)
    target_reps: int | None = Field(default=None, ge=1, le=100)
    rep_min: int | None = Field(default=None, ge=1, le=100)
    rep_max: int | None = Field(default=None, ge=1, le=100)
