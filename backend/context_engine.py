"""Context-selection layer: builds a compact, relevant slice of the user's
astrology data for a question, instead of sending the whole database to the model."""
from __future__ import annotations

TOPIC_KEYWORDS = {
    "love": ["love", "relationship", "partner", "romance", "crush", "dating", "ex"],
    "marriage": ["marriage", "marry", "wedding", "spouse", "husband", "wife"],
    "career": ["career", "job", "work", "promotion", "business", "profession"],
    "money": ["money", "finance", "wealth", "income", "salary", "debt", "invest"],
    "family": ["family", "mother", "father", "children", "parents", "home", "sibling"],
    "health": ["health", "wellbeing", "energy", "body", "stress", "sleep"],
    "growth": ["growth", "purpose", "spiritual", "meaning", "self", "peace"],
    "timing": ["when", "timing", "date", "muhurat", "auspicious", "should i"],
}

TOPIC_HOUSES = {
    "love": [5, 7], "marriage": [7, 2, 8], "career": [10, 6, 1],
    "money": [2, 11, 9], "family": [4, 2, 3], "health": [1, 6, 8],
    "growth": [9, 12, 1], "timing": [1],
}


def detect_topic(question: str) -> str:
    q = question.lower()
    for topic, words in TOPIC_KEYWORDS.items():
        if any(w in q for w in words):
            return topic
    return "general"


def build_context(question: str, chart: dict, dasha: dict | None,
                  transits: dict | None, panchang: dict | None,
                  profile: dict, summary: str | None) -> dict:
    topic = detect_topic(question)
    houses = TOPIC_HOUSES.get(topic, [1, 10, 7])

    relevant_planets = []
    for p in chart.get("planets", []):
        if p.get("house") in houses or p["name"] in ("Sun", "Moon"):
            relevant_planets.append({
                "planet": p["name"], "sign": p["sign"], "house": p["house"],
                "nakshatra": p["nakshatra"], "retrograde": p["retrograde"],
                "degree": p["degree_dms"],
            })

    ctx = {
        "topic": topic,
        "profile": {
            "name": profile.get("first_name"),
            "terminology": profile.get("terminology_mode", "both"),
            "birth_time_known": chart.get("birth_time_known", True),
        },
        "natal": {
            "lagna": chart.get("lagna", {}).get("sign") if chart.get("lagna") else None,
            "moon_sign": chart.get("moon_sign"),
            "moon_nakshatra": chart.get("moon_nakshatra"),
            "sun_sign": chart.get("sun_sign"),
            "relevant_placements": relevant_planets,
            "yogas": [y["name"] for y in chart.get("yogas", [])],
            "doshas": [d["name"] for d in chart.get("doshas", [])],
        },
    }
    if dasha:
        ctx["current_period"] = {
            "mahadasha": (dasha.get("current_mahadasha") or {}).get("lord"),
            "antardasha": (dasha.get("current_antardasha") or {}).get("lord"),
        }
    if transits:
        ctx["transits"] = [
            {"planet": t["planet"], "sign": t["sign"], "house_from_moon": t["house_from_moon"],
             "retrograde": t["retrograde"]}
            for t in transits.get("transits", [])
            if t["planet"] in ("Saturn", "Jupiter", "Rahu", "Ketu", "Mars", "Sun", "Moon")
        ]
        ctx["moon_today"] = transits.get("moon_today")
    if panchang:
        ctx["panchang"] = {
            "tithi": panchang.get("tithi", {}).get("name"),
            "nakshatra": panchang.get("nakshatra", {}).get("name"),
            "yoga": panchang.get("yoga", {}).get("name"),
        }
    if summary:
        ctx["conversation_summary"] = summary
    return ctx
