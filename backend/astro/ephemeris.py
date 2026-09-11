"""Ephemeris provider abstraction.

The rest of the engine talks to this module only, never to Skyfield directly, so
the astronomical backend can be swapped (e.g. Swiss Ephemeris) without touching
the astrology rules. Skyfield + the JPL DE421 kernel are used because both are
permissively licensed (MIT / public domain) and safe for a closed-source
commercial product.
"""
from __future__ import annotations

import math
import os
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from skyfield.api import load, load_file, wgs84
from skyfield import almanac

_EPHE_DIR = Path(__file__).resolve().parent.parent / "ephemeris"
_KERNEL = _EPHE_DIR / "de440s.bsp"

# Loaded once at import; Skyfield objects are cheap to keep resident.
_TS = load.timescale()
_EPH = load_file(str(_KERNEL))

_EARTH = _EPH["earth"]
_SUN = _EPH["sun"]
_MOON = _EPH["moon"]

# Sidereal planet set used by Vedic astrology (the 7 visible grahas + nodes).
_BODIES = {
    "sun": _EPH["sun"],
    "moon": _EPH["moon"],
    "mars": _EPH["mars barycenter"],
    "mercury": _EPH["mercury"],
    "jupiter": _EPH["jupiter barycenter"],
    "venus": _EPH["venus"],
    "saturn": _EPH["saturn barycenter"],
}


def _julian_centuries(jd_tt: float) -> float:
    return (jd_tt - 2451545.0) / 36525.0


def lahiri_ayanamsa(jd_tt: float) -> float:
    """Lahiri (Chitrapaksha) ayanamsa in degrees.

    Anchored to the Swiss-Ephemeris Lahiri value at J2000 (23.853373 deg) and
    advanced with the IAU general precession polynomial. Accurate to well under
    an arc-minute across the 1800-2100 range that matters for birth charts.
    """
    t = _julian_centuries(jd_tt)
    precession_arcsec = 5028.796195 * t + 1.1054348 * t * t
    return 23.853373 + precession_arcsec / 3600.0


def mean_obliquity(jd_tt: float) -> float:
    """Mean obliquity of the ecliptic in degrees (Laskar / Meeus)."""
    t = _julian_centuries(jd_tt)
    seconds = (
        84381.448
        - 46.8150 * t
        - 0.00059 * t * t
        + 0.001813 * t * t * t
    )
    return seconds / 3600.0


def _time_from_dt(dt_utc: datetime):
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    return _TS.from_datetime(dt_utc)


def tropical_longitude(body_key: str, dt_utc: datetime) -> float:
    """Apparent geocentric ecliptic longitude of date, in degrees (tropical)."""
    t = _time_from_dt(dt_utc)
    body = _BODIES[body_key]
    astrometric = _EARTH.at(t).observe(body).apparent()
    _lat, lon, _dist = astrometric.ecliptic_latlon(epoch=t)
    return float(lon.degrees) % 360.0


def tropical_latitude(body_key: str, dt_utc: datetime) -> float:
    t = _time_from_dt(dt_utc)
    body = _BODIES[body_key]
    astrometric = _EARTH.at(t).observe(body).apparent()
    lat, _lon, _dist = astrometric.ecliptic_latlon(epoch=t)
    return float(lat.degrees)


def mean_node_longitude(dt_utc: datetime) -> float:
    """Mean lunar ascending node (Rahu), tropical longitude in degrees."""
    t = _time_from_dt(dt_utc)
    tc = _julian_centuries(t.tt)
    omega = (
        125.0445479
        - 1934.1362891 * tc
        + 0.0020754 * tc * tc
        + tc * tc * tc / 467441.0
        - tc * tc * tc * tc / 60616000.0
    )
    return omega % 360.0


def ayanamsa_for(dt_utc: datetime) -> float:
    t = _time_from_dt(dt_utc)
    return lahiri_ayanamsa(t.tt)


def obliquity_for(dt_utc: datetime) -> float:
    t = _time_from_dt(dt_utc)
    return mean_obliquity(t.tt)


def gmst_degrees(dt_utc: datetime) -> float:
    t = _time_from_dt(dt_utc)
    return float(t.gmst * 15.0) % 360.0


def sunrise_sunset(dt_local_date, lat: float, lon: float, tz_offset_hours: float):
    """Return (sunrise, sunset) as timezone-aware UTC datetimes for the local
    calendar date, or (None, None) at extreme latitudes / polar day."""
    from datetime import timedelta

    location = wgs84.latlon(lat, lon)
    # Search window: local midnight to local midnight+1day expressed in UTC.
    local_midnight = datetime(
        dt_local_date.year, dt_local_date.month, dt_local_date.day, 0, 0, 0,
        tzinfo=timezone.utc,
    ) - timedelta(hours=tz_offset_hours)
    t0 = _TS.from_datetime(local_midnight)
    t1 = _TS.from_datetime(local_midnight + timedelta(days=1))
    f = almanac.sunrise_sunset(_EPH, location)
    times, events = almanac.find_discrete(t0, t1, f)
    sunrise = sunset = None
    for ti, ev in zip(times, events):
        dt = ti.utc_datetime()
        if ev == 1 and sunrise is None:
            sunrise = dt
        elif ev == 0 and sunset is None:
            sunset = dt
    return sunrise, sunset


def moon_phase_angle(dt_utc: datetime) -> float:
    """Elongation of the Moon from the Sun in degrees (0=new, 180=full)."""
    sun = tropical_longitude("sun", dt_utc)
    moon = tropical_longitude("moon", dt_utc)
    return float((moon - sun) % 360.0)
