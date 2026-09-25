"""Geocoding + timezone resolution behind a provider interface so Google Places
can be swapped for Mapbox/OSM later without touching callers."""
from __future__ import annotations

from datetime import datetime, date, time as dtime
from zoneinfo import ZoneInfo

import httpx
from fastapi import HTTPException
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
        query = query.strip()
        if len(query) < 2:
            return []
        if not self.api_key:
            raise HTTPException(503, "Birthplace search is not configured.")

        # Places API (New) is the primary integration. A number of Google Cloud
        # projects no longer enable the legacy autocomplete endpoint by default,
        # which was the source of the opaque city-search failures in the app.
        async with httpx.AsyncClient(timeout=15) as c:
            try:
                r = await c.post(
                    "https://places.googleapis.com/v1/places:autocomplete",
                    headers={
                        "X-Goog-Api-Key": self.api_key,
                        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
                        "Content-Type": "application/json",
                    },
                    json={
                        "input": query,
                        "includedPrimaryTypes": ["(cities)"],
                        "languageCode": "en",
                    },
                )
                r.raise_for_status()
                suggestions = r.json().get("suggestions", [])
                results = []
                for suggestion in suggestions:
                    prediction = suggestion.get("placePrediction") or {}
                    place_id = prediction.get("placeId")
                    description = (prediction.get("text") or {}).get("text")
                    if place_id and description:
                        results.append({"place_id": place_id, "description": description})
                return results
            except (httpx.HTTPError, ValueError) as exc:
                # Keep legacy as a compatibility fallback for existing Google
                # projects while they migrate to Places API (New).
                try:
                    return await self._legacy_search(c, query)
                except HTTPException:
                    raise HTTPException(502, "Google Places could not search cities right now. Please try again.") from exc

    async def _legacy_search(self, client: httpx.AsyncClient, query: str) -> list[dict]:
        r = await client.get(
            "https://maps.googleapis.com/maps/api/place/autocomplete/json",
            params={"input": query, "types": "(cities)", "key": self.api_key, "language": "en"},
        )
        r.raise_for_status()
        data = r.json()
        status = data.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            raise HTTPException(502, data.get("error_message") or f"Google Places search failed ({status}).")
        return [
            {"place_id": p["place_id"], "description": p["description"]}
            for p in data.get("predictions", [])
            if p.get("place_id") and p.get("description")
        ]

    async def details(self, place_id: str) -> dict:
        if not self.api_key:
            raise HTTPException(503, "Birthplace search is not configured.")
        if not place_id.strip():
            raise HTTPException(400, "A place id is required.")
        async with httpx.AsyncClient(timeout=15) as c:
            try:
                r = await c.get(
                    f"https://places.googleapis.com/v1/places/{place_id}",
                    headers={
                        "X-Goog-Api-Key": self.api_key,
                        "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
                    },
                    params={"languageCode": "en"},
                )
                r.raise_for_status()
                data = r.json()
                loc = data.get("location") or {}
                lat, lon = loc.get("latitude"), loc.get("longitude")
                if lat is None or lon is None:
                    raise ValueError("Place response did not include coordinates")
                return {
                    "name": (data.get("displayName") or {}).get("text"),
                    "formatted_address": data.get("formattedAddress"),
                    "lat": lat,
                    "lon": lon,
                    "tz_name": tz_name_for(lat, lon),
                }
            except (httpx.HTTPError, ValueError) as exc:
                try:
                    return await self._legacy_details(c, place_id)
                except HTTPException:
                    raise HTTPException(502, "Google Places could not resolve that city. Please choose it again.") from exc

    async def _legacy_details(self, client: httpx.AsyncClient, place_id: str) -> dict:
        r = await client.get(
            "https://maps.googleapis.com/maps/api/place/details/json",
            params={
                "place_id": place_id,
                "fields": "name,formatted_address,geometry",
                "key": self.api_key,
                "language": "en",
            },
        )
        r.raise_for_status()
        payload = r.json()
        if payload.get("status") != "OK":
            raise HTTPException(502, payload.get("error_message") or "Google Places could not resolve that location.")
        data = payload.get("result", {})
        loc = data.get("geometry", {}).get("location", {})
        lat, lon = loc.get("lat"), loc.get("lng")
        if lat is None or lon is None:
            raise HTTPException(502, "Google Places returned an incomplete location.")
        return {
            "name": data.get("name"),
            "formatted_address": data.get("formatted_address"),
            "lat": lat,
            "lon": lon,
            "tz_name": tz_name_for(lat, lon),
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
