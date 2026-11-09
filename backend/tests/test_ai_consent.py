import asyncio

import pytest

import ai_gateway
import config


@pytest.fixture
def consent_db(monkeypatch):
    rows: dict[str, dict] = {}

    async def one(table, columns="*", *, filters=None):
        assert table == "saved_items" and filters["kind"] == "ai_consent"
        at = (rows.get(filters["user_id"]) or {}).get("ai_consent_at")
        return {"payload": {"granted_at": at}} if at else None

    monkeypatch.setattr(ai_gateway.db, "enabled", lambda: True)
    monkeypatch.setattr(ai_gateway.db, "one", one)
    monkeypatch.setattr(config, "AI_ENABLED", True)
    ai_gateway._consent_cache.clear()
    token = ai_gateway.consent_required.set(True)
    yield rows
    ai_gateway.consent_required.reset(token)


def test_no_consent_blocks_every_ai_call(consent_db):
    consent_db["u1"] = {"ai_consent_at": None}
    with pytest.raises(ai_gateway.AIUnavailable):
        asyncio.run(ai_gateway.generate("sys", "hi", user_id="u1"))
    with pytest.raises(ai_gateway.AIUnavailable):
        asyncio.run(ai_gateway.generate_json("sys", "hi", user_id="u1"))

    async def first_chunk():
        async for _ in ai_gateway.stream("sys", [{"role": "user", "content": "hi"}], user_id="u1"):
            break
    with pytest.raises(ai_gateway.AIUnavailable):
        asyncio.run(first_chunk())


def test_missing_profile_counts_as_no_consent(consent_db):
    with pytest.raises(ai_gateway.AIUnavailable):
        asyncio.run(ai_gateway._require_consent("nobody"))


def test_consent_allows_and_withdrawal_takes_effect(consent_db):
    consent_db["u2"] = {"ai_consent_at": "2026-11-09T10:00:00+00:00"}
    asyncio.run(ai_gateway._require_consent("u2"))
    consent_db["u2"] = {"ai_consent_at": None}
    ai_gateway.forget_consent("u2")
    with pytest.raises(ai_gateway.AIUnavailable):
        asyncio.run(ai_gateway._require_consent("u2"))


def test_builds_without_consent_screen_are_not_gated(consent_db):
    consent_db["u3"] = {"ai_consent_at": None}
    token = ai_gateway.consent_required.set(False)
    try:
        asyncio.run(ai_gateway._require_consent("u3"))
    finally:
        ai_gateway.consent_required.reset(token)
