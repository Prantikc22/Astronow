"""Mobile-number sign-in with Message Central VerifyNow + Supabase Auth.

VerifyNow generates and checks the OTP itself, so it can't plug into Supabase's
SMS hook (which needs to send a Supabase-generated code). Instead:

1. /send asks VerifyNow to text a code and remembers the verification id.
2. /verify checks the code with VerifyNow, then finds the Supabase user that
   owns the number (or creates one with the number confirmed in auth.users).
3. A real Supabase session is minted with an admin-generated one-time sign-in
   token (no email is sent and no password is changed).

One account per phone number is enforced here; one account per email is
enforced by Supabase. Email/Google accounts attach a number through /link.
"""
from __future__ import annotations

import logging
import re
import secrets
import time
from typing import Optional

import httpx
from fastapi import HTTPException

import config
import db

logger = logging.getLogger("astronow.phone")

MC_BASE = config._get("MESSAGECENTRAL_BASE_URL", "https://cpaas.messagecentral.com").rstrip("/")
MC_CUSTOMER = config._get("MESSAGECENTRAL_CUSTOMER_ID", "")
MC_TOKEN = config._get("MESSAGECENTRAL_AUTH_TOKEN", "")
OTP_LENGTH = 6
_AUTH = f"{config.SUPABASE_URL}/auth/v1"
_ADMIN = {"apikey": config.SUPABASE_SERVICE_ROLE_KEY, "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
          "Content-Type": "application/json"}
_ANON = {"apikey": config.SUPABASE_ANON_KEY, "Content-Type": "application/json"}
# Synthetic, never-emailed address used only to mint sessions for phone-only accounts.
PHONE_EMAIL_DOMAIN = "phone.astronow.app"

_http = httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=8.0))

# Pending codes live in saved_items (under a system user id) so a code sent by
# one serverless instance verifies on another. Memory is the fallback when the
# database is off (local tests). The per-IP limit is per instance, best effort.
SYSTEM_USER = "00000000-0000-0000-0000-000000000000"
_pending: dict[str, dict] = {}        # e164 -> {verification_id, expires, attempts, sends}
_send_log: dict[str, list[float]] = {}  # rate-limit key -> send timestamps


async def _load(e164: str) -> Optional[dict]:
    if db.enabled():
        row = await db.one("saved_items", "payload", filters={"user_id": SYSTEM_USER, "kind": f"otp:{e164}"})
        return (row or {}).get("payload") or None
    return _pending.get(e164)


async def _save(e164: str, rec: dict) -> None:
    if db.enabled():
        kind = f"otp:{e164}"
        if await db.one("saved_items", "id", filters={"user_id": SYSTEM_USER, "kind": kind}):
            await db.update("saved_items", {"payload": rec}, filters={"user_id": SYSTEM_USER, "kind": kind})
        else:
            await db.insert("saved_items", {"user_id": SYSTEM_USER, "kind": kind, "payload": rec})
    else:
        _pending[e164] = rec


async def _clear(e164: str) -> None:
    """Spends the code but keeps the send history for rate limiting."""
    rec = await _load(e164)
    if rec:
        await _save(e164, {"sends": rec.get("sends", [])})


def configured() -> bool:
    return bool(MC_CUSTOMER and MC_TOKEN)


def normalize(country_code: str, number: str) -> tuple[str, str, str]:
    cc = re.sub(r"\D", "", country_code or "")
    digits = re.sub(r"\D", "", number or "").lstrip("0")
    if cc and digits.startswith(cc) and len(digits) > 10:
        digits = digits[len(cc):]
    if not cc or not (1 <= len(cc) <= 4) or not (6 <= len(digits) <= 14):
        raise HTTPException(422, "Enter a valid mobile number.")
    if cc == "91" and not re.fullmatch(r"[6-9]\d{9}", digits):
        raise HTTPException(422, "Enter a valid 10-digit Indian mobile number.")
    return cc, digits, f"+{cc}{digits}"


def _rate_limit(key: str, limit: int, window: float) -> None:
    now = time.time()
    hits = [t for t in _send_log.get(key, []) if now - t < window]
    if len(hits) >= limit:
        minutes = max(1, int((window - (now - hits[0])) // 60) + 1)
        raise HTTPException(429, f"Too many codes requested. Please try again in about {minutes} min.")
    hits.append(now)
    _send_log[key] = hits


async def send_code(country_code: str, number: str, client_ip: str) -> dict:
    if not configured():
        raise HTTPException(503, "Mobile sign-in is not configured on the server.")
    cc, digits, e164 = normalize(country_code, number)
    pending = await _load(e164) or {}
    now = time.time()
    if now - pending.get("sent_at", 0) < 30:
        raise HTTPException(429, "Please wait a few seconds before requesting another code.")
    sends = [t for t in pending.get("sends", []) if now - t < 3600]
    if len(sends) >= 5:
        minutes = max(1, int((3600 - (now - sends[0])) // 60) + 1)
        raise HTTPException(429, f"Too many codes requested. Please try again in about {minutes} min.")
    _rate_limit(f"ip:{client_ip}", 20, 3600)
    r = await _http.post(f"{MC_BASE}/verification/v3/send", headers={"authToken": MC_TOKEN}, params={
        "countryCode": cc, "customerId": MC_CUSTOMER, "flowType": "SMS", "mobileNumber": digits, "otpLength": OTP_LENGTH,
    })
    body = _json(r)
    data = body.get("data") or {}
    if r.status_code != 200 or not data.get("verificationId"):
        code = body.get("responseCode")
        logger.warning("VerifyNow send failed %s %s", r.status_code, str(body)[:200])
        if code == 506:  # an unexpired code already exists for this number
            raise HTTPException(429, "A code was just sent. Please use it or wait a minute to request another.")
        if code == 800:
            raise HTTPException(429, "Too many attempts for this number. Please try again later.")
        if code == 511:
            raise HTTPException(422, "This country code isn't supported yet.")
        raise HTTPException(502, "We couldn't send the code right now. Please try again.")
    timeout = int(str(data.get("timeout") or "60").split(".")[0] or 60)
    await _save(e164, {"verification_id": str(data["verificationId"]), "sent_at": now,
                       "expires": now + max(timeout, 60) + 240, "attempts": 0, "sends": sends + [now]})
    return {"sent": True, "phone": e164, "length": OTP_LENGTH, "resend_after": 30}


async def check_code(country_code: str, number: str, code: str) -> str:
    """Validates the OTP with VerifyNow. Returns the E.164 number on success."""
    _, _, e164 = normalize(country_code, number)
    pending = await _load(e164)
    if not pending or not pending.get("verification_id") or pending["expires"] < time.time():
        raise HTTPException(400, "This code has expired. Please request a new one.")
    if not re.fullmatch(r"\d{4,8}", code or ""):
        raise HTTPException(422, "Enter the code from the SMS.")
    pending["attempts"] += 1
    if pending["attempts"] > 5:
        await _clear(e164)
        raise HTTPException(429, "Too many wrong attempts. Please request a new code.")
    await _save(e164, pending)
    params = {"verificationId": pending["verification_id"], "code": code, "customerId": MC_CUSTOMER, "flowType": "SMS"}
    r = await _http.get(f"{MC_BASE}/verification/v3/validateOtp", headers={"authToken": MC_TOKEN}, params=params)
    if r.status_code == 405:
        r = await _http.post(f"{MC_BASE}/verification/v3/validateOtp", headers={"authToken": MC_TOKEN}, params=params)
    body = _json(r)
    status = (body.get("data") or {}).get("verificationStatus")
    code_num = body.get("responseCode")
    if r.status_code == 200 and status == "VERIFICATION_COMPLETED":
        await _clear(e164)
        return e164
    if code_num == 702:
        raise HTTPException(400, "That code isn't right. Please check and try again.")
    if code_num in (705, 505):
        await _clear(e164)
        raise HTTPException(400, "This code has expired. Please request a new one.")
    if code_num == 703:
        await _clear(e164)
        raise HTTPException(400, "This code was already used. Please request a new one.")
    logger.warning("VerifyNow validate failed %s %s", r.status_code, str(body)[:200])
    raise HTTPException(502, "We couldn't verify the code right now. Please try again.")


def _json(r: httpx.Response) -> dict:
    try:
        return r.json()
    except ValueError:
        return {}


# ----------------------------------------------------------------------------
# Supabase account resolution
# ----------------------------------------------------------------------------
def _kind(e164: str) -> str:
    return f"phone:{e164}"


async def owner_of(e164: str) -> Optional[str]:
    row = await db.one("saved_items", "user_id", filters={"kind": _kind(e164), "deleted_at": None})
    if row:
        return row["user_id"]
    # Numbers set outside this flow (dashboard, older data): look them up in auth.users.
    page = 1
    while page <= 20:
        r = await _http.get(f"{_AUTH}/admin/users", headers=_ADMIN, params={"page": page, "per_page": 500})
        users = (_json(r) or {}).get("users") or []
        for u in users:
            if u.get("phone") and f"+{u['phone'].lstrip('+')}" == e164:
                await _remember(e164, u["id"])
                return u["id"]
        if len(users) < 500:
            break
        page += 1
    return None


async def _remember(e164: str, user_id: str) -> None:
    await db.insert("saved_items", {"user_id": user_id, "kind": _kind(e164), "payload": {"phone": e164}})


async def _get_user(user_id: str) -> dict:
    r = await _http.get(f"{_AUTH}/admin/users/{user_id}", headers=_ADMIN)
    if r.status_code != 200:
        raise HTTPException(404, "Account not found.")
    return _json(r)


async def _set_phone(user_id: str, e164: str) -> None:
    """Stores the verified number on the Supabase user (auth.users.phone)."""
    r = await _http.put(f"{_AUTH}/admin/users/{user_id}", headers=_ADMIN,
                        json={"phone": e164.lstrip("+"), "phone_confirm": True, "user_metadata": {"phone": e164, "phone_verified": True}})
    if r.status_code not in (200, 201):
        # Some projects reject phone edits when the Phone provider is off; keep it in metadata instead.
        logger.warning("Setting auth phone failed (%s); storing in metadata", r.status_code)
        await _http.put(f"{_AUTH}/admin/users/{user_id}", headers=_ADMIN,
                        json={"user_metadata": {"phone": e164, "phone_verified": True}})


async def _create_phone_user(e164: str) -> str:
    email = f"{e164.lstrip('+')}.{secrets.token_hex(3)}@{PHONE_EMAIL_DOMAIN}"
    payload = {"email": email, "email_confirm": True, "phone": e164.lstrip("+"), "phone_confirm": True,
               "user_metadata": {"phone": e164, "phone_verified": True, "signup_method": "phone"}}
    r = await _http.post(f"{_AUTH}/admin/users", headers=_ADMIN, json=payload)
    if r.status_code not in (200, 201):
        text = r.text.lower()
        if "phone" in text and ("registered" in text or "exists" in text):
            raise HTTPException(409, "This number is already linked to an account.")
        payload.pop("phone"), payload.pop("phone_confirm")
        r = await _http.post(f"{_AUTH}/admin/users", headers=_ADMIN, json=payload)
        if r.status_code not in (200, 201):
            logger.error("Creating phone user failed %s %s", r.status_code, r.text[:200])
            raise HTTPException(502, "We couldn't create your account right now. Please try again.")
    user_id = _json(r)["id"]
    await _remember(e164, user_id)
    return user_id


async def _session_for(user_id: str) -> dict:
    """Mints a normal Supabase session via an admin one-time sign-in token."""
    user = await _get_user(user_id)
    email = user.get("email")
    if not email:
        raise HTTPException(409, "This account needs an email to sign in. Please contact support.")
    r = await _http.post(f"{_AUTH}/admin/generate_link", headers=_ADMIN, json={"type": "magiclink", "email": email})
    link = _json(r)
    token_hash = link.get("hashed_token") or (link.get("properties") or {}).get("hashed_token")
    if r.status_code != 200 or not token_hash:
        logger.error("generate_link failed %s %s", r.status_code, r.text[:200])
        raise HTTPException(502, "We couldn't sign you in right now. Please try again.")
    for verify_type in ("magiclink", "email"):
        v = await _http.post(f"{_AUTH}/verify", headers=_ANON, json={"type": verify_type, "token_hash": token_hash})
        session = _json(v)
        if v.status_code == 200 and session.get("access_token"):
            return {"access_token": session["access_token"], "refresh_token": session["refresh_token"],
                    "expires_in": session.get("expires_in", 3600), "user": {"id": user_id, "email": email}}
    logger.error("verify token_hash failed %s %s", v.status_code, v.text[:200])
    raise HTTPException(502, "We couldn't sign you in right now. Please try again.")


async def sign_in(e164: str) -> dict:
    user_id = await owner_of(e164)
    is_new = user_id is None
    if is_new:
        user_id = await _create_phone_user(e164)
    session = await _session_for(user_id)
    return {**session, "is_new": is_new, "phone": e164}


async def link(user_id: str, e164: str) -> dict:
    owner = await owner_of(e164)
    if owner and owner != user_id:
        raise HTTPException(409, "This number already has an AstroNow account. Sign out and log in with your mobile number instead.")
    if not owner:
        await _remember(e164, user_id)
    await _set_phone(user_id, e164)
    return {"linked": True, "phone": e164}


def is_phone_email(email: Optional[str]) -> bool:
    return bool(email and email.endswith("@" + PHONE_EMAIL_DOMAIN))
