import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db import get_db
from app.models import GoalType, ReadingGoal, ReadingSession, User
from app.goals.schemas import GoalCreate, GoalOut

router = APIRouter(prefix="/goals", tags=["goals"])


async def _today_totals(user_id: int, db: AsyncSession) -> tuple[int, int]:
    """Сумма страниц и минут за сегодня (UTC)."""
    today_utc = datetime.datetime.now(datetime.timezone.utc).date()
    today_start = datetime.datetime.combine(
        today_utc, datetime.time.min, tzinfo=datetime.timezone.utc
    )
    today_end = datetime.datetime.combine(
        today_utc, datetime.time.max, tzinfo=datetime.timezone.utc
    )
    sessions_result = await db.execute(
        select(ReadingSession).where(
            ReadingSession.user_id == user_id,
            ReadingSession.started_at >= today_start,
            ReadingSession.started_at <= today_end,
        )
    )
    sessions = sessions_result.scalars().all()
    pages = sum(s.pages_read for s in sessions)
    minutes = sum(s.duration_minutes for s in sessions)
    return pages, minutes


@router.post("", response_model=GoalOut, status_code=200)
@router.post("/", response_model=GoalOut, status_code=200, include_in_schema=False)
async def upsert_goal(
    goal_in: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GoalOut:
    """
    Создать или обновить цель чтения (upsert по user_id + goal_type).

    Если цель с таким goal_type уже существует для данного пользователя —
    обновляет target_value. Иначе создаёт новую запись.
    Возвращает GoalOut с current_value=0 (вычисляется при чтении).
    """
    result = await db.execute(
        select(ReadingGoal).where(
            ReadingGoal.user_id == current_user.id,
            ReadingGoal.goal_type == goal_in.goal_type,
        )
    )
    existing = result.scalar_one_or_none()

    if existing is not None:
        existing.target_value = goal_in.target_value
        goal = existing
    else:
        goal = ReadingGoal(
            user_id=current_user.id,
            goal_type=goal_in.goal_type,
            target_value=goal_in.target_value,
        )
        db.add(goal)

    await db.commit()
    await db.refresh(goal)

    total_pages_today, total_minutes_today = await _today_totals(current_user.id, db)
    if goal.goal_type == GoalType.pages_per_day:
        current_value = total_pages_today
    else:
        current_value = total_minutes_today

    return GoalOut(
        id=goal.id,
        goal_type=goal.goal_type,
        target_value=goal.target_value,
        current_value=current_value,
        created_at=goal.created_at,
    )


@router.get("", response_model=list[GoalOut])
@router.get("/", response_model=list[GoalOut], include_in_schema=False)
async def list_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GoalOut]:
    """
    Получить все цели чтения текущего пользователя.

    Для каждой цели вычисляет current_value из reading_sessions за сегодня (UTC):
    - pages_per_day: сумма pages_read за сегодня
    - minutes_per_day: сумма duration_minutes за сегодня
    """
    # Получаем все цели пользователя
    goals_result = await db.execute(
        select(ReadingGoal).where(ReadingGoal.user_id == current_user.id)
    )
    goals = goals_result.scalars().all()

    if not goals:
        return []

    total_pages_today, total_minutes_today = await _today_totals(current_user.id, db)

    output: list[GoalOut] = []
    for goal in goals:
        if goal.goal_type == GoalType.pages_per_day:
            current_value = total_pages_today
        else:  # minutes_per_day
            current_value = total_minutes_today

        output.append(
            GoalOut(
                id=goal.id,
                goal_type=goal.goal_type,
                target_value=goal.target_value,
                current_value=current_value,
                created_at=goal.created_at,
            )
        )

    return output
