import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db import get_db
from app.models import ReadingSession, User
from app.stats.schemas import DailyBreakdown, ReadingStatsOut

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/reading", response_model=ReadingStatsOut)
async def get_reading_stats(
    period: Literal["week", "month", "year"] = Query(
        "week",
        description="Период: week (7 дней), month (30 дней), year (365 дней)",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReadingStatsOut:
    """
    Возвращает статистику чтения за указанный период.
    Каждый день периода присутствует в daily_breakdown (нули для дней без сессий).
    """
    today = datetime.date.today()

    if period == "week":
        period_start = today - datetime.timedelta(days=6)
    elif period == "month":
        period_start = today - datetime.timedelta(days=29)
    else:  # year
        period_start = today - datetime.timedelta(days=364)

    # Преобразуем date в datetime для сравнения с DateTime(timezone=True)
    period_start_dt = datetime.datetime.combine(
        period_start, datetime.time.min, tzinfo=datetime.timezone.utc
    )

    # Получаем все сессии пользователя за период
    result = await db.execute(
        select(ReadingSession).where(
            ReadingSession.user_id == current_user.id,
            ReadingSession.started_at >= period_start_dt,
        )
    )
    sessions = result.scalars().all()

    # Агрегируем по дате на стороне Python
    day_map: dict[datetime.date, dict[str, int]] = {}
    for session in sessions:
        # started_at может быть timezone-aware, берём дату в UTC
        session_date = session.started_at.astimezone(datetime.timezone.utc).date()
        if session_date not in day_map:
            day_map[session_date] = {"pages": 0, "minutes": 0}
        day_map[session_date]["pages"] += session.pages_read
        day_map[session_date]["minutes"] += session.duration_minutes

    # Строим daily_breakdown, заполняя нулями дни без сессий
    daily_breakdown: list[DailyBreakdown] = []
    current_date = period_start
    while current_date <= today:
        data = day_map.get(current_date, {"pages": 0, "minutes": 0})
        daily_breakdown.append(
            DailyBreakdown(
                date=current_date,
                pages=data["pages"],
                minutes=data["minutes"],
            )
        )
        current_date += datetime.timedelta(days=1)

    total_pages = sum(item.pages for item in daily_breakdown)
    total_minutes = sum(item.minutes for item in daily_breakdown)
    sessions_count = len(sessions)

    return ReadingStatsOut(
        total_pages=total_pages,
        total_minutes=total_minutes,
        sessions_count=sessions_count,
        daily_breakdown=daily_breakdown,
    )
