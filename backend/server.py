"""Cosmic Clarity API — portable FastAPI layer over Supabase (Auth + Postgres),
the deterministic Vedic engine, and the OpenRouter AI gateway."""
from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime, time as dtime, timedelta, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

import ai_gateway
import config
import context_engine
import db
import geocode
import interpret
import prompts
import supa_auth
from astro import (compatibility, constants as C, dasha as dasha_mod, engine,
                   numerology as num_mod, panchang as panchang_mod, tarot as tarot_mod,
                   terminology, transits as transit_mod, vastu as vastu_mod)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("server")

app = FastAPI(title="Cosmic Clarity API")
api = APIRouter(prefix="/api")
User = Depends(supa_auth.require_user)
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "cosmic-admin-dev")
RC_SECRET = os.environ.get("REVENUECAT_SECRET_KEY", "")


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _parse_date(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def _parse_time(s: Optional[str]) -> Optional[dtime]:
    if not s:
        return None
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(s, fmt).time()
        except ValueError:
            continue
    return None


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


async def get_profile(user_id: str) -> Optional[dict]:
    return await db.fetchrow("select * from profiles where user_id=$1", user_id)


async def get_entitlement(user_id: str) -> dict:
    row = await db.fetchrow("select tier, source, expires_at from entitlements where user_id=$1", user_id)
    tier = (row or {}).get("tier", "free")
    premium = tier in config.DEFAULT_APP_CONFIG["premium_tiers"]
    exp = (row or {}).get("expires_at")
    if premium and exp and exp < datetime.now(timezone.utc):
        premium, tier = False, "free"
    return {"tier": tier, "premium": premium, "source": (row or {}).get("source")}


async def load_chart(user_id: str) -> Optional[dict]:
    row = await db.fetchrow("select chart, dasha, numerology from birth_charts where user_id=$1", user_id)
    if not row:
        return None
    return {
        "chart": row["chart"] if isinstance(row["chart"], dict) else json.loads(row["chart"]),
        "dasha": (row["dasha"] if isinstance(row["dasha"], dict) else json.loads(row["dasha"])) if row["dasha"] else None,
        "numerology": (row["numerology"] if isinstance(row["numerology"], dict) else json.loads(row["numerology"])) if row["numerology"] else None,
    }


def _require_db():
    if not db.enabled():
        raise HTTPException(503, "Persistence is not configured yet. Add DATABASE_URL to enable accounts and saving.")


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
        await db.execute(
            "insert into profiles(user_id, first_name) values($1,$2) on conflict (user_id) do nothing",
            session["user"]["id"], body.first_name,
        )
        await db.execute(
            "insert into entitlements(user_id, tier, source) values($1,'free','signup') on conflict (user_id) do nothing",
            session["user"]["id"],
        )
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
        now = datetime.now(timezone.utc)
        for tbl in ("saved_profiles", "conversations", "tarot_readings", "vastu_homes",
                    "compatibility_reports", "saved_items"):
            await db.execute(f"update {tbl} set deleted_at=$1 where user_id=$2 and deleted_at is null", now, uid)
        await db.execute("delete from birth_charts where user_id=$1", uid)
        await db.execute("delete from messages where user_id=$1", uid)
        await db.execute("delete from profiles where user_id=$1", uid)
    await supa_auth.delete_user(uid)
    return {"deleted": True}


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
    language: str = "en"


@api.post("/onboarding")
async def onboarding(body: OnboardIn, user: dict = User):
    _require_db()
    dob = _parse_date(body.dob)
    t = _parse_time(body.birth_time) if body.birth_time_known else None
    tz_name = body.tz_name or geocode.tz_name_for(body.lat, body.lon) or "UTC"
    tz_offset = geocode.tz_offset_hours(tz_name, dob, t)
    full = compute_full(dob, t, body.lat, body.lon, tz_offset, body.birth_time_known, body.first_name)

    await db.execute(
        """insert into profiles(user_id,first_name,dob,birth_time,birth_time_known,birthplace,lat,lon,
             tz_offset,tz_name,gender,relationship_status,interests,terminology_mode,language,onboarded,updated_at)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,now())
           on conflict (user_id) do update set first_name=$2,dob=$3,birth_time=$4,birth_time_known=$5,
             birthplace=$6,lat=$7,lon=$8,tz_offset=$9,tz_name=$10,gender=$11,relationship_status=$12,
             interests=$13,terminology_mode=$14,language=$15,onboarded=true,updated_at=now()""",
        user["id"], body.first_name, dob, t, body.birth_time_known, body.birthplace, body.lat, body.lon,
        tz_offset, tz_name, body.gender, body.relationship_status, json.dumps(body.interests),
        body.terminology_mode, body.language,
    )
    await db.execute(
        """insert into birth_charts(user_id,chart,dasha,numerology,computed_at)
           values($1,$2,$3,$4,now())
           on conflict (user_id) do update set chart=$2,dasha=$3,numerology=$4,computed_at=now()""",
        user["id"], json.dumps(full["chart"]), json.dumps(full["dasha"]), json.dumps(full["numerology"]),
    )
    await _track(user["id"], "onboarding_completed", {"interests": body.interests})
    return {"profile": await get_profile(user["id"]), **full}


class ProfilePatch(BaseModel):
    terminology_mode: Optional[str] = None
    language: Optional[str] = None
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
    await db.execute(f"update profiles set {', '.join(sets)}, updated_at=now() where user_id=$1", user["id"], *vals)
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
    return {k: {"value": v, "label": labels[v]} for k, v in scores.items()}


@api.get("/today")
async def today(user: dict = User):
    _require_db()
    data = await load_chart(user["id"])
    if not data:
        raise HTTPException(404, "Complete onboarding first.")
    profile = await get_profile(user["id"])
    chart, dashas = data["chart"], data["dasha"]
    tr = transit_mod.compute_transits(chart)
    pan = None
    if profile and profile.get("lat") is not None:
        pan = panchang_mod.compute_panchang(
            date.today(), profile["lat"], profile["lon"], profile.get("tz_offset") or 0.0)
    name = profile.get("first_name") if profile else None

    try:
        ctx = {"transits": tr, "dasha": dashas, "panchang": pan}
        insight = await ai_gateway.generate(
            prompts.SYSTEM_PROMPT,
            prompts.daily_insight_prompt(name or "friend", profile.get("terminology_mode", "both"))
            + "\n\nCONTEXT:\n" + json.dumps(ctx, default=str),
            tier="fast", user_id=user["id"], feature="today_insight",
        )
    except ai_gateway.AIUnavailable:
        insight = interpret.daily_insight(name, chart, tr, dashas)

    hour = datetime.now(timezone.utc).hour
    greeting = "Good morning" if 5 <= hour < 12 else "Good afternoon" if 12 <= hour < 17 else "Good evening"
    md = dashas.get("current_mahadasha") or {}
    daily_tarot = tarot_mod.draw("one", seed=int(date.today().strftime("%Y%m%d")))
    await _track(user["id"], "today_viewed", {})
    return {
        "greeting": greeting,
        "name": name,
        "date": date.today().isoformat(),
        "energy": _energy_meter(tr),
        "moon_today": tr["moon_today"],
        "current_period": {"mahadasha": md.get("lord"),
                           "antardasha": (dashas.get("current_antardasha") or {}).get("lord")},
        "insight": insight,
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


@api.get("/config")
async def get_config():
    cfg = dict(config.DEFAULT_APP_CONFIG)
    if db.enabled():
        rows = await db.fetch("select key, value from app_config")
        for r in rows:
            cfg[r["key"]] = r["value"]
    cfg["revenuecat"] = {
        "ios_key": config.REVENUECAT_IOS_API_KEY,
        "android_key": config.REVENUECAT_ANDROID_API_KEY,
    }
    cfg["ai_enabled"] = config.AI_ENABLED
    cfg["persistence_enabled"] = db.enabled()
    cfg.pop("premium_tiers", None)
    return cfg


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
        await db.execute(
            "insert into tarot_readings(user_id,spread,cards,note,interpretation) values($1,$2,$3,$4,$5)",
            user["id"], body.spread, json.dumps(reading["cards"]), body.question, interpretation)
    await _track(user["id"], "tarot_completed", {"spread": body.spread})
    return {**reading, "interpretation": interpretation}


@api.get("/tarot/history")
async def tarot_history(user: dict = User):
    _require_db()
    rows = await db.fetch(
        "select id,spread,cards,note,interpretation,created_at from tarot_readings "
        "where user_id=$1 and deleted_at is null order by created_at desc limit 50", user["id"])
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
                f"Compatibility (Guna Milan) score {result['total']}/36 ({result['verdict']}). "
                f"Kootas: {json.dumps(result['kootas'])}. Give a warm, balanced 3-paragraph overview of "
                f"emotional compatibility, communication, and areas needing attention. Never tell them to "
                f"marry or divorce. Person A moon {mine['chart']['moon_sign']}, Person B moon {partner['chart']['moon_sign']}.",
                tier="deep", user_id=user["id"], feature="compatibility")
        except ai_gateway.AIUnavailable:
            overview = None
    await db.execute(
        "insert into compatibility_reports(user_id,partner_name,relation,result) values($1,$2,$3,$4)",
        user["id"], body.name, body.relation, json.dumps({**result, "partner_moon": partner["chart"]["moon_sign"]}))
    await _track(user["id"], "compatibility_started", {"verdict": result["verdict"]})
    return {
        "guna_milan": result,
        "partner_moon_sign": partner["chart"]["moon_sign"],
        "premium": ent["premium"],
        "overview": overview,
        "locked": not ent["premium"],
    }


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
        home_id = await db.fetchval(
            "insert into vastu_homes(user_id,name,rooms,north_rotation,analysis,source) "
            "values($1,$2,$3,$4,$5,$6) returning id",
            user["id"], body.name, json.dumps(body.rooms), body.north_rotation,
            json.dumps(analysis), body.source)
    await _track(user["id"], "vastu_completed", {"score": analysis["score"], "source": body.source})
    return {"id": str(home_id) if home_id else None, "analysis": analysis,
            "advice": advice, "premium": ent.get("premium", False)}


@api.get("/vastu/homes")
async def vastu_homes(user: dict = User):
    _require_db()
    rows = await db.fetch(
        "select id,name,rooms,north_rotation,analysis,source,created_at from vastu_homes "
        "where user_id=$1 and deleted_at is null order by created_at desc", user["id"])
    return {"homes": rows}


@api.delete("/vastu/homes/{home_id}")
async def vastu_delete(home_id: str, user: dict = User):
    _require_db()
    await db.execute("update vastu_homes set deleted_at=now() where id=$1 and user_id=$2", home_id, user["id"])
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
    rows = await db.fetch(
        "select id,title,summary,updated_at from conversations "
        "where user_id=$1 and deleted_at is null order by updated_at desc", user["id"])
    return {"conversations": rows}


@api.post("/conversations")
async def create_conversation(user: dict = User):
    _require_db()
    cid = await db.fetchval(
        "insert into conversations(user_id) values($1) returning id", user["id"])
    await _track(user["id"], "ask_started", {})
    return {"id": str(cid), "title": "New conversation"}


@api.get("/conversations/{cid}/messages")
async def conversation_messages(cid: str, user: dict = User):
    _require_db()
    convo = await db.fetchrow("select id,title,summary from conversations where id=$1 and user_id=$2", cid, user["id"])
    if not convo:
        raise HTTPException(404, "Conversation not found.")
    rows = await db.fetch(
        "select id,role,content,created_at from messages where conversation_id=$1 order by created_at", cid)
    return {"conversation": convo, "messages": rows}


@api.delete("/conversations/{cid}")
async def delete_conversation(cid: str, user: dict = User):
    _require_db()
    await db.execute("update conversations set deleted_at=now() where id=$1 and user_id=$2", cid, user["id"])
    return {"deleted": True}


async def _check_fair_use(user_id: str) -> None:
    ent = await get_entitlement(user_id)
    cfg = await get_config()
    if not ent["premium"]:
        used = await db.fetchval(
            "select count(*) from messages where user_id=$1 and role='user'", user_id) or 0
        if used >= cfg.get("free_chat_allowance", config.FREE_CHAT_ALLOWANCE):
            raise HTTPException(402, json.dumps({"paywall": True,
                "reason": "You've used your complimentary questions. Subscribe for ongoing guidance."}))
    else:
        since = datetime.now(timezone.utc) - timedelta(days=1)
        today_count = await db.fetchval(
            "select count(*) from messages where user_id=$1 and role='user' and created_at>$2",
            user_id, since) or 0
        if today_count >= cfg.get("fairuse_daily_messages", config.FAIRUSE_DAILY_MESSAGES):
            raise HTTPException(429, "Daily fair-use limit reached. Please continue tomorrow.")


async def _assemble_context(user_id: str, question: str) -> tuple[dict, dict]:
    data = await load_chart(user_id)
    if not data:
        raise HTTPException(404, "Complete onboarding first.")
    profile = await get_profile(user_id)
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
    await db.execute(
        "insert into messages(conversation_id,user_id,role,content,topic) values($1,$2,'user',$3,$4)",
        cid, user["id"], body.content, ctx["topic"])
    history = await db.fetch(
        "select role,content from messages where conversation_id=$1 order by created_at desc limit 8", cid)
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
    await db.execute(
        "insert into messages(conversation_id,user_id,role,content) values($1,$2,'assistant',$3)",
        cid, user["id"], reply)
    await db.execute("update conversations set updated_at=now() where id=$1", cid)
    await _maybe_title(cid, body.content)
    await _track(user["id"], "message_sent", {"topic": ctx["topic"]})
    return {"reply": reply, "topic": ctx["topic"]}


@api.post("/ask/stream")
async def ask_stream(cid: str, body: MessageIn, user: dict = User):
    _require_db()
    await _check_fair_use(user["id"])
    ctx, _ = await _assemble_context(user["id"], body.content)
    await db.execute(
        "insert into messages(conversation_id,user_id,role,content,topic) values($1,$2,'user',$3,$4)",
        cid, user["id"], body.content, ctx["topic"])
    history = await db.fetch(
        "select role,content from messages where conversation_id=$1 order by created_at desc limit 8", cid)
    msgs = [{"role": m["role"], "content": m["content"]} for m in reversed(history)]
    msgs.insert(0, {"role": "user", "content": "CONTEXT:\n" + json.dumps(ctx, default=str)})

    async def gen():
        parts: list[str] = []
        try:
            async for chunk in ai_gateway.stream(prompts.SYSTEM_PROMPT, msgs, tier="standard",
                                                  user_id=user["id"], feature="chat"):
                parts.append(chunk)
                yield chunk
        except ai_gateway.AIUnavailable:
            fallback = interpret.chat_reply(body.content, ctx)
            parts.append(fallback)
            yield fallback
        reply = "".join(parts)
        await db.execute(
            "insert into messages(conversation_id,user_id,role,content) values($1,$2,'assistant',$3)",
            cid, user["id"], reply)
        await db.execute("update conversations set updated_at=now() where id=$1", cid)

    return StreamingResponse(gen(), media_type="text/plain")


async def _maybe_title(cid: str, first_msg: str) -> None:
    convo = await db.fetchrow("select title from conversations where id=$1", cid)
    if convo and convo["title"] == "New conversation":
        title = first_msg.strip()[:40] + ("…" if len(first_msg) > 40 else "")
        await db.execute("update conversations set title=$1 where id=$2", title, cid)


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
    _require_db()
    tier, source, expires = body.tier, body.source, body.expires_at
    # Server-side verification when a RevenueCat secret key is configured.
    if RC_SECRET and body.rc_customer_id:
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                r = await c.get(f"https://api.revenuecat.com/v1/subscribers/{body.rc_customer_id}",
                                headers={"Authorization": f"Bearer {RC_SECRET}"})
                if r.status_code == 200:
                    ents = r.json().get("subscriber", {}).get("entitlements", {})
                    tier, expires = _tier_from_rc(ents)
                    source = "revenuecat_verified"
        except Exception as e:  # noqa: BLE001
            logger.warning("RC verify failed: %s", e)
    exp_dt = datetime.fromisoformat(expires.replace("Z", "+00:00")) if expires else None
    await db.execute(
        """insert into entitlements(user_id,tier,source,rc_customer_id,expires_at,updated_at)
           values($1,$2,$3,$4,$5,now())
           on conflict (user_id) do update set tier=$2,source=$3,rc_customer_id=$4,expires_at=$5,updated_at=now()""",
        user["id"], tier, source, body.rc_customer_id, exp_dt)
    await _track(user["id"], "purchase_completed", {"tier": tier})
    return await get_entitlement(user["id"])


def _tier_from_rc(entitlements: dict) -> tuple[str, Optional[str]]:
    for name in ("founder_lifetime", "lifetime", "premium_annual", "premium_monthly", "premium"):
        ent = entitlements.get(name)
        if ent and ent.get("expires_date") is None:
            return ("lifetime" if "lifetime" in name else name), None
        if ent:
            return (name if name != "premium" else "premium_monthly"), ent.get("expires_date")
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
            await db.execute("insert into analytics_events(user_id,name,props) values($1,$2,$3)",
                             user_id, name, json.dumps(props))
        except Exception:  # noqa: BLE001
            pass


@api.post("/analytics")
async def analytics(body: AnalyticsIn, user: dict = User):
    await _track(user["id"], body.name, body.props)
    return {"ok": True}


def _admin(token: Optional[str]) -> None:
    if token != ADMIN_TOKEN:
        raise HTTPException(403, "Admin authorization required.")


@api.get("/admin/stats")
async def admin_stats(x_admin_token: Optional[str] = Query(None, alias="admin_token")):
    _admin(x_admin_token)
    if not db.enabled():
        return {"persistence": False}
    users = await db.fetchval("select count(*) from profiles") or 0
    paid = await db.fetchval(
        "select count(*) from entitlements where tier <> 'free'") or 0
    since_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today = datetime.now(timezone.utc) - timedelta(days=1)
    cost_today = await db.fetchval(
        "select coalesce(sum(cost_input+cost_output),0) from usage_events where created_at>$1", today) or 0
    cost_month = await db.fetchval(
        "select coalesce(sum(cost_input+cost_output),0) from usage_events where created_at>$1", since_month) or 0
    chats = await db.fetchval("select count(*) from messages where role='user'") or 0
    vastu = await db.fetchval("select count(*) from vastu_homes") or 0
    dau = await db.fetchval(
        "select count(distinct user_id) from analytics_events where created_at>$1", today) or 0
    return {
        "persistence": True, "users": users, "paid_users": paid, "dau": dau,
        "ai_cost_today_usd": round(float(cost_today), 4), "ai_cost_month_usd": round(float(cost_month), 4),
        "chats": chats, "vastu_analyses": vastu,
        "cost_per_paid_user": round(float(cost_month) / paid, 4) if paid else 0,
    }


@api.get("/")
async def root():
    return {"app": "Cosmic Clarity", "status": "ok",
            "persistence": db.enabled(), "ai": config.AI_ENABLED}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def _startup():
    await db.init()


@app.on_event("shutdown")
async def _shutdown():
    await db.close()
