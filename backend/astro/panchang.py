"""Panchang (daily Vedic calendar) computation."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from . import constants as C
from . import ephemeris as ephe


def _karana_name(index_within_tithi: int, tithi_num: int) -> str:
    # 60 karanas across a lunar month. First half of tithi 1 = Kimstughna (fixed),
    # last karanas are Shakuni, Chatushpada, Naga (fixed). Middle 56 are the 7
    # movable karanas repeated 8 times.
    karana_number = (tithi_num - 1) * 2 + index_within_tithi  # 0-based, 0..59
    if karana_number == 0:
        return "Kimstughna"
    if karana_number >= 57:
        return ["Shakuni", "Chatushpada", "Naga"][karana_number - 57]
    return C.KARANAS_MOVABLE[(karana_number - 1) % 7]


def compute_panchang(
    for_date: date,
    lat: float | None,
    lon: float | None,
    tz_offset_hours: float,
) -> dict:
    """Compute panchang for a local date at a location."""
    # Reference instant: local noon expressed in UTC for the elements.
    local_noon_utc = datetime(
        for_date.year, for_date.month, for_date.day, 12, 0, 0, tzinfo=timezone.utc
    ) - timedelta(hours=tz_offset_hours)

    sun = ephe.tropical_longitude("sun", local_noon_utc)
    ayan = ephe.ayanamsa_for(local_noon_utc)
    moon_trop = ephe.tropical_longitude("moon", local_noon_utc)
    moon_sid = (moon_trop - ayan) % 360.0
    sun_sid = (sun - ayan) % 360.0

    # Tithi from Moon-Sun elongation.
    elong = (moon_trop - sun) % 360.0
    tithi_num = int(elong // 12.0) + 1  # 1..30
    tithi_frac = (elong % 12.0) / 12.0
    paksha = "Shukla" if tithi_num <= 15 else "Krishna"

    # Yoga (Sun+Moon sidereal).
    yoga_val = (sun_sid + moon_sid) % 360.0
    yoga_index = int(yoga_val // (360.0 / 27.0)) % 27

    # Karana (half tithi).
    karana_half = int((elong % 12.0) // 6.0)  # 0 or 1
    karana = _karana_name(karana_half + 1, tithi_num) if False else _karana_index(elong)

    nak_index = C.nakshatra_index(moon_sid)

    result = {
        "date": for_date.isoformat(),
        "weekday": for_date.strftime("%A"),
        "paksha": paksha,
        "tithi": {
            "number": tithi_num,
            "name": C.TITHI_NAMES[tithi_num - 1],
            "paksha": paksha,
            "completion": round(tithi_frac * 100, 1),
        },
        "nakshatra": {
            "name": C.NAKSHATRAS[nak_index],
            "lord": C.NAKSHATRA_LORDS[nak_index],
            "index": nak_index,
        },
        "yoga": {"name": C.YOGAS[yoga_index], "index": yoga_index},
        "karana": {"name": karana},
        "moon_sign": C.RASHIS[C.rashi_index(moon_sid)],
        "sun_sign": C.RASHIS[C.rashi_index(sun_sid)],
    }

    if lat is not None and lon is not None:
        sunrise, sunset = ephe.sunrise_sunset(for_date, lat, lon, tz_offset_hours)
        if sunrise and sunset:
            result["sunrise"] = _local_str(sunrise, tz_offset_hours)
            result["sunset"] = _local_str(sunset, tz_offset_hours)
            result["rahu_kalam"] = _rahu_kalam(for_date, sunrise, sunset, tz_offset_hours)
            result["abhijit_muhurat"] = _abhijit(sunrise, sunset, tz_offset_hours)
    return result


def _karana_index(elong: float) -> str:
    half = int(elong // 6.0)  # 0..59
    if half == 0:
        return "Kimstughna"
    if half >= 57:
        return ["Shakuni", "Chatushpada", "Naga"][half - 57]
    return C.KARANAS_MOVABLE[(half - 1) % 7]


def _local_str(dt_utc: datetime, tz_offset_hours: float) -> str:
    local = dt_utc + timedelta(hours=tz_offset_hours)
    return local.strftime("%I:%M %p").lstrip("0")


def _rahu_kalam(for_date: date, sunrise: datetime, sunset: datetime, tz: float) -> dict:
    day_len = (sunset - sunrise) / 8.0
    seg = C.RAHU_KALAM_SEGMENT[for_date.weekday()]
    start = sunrise + day_len * seg
    end = start + day_len
    return {"start": _local_str(start, tz), "end": _local_str(end, tz)}


def _abhijit(sunrise: datetime, sunset: datetime, tz: float) -> dict:
    midday = sunrise + (sunset - sunrise) / 2.0
    half = (sunset - sunrise) / 15.0 / 2.0
    return {
        "start": _local_str(midday - half, tz),
        "end": _local_str(midday + half, tz),
    }
