"""Deterministic, data-grounded interpretation fallback.

Used when the AI provider is not configured so the app is never blank or
random. Every sentence is derived from real calculated data, never invented.
When OpenRouter is configured the gateway prefers the LLM for richer prose.
"""
from __future__ import annotations

PLANET_THEME = {
    "Sun": "identity, vitality and confidence",
    "Moon": "emotions, comfort and the inner world",
    "Mars": "drive, courage and action",
    "Mercury": "communication, thinking and learning",
    "Jupiter": "growth, wisdom and opportunity",
    "Venus": "love, harmony and pleasure",
    "Saturn": "discipline, patience and responsibility",
    "Rahu": "ambition, obsession and unconventional paths",
    "Ketu": "detachment, spirituality and letting go",
}

SIGN_QUALITY = {
    "Aries": "bold and initiating", "Taurus": "steady and grounded",
    "Gemini": "curious and communicative", "Cancer": "nurturing and sensitive",
    "Leo": "expressive and warm", "Virgo": "precise and service-minded",
    "Libra": "balanced and relational", "Scorpio": "intense and transformative",
    "Sagittarius": "expansive and philosophical", "Capricorn": "disciplined and ambitious",
    "Aquarius": "innovative and independent", "Pisces": "imaginative and compassionate",
}

HOUSE_AREA = {
    1: "your sense of self", 2: "resources and speech", 3: "courage and effort",
    4: "home and inner peace", 5: "creativity and romance", 6: "work and health",
    7: "partnership", 8: "transformation and shared resources", 9: "beliefs and fortune",
    10: "career and reputation", 11: "gains and community", 12: "rest and release",
}


def daily_insight(name: str, chart: dict, transits: dict, dasha: dict | None) -> str:
    moon = transits.get("moon_today", {})
    md = (dasha or {}).get("current_mahadasha") or {}
    lord = md.get("lord")
    parts = []
    greeting = f"{name}, " if name else ""
    if moon:
        parts.append(
            f"{greeting}the Moon is moving through {moon.get('sign')} "
            f"({moon.get('nakshatra')}) today, a {moon.get('phase','').lower()} phase — "
            f"a good moment for {SIGN_QUALITY.get(moon.get('sign'),'reflection')} energy."
        )
    if lord:
        parts.append(
            f"You are in your {lord} major life period, which traditionally emphasizes "
            f"{PLANET_THEME.get(lord,'important life themes')}. Let today's choices honour that."
        )
    sat = next((t for t in transits.get("transits", []) if t["planet"] == "Saturn"), None)
    if sat:
        parts.append(
            f"Saturn is transiting your {_ordinal(sat['house_from_moon'])} house from the Moon — "
            f"one way Vedic astrology reads this is a call toward patience around "
            f"{HOUSE_AREA.get(sat['house_from_moon'],'your path')}."
        )
    return "\n\n".join(parts) or "Your chart is ready. Explore it below to begin."


def planet_meaning(planet: dict, terminology: str = "both") -> dict:
    name = planet["name"]
    return {
        "summary": (
            f"{name} sits in {planet['sign']} in your {_ordinal(planet['house']) if planet['house'] else 'chart'}, "
            f"in the star {planet['nakshatra']}. This colours {PLANET_THEME.get(name,'key themes')} "
            f"with a {SIGN_QUALITY.get(planet['sign'],'distinct')} tone."
        ),
        "strengths": f"{name} here can support {HOUSE_AREA.get(planet['house'],'your growth') if planet['house'] else 'your growth'}.",
        "challenges": (
            f"When under pressure, this placement may over-express "
            f"{PLANET_THEME.get(name,'its themes')} — awareness helps balance it."
        ),
    }


def dasha_meaning(lord: str) -> str:
    return (
        f"The {lord} period traditionally brings focus to {PLANET_THEME.get(lord,'life lessons')}. "
        f"It is a chapter for working consciously with these themes rather than against them."
    )


def chat_reply(question: str, context: dict) -> str:
    natal = context.get("natal", {})
    period = context.get("current_period", {})
    topic = context.get("topic", "general")
    name = context.get("profile", {}).get("name") or "there"
    lines = [
        f"Thank you for asking, {name}. Here is how Vedic astrology might reflect on this.",
    ]
    if natal.get("moon_sign"):
        lines.append(
            f"Your Moon in {natal['moon_sign']} ({natal.get('moon_nakshatra')}) shapes how you "
            f"experience this — a {SIGN_QUALITY.get(natal['moon_sign'],'thoughtful')} emotional nature."
        )
    rel = natal.get("relevant_placements", [])
    if rel:
        p = rel[0]
        lines.append(
            f"For {topic}, your {p['planet']} in {p['sign']} "
            f"({_ordinal(p['house']) if p['house'] else 'chart'}) is worth noticing; it may emphasize "
            f"{PLANET_THEME.get(p['planet'],'meaningful themes')} in this area."
        )
    if period.get("mahadasha"):
        lines.append(
            f"You are in your {period['mahadasha']} major period"
            + (f" with a {period['antardasha']} sub-period" if period.get("antardasha") else "")
            + f", which traditionally highlights {PLANET_THEME.get(period['mahadasha'],'growth')}."
        )
    lines.append(
        "This is offered as reflection rather than certainty — trust your own judgement, "
        "and seek a qualified professional for medical, legal or financial decisions."
    )
    return "\n\n".join(lines)


def _ordinal(n) -> str:
    if not n:
        return ""
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"
