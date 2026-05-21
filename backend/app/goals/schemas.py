from datetime import datetime

from pydantic import BaseModel, Field

from app.models import GoalType


class GoalCreate(BaseModel):
    """Схема для создания или обновления цели чтения."""

    goal_type: GoalType = Field(..., description="Тип цели: pages_per_day или minutes_per_day")
    target_value: int = Field(..., gt=0, description="Целевое значение (должно быть > 0)")

    class Config:
        json_schema_extra = {
            "example": {
                "goal_type": "pages_per_day",
                "target_value": 30,
            }
        }


class GoalOut(BaseModel):
    """Схема ответа при получении цели чтения."""

    id: int
    goal_type: GoalType
    target_value: int
    current_value: int
    created_at: datetime

    class Config:
        from_attributes = True
