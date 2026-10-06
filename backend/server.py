"""AstroNow API — portable FastAPI layer over Supabase (Auth + Postgres),
the deterministic Vedic engine, and the OpenRouter AI gateway."""
from __future__ import annotations

import json
import logging
import os
import secrets
import asyncio
import time
from datetime import date, datetime, time as dtime, timedelta, timezone
from typing import Any, Literal, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

import ai_gateway
import growth
import phone_auth
import report_ai
import config
import context_engine
import daily_reading
import db
import geocode
import interpret
import legal
import prompts
import supa_auth
from astro import (compatibility, constants as C, dasha as dasha_mod, engine,
                   numerology as num_mod, panchang as panchang_mod, tarot as tarot_mod,
                   terminology, transits as transit_mod, vastu as vastu_mod)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("server")

app = FastAPI(title="AstroNow API")
api = APIRouter(prefix="/api")
User = Depends(supa_auth.require_user)
ReadingLanguage = Literal["en", "hi", "bn", "ta", "te", "es", "fr", "de", "pt"]
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")
RC_SECRET = os.environ.get("REVENUECAT_SECRET_KEY", "")


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _parse_date(s: str) -> date:
    try:
        parsed = datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(422, "Enter a valid date of birth in YYYY-MM-DD format.") from exc
    if parsed > date.today():
        raise HTTPException(422, "Date of birth cannot be in the future.")
    return parsed


def _parse_time(s: Optional[str]) -> Optional[dtime]:
    if not s:
        return None
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(s, fmt).time()
        except ValueError:
            continue
    raise HTTPException(422, "Enter a valid birth time in HH:MM format.")


def birth_utc(dob: date, t: Optional[dtime], tz_offset: float, known: bool) -> datetime:
    local = datetime.combine(dob, t or dtime(12, 0))
    return (local - timedelta(hours=tz_offset)).replace(tzinfo=timezone.utc)


def compute_full(dob: date, t: Optional[dtime], lat: float, lon: float,
                 tz_offset: float, known: bool, name: Optional[str] = None) -> dict:
    dt_utc = birth_utc(dob, t, tz_offset, known)
    chart = engine.build_natal_chart(dt_utc, lat, lon, birth_time_known=known)
    moon = next(p for p in chart["planets"] if p["name"] == "Moon")
    dashas = dasha_mod.compute_dashas(moon["longitude"], dt_utc)
    numo = num_mod.compute_numerology(dob, name)
    return {"chart": chart, "dasha": dashas, "numerology": numo}


async def get_profile(user_id: str, with_changes: bool = True) -> Optional[dict]:
    profile = await db.one("profiles", filters={"user_id": user_id})
    if profile and with_changes:
        profile["birth_details_change_count"] = await db.count(
            "analytics_events", filters={"user_id": user_id, "name": "birth_profile_corrected"})
    return profile


_ent_cache: dict[str, tuple[dict, float]] = {}
_ENT_TTL = 30.0


async def get_entitlement(user_id: str) -> dict:
    hit = _ent_cache.get(user_id)
    if hit and hit[1] > time.monotonic():
        return hit[0]
    ent = await _read_entitlement(user_id)
    _ent_cache[user_id] = (ent, time.monotonic() + _ENT_TTL)
    return ent


async def _read_entitlement(user_id: str) -> dict:
    row = await db.one("entitlements", "tier,source,expires_at", filters={"user_id": user_id})
    source = (row or {}).get("source")
    # Never trust a row that could have been modified through an older client
    # policy. Paid access is granted only after server-side RevenueCat verification.
    trusted = source in {"revenuecat_verified", "founder_migration", "admin_grant"}
    tier = (row or {}).get("tier", "free") if trusted else "free"
    premium = tier in config.DEFAULT_APP_CONFIG["premium_tiers"]
    exp = (row or {}).get("expires_at")
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp.replace("Z", "+00:00"))
    if premium and exp and exp < datetime.now(timezone.utc):
        premium, tier = False, "free"
    return {"tier": tier, "premium": premium, "source": source}


async def load_chart(user_id: str) -> Optional[dict]:
    row = await db.one("birth_charts", "chart,dasha,numerology,computed_at", filters={"user_id": user_id})
    if not row:
        return None
    return {
        "chart": row["chart"] if isinstance(row["chart"], dict) else json.loads(row["chart"]),
        "dasha": (row["dasha"] if isinstance(row["dasha"], dict) else json.loads(row["dasha"])) if row["dasha"] else None,
        "numerology": (row["numerology"] if isinstance(row["numerology"], dict) else json.loads(row["numerology"])) if row["numerology"] else None,
        "computed_at": row.get("computed_at"),
    }


def _require_db():
    if not db.enabled():
        raise HTTPException(503, "Supabase Data API is not configured yet.")


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
class SignupIn(BaseModel):
    email: str
    password: str
    first_name: Optional[str] = None


class LoginIn(BaseModel):
    email: str
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


@api.post("/auth/signup")
async def signup(body: SignupIn):
    session = await supa_auth.signup(body.email, body.password, body.first_name)
    if db.enabled():
        await db.insert("profiles", {"user_id": session["user"]["id"], "first_name": body.first_name}, upsert=True, on_conflict="user_id", ignore_duplicates=True)
        await db.insert("entitlements", {"user_id": session["user"]["id"], "tier": "free", "source": "signup"}, upsert=True, on_conflict="user_id", ignore_duplicates=True)
    return session


@api.post("/auth/login")
async def login(body: LoginIn):
    return await supa_auth.login(body.email, body.password)


@api.post("/auth/refresh")
async def refresh(body: RefreshIn):
    return await supa_auth.refresh(body.refresh_token)


@api.get("/auth/me")
async def me(user: dict = User):
    profile = await get_profile(user["id"]) if db.enabled() else None
    ent = await get_entitlement(user["id"]) if db.enabled() else {"tier": "free", "premium": False}
    return {
        "user": user,
        "profile": profile,
        "onboarded": bool(profile and profile.get("onboarded")),
        "entitlement": ent,
    }


@api.delete("/account")
async def delete_account(user: dict = User):
    uid = user["id"]
    if db.enabled():
        # Store rules require real deletion, not a soft-delete flag.
        await db.delete("messages", filters={"user_id": uid})
        for tbl in ("conversations", "saved_profiles", "tarot_readings", "vastu_homes", "compatibility_reports",
                    "saved_items", "analytics_events", "usage_events", "notification_prefs", "entitlements",
                    "birth_charts", "profiles"):
            try:
                await db.delete(tbl, filters={"user_id": uid})
            except Exception:  # noqa: BLE001 - one missing table must not block the rest
                logger.exception("Account deletion failed for %s", tbl)
    await supa_auth.delete_user(uid)
    return {"deleted": True}


# --------------------------------------------------------------------------- #
# Public pages for the store listings
# --------------------------------------------------------------------------- #
@app.get("/privacy", response_class=HTMLResponse, include_in_schema=False)
async def privacy_page():
    return legal.privacy()


@app.get("/terms", response_class=HTMLResponse, include_in_schema=False)
async def terms_page():
    return legal.terms()


@app.get("/support", response_class=HTMLResponse, include_in_schema=False)
async def support_page():
    return legal.support()


@app.get("/delete-account", response_class=HTMLResponse, include_in_schema=False)
async def delete_account_page():
    return legal.delete_account()


# --------------------------------------------------------------------------- #
# Geocoding
# --------------------------------------------------------------------------- #
@api.get("/geo/search")
async def geo_search(q: str = Query(..., min_length=2)):
    return {"results": await geocode.provider.search(q)}


@api.get("/geo/details")
async def geo_details(place_id: str):
    return await geocode.provider.details(place_id)


# --------------------------------------------------------------------------- #
# Onboarding / profile
# --------------------------------------------------------------------------- #
class OnboardIn(BaseModel):
    first_name: str
    dob: str
    birth_time: Optional[str] = None
    birth_time_known: bool = True
    birthplace: Optional[str] = None
    lat: float
    lon: float
    tz_name: Optional[str] = None
    gender: Optional[str] = None
    relationship_status: Optional[str] = None
    interests: list[str] = Field(default_factory=list)
    terminology_mode: str = "both"
    language: ReadingLanguage = "en"


@api.post("/onboarding")
async def onboarding(body: OnboardIn, user: dict = User):
    _require_db()
    existing = await get_profile(user["id"])
    if existing and existing.get("onboarded"):
        raise HTTPException(409, "Birth details are already locked. Use the one-time correction flow.")
    dob = _parse_date(body.dob)
    if body.birth_time_known and not body.birth_time:
        raise HTTPException(422, "Birth time is required when marked as known.")
    t = _parse_time(body.birth_time) if body.birth_time_known else None
    tz_name = body.tz_name or geocode.tz_name_for(body.lat, body.lon) or "UTC"
    tz_offset = geocode.tz_offset_hours(tz_name, dob, t)
    full = compute_full(dob, t, body.lat, body.lon, tz_offset, body.birth_time_known, body.first_name)

    profile_values = {"user_id": user["id"], "first_name": body.first_name, "dob": dob,
        "birth_time": t, "birth_time_known": body.birth_time_known, "birthplace": body.birthplace,
        "lat": body.lat, "lon": body.lon, "tz_offset": tz_offset, "tz_name": tz_name,
        "gender": body.gender, "relationship_status": body.relationship_status,
        "interests": body.interests, "terminology_mode": body.terminology_mode,
        "language": body.language, "onboarded": True, "updated_at": datetime.now(timezone.utc)}
    await db.insert("profiles", profile_values, upsert=True, on_conflict="user_id")
    await db.insert("birth_charts", {"user_id": user["id"], "chart": full["chart"],
        "dasha": full["dasha"], "numerology": full["numerology"],
        "computed_at": datetime.now(timezone.utc)}, upsert=True, on_conflict="user_id")
    await _track(user["id"], "onboarding_completed", {"interests": body.interests})
    return {"profile": await get_profile(user["id"]), **full}


class BirthProfileCorrection(BaseModel):
    dob: str
    birth_time: Optional[str] = None
    birth_time_known: bool = True
    birthplace: Optional[str] = None
    lat: float
    lon: float
    tz_name: Optional[str] = None


@api.get("/birth-profile")
async def birth_profile(user: dict = User):
    _require_db()
    profile = await get_profile(user["id"])
    if not profile or not profile.get("onboarded"):
        raise HTTPException(404, "Complete onboarding first.")
    count = int(profile.get("birth_details_change_count") or 0)
    return {"profile": profile, "locked": True, "changes_remaining": max(0, 1 - count)}


@api.patch("/birth-profile")
async def correct_birth_profile(body: BirthProfileCorrection, user: dict = User):
    _require_db()
    profile = await get_profile(user["id"])
    if not profile or not profile.get("onboarded"):
        raise HTTPException(404, "Complete onboarding first.")
    if int(profile.get("birth_details_change_count") or 0) >= 1:
        raise HTTPException(409, "Your one birth-detail correction has already been used. Contact support for a verified correction.")

    dob = _parse_date(body.dob)
    if body.birth_time_known and not body.birth_time:
        raise HTTPException(422, "Birth time is required when marked as known.")
    t = _parse_time(body.birth_time) if body.birth_time_known else None
    tz_name = body.tz_name or geocode.tz_name_for(body.lat, body.lon) or "UTC"
    tz_offset = geocode.tz_offset_hours(tz_name, dob, t)
    full = compute_full(dob, t, body.lat, body.lon, tz_offset, body.birth_time_known, profile.get("first_name") or "friend")
    # The correction event is server-only and acts as the immutable usage lock.
    # This avoids requiring a direct Postgres connection while keeping all data
    # inside the same Supabase project.
    await db.update("profiles", {"dob": dob, "birth_time": t,
        "birth_time_known": body.birth_time_known, "birthplace": body.birthplace,
        "lat": body.lat, "lon": body.lon, "tz_offset": tz_offset, "tz_name": tz_name,
        "updated_at": datetime.now(timezone.utc)}, filters={"user_id": user["id"]})
    await db.insert("birth_charts", {"user_id": user["id"], "chart": full["chart"],
        "dasha": full["dasha"], "numerology": full["numerology"],
        "computed_at": datetime.now(timezone.utc)}, upsert=True, on_conflict="user_id")
    await _track(user["id"], "birth_profile_corrected", {"changes_remaining": 0})
    return {"profile": await get_profile(user["id"]), "locked": True, "changes_remaining": 0, **full}


class ProfilePatch(BaseModel):
    terminology_mode: Optional[str] = None
    language: Optional[ReadingLanguage] = None
    relationship_status: Optional[str] = None
    interests: Optional[list[str]] = None
    first_name: Optional[str] = None


@api.patch("/profile")
async def patch_profile(body: ProfilePatch, user: dict = User):
    _require_db()
    fields = {k: v for k, v in body.dict().items() if v is not None}
    if not fields:
        return await get_profile(user["id"])
    sets, vals = [], []
    for i, (k, v) in enumerate(fields.items(), start=2):
        sets.append(f"{k}=${i}")
        vals.append(json.dumps(v) if k == "interests" else v)
    await db.update("profiles", {**fields, "updated_at": datetime.now(timezone.utc)}, filters={"user_id": user["id"]})
    return await get_profile(user["id"])


# --------------------------------------------------------------------------- #
# Chart / Today / Dasha / Transits / Panchang / Numerology
# --------------------------------------------------------------------------- #
@api.get("/chart")
async def get_chart(user: dict = User):
    _require_db()
    data = await load_chart(user["id"])
    if not data:
        raise HTTPException(404, "Chart not generated yet. Complete onboarding first.")
    profile = await get_profile(user["id"])
    return {**data, "terminology_mode": profile.get("terminology_mode", "both") if profile else "both"}


class ComputeIn(BaseModel):
    dob: str
    birth_time: Optional[str] = None
    birth_time_known: bool = True
    lat: float
    lon: float
    tz_name: Optional[str] = None
    name: Optional[str] = None


@api.post("/chart/compute")
async def chart_compute(body: ComputeIn):
    dob = _parse_date(body.dob)
    t = _parse_time(body.birth_time) if body.birth_time_known else None
    tz_name = body.tz_name or geocode.tz_name_for(body.lat, body.lon) or "UTC"
    tz_offset = geocode.tz_offset_hours(tz_name, dob, t)
    return compute_full(dob, t, body.lat, body.lon, tz_offset, body.birth_time_known, body.name)


def _energy_meter(transits: dict) -> dict:
    scores = {"career": 3, "relationships": 3, "energy": 3}
    benefic_houses = {1, 4, 5, 7, 9, 10, 11}
    for t in transits.get("transits", []):
        h = t["house_from_moon"]
        good = h in benefic_houses
        if t["planet"] in ("Jupiter", "Venus"):
            scores["relationships"] += 1 if good else -1
        if t["planet"] in ("Sun", "Mars", "Saturn"):
            scores["career"] += 1 if good else -1
        if t["planet"] in ("Moon", "Mars", "Sun"):
            scores["energy"] += 1 if good else -1
    for k in scores:
        scores[k] = max(1, min(5, scores[k]))
    labels = {1: "Low", 2: "Reflective", 3: "Moderate", 4: "Strong", 5: "Excellent"}
    expanded = {
        "self": scores["energy"],
        "wellbeing": scores["energy"],
        "career": scores["career"],
        "money": max(1, min(5, round((scores["career"] * 2 + scores["energy"]) / 3))),
        "love": scores["relationships"],
        "family": max(1, min(5, round((scores["relationships"] * 2 + scores["energy"]) / 3))),
        "learning": max(1, min(5, round((scores["career"] + scores["energy"]) / 2))),
        "spiritual": max(1, min(5, round((scores["relationships"] + scores["energy"]) / 2))),
    }
    # Keep legacy keys while richer clients move to the eight daily-life areas.
    expanded.update(scores)
    return {k: {"value": v, "label": labels[v]} for k, v in expanded.items()}


# Slow AI work (daily readings, reports) runs as a FastAPI background task: it
# starts after the response is sent and, on serverless hosts, keeps the same
# invocation alive until it finishes. A lock row in saved_items makes sure
# concurrent polls from any instance start the work once.
_LOCK_TTL = 300


async def _claim(user_id: str, cache_key: str) -> bool:
    kind = f"lock:{cache_key}"
    row = await db.one("saved_items", "id,created_at", filters={"user_id": user_id, "kind": kind})
    if row:
        try:
            started = datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00"))
        except ValueError:
            started = datetime.min.replace(tzinfo=timezone.utc)
        if (datetime.now(timezone.utc) - started).total_seconds() < _LOCK_TTL:
            return False
        await db.delete("saved_items", filters={"id": row["id"]})
    await db.insert("saved_items", {"user_id": user_id, "kind": kind, "payload": {}})
    return True


async def _release(user_id: str, cache_key: str) -> None:
    try:
        await db.delete("saved_items", filters={"user_id": user_id, "kind": f"lock:{cache_key}"})
    except Exception:  # noqa: BLE001 - a stale lock simply expires
        logger.warning("Could not release lock %s", cache_key)


async def _generate_and_cache_daily(cache_key: str, user_id: str, language: str, request: str) -> None:
    """Generate daily prose outside the request path and persist it for reuse."""
    try:
        reading = None
        for tier in ("fast", "standard"):
            try:
                candidate = await ai_gateway.generate_json(
                    prompts.SYSTEM_PROMPT, request, tier=tier, retries=0,
                    user_id=user_id, feature="today_insight",
                )
                if daily_reading.valid_reading(candidate, language, require_categories=True):
                    reading = candidate
                    break
            except (ai_gateway.AIUnavailable, ValueError, KeyError, TypeError):
                logger.warning("Daily reading generation failed with %s tier", tier)
        if reading is not None:
            existing = await db.one("saved_items", "id", filters={"user_id": user_id, "kind": cache_key})
            if existing:
                await db.update("saved_items", {"payload": reading}, filters={"id": existing["id"]})
            else:
                await db.insert("saved_items", {"user_id": user_id, "kind": cache_key, "payload": reading})
    except Exception:  # noqa: BLE001 - a background refresh must never break /today
        logger.exception("Background daily reading generation failed")
    finally:
        await _release(user_id, cache_key)


@api.get("/today")
async def today(background: BackgroundTasks, user: dict = User, day: Optional[str] = None):
    _require_db()
    if day:
        try:
            reading_day = date.fromisoformat(day)
        except ValueError as exc:
            raise HTTPException(422, "Enter a valid reading date in YYYY-MM-DD format.") from exc
    else:
        reading_day = date.today()
    if reading_day < date.today() or reading_day > date.today() + timedelta(days=1):
        raise HTTPException(400, "Daily readings are available for today and tomorrow only.")
    data = await load_chart(user["id"])
    if not data:
        raise HTTPException(404, "Complete onboarding first.")
    profile = await get_profile(user["id"])
    return await _today_payload(user["id"], data, profile, (profile or {}).get("first_name"), reading_day, "self", background)


async def _today_payload(user_id: str, data: dict, profile: Optional[dict], name: Optional[str],
                         reading_day: date, scope: str, background: BackgroundTasks) -> dict:
    """Daily reading for any chart the user owns (their own or a family member's).
    Location, language and terminology always come from the account holder."""
    chart, dashas = data["chart"], data["dasha"]
    as_of = datetime.now(timezone.utc) if reading_day == date.today() else datetime.combine(reading_day, dtime(hour=12), timezone.utc)
    tr = transit_mod.compute_transits(chart, as_of=as_of)
    pan = None
    if profile and profile.get("lat") is not None:
        pan = panchang_mod.compute_panchang(
            reading_day, profile["lat"], profile["lon"], profile.get("tz_offset") or 0.0)

    language = (profile or {}).get("language") or "en"
    ctx = {"transits": tr, "dasha": dashas, "panchang": pan}
    request = (
        prompts.daily_insight_prompt(name or "friend", (profile or {}).get("terminology_mode", "both"), language, reading_day.isoformat())
        + "\n\nCONTEXT:\n" + json.dumps(ctx, default=str)
    )
    chart_version = str(data.get("computed_at") or "v1").replace(":", "-")
    cache_key = f"daily_reading:v3:{scope}:{reading_day.isoformat()}:{language}:{chart_version}" if scope != "self" else f"daily_reading:v3:{reading_day.isoformat()}:{language}:{chart_version}"
    cached = await db.one("saved_items", "payload", filters={"user_id": user_id, "kind": cache_key})
    reading = (cached or {}).get("payload")
    if not daily_reading.valid_reading(reading, language, require_categories=True):
        reading = daily_reading.fallback_reading(language)
        if await _claim(user_id, cache_key):
            background.add_task(_generate_and_cache_daily, cache_key, user_id, language, request)
        reading_status = "generating"
    else:
        reading_status = "ready"

    try:
        from zoneinfo import ZoneInfo
        local_now = datetime.now(ZoneInfo((profile or {}).get("tz_name") or "UTC"))
    except Exception:  # pragma: no cover - defensive fallback for invalid legacy zones
        local_now = datetime.now(timezone.utc) + timedelta(hours=float((profile or {}).get("tz_offset") or 0))
    hour = local_now.hour
    greeting = "Good morning" if 5 <= hour < 12 else "Good afternoon" if 12 <= hour < 17 else "Good evening"
    md = dashas.get("current_mahadasha") or {}
    daily_tarot = tarot_mod.draw("one", seed=int(reading_day.strftime("%Y%m%d")))
    await _track(user_id, "today_viewed", {})
    return {
        "greeting": greeting,
        "name": name,
        "date": reading_day.isoformat(),
        "energy": _energy_meter(tr),
        "moon_today": tr["moon_today"],
        "current_period": {"mahadasha": md.get("lord"),
                           "antardasha": (dashas.get("current_antardasha") or {}).get("lord")},
        "insight": reading["theme"],
        "reading": reading,
        "reading_status": reading_status,
        "language": language,
        "panchang": pan,
        "daily_tarot": daily_tarot,
        "terminology_mode": profile.get("terminology_mode", "both") if profile else "both",
    }




@api.get("/dasha")
async def get_dasha(user: dict = User):
    _require_db()
    data = await load_chart(user["id"])
    if not data:
        raise HTTPException(404, "Complete onboarding first.")
    return data["dasha"]


@api.get("/transits")
async def get_transits(user: dict = User):
    _require_db()
    data = await load_chart(user["id"])
    if not data:
        raise HTTPException(404, "Complete onboarding first.")
    return transit_mod.compute_transits(data["chart"])


@api.get("/panchang")
async def get_panchang(user: dict = User, day: Optional[str] = None):
    _require_db()
    profile = await get_profile(user["id"])
    lat = profile.get("lat") if profile else None
    lon = profile.get("lon") if profile else None
    tz = (profile.get("tz_offset") if profile else 0.0) or 0.0
    d = _parse_date(day) if day else date.today()
    return panchang_mod.compute_panchang(d, lat, lon, tz)


@api.get("/numerology")
async def get_numerology(user: dict = User):
    _require_db()
    data = await load_chart(user["id"])
    if not data or not data.get("numerology"):
        raise HTTPException(404, "Complete onboarding first.")
    return data["numerology"]


# --------------------------------------------------------------------------- #
# Terminology + config
# --------------------------------------------------------------------------- #
@api.get("/terminology")
async def get_terminology(mode: str = "both"):
    return {"mode": mode, "terms": terminology.full_map(mode)}


_cfg_cache: tuple[dict, float] | None = None


@api.get("/config")
async def get_config():
    global _cfg_cache
    if _cfg_cache and _cfg_cache[1] > time.monotonic():
        return dict(_cfg_cache[0])
    cfg = dict(config.DEFAULT_APP_CONFIG)
    if db.enabled():
        rows = await db.select("app_config", "key,value")
        for r in rows:
            cfg[r["key"]] = r["value"]
    cfg["revenuecat"] = {
        "ios_key": config.REVENUECAT_IOS_API_KEY,
        "android_key": config.REVENUECAT_ANDROID_API_KEY,
    }
    cfg["ai_enabled"] = config.AI_ENABLED
    cfg["persistence_enabled"] = db.enabled()
    cfg.pop("premium_tiers", None)
    _cfg_cache = (cfg, time.monotonic() + 60.0)
    return dict(cfg)


# --------------------------------------------------------------------------- #
# Tarot
# --------------------------------------------------------------------------- #
class TarotIn(BaseModel):
    spread: str = "one"
    question: Optional[str] = None
    interpret: bool = True


@api.post("/tarot/draw")
async def tarot_draw(body: TarotIn, user: dict = User):
    reading = tarot_mod.draw(body.spread)
    interpretation = None
    if body.interpret:
        cards_txt = "; ".join(f"{c['position']}: {c['name']} ({c['orientation']}) — {c['keywords']}"
                              for c in reading["cards"])
        try:
            interpretation = await ai_gateway.generate(
                prompts.SYSTEM_PROMPT,
                f"A tarot reading was drawn (reflection tool, not astrology). Spread: {body.spread}. "
                f"Question: {body.question or 'open reflection'}. Cards: {cards_txt}. "
                f"Give a warm, grounded 2-3 paragraph reflection. Avoid fear or certainty.",
                tier="standard", user_id=user["id"], feature="tarot")
        except ai_gateway.AIUnavailable:
            interpretation = "This reading invites reflection. " + " ".join(
                f"{c['position']} — {c['name']} speaks to {c['keywords']}." for c in reading["cards"])
    if db.enabled():
        await db.insert("tarot_readings", {"user_id": user["id"], "spread": body.spread,
            "cards": reading["cards"], "note": body.question, "interpretation": interpretation})
    await _track(user["id"], "tarot_completed", {"spread": body.spread})
    return {**reading, "interpretation": interpretation}


@api.get("/tarot/history")
async def tarot_history(user: dict = User):
    _require_db()
    rows = await db.select("tarot_readings", "id,spread,cards,note,interpretation,created_at",
        filters={"user_id": user["id"], "deleted_at": None}, order="created_at.desc", limit=50)
    return {"readings": rows}


# --------------------------------------------------------------------------- #
# Compatibility
# --------------------------------------------------------------------------- #
class PartnerIn(BaseModel):
    name: str
    relation: str = "partner"
    dob: str
    birth_time: Optional[str] = None
    birth_time_known: bool = True
    lat: float
    lon: float
    tz_name: Optional[str] = None


@api.post("/compatibility")
async def compatibility_check(body: PartnerIn, user: dict = User):
    _require_db()
    mine = await load_chart(user["id"])
    if not mine:
        raise HTTPException(404, "Complete onboarding first.")
    dob = _parse_date(body.dob)
    t = _parse_time(body.birth_time) if body.birth_time_known else None
    tz_name = body.tz_name or geocode.tz_name_for(body.lat, body.lon) or "UTC"
    tz_offset = geocode.tz_offset_hours(tz_name, dob, t)
    partner = compute_full(dob, t, body.lat, body.lon, tz_offset, body.birth_time_known, body.name)

    def moon_key(chart):
        m = next(p for p in chart["planets"] if p["name"] == "Moon")
        return {"moon_sign_index": m["sign_index"], "moon_nakshatra_index": m["nakshatra_index"]}

    result = compatibility.guna_milan(moon_key(mine["chart"]), moon_key(partner["chart"]))
    ent = await get_entitlement(user["id"])
    overview = None
    if ent["premium"]:
        try:
            overview = await ai_gateway.generate(
                prompts.SYSTEM_PROMPT,
                prompts.compatibility_prompt(result, mine["chart"], partner["chart"], body.relation),
                tier="deep", user_id=user["id"], feature="compatibility")
        except ai_gateway.AIUnavailable:
            overview = None
    await db.insert("compatibility_reports", {"user_id": user["id"], "partner_name": body.name,
        "relation": body.relation, "result": {**result, "partner_moon": partner["chart"]["moon_sign"]}})
    await _track(user["id"], "compatibility_started", {"verdict": result["verdict"]})
    return {
        "guna_milan": result,
        "partner_moon_sign": partner["chart"]["moon_sign"],
        "premium": ent["premium"],
        "overview": overview,
        "locked": not ent["premium"],
    }


@api.get("/compatibility/history")
async def compatibility_history(user: dict = User):
    """Return the user's recent saved matches without exposing another birth profile."""
    _require_db()
    rows = await db.select(
        "compatibility_reports",
        "id,partner_name,relation,result,created_at",
        filters={"user_id": user["id"], "deleted_at": None},
        order="created_at.desc",
        limit=12,
    )
    return {"matches": rows}


# --------------------------------------------------------------------------- #
# Vastu
# --------------------------------------------------------------------------- #
class VastuAnalyzeIn(BaseModel):
    name: str = "My Home"
    rooms: list[dict]
    north_rotation: float = 0.0
    source: str = "draw"
    save: bool = True
    explain: bool = True


@api.post("/vastu/analyze")
async def vastu_analyze(body: VastuAnalyzeIn, user: dict = User):
    try:
        analysis = vastu_mod.analyze(body.rooms, body.north_rotation)
    except (KeyError, TypeError, ValueError):
        raise HTTPException(400, "Each room needs room_type, x, y, width and height.")
    ent = await get_entitlement(user["id"]) if db.enabled() else {"premium": False}
    advice = None
    if body.explain and ent.get("premium"):
        try:
            advice = await ai_gateway.generate(
                prompts.SYSTEM_PROMPT,
                f"Home Vastu analysis (deterministic findings provided). Score {analysis['score']}/100. "
                f"Findings: {json.dumps(analysis['findings'])}. Write warm, practical guidance prioritising "
                f"improvements possible WITHOUT renovation. No fear-based claims.",
                tier="deep", user_id=user["id"], feature="vastu")
        except ai_gateway.AIUnavailable:
            advice = None
    home_id = None
    if body.save and db.enabled():
        home = await db.insert("vastu_homes", {"user_id": user["id"], "name": body.name,
            "rooms": body.rooms, "north_rotation": body.north_rotation, "analysis": analysis,
            "source": body.source}, returning=True)
        home_id = home.get("id") if home else None
    await _track(user["id"], "vastu_completed", {"score": analysis["score"], "source": body.source})
    return {"id": str(home_id) if home_id else None, "analysis": analysis,
            "advice": advice, "premium": ent.get("premium", False)}


@api.get("/vastu/homes")
async def vastu_homes(user: dict = User):
    _require_db()
    rows = await db.select("vastu_homes", "id,name,rooms,north_rotation,analysis,source,created_at",
        filters={"user_id": user["id"], "deleted_at": None}, order="created_at.desc")
    return {"homes": rows}


@api.delete("/vastu/homes/{home_id}")
async def vastu_delete(home_id: str, user: dict = User):
    _require_db()
    await db.update("vastu_homes", {"deleted_at": datetime.now(timezone.utc)}, filters={"id": home_id, "user_id": user["id"]})
    return {"deleted": True}


class FloorplanIn(BaseModel):
    image_url: str


@api.post("/vastu/parse-floorplan")
async def parse_floorplan(body: FloorplanIn, user: dict = User):
    await _track(user["id"], "floorplan_uploaded", {})
    try:
        parsed = await ai_gateway.generate_json(
            prompts.VISION_FLOORPLAN_PROMPT, "Identify the rooms in this floor plan.",
            tier="vision", user_id=user["id"], feature="floorplan_parse", images=[body.image_url])
    except ai_gateway.AIUnavailable:
        raise HTTPException(503, "Automatic floor-plan reading needs the AI provider. "
                                 "You can mark the rooms manually instead.")
    rooms = parsed.get("rooms", [])
    return {"rooms": rooms, "notes": parsed.get("notes"),
            "message": "Please confirm or correct the detected rooms, then set North."}


# --------------------------------------------------------------------------- #
# Ask (conversations + chat)
# --------------------------------------------------------------------------- #
@api.get("/conversations")
async def list_conversations(user: dict = User):
    _require_db()
    rows = await db.select("conversations", "id,title,summary,updated_at",
        filters={"user_id": user["id"], "deleted_at": None}, order="updated_at.desc")
    return {"conversations": rows}


@api.post("/conversations")
async def create_conversation(user: dict = User):
    _require_db()
    convo = await db.insert("conversations", {"user_id": user["id"]}, returning=True)
    cid = convo.get("id") if convo else None
    await _track(user["id"], "ask_started", {})
    return {"id": str(cid), "title": "New conversation"}


@api.get("/conversations/{cid}/messages")
async def conversation_messages(cid: str, user: dict = User):
    _require_db()
    convo = await db.one("conversations", "id,title,summary", filters={"id": cid, "user_id": user["id"]})
    if not convo:
        raise HTTPException(404, "Conversation not found.")
    rows = await db.select("messages", "id,role,content,created_at",
        filters={"conversation_id": cid}, order="created_at.asc")
    return {"conversation": convo, "messages": rows}


@api.delete("/conversations/{cid}")
async def delete_conversation(cid: str, user: dict = User):
    _require_db()
    await db.update("conversations", {"deleted_at": datetime.now(timezone.utc)}, filters={"id": cid, "user_id": user["id"]})
    return {"deleted": True}


async def _check_fair_use(user_id: str) -> None:
    ent, cfg = await asyncio.gather(get_entitlement(user_id), get_config())
    if not ent["premium"]:
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        used = await db.count("messages", filters={"user_id": user_id, "role": "user",
            "created_at": ("gte", month_start.isoformat())})
        if used >= cfg.get("free_chat_allowance", config.FREE_CHAT_ALLOWANCE) and not await _consume_bonus(user_id):
            raise HTTPException(402, json.dumps({"paywall": True,
                "reason": "You've used this month's complimentary messages. Join for more guidance, or come back next month."}))
    else:
        since = datetime.now(timezone.utc) - timedelta(days=1)
        today_count = await db.count("messages", filters={"user_id": user_id, "role": "user",
            "created_at": ("gt", since.isoformat())})
        if today_count >= cfg.get("fairuse_daily_messages", config.FAIRUSE_DAILY_MESSAGES):
            raise HTTPException(429, "Daily fair-use limit reached. Please continue tomorrow.")


async def _assemble_context(user_id: str, question: str) -> tuple[dict, dict]:
    data, profile = await asyncio.gather(load_chart(user_id), get_profile(user_id, with_changes=False))
    if not data:
        raise HTTPException(404, "Complete onboarding first.")
    tr = transit_mod.compute_transits(data["chart"])
    pan = None
    if profile and profile.get("lat") is not None:
        pan = panchang_mod.compute_panchang(date.today(), profile["lat"], profile["lon"],
                                            profile.get("tz_offset") or 0.0)
    convo_summary = None
    ctx = context_engine.build_context(question, data["chart"], data["dasha"], tr, pan, profile or {}, convo_summary)
    return ctx, (profile or {})


class MessageIn(BaseModel):
    content: str


@api.post("/conversations/{cid}/message")
async def send_message(cid: str, body: MessageIn, user: dict = User):
    _require_db()
    await _check_fair_use(user["id"])
    ctx, profile = await _assemble_context(user["id"], body.content)
    await db.insert("messages", {"conversation_id": cid, "user_id": user["id"], "role": "user",
        "content": body.content, "topic": ctx["topic"]})
    history = await db.select("messages", "role,content", filters={"conversation_id": cid},
        order="created_at.desc", limit=8)
    msgs = [{"role": m["role"], "content": m["content"]} for m in reversed(history)]
    msgs.insert(0, {"role": "user", "content": "CONTEXT:\n" + json.dumps(ctx, default=str)})
    try:
        parts = []
        async for chunk in ai_gateway.stream(prompts.SYSTEM_PROMPT, msgs, tier="standard",
                                              user_id=user["id"], feature="chat"):
            parts.append(chunk)
        reply = "".join(parts) or interpret.chat_reply(body.content, ctx)
    except ai_gateway.AIUnavailable:
        reply = interpret.chat_reply(body.content, ctx)
    await db.insert("messages", {"conversation_id": cid, "user_id": user["id"], "role": "assistant", "content": reply})
    await db.update("conversations", {"updated_at": datetime.now(timezone.utc)}, filters={"id": cid})
    await _maybe_title(cid, body.content)
    await _track(user["id"], "message_sent", {"topic": ctx["topic"]})
    return {"reply": reply, "topic": ctx["topic"]}


@api.post("/ask/stream")
async def ask_stream(cid: str, body: MessageIn, user: dict = User):
    _require_db()
    # Every Supabase round-trip costs ~0.5-1s, so independent reads run together
    # and the user's message is saved while the model is already answering.
    _, (ctx, profile), history = await asyncio.gather(
        _check_fair_use(user["id"]),
        _assemble_context(user["id"], body.content),
        db.select("messages", "role,content", filters={"conversation_id": cid}, order="created_at.desc", limit=7),
    )
    save_question = asyncio.create_task(db.insert("messages", {"conversation_id": cid, "user_id": user["id"], "role": "user",
        "content": body.content, "topic": ctx["topic"]}))
    msgs = [{"role": m["role"], "content": m["content"]} for m in reversed(history)]
    msgs.append({"role": "user", "content": body.content})
    msgs.insert(0, {"role": "user", "content": "CONTEXT:\n" + json.dumps(ctx, default=str)})

    async def gen():
        parts: list[str] = []
        try:
            async for chunk in ai_gateway.stream(prompts.chat_system_prompt((profile or {}).get("language") or "en"), msgs,
                                                  tier="standard", user_id=user["id"], feature="chat"):
                parts.append(chunk)
                yield chunk
        except ai_gateway.AIUnavailable:
            if parts:
                interruption = "\n\nI couldn't finish that thought. Please ask again."
                parts.append(interruption)
                yield interruption
            else:
                fallback = interpret.chat_reply(body.content, ctx)
                parts.append(fallback)
                yield fallback
        except Exception:
            logger.exception("AI chat stream failed")
            fallback = "\n\nI couldn't finish that thought. Please ask again." if parts else interpret.chat_reply(body.content, ctx)
            parts.append(fallback)
            yield fallback
        if not parts:
            fallback = interpret.chat_reply(body.content, ctx)
            parts.append(fallback)
            yield fallback
        reply = "".join(parts)
        await save_question
        await db.insert("messages", {"conversation_id": cid, "user_id": user["id"], "role": "assistant", "content": reply})
        await db.update("conversations", {"updated_at": datetime.now(timezone.utc)}, filters={"id": cid})

    return StreamingResponse(gen(), media_type="text/plain", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


async def _maybe_title(cid: str, first_msg: str) -> None:
    convo = await db.one("conversations", "title", filters={"id": cid})
    if convo and convo["title"] == "New conversation":
        title = first_msg.strip()[:40] + ("…" if len(first_msg) > 40 else "")
        await db.update("conversations", {"title": title}, filters={"id": cid})


# --------------------------------------------------------------------------- #
# Entitlements (RevenueCat sync)
# --------------------------------------------------------------------------- #
class EntitlementSync(BaseModel):
    rc_customer_id: Optional[str] = None
    tier: str = "free"
    source: str = "revenuecat"
    expires_at: Optional[str] = None


@api.get("/entitlement")
async def entitlement(user: dict = User):
    if not db.enabled():
        return {"tier": "free", "premium": False}
    return await get_entitlement(user["id"])


@api.post("/entitlement/sync")
async def entitlement_sync(body: EntitlementSync, user: dict = User):
    _ent_cache.pop(user["id"], None)
    _require_db()
    if not RC_SECRET:
        raise HTTPException(503, "Purchase verification is not configured on the server.")
    if not body.rc_customer_id or body.rc_customer_id != user["id"]:
        raise HTTPException(403, "RevenueCat customer identity does not match this account.")
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(f"https://api.revenuecat.com/v1/subscribers/{body.rc_customer_id}",
                            headers={"Authorization": f"Bearer {RC_SECRET}"})
        if r.status_code != 200:
            raise HTTPException(502, "Could not verify the purchase with RevenueCat.")
        ents = r.json().get("subscriber", {}).get("entitlements", {})
        tier, expires = _tier_from_rc(ents)
        source = "revenuecat_verified"
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.warning("RC verify failed: %s", e)
        raise HTTPException(502, "Could not verify the purchase with RevenueCat.") from e
    exp_dt = datetime.fromisoformat(expires.replace("Z", "+00:00")) if expires else None
    await db.insert("entitlements", {"user_id": user["id"], "tier": tier, "source": source,
        "rc_customer_id": body.rc_customer_id, "expires_at": exp_dt,
        "updated_at": datetime.now(timezone.utc)}, upsert=True, on_conflict="user_id")
    await _track(user["id"], "purchase_completed", {"tier": tier})
    _ent_cache.pop(user["id"], None)
    return await get_entitlement(user["id"])


def _tier_from_rc(entitlements: dict) -> tuple[str, Optional[str]]:
    # "astronow_pro" is the entitlement configured in RevenueCat; the others are older names.
    for name in ("founder_lifetime", "lifetime", "premium_annual", "premium_monthly", "premium", "astronow_pro"):
        ent = entitlements.get(name)
        if ent and ent.get("expires_date") is None:
            return ("lifetime" if "lifetime" in name else name), None
        if ent:
            if name in ("premium", "astronow_pro"):
                annual = "annual" in str(ent.get("product_identifier", ""))
                return ("premium_annual" if annual else "premium_monthly"), ent.get("expires_date")
            return name, ent.get("expires_date")
    return "free", None


# --------------------------------------------------------------------------- #
# Analytics + admin
# --------------------------------------------------------------------------- #
class AnalyticsIn(BaseModel):
    name: str
    props: dict = Field(default_factory=dict)


async def _track(user_id: Optional[str], name: str, props: dict) -> None:
    if db.enabled():
        try:
            await db.insert("analytics_events", {"user_id": user_id, "name": name, "props": props})
        except Exception:  # noqa: BLE001
            pass


@api.post("/analytics")
async def analytics(body: AnalyticsIn, user: dict = User):
    await _track(user["id"], body.name, body.props)
    return {"ok": True}


def _admin(token: Optional[str]) -> None:
    if not ADMIN_TOKEN or not token or not secrets.compare_digest(token, ADMIN_TOKEN):
        raise HTTPException(403, "Admin authorization required.")


@api.get("/admin/stats")
async def admin_stats(x_admin_token: Optional[str] = Header(None)):
    _admin(x_admin_token)
    if not db.enabled():
        return {"persistence": False}
    users = await db.count("profiles")
    paid = await db.count("entitlements", filters={"tier": ("neq", "free")})
    since_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today = datetime.now(timezone.utc) - timedelta(days=1)
    usage_today = await db.select("usage_events", "cost_input,cost_output", filters={"created_at": ("gt", today.isoformat())})
    usage_month = await db.select("usage_events", "cost_input,cost_output", filters={"created_at": ("gt", since_month.isoformat())})
    cost_today = sum(float(r.get("cost_input") or 0) + float(r.get("cost_output") or 0) for r in usage_today)
    cost_month = sum(float(r.get("cost_input") or 0) + float(r.get("cost_output") or 0) for r in usage_month)
    chats = await db.count("messages", filters={"role": "user"})
    vastu = await db.count("vastu_homes")
    active = await db.select("analytics_events", "user_id", filters={"created_at": ("gt", today.isoformat())})
    dau = len({r.get("user_id") for r in active if r.get("user_id")})
    return {
        "persistence": True, "users": users, "paid_users": paid, "dau": dau,
        "ai_cost_today_usd": round(float(cost_today), 4), "ai_cost_month_usd": round(float(cost_month), 4),
        "chats": chats, "vastu_analyses": vastu,
        "cost_per_paid_user": round(float(cost_month) / paid, 4) if paid else 0,
    }


# --------------------------------------------------------------------------- #
# Family profiles
# --------------------------------------------------------------------------- #
FAMILY_LIMIT = {"free": 1, "premium": 5}


class FamilyIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    relation: Optional[str] = None
    dob: str
    birth_time: Optional[str] = None
    birth_time_known: bool = True
    birthplace: Optional[str] = None
    lat: float
    lon: float
    tz_name: Optional[str] = None


def _member_chart(row: dict) -> dict:
    raw = row.get("chart") or {}
    return raw if isinstance(raw, dict) else json.loads(raw)


def _member_summary(row: dict) -> dict:
    full = _member_chart(row)
    chart = full.get("chart") or {}
    return {"id": row["id"], "name": row["name"], "relation": row.get("relation"),
            "dob": row.get("dob"), "birthplace": row.get("birthplace"),
            "moon_sign": chart.get("moon_sign"), "sun_sign": chart.get("sun_sign"),
            "lagna": (chart.get("lagna") or {}).get("sign")}


async def _family_rows(user_id: str) -> list[dict]:
    return await db.select("saved_profiles", "*", filters={"user_id": user_id, "deleted_at": None}, order="created_at.asc")


@api.get("/family")
async def family_list(user: dict = User):
    _require_db()
    ent = await get_entitlement(user["id"])
    rows = await _family_rows(user["id"])
    return {"members": [_member_summary(r) for r in rows],
            "limit": FAMILY_LIMIT["premium" if ent["premium"] else "free"], "premium": ent["premium"]}


@api.post("/family")
async def family_add(body: FamilyIn, user: dict = User):
    _require_db()
    ent = await get_entitlement(user["id"])
    rows = await _family_rows(user["id"])
    limit = FAMILY_LIMIT["premium" if ent["premium"] else "free"]
    if len(rows) >= limit:
        raise HTTPException(402, json.dumps({"paywall": True, "reason": "Add more family members with AstroNow Plus."}))
    dob = _parse_date(body.dob)
    if body.birth_time_known and not body.birth_time:
        raise HTTPException(422, "Birth time is required when marked as known.")
    t = _parse_time(body.birth_time) if body.birth_time_known else None
    tz_name = body.tz_name or geocode.tz_name_for(body.lat, body.lon) or "UTC"
    tz_offset = geocode.tz_offset_hours(tz_name, dob, t)
    full = compute_full(dob, t, body.lat, body.lon, tz_offset, body.birth_time_known, body.name)
    row = await db.insert("saved_profiles", {
        "user_id": user["id"], "name": body.name.strip(), "relation": body.relation, "dob": dob,
        "birth_time": t, "birth_time_known": body.birth_time_known, "birthplace": body.birthplace,
        "lat": body.lat, "lon": body.lon, "tz_offset": tz_offset, "chart": full,
    }, returning=True)
    await _track(user["id"], "family_member_added", {"relation": body.relation})
    return _member_summary(row)


@api.delete("/family/{member_id}")
async def family_delete(member_id: str, user: dict = User):
    _require_db()
    await db.update("saved_profiles", {"deleted_at": datetime.now(timezone.utc)}, filters={"id": member_id, "user_id": user["id"]})
    return {"deleted": True}


@api.get("/family/{member_id}/today")
async def family_today(member_id: str, background: BackgroundTasks, user: dict = User, day: Optional[str] = None):
    _require_db()
    row = await db.one("saved_profiles", "*", filters={"id": member_id, "user_id": user["id"], "deleted_at": None})
    if not row:
        raise HTTPException(404, "Family member not found.")
    reading_day = date.fromisoformat(day) if day else date.today()
    if reading_day < date.today() or reading_day > date.today() + timedelta(days=1):
        raise HTTPException(400, "Daily readings are available for today and tomorrow only.")
    full = _member_chart(row)
    data = {"chart": full["chart"], "dasha": full["dasha"], "computed_at": row.get("created_at")}
    profile = await get_profile(user["id"])
    return await _today_payload(user["id"], data, profile, row["name"], reading_day, f"member-{member_id}", background)


# --------------------------------------------------------------------------- #
# Question credits and referrals
# --------------------------------------------------------------------------- #
async def _bonus_rows(user_id: str) -> list[dict]:
    rows = await db.select("saved_items", "id,payload", filters={"user_id": user_id, "kind": "bonus_questions", "deleted_at": None})
    for r in rows:
        if isinstance(r.get("payload"), str):
            r["payload"] = json.loads(r["payload"])
    return rows


async def _usage(user_id: str) -> dict:
    ent = await get_entitlement(user_id)
    cfg = await get_config()
    bonus = sum(int((r["payload"] or {}).get("remaining", 0)) for r in await _bonus_rows(user_id))
    if ent["premium"]:
        since = datetime.now(timezone.utc) - timedelta(days=1)
        used = await db.count("messages", filters={"user_id": user_id, "role": "user", "created_at": ("gt", since.isoformat())})
        allowance = int(cfg.get("fairuse_daily_messages", config.FAIRUSE_DAILY_MESSAGES))
        return {"premium": True, "period": "day", "used": used, "allowance": allowance, "bonus": bonus,
                "remaining": max(0, allowance - used)}
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    used = await db.count("messages", filters={"user_id": user_id, "role": "user", "created_at": ("gte", month_start.isoformat())})
    allowance = int(cfg.get("free_chat_allowance", config.FREE_CHAT_ALLOWANCE))
    return {"premium": False, "period": "month", "used": used, "allowance": allowance, "bonus": bonus,
            "remaining": max(0, allowance - used) + bonus}


async def _consume_bonus(user_id: str) -> bool:
    for r in await _bonus_rows(user_id):
        payload = r["payload"] or {}
        remaining = int(payload.get("remaining", 0))
        if remaining > 0:
            await db.update("saved_items", {"payload": {**payload, "remaining": remaining - 1}}, filters={"id": r["id"]})
            return True
    return False


@api.get("/usage")
async def usage(user: dict = User):
    _require_db()
    return await _usage(user["id"])


class RedeemIn(BaseModel):
    code: str = Field(min_length=4, max_length=16)


REFERRAL_BONUS = 2


async def _ensure_referral_code(user_id: str) -> str:
    code = growth.referral_code(user_id)
    kind = f"referral_code:{code}"
    if not await db.one("saved_items", "id", filters={"user_id": user_id, "kind": kind}):
        await db.insert("saved_items", {"user_id": user_id, "kind": kind, "payload": {"code": code}})
    return code


@api.get("/referral")
async def referral(user: dict = User):
    _require_db()
    code = await _ensure_referral_code(user["id"])
    invited = await db.count("saved_items", filters={"user_id": user["id"], "kind": "referral_credit"})
    redeemed = await db.one("saved_items", "id", filters={"user_id": user["id"], "kind": "referral_redeemed"})
    return {"code": code, "invited": invited, "earned": invited * REFERRAL_BONUS,
            "bonus_per_friend": REFERRAL_BONUS, "can_redeem": redeemed is None}


@api.post("/referral/redeem")
async def referral_redeem(body: RedeemIn, user: dict = User):
    _require_db()
    code = body.code.strip().upper().replace(" ", "")
    owner = await db.one("saved_items", "user_id", filters={"kind": f"referral_code:{code}"})
    if not owner:
        raise HTTPException(404, "That invite code was not found. Check it and try again.")
    if owner["user_id"] == user["id"]:
        raise HTTPException(400, "You can't use your own invite code.")
    if await db.one("saved_items", "id", filters={"user_id": user["id"], "kind": "referral_redeemed"}):
        raise HTTPException(409, "You have already used an invite code.")
    await db.insert("saved_items", {"user_id": user["id"], "kind": "referral_redeemed", "payload": {"code": code, "referrer": owner["user_id"]}})
    await db.insert("saved_items", {"user_id": user["id"], "kind": "bonus_questions", "payload": {"count": REFERRAL_BONUS, "remaining": REFERRAL_BONUS, "reason": "welcome"}})
    await db.insert("saved_items", {"user_id": owner["user_id"], "kind": "bonus_questions", "payload": {"count": REFERRAL_BONUS, "remaining": REFERRAL_BONUS, "reason": "referral"}})
    await db.insert("saved_items", {"user_id": owner["user_id"], "kind": "referral_credit", "payload": {"friend": user["id"]}})
    await _track(user["id"], "referral_redeemed", {})
    return {"redeemed": True, "bonus": REFERRAL_BONUS, "usage": await _usage(user["id"])}


# --------------------------------------------------------------------------- #
# Moon calendar and muhurat finder
# --------------------------------------------------------------------------- #
async def _location(user_id: str) -> tuple[Optional[float], Optional[float], float]:
    profile = await get_profile(user_id)
    return ((profile or {}).get("lat"), (profile or {}).get("lon"), float((profile or {}).get("tz_offset") or 0.0))


@api.get("/moon-calendar")
async def moon_calendar(user: dict = User, year: Optional[int] = None, month: Optional[int] = None):
    _require_db()
    today = date.today()
    y, m = year or today.year, month or today.month
    if not (1 <= m <= 12) or not (today.year - 1 <= y <= today.year + 2):
        raise HTTPException(422, "Choose a month within the next two years.")
    lat, lon, tz = await _location(user["id"])
    return {"year": y, "month": m, "days": growth.moon_calendar(y, m, lat, lon, tz)}


@api.get("/muhurat/activities")
async def muhurat_activities():
    return {"activities": [{"id": k, "label": v["label"]} for k, v in growth.ACTIVITIES.items()]}


@api.get("/muhurat")
async def muhurat(activity: str, user: dict = User, days: int = 21):
    _require_db()
    if activity not in growth.ACTIVITIES:
        raise HTTPException(422, "Choose a supported activity.")
    lat, lon, tz = await _location(user["id"])
    ranked = growth.find_muhurat(activity, lat, lon, tz, date.today(), days)
    ent = await get_entitlement(user["id"])
    free_visible = 1
    results = []
    for i, r in enumerate(ranked[:10]):
        if ent["premium"] or i < free_visible:
            results.append({**r, "locked": False})
        else:
            results.append({"date": r["date"], "weekday": r["weekday"], "score": r["score"], "locked": True})
    await _track(user["id"], "muhurat_searched", {"activity": activity})
    return {"activity": activity, "label": growth.ACTIVITIES[activity]["label"], "premium": ent["premium"], "results": results}


# --------------------------------------------------------------------------- #
# Store purchases (RevenueCat) for one-time products
# --------------------------------------------------------------------------- #
_rc_cache: dict[str, tuple[dict, float]] = {}
QUESTION_PACKS = {"questions_10": 10, "questions_30": 30}
REPORT_PRODUCTS = {"artha-strategy": "report_artha_strategy", "twelve-year-compass": "report_12_year_compass"}


async def _rc_non_subscriptions(user_id: str, fresh: bool = False) -> Optional[dict]:
    """{product_id: [transactions]} from RevenueCat, or None if verification isn't configured."""
    if not RC_SECRET:
        return None
    hit = _rc_cache.get(user_id)
    if hit and not fresh and hit[1] > time.monotonic():
        return hit[0]
    r = await ai_gateway._client().get(f"https://api.revenuecat.com/v1/subscribers/{user_id}",
                                       headers={"Authorization": f"Bearer {RC_SECRET}"}, timeout=20)
    if r.status_code != 200:
        raise HTTPException(502, "Could not verify purchases with the store right now.")
    subs = r.json().get("subscriber", {}).get("non_subscriptions", {}) or {}
    _rc_cache[user_id] = (subs, time.monotonic() + 60.0)
    return subs


async def _owns_product(user_id: str, product_id: str) -> bool:
    subs = await _rc_non_subscriptions(user_id)
    if subs is None:
        raise HTTPException(503, "Purchase verification is not configured on the server.")
    return any(product_id in key for key in subs)


@api.post("/questions/sync")
async def questions_sync(user: dict = User):
    """Credits verified question-pack purchases exactly once per store transaction."""
    _require_db()
    subs = await _rc_non_subscriptions(user["id"], fresh=True)
    if subs is None:
        raise HTTPException(503, "Purchase verification is not configured on the server.")
    added = 0
    for product_id, transactions in subs.items():
        count = next((n for key, n in QUESTION_PACKS.items() if key in product_id), None)
        if not count:
            continue
        for tx in transactions or []:
            tx_id = str(tx.get("id") or tx.get("store_transaction_id") or "")
            kind = f"question_pack:{tx_id}"
            if not tx_id or await db.one("saved_items", "id", filters={"user_id": user["id"], "kind": kind}):
                continue
            await db.insert("saved_items", {"user_id": user["id"], "kind": kind, "payload": {"product": product_id, "count": count}})
            await db.insert("saved_items", {"user_id": user["id"], "kind": "bonus_questions",
                                            "payload": {"count": count, "remaining": count, "reason": product_id}})
            added += count
    if added:
        await _track(user["id"], "question_pack_credited", {"count": added})
    return {"added": added, "usage": await _usage(user["id"])}


# --------------------------------------------------------------------------- #
# Personal AI reports
# --------------------------------------------------------------------------- #

def _report_context(data: dict, tr: dict, numerology: Optional[dict]) -> dict:
    chart, dasha = data["chart"], data.get("dasha") or {}
    day = lambda v: str(v or "")[:10]  # noqa: E731 - dates only keep the context compact
    md = dasha.get("current_mahadasha") or {}
    now = datetime.now(timezone.utc).isoformat()
    upcoming_sub = [{"lord": a["lord"], "start": day(a["start"]), "end": day(a["end"])}
                    for a in md.get("antardashas", []) if str(a.get("end", "")) > now][:6]
    later = [{"lord": m["lord"], "start": day(m["start"]), "end": day(m["end"])}
             for m in dasha.get("mahadashas", []) if str(m.get("start", "")) > now][:3]
    return {
        "today": date.today().isoformat(),
        "ascendant": (chart.get("lagna") or {}).get("sign"), "moon_sign": chart.get("moon_sign"),
        "moon_nakshatra": chart.get("moon_nakshatra"), "sun_sign": chart.get("sun_sign"),
        "birth_time_known": chart.get("birth_time_known"),
        "planets": [{k: p.get(k) for k in ("name", "sign", "house", "nakshatra", "retrograde")} for p in chart.get("planets", [])],
        "yogas": [y.get("name") for y in chart.get("yogas", [])], "doshas": chart.get("doshas", []),
        "current_period": {"mahadasha": md.get("lord"), "until": day(md.get("end")),
                           "antardasha": (dasha.get("current_antardasha") or {}).get("lord"),
                           "antardasha_until": day((dasha.get("current_antardasha") or {}).get("end"))},
        "upcoming_sub_periods": upcoming_sub, "next_major_periods": later,
        "transits_from_moon": [{k: t.get(k) for k in ("planet", "sign", "house_from_moon", "retrograde")} for t in tr.get("transits", [])],
        "numerology": numerology,
    }


async def _generate_report(cache_key: str, user_id: str, slug: str, request: str) -> None:
    try:
        for attempt in range(2):
            try:
                out = await ai_gateway.generate_json(prompts.SYSTEM_PROMPT, request, tier="deep", retries=0,
                                                     user_id=user_id, feature=f"report:{slug}")
            except (ai_gateway.AIUnavailable, ValueError):
                out = None
            if report_ai.valid_report(out, slug):
                await db.insert("saved_items", {"user_id": user_id, "kind": cache_key, "payload": out})
                await _track(user_id, "personal_report_generated", {"slug": slug})
                return
            logger.warning("Report %s generation attempt %s invalid", slug, attempt + 1)
    except Exception:  # noqa: BLE001 - background work must never crash the server
        logger.exception("Personal report generation failed")
    finally:
        await _release(user_id, cache_key)


@api.get("/reports/{slug}/personal")
async def personal_report(slug: str, background: BackgroundTasks, user: dict = User):
    _require_db()
    if slug not in report_ai.BRIEFS:
        raise HTTPException(404, "Report not found.")
    if slug in REPORT_PRODUCTS:
        allowed = await _owns_product(user["id"], REPORT_PRODUCTS[slug])
    else:
        allowed = (await get_entitlement(user["id"]))["premium"]
    if not allowed:
        raise HTTPException(402, json.dumps({"paywall": True, "reason": "Your personal report unlocks with AstroNow Plus."}))
    data, profile = await asyncio.gather(load_chart(user["id"]), get_profile(user["id"], with_changes=False))
    if not data:
        raise HTTPException(404, "Complete onboarding first.")
    language = (profile or {}).get("language") or "en"
    chart_version = str(data.get("computed_at") or "v1").replace(":", "-")
    cache_key = f"report:v1:{slug}:{language}:{chart_version}"
    cached = await db.one("saved_items", "payload", filters={"user_id": user["id"], "kind": cache_key})
    if cached and report_ai.valid_report(cached.get("payload"), slug):
        return {"status": "ready", "report": cached["payload"]}
    if await _claim(user["id"], cache_key):
        tr = transit_mod.compute_transits(data["chart"])
        ctx = _report_context(data, tr, data.get("numerology"))
        request = report_ai.report_prompt(slug, (profile or {}).get("first_name") or "friend",
                                          (profile or {}).get("terminology_mode", "both"), language, json.dumps(ctx, default=str))
        background.add_task(_generate_report, cache_key, user["id"], slug, request)
    return {"status": "generating"}


# --------------------------------------------------------------------------- #
# Mobile number sign-in (Message Central VerifyNow)
# --------------------------------------------------------------------------- #
class PhoneIn(BaseModel):
    country_code: str = Field(min_length=1, max_length=5)
    phone: str = Field(min_length=6, max_length=20)


class PhoneCodeIn(PhoneIn):
    code: str = Field(min_length=4, max_length=8)


@api.post("/auth/phone/send")
async def phone_send(body: PhoneIn, request: Request):
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "unknown")
    return await phone_auth.send_code(body.country_code, body.phone, ip)


@api.post("/auth/phone/verify")
async def phone_verify(body: PhoneCodeIn):
    """Sign in or sign up with a verified mobile number. Returns a Supabase session."""
    _require_db()
    e164 = await phone_auth.check_code(body.country_code, body.phone, body.code)
    result = await phone_auth.sign_in(e164)
    await _track(result["user"]["id"], "phone_signin", {"new": result["is_new"]})
    return result


@api.post("/auth/phone/link")
async def phone_link(body: PhoneCodeIn, user: dict = User):
    """Attach a verified number to the signed-in (email/Google) account."""
    _require_db()
    e164 = await phone_auth.check_code(body.country_code, body.phone, body.code)
    result = await phone_auth.link(user["id"], e164)
    supa_auth.forget_user(user["id"])
    await _track(user["id"], "phone_linked", {})
    return result


@api.get("/")
async def root():
    return {"app": "AstroNow", "status": "ok",
            "persistence": db.enabled(), "ai": config.AI_ENABLED}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=config.CORS_ORIGINS,
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def _startup():
    await db.init()


@app.on_event("shutdown")
async def _shutdown():
    await db.close()
