"""Mobile sign-in: Message Central and Supabase calls are mocked."""
import asyncio
import json

import httpx
import pytest
from fastapi import HTTPException

import phone_auth


def run(coro):
    return asyncio.run(coro)


class FakeDB:
    def __init__(self):
        self.rows = []

    def enabled(self):
        return False  # pending codes stay in memory for these tests

    async def one(self, table, columns="*", *, filters=None):
        for r in self.rows:
            if r["kind"] == filters.get("kind") and r.get("deleted_at") is None:
                return r
        return None

    async def insert(self, table, values, **_):
        self.rows.append({**values, "deleted_at": None})


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    phone_auth._pending.clear()
    phone_auth._send_log.clear()
    monkeypatch.setattr(phone_auth, "MC_CUSTOMER", "C-TEST")
    monkeypatch.setattr(phone_auth, "MC_TOKEN", "tok")
    fake = FakeDB()
    monkeypatch.setattr(phone_auth, "db", fake)
    return fake


def mock_http(monkeypatch, handler):
    monkeypatch.setattr(phone_auth, "_http", httpx.AsyncClient(transport=httpx.MockTransport(handler)))


def test_normalize_indian_and_international():
    assert phone_auth.normalize("+91", "98765 43210") == ("91", "9876543210", "+919876543210")
    assert phone_auth.normalize("91", "919876543210")[2] == "+919876543210"
    assert phone_auth.normalize("1", "(415) 555-2671")[2] == "+14155552671"
    for bad in [("91", "12345"), ("91", "5876543210"), ("", "9876543210")]:
        with pytest.raises(HTTPException):
            phone_auth.normalize(*bad)


def test_send_then_verify_success(monkeypatch):
    def handler(req):
        if req.url.path.endswith("/send"):
            assert req.url.params["mobileNumber"] == "9876543210" and req.headers["authToken"] == "tok"
            return httpx.Response(200, json={"responseCode": 200, "data": {"verificationId": "4321", "timeout": "60"}})
        assert req.url.params["verificationId"] == "4321" and req.url.params["code"] == "123456"
        return httpx.Response(200, json={"responseCode": 200, "data": {"verificationStatus": "VERIFICATION_COMPLETED"}})
    mock_http(monkeypatch, handler)
    out = run(phone_auth.send_code("91", "9876543210", "1.1.1.1"))
    assert out["sent"] and out["phone"] == "+919876543210"
    assert run(phone_auth.check_code("91", "9876543210", "123456")) == "+919876543210"
    assert "verification_id" not in phone_auth._pending["+919876543210"]  # a code can't be reused


def test_wrong_code_and_attempt_limit(monkeypatch):
    mock_http(monkeypatch, lambda req: httpx.Response(400, json={"responseCode": 702}))
    phone_auth._pending["+919876543210"] = {"verification_id": "1", "sent_at": 0, "expires": 9e12, "attempts": 0}
    for _ in range(5):
        with pytest.raises(HTTPException) as e:
            run(phone_auth.check_code("91", "9876543210", "000000"))
        assert e.value.status_code == 400
    with pytest.raises(HTTPException) as e:
        run(phone_auth.check_code("91", "9876543210", "000000"))
    assert e.value.status_code == 429


def test_expired_or_missing_code():
    with pytest.raises(HTTPException) as e:
        run(phone_auth.check_code("91", "9876543210", "123456"))
    assert "expired" in e.value.detail


def test_resend_cooldown(monkeypatch):
    mock_http(monkeypatch, lambda req: httpx.Response(200, json={"responseCode": 200, "data": {"verificationId": "9"}}))
    run(phone_auth.send_code("91", "9876543210", "ip"))
    with pytest.raises(HTTPException) as e:
        run(phone_auth.send_code("91", "9876543210", "ip"))
    assert e.value.status_code == 429


def test_link_blocks_number_owned_by_another_account(fresh):
    fresh.rows.append({"user_id": "someone-else", "kind": "phone:+919876543210", "deleted_at": None})
    with pytest.raises(HTTPException) as e:
        run(phone_auth.link("me", "+919876543210"))
    assert e.value.status_code == 409


def test_new_number_creates_one_account_then_reuses_it(monkeypatch, fresh):
    created = []

    def handler(req):
        path = req.url.path
        if path.endswith("/admin/users") and req.method == "POST":
            body = json.loads(req.content)
            assert body["phone"] == "919876543210" and body["phone_confirm"] and body["email"].endswith("@phone.astronow.app")
            created.append(body)
            return httpx.Response(200, json={"id": "new-user", "email": body["email"]})
        if path.endswith("/admin/users") and req.method == "GET":
            return httpx.Response(200, json={"users": []})
        if "/admin/users/" in path:
            return httpx.Response(200, json={"id": "new-user", "email": created[0]["email"]})
        if path.endswith("/admin/generate_link"):
            return httpx.Response(200, json={"hashed_token": "h"})
        if path.endswith("/verify"):
            return httpx.Response(200, json={"access_token": "a", "refresh_token": "r", "expires_in": 3600})
        raise AssertionError(path)
    mock_http(monkeypatch, handler)
    first = run(phone_auth.sign_in("+919876543210"))
    assert first["is_new"] and first["access_token"] == "a"
    second = run(phone_auth.sign_in("+919876543210"))
    assert not second["is_new"] and len(created) == 1  # same number, same account
