import datetime
from pydantic import BaseModel


class DailyBreakdown(BaseModel):
    date: datetime.date
    pages: int
    minutes: int


class ReadingStatsOut(BaseModel):
    total_pages: int
    total_minutes: int
    sessions_count: int
    daily_breakdown: list[DailyBreakdown]
