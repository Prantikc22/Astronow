"""Current planetary transits (gochar) relative to a natal chart."""
from __future__ import annotations

from datetime import datetime, timezone

from . import constants as C
from . import engine as engine_mod
from . import ephemeris as ephe


def compute_transits(natal_chart: dict, as_of: datetime | None = None) -> dict:
    if as_of is None:
        as_of = datetime.now(timezone.utc)
    ayan = ephe.ayanamsa_for(as_of)

    # Reference point for house counting: natal Moon sign (Chandra lagna) is the
    # most common Vedic transit reference; fall back to lagna when time known.
    ref_sign = None
    if natal_chart.get("lagna"):
        ref_sign = natal_chart["lagna"]["sign_index"]
    else:
        moon = next(p for p in natal_chart["planets"] if p["name"] == "Moon")
        ref_sign = moon["sign_index"]

    body_map = {
        "Sun": "sun", "Moon": "moon", "Mars": "mars", "Mercury": "mercury",
        "Jupiter": "jupiter", "Venus": "venus", "Saturn": "saturn",
    }
    transits = []
    for name, key in body_map.items():
        trop = ephe.tropical_longitude(key, as_of)
        sid = (trop - ayan) % 360.0
        sign_idx = C.rashi_index(sid)
        house = ((sign_idx - ref_sign) % 12) + 1
        retro = False
        if name not in ("Sun", "Moon"):
            from datetime import timedelta
            later = ephe.tropical_longitude(key, as_of + timedelta(hours=12))
            delta = (later - trop + 540.0) % 360.0 - 180.0
            retro = bool(delta < 0)
        transits.append({
            "planet": name,
            "sign": C.RASHIS[sign_idx],
            "sign_index": sign_idx,
            "degree": round(C.degree_in_sign(sid), 2),
            "house_from_moon": house,
            "retrograde": retro,
            "nakshatra": C.NAKSHATRAS[C.nakshatra_index(sid)],
        })

    rahu_trop = ephe.mean_node_longitude(as_of)
    rahu_sid = (rahu_trop - ayan) % 360.0
    for name, sid in (("Rahu", rahu_sid), ("Ketu", (rahu_sid + 180.0) % 360.0)):
        sign_idx = C.rashi_index(sid)
        transits.append({
            "planet": name,
            "sign": C.RASHIS[sign_idx],
            "sign_index": sign_idx,
            "degree": round(C.degree_in_sign(sid), 2),
            "house_from_moon": ((sign_idx - ref_sign) % 12) + 1,
            "retrograde": True,
            "nakshatra": C.NAKSHATRAS[C.nakshatra_index(sid)],
        })

    moon_now = next(t for t in transits if t["planet"] == "Moon")
    return {
        "as_of": as_of.isoformat(),
        "reference": "moon_sign" if not natal_chart.get("lagna") else "lagna",
        "transits": transits,
        "moon_today": {
            "sign": moon_now["sign"],
            "nakshatra": moon_now["nakshatra"],
            "phase_angle": round(ephe.moon_phase_angle(as_of), 1),
            "phase": _phase_name(ephe.moon_phase_angle(as_of)),
        },
    }


def _phase_name(angle: float) -> str:
    if angle < 45:
        return "New Moon"
    if angle < 90:
        return "Waxing Crescent"
    if angle < 135:
        return "First Quarter"
    if angle < 180:
        return "Waxing Gibbous"
    if angle < 225:
        return "Full Moon"
    if angle < 270:
        return "Waning Gibbous"
    if angle < 315:
        return "Last Quarter"
    return "Waning Crescent"
