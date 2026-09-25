"""Supabase Data API persistence for AstroNow."""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, time
from typing import Any, Optional

import httpx

import config

logger = logging.getLogger("db")
_client: Optional[httpx.AsyncClient] = None


def _json(value: Any) -> Any:
    if isinstance(value, (date, datetime, time)):
        return value.isoformat()
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            pass
    return value


async def init() -> None:
    global _client
    if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
        logger.warning("Supabase Data API not configured; persistence is disabled.")
        return
    _client = httpx.AsyncClient(
        base_url=f"{config.SUPABASE_URL}/rest/v1",
        headers={"apikey": config.SUPABASE_SERVICE_ROLE_KEY,
                 "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
                 "Content-Type": "application/json"}, timeout=30)
    try:
        r = await _client.get("/profiles", params={"select": "user_id", "limit": "0"})
        r.raise_for_status()
        logger.info("Supabase Data API ready.")
    except Exception:
        await _client.aclose()
        _client = None
        logger.exception("Supabase Data API connection failed.")


async def close() -> None:
    global _client
    if _client:
        await _client.aclose()
        _client = None


def enabled() -> bool:
    return _client is not None


def _require() -> httpx.AsyncClient:
    if not _client:
        raise RuntimeError("Supabase Data API is not initialized")
    return _client


def _params(filters: Optional[dict[str, Any]]) -> list[tuple[str, str]]:
    out = []
    for key, value in (filters or {}).items():
        if isinstance(value, tuple):
            op, raw = value
            out.append((key, f"{op}.{raw}"))
        elif value is None:
            out.append((key, "is.null"))
        else:
            out.append((key, f"eq.{value}"))
    return out


async def select(table: str, columns: str = "*", *, filters: Optional[dict[str, Any]] = None,
                 order: Optional[str] = None, limit: Optional[int] = None) -> list[dict]:
    params = [("select", columns), *_params(filters)]
    if order:
        params.append(("order", order))
    if limit is not None:
        params.append(("limit", str(limit)))
    r = await _require().get(f"/{table}", params=params)
    r.raise_for_status()
    return r.json()


async def one(table: str, columns: str = "*", *, filters: Optional[dict[str, Any]] = None) -> Optional[dict]:
    rows = await select(table, columns, filters=filters, limit=1)
    return rows[0] if rows else None


async def insert(table: str, values: dict[str, Any], *, returning: bool = False,
                 upsert: bool = False, on_conflict: Optional[str] = None,
                 ignore_duplicates: bool = False) -> Optional[dict]:
    params = {"on_conflict": on_conflict} if on_conflict else None
    prefer = ["return=representation" if returning else "return=minimal"]
    if upsert:
        prefer.append("resolution=ignore-duplicates" if ignore_duplicates else "resolution=merge-duplicates")
    r = await _require().post(f"/{table}", params=params,
        json={k: _json(v) for k, v in values.items()}, headers={"Prefer": ",".join(prefer)})
    r.raise_for_status()
    if returning:
        rows = r.json()
        return rows[0] if rows else None
    return None


async def update(table: str, values: dict[str, Any], *, filters: dict[str, Any], returning: bool = False) -> list[dict]:
    r = await _require().patch(f"/{table}", params=_params(filters),
        json={k: _json(v) for k, v in values.items()},
        headers={"Prefer": "return=representation" if returning else "return=minimal"})
    r.raise_for_status()
    return r.json() if returning and r.content else []


async def delete(table: str, *, filters: dict[str, Any]) -> None:
    r = await _require().delete(f"/{table}", params=_params(filters))
    r.raise_for_status()


async def count(table: str, *, filters: Optional[dict[str, Any]] = None) -> int:
    r = await _require().get(f"/{table}", params=[("select", "*"), *_params(filters)],
        headers={"Prefer": "count=exact", "Range": "0-0"})
    r.raise_for_status()
    total = (r.headers.get("content-range") or "*/0").split("/")[-1]
    return int(total) if total.isdigit() else 0
