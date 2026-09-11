"""Geocoding + timezone resolution behind a provider interface so Google Places
can be swapped for Mapbox/OSM later without touching callers."""
from __future__ import annotations

from datetime import datetime, date, time as dtime
from zoneinfo import ZoneInfo

import httpx
from timezonefinder import TimezoneFinder

import config

_tf = TimezoneFinder()


class GeocoderProvider:
    async def search(self, query: str) -> list[dict]:
        raise NotImplementedError

    async def details(self, place_id: str) -> dict:
        raise NotImplementedError


class GooglePlacesGeocoder(GeocoderProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def search(self, query: str) -> list[dict]:
        if not self.api_key:
            return []
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(
                "https://maps.googleapis.com/maps/api/place/autocomplete/json",
                params={"input": query, "types": "(cities)", "key": self.api_key},
            )
            data = r.json()
            preds = data.get("predictions", [])
            return [
                {"place_id": p["place_id"], "description": p["description"]}
                for p in preds
            ]

    async def details(self, place_id: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                params={
                    "place_id": place_id,
                    "fields": "name,formatted_address,geometry",
                    "key": self.api_key,
                },
            )
            data = r.json().get("result", {})
            loc = data.get("geometry", {}).get("location", {})
            lat, lon = loc.get("lat"), loc.get("lng")
            return {
                "name": data.get("name"),
                "formatted_address": data.get("formatted_address"),
                "lat": lat,
                "lon": lon,
                "tz_name": tz_name_for(lat, lon) if lat is not None else None,
            }


def tz_name_for(lat: float, lon: float) -> str | None:
    try:
        return _tf.timezone_at(lat=lat, lng=lon)
    except Exception:  # noqa: BLE001
        return None


def tz_offset_hours(tz_name: str, on_date: date, on_time: dtime | None = None) -> float:
    """UTC offset in hours for a tz at a specific historical date/time (DST-aware)."""
    try:
        tz = ZoneInfo(tz_name)
        moment = datetime.combine(on_date, on_time or dtime(12, 0))
        localized = moment.replace(tzinfo=tz)
        return localized.utcoffset().total_seconds() / 3600.0
    except Exception:  # noqa: BLE001
        return 0.0


provider: GeocoderProvider = GooglePlacesGeocoder(config.GOOGLE_PLACES_API_KEY)
