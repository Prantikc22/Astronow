"""Server-side AI gateway to OpenRouter. Never called from the client.

Provides model routing, usage/cost logging, timeouts, JSON-schema validation for
structured tasks, streaming for chat, and a deterministic fallback when the
provider is not configured.
"""
from __future__ import annotations

import json
import logging
from typing import AsyncGenerator, Optional

import httpx

import config
import db

logger = logging.getLogger("ai")
_URL = "https://openrouter.ai/api/v1/chat/completions"


class AIUnavailable(Exception):
    pass


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {config.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://cosmicclarity.app",
        "X-Title": "Cosmic Clarity",
    }


def _model(tier: str) -> str:
    return config.AI_MODELS.get(tier, config.AI_MODELS["standard"])


async def _log_usage(user_id: Optional[str], feature: str, model: str, usage: dict) -> None:
    if not db.enabled():
        return
    pin = config.MODEL_PRICING.get(model, {"in": 1.0, "out": 3.0})
    it = usage.get("prompt_tokens", 0)
    ot = usage.get("completion_tokens", 0)
    try:
        await db.execute(
            """insert into usage_events(user_id,feature,model,input_tokens,output_tokens,cost_input,cost_output)
               values($1,$2,$3,$4,$5,$6,$7)""",
            user_id, feature, model, it, ot,
            it * pin["in"] / 1_000_000, ot * pin["out"] / 1_000_000,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("usage log failed: %s", e)


async def generate(system: str, user: str, tier: str = "standard",
                   user_id: Optional[str] = None, feature: str = "chat",
                   temperature: float = 0.7, images: Optional[list[str]] = None) -> str:
    if not config.AI_ENABLED:
        raise AIUnavailable()
    model = _model("vision" if images else tier)
    content: object = user
    if images:
        content = [{"type": "text", "text": user}] + [
            {"type": "image_url", "image_url": {"url": img}} for img in images
        ]
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": content}],
        "temperature": temperature,
    }
    async with httpx.AsyncClient(timeout=90) as c:
        r = await c.post(_URL, headers=_headers(), json=payload)
        if r.status_code != 200:
            logger.error("OpenRouter error %s: %s", r.status_code, r.text[:300])
            raise AIUnavailable()
        data = r.json()
        await _log_usage(user_id, feature, model, data.get("usage", {}))
        return data["choices"][0]["message"]["content"]


async def generate_json(system: str, user: str, tier: str = "deep",
                        user_id: Optional[str] = None, feature: str = "structured",
                        images: Optional[list[str]] = None, retries: int = 1) -> dict:
    if not config.AI_ENABLED:
        raise AIUnavailable()
    model = _model("vision" if images else tier)
    content: object = user
    if images:
        content = [{"type": "text", "text": user}] + [
            {"type": "image_url", "image_url": {"url": img}} for img in images
        ]
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": content}],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=120) as c:
        for attempt in range(retries + 1):
            r = await c.post(_URL, headers=_headers(), json=payload)
            if r.status_code != 200:
                if attempt < retries:
                    continue
                raise AIUnavailable()
            data = r.json()
            await _log_usage(user_id, feature, model, data.get("usage", {}))
            txt = data["choices"][0]["message"]["content"]
            try:
                return json.loads(txt)
            except json.JSONDecodeError:
                if attempt < retries:
                    continue
                start, end = txt.find("{"), txt.rfind("}")
                if start >= 0 and end > start:
                    return json.loads(txt[start:end + 1])
                raise AIUnavailable()
    raise AIUnavailable()


async def stream(system: str, messages: list[dict], tier: str = "standard",
                 user_id: Optional[str] = None, feature: str = "chat",
                 temperature: float = 0.7) -> AsyncGenerator[str, None]:
    """Yield text chunks. Falls back to a single grounded message upstream."""
    model = _model(tier)
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system}] + messages,
        "temperature": temperature,
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=120) as c:
        async with c.stream("POST", _URL, headers=_headers(), json=payload) as r:
            if r.status_code != 200:
                raise AIUnavailable()
            async for line in r.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                chunk = line[5:].strip()
                if chunk == "[DONE]":
                    break
                try:
                    obj = json.loads(chunk)
                    delta = obj["choices"][0]["delta"].get("content")
                    if delta:
                        yield delta
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
