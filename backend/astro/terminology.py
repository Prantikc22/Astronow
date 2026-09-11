"""Canonical Vedic terminology map. UI resolves labels through these keys so
Simple / Traditional / Both are pure presentation choices."""
from __future__ import annotations

TERMS = {
    "kundli": {"simple": "Birth Chart", "traditional": "Kundli"},
    "nakshatra": {"simple": "Birth Star", "traditional": "Nakshatra"},
    "mahadasha": {"simple": "Major Life Period", "traditional": "Mahadasha"},
    "antardasha": {"simple": "Sub-period", "traditional": "Antardasha"},
    "panchang": {"simple": "Daily Calendar", "traditional": "Panchang"},
    "muhurat": {"simple": "Auspicious Timing", "traditional": "Muhurat"},
    "guna_milan": {"simple": "Compatibility", "traditional": "Guna Milan"},
    "lagna": {"simple": "Ascendant", "traditional": "Lagna"},
    "gochar": {"simple": "Transit", "traditional": "Gochar"},
    "upaya": {"simple": "Remedy", "traditional": "Upaya"},
    "rashi": {"simple": "Sign", "traditional": "Rashi"},
    "graha": {"simple": "Planet", "traditional": "Graha"},
    "bhava": {"simple": "House", "traditional": "Bhava"},
    "yoga": {"simple": "Combination", "traditional": "Yoga"},
    "dosha": {"simple": "Affliction", "traditional": "Dosha"},
    "vastu": {"simple": "Home Analysis", "traditional": "Vastu"},
    "tithi": {"simple": "Lunar Day", "traditional": "Tithi"},
    "karana": {"simple": "Half Lunar Day", "traditional": "Karana"},
    "paksha": {"simple": "Lunar Fortnight", "traditional": "Paksha"},
    "pada": {"simple": "Quarter", "traditional": "Pada"},
}

MODES = ("simple", "traditional", "both")


def resolve(key: str, mode: str = "both") -> str:
    entry = TERMS.get(key)
    if not entry:
        return key
    if mode == "simple":
        return entry["simple"]
    if mode == "traditional":
        return entry["traditional"]
    return f"{entry['simple']} \u00b7 {entry['traditional']}"


def full_map(mode: str = "both") -> dict:
    return {k: resolve(k, mode) for k in TERMS}
