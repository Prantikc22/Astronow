"""Vimshottari Dasha computation (deterministic)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from . import constants as C

_YEAR_DAYS = 365.2425
_NAK_SPAN = 360.0 / 27.0


def _add_years(dt: datetime, years: float) -> datetime:
    return dt + timedelta(days=years * _YEAR_DAYS)


def compute_dashas(moon_longitude: float, birth_dt_utc: datetime) -> dict:
    """Return full mahadasha timeline plus current maha/antar dasha."""
    nak_index = C.nakshatra_index(moon_longitude)
    lord = C.NAKSHATRA_LORDS[nak_index]
    start_seq = C.DASHA_SEQUENCE.index(lord)

    # Fraction of the current nakshatra already elapsed by the Moon.
    within = moon_longitude % _NAK_SPAN
    elapsed_fraction = within / _NAK_SPAN
    first_years = C.DASHA_YEARS[lord]
    balance_years = first_years * (1.0 - elapsed_fraction)

    mahadashas = []
    cursor = birth_dt_utc
    # First (partial) mahadasha, started before birth.
    md_start = _add_years(birth_dt_utc, -(first_years - balance_years))
    md_end = _add_years(cursor, balance_years)
    mahadashas.append(_maha(lord, md_start, md_end))
    cursor = md_end

    for i in range(1, 9):
        lord_i = C.DASHA_SEQUENCE[(start_seq + i) % 9]
        yrs = C.DASHA_YEARS[lord_i]
        nxt = _add_years(cursor, yrs)
        mahadashas.append(_maha(lord_i, cursor, nxt))
        cursor = nxt

    now = datetime.now(timezone.utc)
    current_maha = None
    current_antar = None
    for md in mahadashas:
        if md["start"] <= now.isoformat() <= md["end"]:
            current_maha = md
            for ad in md["antardashas"]:
                if ad["start"] <= now.isoformat() <= ad["end"]:
                    current_antar = ad
                    break
            break

    return {
        "moon_nakshatra": C.NAKSHATRAS[nak_index],
        "starting_lord": lord,
        "balance_years_at_birth": round(balance_years, 3),
        "mahadashas": mahadashas,
        "current_mahadasha": current_maha,
        "current_antardasha": current_antar,
    }


def _maha(lord: str, start: datetime, end: datetime) -> dict:
    total_years = C.DASHA_YEARS[lord]
    antars = _antardashas(lord, start, total_years)
    return {
        "lord": lord,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "start_year": start.year,
        "end_year": end.year,
        "years": total_years,
        "antardashas": antars,
    }


def _antardashas(maha_lord: str, maha_start: datetime, maha_years: float) -> list:
    seq_start = C.DASHA_SEQUENCE.index(maha_lord)
    antars = []
    cursor = maha_start
    for i in range(9):
        lord_i = C.DASHA_SEQUENCE[(seq_start + i) % 9]
        portion_years = maha_years * C.DASHA_YEARS[lord_i] / 120.0
        nxt = _add_years(cursor, portion_years)
        antars.append({
            "lord": lord_i,
            "start": cursor.isoformat(),
            "end": nxt.isoformat(),
            "years": round(portion_years, 3),
        })
        cursor = nxt
    return antars
