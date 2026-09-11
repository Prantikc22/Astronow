"""Backend integration tests for Cosmic Clarity API.

Covers auth, onboarding, today/dasha/transits/chart/panchang/numerology,
geo, terminology, config, tarot, compatibility, vastu, entitlement, ask flow,
and free-tier paywall (402) enforcement.
"""
from __future__ import annotations

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://cosmic-clarity-11.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EXISTING_EMAIL = "cosmic.tester.2026@gmail.com"
EXISTING_PASSWORD = "Test12345!"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def existing_token(session):
    r = session.post(f"{API}/auth/login", json={"email": EXISTING_EMAIL, "password": EXISTING_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    return data["access_token"] if "access_token" in data else data.get("session", {}).get("access_token") or data.get("token") or data["access_token"]


@pytest.fixture(scope="session")
def auth_headers(existing_token):
    return {"Authorization": f"Bearer {existing_token}", "Content-Type": "application/json"}


# ---------- root / config / terminology ----------
def test_root(session):
    r = session.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j.get("status") == "ok"
    assert "persistence" in j and "ai" in j


def test_config(session):
    r = session.get(f"{API}/config", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert "revenuecat" in j and "ai_enabled" in j and "persistence_enabled" in j
    assert "free_chat_allowance" in j


@pytest.mark.parametrize("mode", ["simple", "traditional", "both"])
def test_terminology(session, mode):
    r = session.get(f"{API}/terminology", params={"mode": mode}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j["mode"] == mode
    assert isinstance(j.get("terms"), dict) and len(j["terms"]) > 0


# ---------- auth ----------
def test_login_existing(session):
    r = session.post(f"{API}/auth/login", json={"email": EXISTING_EMAIL, "password": EXISTING_PASSWORD}, timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert "user" in j
    assert j["user"]["email"].lower() == EXISTING_EMAIL


def test_auth_me(session, auth_headers):
    r = session.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j["user"]["email"].lower() == EXISTING_EMAIL
    assert j.get("onboarded") is True
    assert "entitlement" in j


def test_auth_me_no_token(session):
    r = session.get(f"{API}/auth/me", timeout=15)
    assert r.status_code in (401, 403)


# ---------- geocoding ----------
def test_geo_search(session):
    r = session.get(f"{API}/geo/search", params={"q": "New Delhi"}, timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert isinstance(j.get("results"), list)


# ---------- chart / today / etc ----------
def test_chart(session, auth_headers):
    r = session.get(f"{API}/chart", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert "chart" in j and "planets" in j["chart"]
    assert isinstance(j["chart"]["planets"], list) and len(j["chart"]["planets"]) >= 7


def test_today(session, auth_headers):
    r = session.get(f"{API}/today", headers=auth_headers, timeout=60)
    assert r.status_code == 200
    j = r.json()
    for k in ("greeting", "energy", "moon_today", "insight", "daily_tarot"):
        assert k in j, f"missing {k}"


def test_dasha(session, auth_headers):
    r = session.get(f"{API}/dasha", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert "current_mahadasha" in j or "mahadashas" in j or "periods" in j


def test_transits(session, auth_headers):
    r = session.get(f"{API}/transits", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert "transits" in j


def test_numerology(session, auth_headers):
    r = session.get(f"{API}/numerology", headers=auth_headers, timeout=30)
    assert r.status_code == 200


def test_panchang(session, auth_headers):
    r = session.get(f"{API}/panchang", headers=auth_headers, timeout=30)
    assert r.status_code == 200


# ---------- tarot ----------
def test_tarot_draw(session, auth_headers):
    r = session.post(f"{API}/tarot/draw", headers=auth_headers,
                     json={"spread": "one", "question": "reflection", "interpret": False}, timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert "cards" in j and len(j["cards"]) >= 1


# ---------- compatibility ----------
def test_compatibility(session, auth_headers):
    r = session.post(f"{API}/compatibility", headers=auth_headers, json={
        "name": "TEST_Partner", "relation": "partner",
        "dob": "1992-04-15", "birth_time": "10:30", "birth_time_known": True,
        "lat": 19.076, "lon": 72.8777, "tz_name": "Asia/Kolkata"
    }, timeout=45)
    assert r.status_code == 200
    j = r.json()
    assert "guna_milan" in j and "total" in j["guna_milan"]
    assert 0 <= j["guna_milan"]["total"] <= 36


# ---------- vastu ----------
def test_vastu_analyze(session, auth_headers):
    rooms = [
        {"room_type": "entrance", "x": 0.4, "y": 0.0, "width": 0.2, "height": 0.1},
        {"room_type": "kitchen", "x": 0.0, "y": 0.6, "width": 0.3, "height": 0.3},
        {"room_type": "bedroom", "x": 0.6, "y": 0.6, "width": 0.4, "height": 0.4},
    ]
    r = session.post(f"{API}/vastu/analyze", headers=auth_headers, json={
        "name": "TEST_Home", "rooms": rooms, "north_rotation": 0.0,
        "source": "draw", "save": False, "explain": False
    }, timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert "analysis" in j and "score" in j["analysis"]


# ---------- ask flow (may hit paywall if free quota used) ----------
def test_conversation_and_message(session, auth_headers):
    r = session.post(f"{API}/conversations", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    cid = r.json()["id"]
    assert cid

    # try a single message; accept 200 (AI reply) or 402 (free-tier paywall)
    r2 = session.post(f"{API}/conversations/{cid}/message", headers=auth_headers,
                      json={"content": "What is my current dasha period?"}, timeout=90)
    assert r2.status_code in (200, 402), f"unexpected {r2.status_code}: {r2.text[:200]}"
    if r2.status_code == 200:
        j = r2.json()
        assert "reply" in j and len(j["reply"]) > 0
    else:
        # 402 indicates paywall — verify payload structure
        assert "paywall" in r2.text.lower()


def test_conversation_list(session, auth_headers):
    r = session.get(f"{API}/conversations", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json().get("conversations"), list)


# ---------- entitlement ----------
def test_entitlement_read(session, auth_headers):
    r = session.get(f"{API}/entitlement", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert "tier" in j and "premium" in j


# ---------- signup smoke: junk domain may be accepted or rejected depending on Supabase settings ----------
def test_signup_smoke(session):
    email = f"junk_{uuid.uuid4().hex[:8]}@x.test"
    r = session.post(f"{API}/auth/signup", json={"email": email, "password": "TestPass123!", "first_name": "Junk"}, timeout=30)
    # Either supabase accepts (200) or rejects (>=400) — just ensure no 500
    assert r.status_code != 500, r.text[:200]
