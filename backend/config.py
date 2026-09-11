"""Environment configuration + server-side app defaults."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")


def _get(key: str, default: str = "") -> str:
    return os.environ.get(key, default) or default


SUPABASE_URL = _get("SUPABASE_URL").rstrip("/")
SUPABASE_ANON_KEY = _get("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = _get("SUPABASE_SERVICE_ROLE_KEY")
DATABASE_URL = _get("DATABASE_URL")

OPENROUTER_API_KEY = _get("OPENROUTER_API_KEY")
AI_MODELS = {
    "fast": _get("AI_MODEL_FAST", "openai/gpt-4o-mini"),
    "standard": _get("AI_MODEL_STANDARD", "openai/gpt-4o-mini"),
    "deep": _get("AI_MODEL_DEEP", "openai/gpt-4o"),
    "vision": _get("AI_MODEL_VISION", "openai/gpt-4o"),
}

GOOGLE_PLACES_API_KEY = _get("GOOGLE_PLACES_API_KEY")

REVENUECAT_IOS_API_KEY = _get("REVENUECAT_IOS_API_KEY")
REVENUECAT_ANDROID_API_KEY = _get("REVENUECAT_ANDROID_API_KEY")

FREE_CHAT_ALLOWANCE = int(_get("FREE_CHAT_ALLOWANCE", "3"))
FAIRUSE_DAILY_MESSAGES = int(_get("FAIRUSE_DAILY_MESSAGES", "200"))

DB_ENABLED = bool(DATABASE_URL)
AI_ENABLED = bool(OPENROUTER_API_KEY)

# Default app config (also overridable from the app_config DB table / admin).
DEFAULT_APP_CONFIG = {
    "feature_flags": {
        "vastu": True,
        "compatibility": True,
        "tarot": True,
        "numerology": True,
        "reports": True,
        "puja_commerce": False,
        "products_commerce": False,
        "lifetime_offer": True,
        "maintenance_mode": False,
    },
    "ai_models": AI_MODELS,
    "free_chat_allowance": FREE_CHAT_ALLOWANCE,
    "fairuse_daily_messages": FAIRUSE_DAILY_MESSAGES,
    "paywall": {
        "products": [
            {"id": "monthly", "period": "month", "recommended": False,
             "ref_price": {"INR": "\u20b9299", "USD": "$7.99"}},
            {"id": "annual", "period": "year", "recommended": True, "badge": "BEST VALUE",
             "ref_price": {"INR": "\u20b91,999", "USD": "$39.99"}},
            {"id": "founder_lifetime", "period": "lifetime", "badge": "FOUNDING OFFER",
             "ref_price": {"INR": "\u20b93,999", "USD": "$79.99"}},
        ],
    },
    # Entitlement tiers considered "premium".
    "premium_tiers": ["premium_monthly", "premium_annual", "founder_lifetime", "lifetime"],
}

# OpenRouter approximate pricing (USD per 1M tokens) for cost estimation.
MODEL_PRICING = {
    "openai/gpt-4o-mini": {"in": 0.15, "out": 0.60},
    "openai/gpt-4o": {"in": 2.50, "out": 10.0},
    "anthropic/claude-3.5-haiku": {"in": 0.80, "out": 4.0},
    "anthropic/claude-3.7-sonnet": {"in": 3.0, "out": 15.0},
}
