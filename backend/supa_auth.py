"""Supabase Auth (GoTrue) integration. Portable: pure REST against Supabase.

Signup creates an email-confirmed user via the service-role admin API, then
issues a password-grant session, so login works immediately without an email
round-trip. Token verification calls GoTrue /user (cached) since the project's
JWT secret is not exposed to the server.
"""
from __future__ import annotations

import time
from typing import Optional

import httpx
from fastapi import Header, HTTPException

import config

_BASE = f"{config.SUPABASE_URL}/auth/v1"
_ANON_HEADERS = {"apikey": config.SUPABASE_ANON_KEY, "Content-Type": "application/json"}
_ADMIN_HEADERS = {
    "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}

# token -> (user dict, expiry epoch)
_token_cache: dict[str, tuple[dict, float]] = {}
_CACHE_TTL = 300


async def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=25)


async def signup(email: str, password: str, first_name: str | None = None) -> dict:
    async with await _client() as c:
        # Create a confirmed user (idempotent-ish: 422 if exists).
        r = await c.post(
            f"{_BASE}/admin/users",
            headers=_ADMIN_HEADERS,
            json={
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"first_name": first_name} if first_name else {},
            },
        )
        if r.status_code not in (200, 201):
            detail = r.json().get("msg") or r.text
            if "already been registered" in detail or r.status_code == 422:
                raise HTTPException(409, "An account with this email already exists.")
            raise HTTPException(400, f"Signup failed: {detail}")
        return await login(email, password)


async def login(email: str, password: str) -> dict:
    async with await _client() as c:
        r = await c.post(
            f"{_BASE}/token?grant_type=password",
            headers=_ANON_HEADERS,
            json={"email": email, "password": password},
        )
        if r.status_code != 200:
            raise HTTPException(401, "Invalid email or password.")
        data = r.json()
        return {
            "access_token": data["access_token"],
            "refresh_token": data["refresh_token"],
            "expires_in": data.get("expires_in", 3600),
            "user": {
                "id": data["user"]["id"],
                "email": data["user"]["email"],
            },
        }


async def refresh(refresh_token: str) -> dict:
    async with await _client() as c:
        r = await c.post(
            f"{_BASE}/token?grant_type=refresh_token",
            headers=_ANON_HEADERS,
            json={"refresh_token": refresh_token},
        )
        if r.status_code != 200:
            raise HTTPException(401, "Session expired. Please sign in again.")
        data = r.json()
        return {
            "access_token": data["access_token"],
            "refresh_token": data["refresh_token"],
            "expires_in": data.get("expires_in", 3600),
        }


async def get_user_from_token(token: str) -> dict:
    now = time.time()
    cached = _token_cache.get(token)
    if cached and cached[1] > now:
        return cached[0]
    async with await _client() as c:
        r = await c.get(
            f"{_BASE}/user",
            headers={"apikey": config.SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"},
        )
        if r.status_code != 200:
            raise HTTPException(401, "Not authenticated.")
        u = r.json()
        user = {"id": u["id"], "email": u.get("email"),
                "first_name": (u.get("user_metadata") or {}).get("first_name")}
        _token_cache[token] = (user, now + _CACHE_TTL)
        return user


async def delete_user(user_id: str) -> None:
    async with await _client() as c:
        await c.delete(f"{_BASE}/admin/users/{user_id}", headers=_ADMIN_HEADERS)
    for tok in [t for t, v in _token_cache.items() if v[0]["id"] == user_id]:
        _token_cache.pop(tok, None)


async def require_user(authorization: Optional[str] = Header(None)) -> dict:
    """FastAPI dependency: resolve the authenticated Supabase user."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing authentication token.")
    token = authorization.split(" ", 1)[1].strip()
    return await get_user_from_token(token)
