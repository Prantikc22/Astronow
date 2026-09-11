"""Deterministic Vedic natal chart engine.

Produces the canonical structured chart JSON. AI never computes any of this.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from . import ephemeris as ephe
from . import constants as C


def _sidereal(tropical_lon: float, ayanamsa: float) -> float:
    return (tropical_lon - ayanamsa) % 360.0


def _placement(longitude: float) -> dict:
    ri = C.rashi_index(longitude)
    ni = C.nakshatra_index(longitude)
    return {
        "longitude": round(longitude, 4),
        "sign": C.RASHIS[ri],
        "sign_sanskrit": C.RASHI_SANSKRIT[ri],
        "sign_index": ri,
        "degree": round(C.degree_in_sign(longitude), 4),
        "degree_dms": _to_dms(C.degree_in_sign(longitude)),
        "nakshatra": C.NAKSHATRAS[ni],
        "nakshatra_index": ni,
        "nakshatra_lord": C.NAKSHATRA_LORDS[ni],
        "pada": C.nakshatra_pada(longitude),
    }


def _to_dms(deg: float) -> str:
    d = int(deg)
    m_full = (deg - d) * 60.0
    m = int(m_full)
    s = int((m_full - m) * 60.0)
    return f"{d}\u00b0{m:02d}'{s:02d}\""


def compute_ascendant(dt_utc: datetime, lat: float, lon: float, ayanamsa: float) -> float:
    """Sidereal ascendant longitude in degrees (whole-sign lagna basis)."""
    ramc = math.radians(ephe.gmst_degrees(dt_utc) + lon)  # local sidereal angle
    eps = math.radians(ephe.obliquity_for(dt_utc))
    phi = math.radians(lat)
    y = math.cos(ramc)
    x = -(math.sin(ramc) * math.cos(eps) + math.tan(phi) * math.sin(eps))
    asc_tropical = math.degrees(math.atan2(y, x)) % 360.0
    return _sidereal(asc_tropical, ayanamsa)


def _planet_longitudes(dt_utc: datetime, ayanamsa: float) -> dict:
    out = {}
    body_map = {
        "Sun": "sun", "Moon": "moon", "Mars": "mars", "Mercury": "mercury",
        "Jupiter": "jupiter", "Venus": "venus", "Saturn": "saturn",
    }
    for name, key in body_map.items():
        trop = ephe.tropical_longitude(key, dt_utc)
        sid = _sidereal(trop, ayanamsa)
        # Retrograde by finite difference (Sun/Moon never retrograde).
        retro = False
        if name not in ("Sun", "Moon"):
            trop_later = ephe.tropical_longitude(key, dt_utc + timedelta(hours=12))
            delta = (trop_later - trop + 540.0) % 360.0 - 180.0
            retro = bool(delta < 0)
        out[name] = {"longitude": sid, "retrograde": retro}
    # Rahu (mean node) and Ketu, always retrograde.
    rahu_trop = ephe.mean_node_longitude(dt_utc)
    rahu_sid = _sidereal(rahu_trop, ayanamsa)
    out["Rahu"] = {"longitude": rahu_sid, "retrograde": True}
    out["Ketu"] = {"longitude": (rahu_sid + 180.0) % 360.0, "retrograde": True}
    return out


def build_natal_chart(
    dt_utc: datetime,
    lat: float,
    lon: float,
    birth_time_known: bool = True,
) -> dict:
    """Build the canonical natal chart dictionary."""
    ayanamsa = ephe.ayanamsa_for(dt_utc)
    planets_raw = _planet_longitudes(dt_utc, ayanamsa)

    lagna_placement = None
    lagna_sign_index = None
    if birth_time_known:
        asc_lon = compute_ascendant(dt_utc, lat, lon, ayanamsa)
        lagna_placement = _placement(asc_lon)
        lagna_sign_index = lagna_placement["sign_index"]

    planets = []
    for name in C.PLANETS:
        p = planets_raw[name]
        placement = _placement(p["longitude"])
        house = None
        if lagna_sign_index is not None:
            house = ((placement["sign_index"] - lagna_sign_index) % 12) + 1
        planets.append({
            "name": name,
            "name_sanskrit": C.PLANET_SANSKRIT[name],
            "retrograde": p["retrograde"],
            "house": house,
            **placement,
        })

    houses = None
    if lagna_sign_index is not None:
        houses = []
        for h in range(12):
            sign_idx = (lagna_sign_index + h) % 12
            occupants = [pl["name"] for pl in planets if pl["sign_index"] == sign_idx]
            houses.append({
                "house": h + 1,
                "sign": C.RASHIS[sign_idx],
                "sign_sanskrit": C.RASHI_SANSKRIT[sign_idx],
                "sign_index": sign_idx,
                "lord": C.RASHI_LORDS[sign_idx],
                "planets": occupants,
            })

    moon = next(p for p in planets if p["name"] == "Moon")
    sun = next(p for p in planets if p["name"] == "Sun")

    chart = {
        "ayanamsa": round(ayanamsa, 5),
        "ayanamsa_name": "Lahiri",
        "birth_time_known": birth_time_known,
        "lagna": lagna_placement,
        "planets": planets,
        "houses": houses,
        "moon_sign": moon["sign"],
        "moon_nakshatra": moon["nakshatra"],
        "moon_pada": moon["pada"],
        "sun_sign": sun["sign"],
        "yogas": _detect_yogas(planets, lagna_sign_index),
        "doshas": _detect_doshas(planets, moon),
    }
    return chart


def _detect_yogas(planets: list, lagna_sign_index: Optional[int]) -> list:
    """Deterministic detection of a few well-defined yogas."""
    yogas = []
    by_name = {p["name"]: p for p in planets}

    # Gajakesari Yoga: Jupiter in kendra (1,4,7,10) from the Moon.
    moon_sign = by_name["Moon"]["sign_index"]
    jup_sign = by_name["Jupiter"]["sign_index"]
    if ((jup_sign - moon_sign) % 12) in (0, 3, 6, 9):
        yogas.append({
            "id": "gajakesari",
            "name": "Gajakesari Yoga",
            "planets": ["Jupiter", "Moon"],
            "nature": "benefic",
        })

    # Budhaditya Yoga: Sun and Mercury in the same sign.
    if by_name["Sun"]["sign_index"] == by_name["Mercury"]["sign_index"]:
        yogas.append({
            "id": "budhaditya",
            "name": "Budhaditya Yoga",
            "planets": ["Sun", "Mercury"],
            "nature": "benefic",
        })

    # Chandra-Mangala Yoga: Moon and Mars in the same sign.
    if by_name["Moon"]["sign_index"] == by_name["Mars"]["sign_index"]:
        yogas.append({
            "id": "chandra_mangala",
            "name": "Chandra-Mangala Yoga",
            "planets": ["Moon", "Mars"],
            "nature": "mixed",
        })
    return yogas


def _detect_doshas(planets: list, moon: dict) -> list:
    """Deterministic detection of commonly discussed doshas."""
    doshas = []
    by_name = {p["name"]: p for p in planets}
    mars = by_name["Mars"]
    if mars["house"] in (1, 2, 4, 7, 8, 12):
        doshas.append({
            "id": "mangal_dosha",
            "name": "Mangal Dosha",
            "detail": f"Mars in house {mars['house']}",
            "severity": "moderate",
        })
    # Kaal Sarp indicator: all 7 planets between Rahu and Ketu axis.
    rahu = by_name["Rahu"]["longitude"]
    ketu = by_name["Ketu"]["longitude"]
    grahas = [by_name[n]["longitude"] for n in
              ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"]]
    span = (ketu - rahu) % 360.0
    inside = all(((g - rahu) % 360.0) <= span for g in grahas)
    outside = all(((g - rahu) % 360.0) >= span for g in grahas)
    if inside or outside:
        doshas.append({
            "id": "kaal_sarp",
            "name": "Kaal Sarp Dosha",
            "detail": "All planets fall on one side of the Rahu-Ketu axis",
            "severity": "notable",
        })
    return doshas
