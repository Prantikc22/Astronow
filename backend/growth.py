"""Deterministic growth features: muhurat finder, moon calendar, referral codes.

Muhurat scoring follows widely used, simplified muhurta guidelines (favourable
nakshatras per activity, avoiding Rikta tithis, Amavasya and Rahu Kaal). It is a
planning aid, not a substitute for a family priest for weddings or ceremonies.
"""
from __future__ import annotations

import hashlib
from datetime import date, timedelta
from typing import Optional

from astro import panchang as panchang_mod

ACTIVITIES: dict[str, dict] = {
    "travel": {
        "label": "Travel",
        "nakshatras": {"Ashwini", "Mrigashira", "Punarvasu", "Pushya", "Hasta", "Anuradha", "Shravana", "Dhanishta", "Revati"},
        "weekdays": {0, 2, 3, 4},  # Mon, Wed, Thu, Fri (Python weekday: Mon=0)
    },
    "business": {
        "label": "Sign a deal or start a business",
        "nakshatras": {"Ashwini", "Rohini", "Pushya", "Hasta", "Chitra", "Anuradha", "Revati", "Uttara Phalguni", "Uttara Ashadha", "Uttara Bhadrapada"},
        "weekdays": {2, 3, 4},
    },
    "property": {
        "label": "Buy property or a vehicle",
        "nakshatras": {"Rohini", "Mrigashira", "Punarvasu", "Pushya", "Uttara Phalguni", "Uttara Ashadha", "Uttara Bhadrapada", "Hasta", "Chitra", "Swati", "Anuradha", "Revati"},
        "weekdays": {0, 2, 3, 4},
    },
    "job": {
        "label": "Join a new job",
        "nakshatras": {"Ashwini", "Rohini", "Pushya", "Hasta", "Chitra", "Anuradha", "Shravana", "Revati"},
        "weekdays": {0, 2, 3, 4},
    },
    "housewarming": {
        "label": "Griha pravesh (housewarming)",
        "nakshatras": {"Rohini", "Mrigashira", "Uttara Phalguni", "Uttara Ashadha", "Uttara Bhadrapada", "Chitra", "Anuradha", "Shravana", "Dhanishta", "Shatabhisha", "Revati"},
        "weekdays": {0, 2, 3, 4},
    },
    "engagement": {
        "label": "Engagement or marriage talks",
        "nakshatras": {"Rohini", "Mrigashira", "Magha", "Uttara Phalguni", "Hasta", "Swati", "Anuradha", "Mula", "Uttara Ashadha", "Uttara Bhadrapada", "Revati"},
        "weekdays": {0, 2, 3, 4},
    },
}

RIKTA = {"Chaturthi", "Navami", "Chaturdashi"}


def _is_amavasya(p: dict) -> bool:
    name = (p.get("tithi") or {}).get("name", "")
    return name == "Amavasya" or (p.get("paksha") == "Krishna" and (p.get("tithi") or {}).get("number") in (15, 30))


def _is_purnima(p: dict) -> bool:
    name = (p.get("tithi") or {}).get("name", "")
    return name == "Purnima" or (p.get("paksha") == "Shukla" and (p.get("tithi") or {}).get("number") == 15)


def score_day(p: dict, activity: str, day: date) -> dict:
    rule = ACTIVITIES[activity]
    tithi = (p.get("tithi") or {}).get("name", "")
    nak = (p.get("nakshatra") or {}).get("name", "")
    reasons: list[str] = []
    cautions: list[str] = []
    score = 0
    if nak in rule["nakshatras"]:
        score += 40
        reasons.append(f"{nak} nakshatra is traditionally favourable for this")
    else:
        cautions.append(f"{nak} nakshatra is neutral for this activity")
    if _is_amavasya(p):
        score -= 30
        cautions.append("Amavasya (new moon) is usually avoided for new beginnings")
    elif tithi in RIKTA:
        cautions.append(f"{tithi} is a Rikta tithi, traditionally avoided for starts")
    else:
        score += 25
        reasons.append(f"{tithi} tithi supports new beginnings")
    if day.weekday() in rule["weekdays"]:
        score += 20
        reasons.append(f"{day.strftime('%A')} is a supportive weekday")
    if p.get("paksha") == "Shukla":
        score += 15
        reasons.append("Waxing moon (Shukla paksha) favours growth")
    # Abhijit is traditionally skipped on Wednesdays.
    window = p.get("abhijit_muhurat") if day.weekday() != 2 else None
    return {
        "date": day.isoformat(), "weekday": day.strftime("%A"), "score": max(0, min(100, score)),
        "tithi": tithi, "paksha": p.get("paksha"), "nakshatra": nak,
        "best_window": window, "avoid_window": p.get("rahu_kalam"),
        "sunrise": p.get("sunrise"), "sunset": p.get("sunset"),
        "reasons": reasons, "cautions": cautions,
    }


def find_muhurat(activity: str, lat: Optional[float], lon: Optional[float], tz: float,
                 start: date, days: int = 21) -> list[dict]:
    days = max(1, min(days, 45))
    out = []
    for i in range(days):
        d = start + timedelta(days=i)
        out.append(score_day(panchang_mod.compute_panchang(d, lat, lon, tz), activity, d))
    return sorted(out, key=lambda r: (-r["score"], r["date"]))


def moon_calendar(year: int, month: int, lat: Optional[float], lon: Optional[float], tz: float) -> list[dict]:
    d = date(year, month, 1)
    days = []
    while d.month == month:
        p = panchang_mod.compute_panchang(d, lat, lon, tz)
        tithi = (p.get("tithi") or {})
        name = tithi.get("name", "")
        number = tithi.get("number") or 0
        paksha = p.get("paksha")
        # Tithis run 1-30 (15 = Purnima, 30 = Amavasya); map to 0 (new) .. 1 (full).
        illumination = round(1 - abs(1 - 2 * (number / 30.0)), 3) if number else 0.5
        events = []
        if _is_purnima(p):
            events.append("Purnima · Full moon")
        elif _is_amavasya(p):
            events.append("Amavasya · New moon")
        if name == "Ekadashi":
            events.append("Ekadashi · fasting day")
        if name == "Trayodashi":
            events.append("Pradosh")
        if name == "Chaturthi" and paksha == "Krishna":
            events.append("Sankashti Chaturthi")
        if name == "Chaturthi" and paksha == "Shukla":
            events.append("Vinayaka Chaturthi")
        days.append({
            "date": d.isoformat(), "tithi": name, "tithi_number": number, "paksha": paksha,
            "nakshatra": (p.get("nakshatra") or {}).get("name"), "illumination": illumination,
            "waxing": paksha == "Shukla", "events": events,
            "sunrise": p.get("sunrise"), "sunset": p.get("sunset"),
        })
        d += timedelta(days=1)
    return days


def referral_code(user_id: str) -> str:
    """Stable, human-friendly 8-character code (no 0/O/1/I confusion)."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    digest = hashlib.sha256(f"astronow-ref:{user_id}".encode()).digest()
    return "".join(alphabet[b % len(alphabet)] for b in digest[:8])
