"""Solar Hijri (Jalali) calendar, the one Iranian users and shops read.

Small and dependency-free: dates convert both ways, and a billing period is a
Jalali month ("1405-08") running from its first day to the next month's first
day, midnight Tehran time.
"""

from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

TEHRAN = ZoneInfo("Asia/Tehran")
_GREGORIAN_MONTHS = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)


def _leap(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def to_jalali(year: int, month: int, day: int) -> tuple[int, int, int]:
    days = 365 * (year - 1600) + (year - 1597) // 4 - (year - 1501) // 100 + (year - 1201) // 400
    days += sum(_GREGORIAN_MONTHS[: month - 1]) + day - 80
    if month > 2 and _leap(year):
        days += 1
    jy = 979 + 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days >= 366:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        return jy, days // 31 + 1, days % 31 + 1
    return jy, (days - 186) // 30 + 7, (days - 186) % 30 + 1


def jalali_date(year: int, month: int, day: int) -> str:
    """Gregorian -> Jalali, as YYYY/MM/DD."""
    jy, jm, jd = to_jalali(year, month, day)
    return f"{jy}/{jm:02d}/{jd:02d}"


def to_gregorian(jy: int, jm: int, jd: int) -> dt.date:
    jy += 1595
    days = -355668 + 365 * jy + (jy // 33) * 8 + ((jy % 33) + 3) // 4 + jd
    days += (jm - 1) * 31 if jm < 7 else (jm - 7) * 30 + 186
    gy = 400 * (days // 146097)
    days %= 146097
    if days > 36524:
        days -= 1
        gy += 100 * (days // 36524)
        days %= 36524
        if days >= 365:
            days += 1
    gy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        gy += (days - 1) // 365
        days = (days - 1) % 365
    gd = days + 1
    months = [31, 29 if _leap(gy) else 28, *_GREGORIAN_MONTHS[2:]]
    gm = 0
    while gd > months[gm]:
        gd -= months[gm]
        gm += 1
    return dt.date(gy, gm + 1, gd)


def period_of(moment: dt.datetime) -> str:
    """The Jalali month ("1405-08") a moment falls in, Tehran time."""
    local = moment.astimezone(TEHRAN)
    jy, jm, _ = to_jalali(local.year, local.month, local.day)
    return f"{jy}-{jm:02d}"


def previous_period(period: str) -> str:
    jy, jm = map(int, period.split("-"))
    return f"{jy - 1}-12" if jm == 1 else f"{jy}-{jm - 1:02d}"


def period_bounds(period: str) -> tuple[dt.datetime, dt.datetime]:
    """[start, end) of a Jalali month as aware datetimes (midnight Tehran)."""
    jy, jm = map(int, period.split("-"))
    if not 1 <= jm <= 12:
        raise ValueError(f"bad period {period!r}")
    ny, nm = (jy + 1, 1) if jm == 12 else (jy, jm + 1)
    start = dt.datetime.combine(to_gregorian(jy, jm, 1), dt.time(), TEHRAN)
    end = dt.datetime.combine(to_gregorian(ny, nm, 1), dt.time(), TEHRAN)
    return start, end
