"""Portable Postgres data layer (asyncpg). Works against any Postgres, incl.
Supabase. Gracefully disabled when DATABASE_URL is not configured so the
deterministic compute endpoints still work in preview."""
from __future__ import annotations

import logging
import ssl
from pathlib import Path
from typing import Any, Optional

import asyncpg

import config

logger = logging.getLogger("db")
_pool: Optional[asyncpg.Pool] = None

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


async def init() -> None:
    global _pool
    if not config.DB_ENABLED:
        logger.warning("DATABASE_URL not set; running in compute-only mode (no persistence).")
        return
    try:
        _pool = await asyncpg.create_pool(
            dsn=config.DATABASE_URL,
            ssl=_SSL_CTX,
            statement_cache_size=0,  # pgbouncer/supavisor compatible
            min_size=1,
            max_size=8,
            command_timeout=30,
        )
        await run_migrations()
        logger.info("Postgres pool ready and migrations applied.")
    except Exception as e:  # noqa: BLE001
        logger.error("DB init failed (%s); continuing in compute-only mode.", e)
        _pool = None


async def close() -> None:
    if _pool:
        await _pool.close()


def enabled() -> bool:
    return _pool is not None


async def run_migrations() -> None:
    if not _pool:
        return
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    async with _pool.acquire() as conn:
        await conn.execute(
            "CREATE TABLE IF NOT EXISTS _migrations (name text primary key, applied_at timestamptz default now())"
        )
        for f in files:
            done = await conn.fetchval("SELECT 1 FROM _migrations WHERE name=$1", f.name)
            if done:
                continue
            sql = f.read_text()
            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute("INSERT INTO _migrations(name) VALUES($1)", f.name)
            logger.info("Applied migration %s", f.name)


async def fetch(query: str, *args) -> list[dict]:
    if not _pool:
        return []
    async with _pool.acquire() as conn:
        rows = await conn.fetch(query, *args)
        return [dict(r) for r in rows]


async def fetchrow(query: str, *args) -> Optional[dict]:
    if not _pool:
        return None
    async with _pool.acquire() as conn:
        row = await conn.fetchrow(query, *args)
        return dict(row) if row else None


async def fetchval(query: str, *args) -> Any:
    if not _pool:
        return None
    async with _pool.acquire() as conn:
        return await conn.fetchval(query, *args)


async def execute(query: str, *args) -> str:
    if not _pool:
        return ""
    async with _pool.acquire() as conn:
        return await conn.execute(query, *args)
