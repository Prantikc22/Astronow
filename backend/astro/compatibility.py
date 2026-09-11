"""Ashtakoota Guna Milan compatibility (deterministic, 36 points)."""
from __future__ import annotations

from . import constants as C

# Per-nakshatra attributes (index 0..26 aligned with C.NAKSHATRAS).
YONI = [
    "Horse", "Elephant", "Sheep", "Serpent", "Serpent", "Dog", "Cat", "Sheep",
    "Cat", "Rat", "Rat", "Cow", "Buffalo", "Tiger", "Buffalo", "Tiger", "Deer",
    "Deer", "Dog", "Monkey", "Mongoose", "Monkey", "Lion", "Horse", "Lion",
    "Cow", "Elephant",
]
YONI_ENEMY = {
    "Cow": "Tiger", "Tiger": "Cow", "Elephant": "Lion", "Lion": "Elephant",
    "Horse": "Buffalo", "Buffalo": "Horse", "Dog": "Deer", "Deer": "Dog",
    "Serpent": "Mongoose", "Mongoose": "Serpent", "Monkey": "Sheep",
    "Sheep": "Monkey", "Cat": "Rat", "Rat": "Cat",
}
GANA = [
    "Deva", "Manushya", "Rakshasa", "Manushya", "Deva", "Manushya", "Deva",
    "Deva", "Rakshasa", "Rakshasa", "Manushya", "Manushya", "Deva", "Rakshasa",
    "Deva", "Rakshasa", "Deva", "Rakshasa", "Rakshasa", "Manushya", "Manushya",
    "Deva", "Rakshasa", "Rakshasa", "Manushya", "Manushya", "Deva",
]
NADI = [
    "Aadi", "Madhya", "Antya", "Antya", "Madhya", "Aadi", "Aadi", "Madhya",
    "Antya", "Antya", "Madhya", "Aadi", "Aadi", "Madhya", "Antya", "Antya",
    "Madhya", "Aadi", "Aadi", "Madhya", "Antya", "Antya", "Madhya", "Aadi",
    "Aadi", "Madhya", "Antya",
]
# Varna by moon sign index (0=Aries..11=Pisces). Brahmin>Kshatriya>Vaishya>Shudra
VARNA_BY_SIGN = [3, 2, 1, 4, 3, 2, 1, 4, 3, 2, 1, 4]  # rank value
VARNA_NAME = {4: "Brahmin", 3: "Kshatriya", 2: "Vaishya", 1: "Shudra"}

_FRIENDS = {
    "Sun": {"Moon", "Mars", "Jupiter"}, "Moon": {"Sun", "Mercury"},
    "Mars": {"Sun", "Moon", "Jupiter"}, "Mercury": {"Sun", "Venus"},
    "Jupiter": {"Sun", "Moon", "Mars"}, "Venus": {"Mercury", "Saturn"},
    "Saturn": {"Mercury", "Venus"},
}
_ENEMIES = {
    "Sun": {"Venus", "Saturn"}, "Moon": set(), "Mars": {"Mercury"},
    "Mercury": {"Moon"}, "Jupiter": {"Mercury", "Venus"},
    "Venus": {"Sun", "Moon"}, "Saturn": {"Sun", "Moon", "Mars"},
}


def _rel(a: str, b: str) -> str:
    if b in _FRIENDS.get(a, set()):
        return "friend"
    if b in _ENEMIES.get(a, set()):
        return "enemy"
    return "neutral"


def _varna(bride_sign: int, groom_sign: int) -> float:
    return 1.0 if VARNA_BY_SIGN[groom_sign] >= VARNA_BY_SIGN[bride_sign] else 0.0


def _vashya(bride_sign: int, groom_sign: int) -> float:
    # Simplified sign-group vashya model.
    groups = {
        0: "Chatushpada", 1: "Chatushpada", 2: "Manava", 3: "Jalachara",
        4: "Vanachara", 5: "Manava", 6: "Manava", 7: "Keeta", 8: "Manava",
        9: "Jalachara", 10: "Manava", 11: "Jalachara",
    }
    if groups[bride_sign] == groups[groom_sign]:
        return 2.0
    diff = abs(bride_sign - groom_sign)
    return 1.0 if diff in (1, 11) else 0.5


def _tara(bride_nak: int, groom_nak: int) -> float:
    def score(from_nak, to_nak):
        count = ((to_nak - from_nak) % 27) + 1
        rem = count % 9
        return 0.0 if rem in (3, 5, 7) else 1.5
    return score(bride_nak, groom_nak) + score(groom_nak, bride_nak)


def _yoni(bride_nak: int, groom_nak: int) -> float:
    ya, yb = YONI[bride_nak], YONI[groom_nak]
    if ya == yb:
        return 4.0
    if YONI_ENEMY.get(ya) == yb:
        return 0.0
    return 2.0


def _graha_maitri(bride_sign: int, groom_sign: int) -> float:
    la, lb = C.RASHI_LORDS[bride_sign], C.RASHI_LORDS[groom_sign]
    if la == lb:
        return 5.0
    r1, r2 = _rel(la, lb), _rel(lb, la)
    combo = {r1, r2}
    if combo == {"friend"}:
        return 5.0
    if combo == {"friend", "neutral"}:
        return 4.0
    if combo == {"neutral"}:
        return 3.0
    if combo == {"friend", "enemy"}:
        return 1.0
    if combo == {"neutral", "enemy"}:
        return 0.5
    return 0.0


def _gana(bride_nak: int, groom_nak: int) -> float:
    ga, gb = GANA[bride_nak], GANA[groom_nak]
    table = {
        ("Deva", "Deva"): 6, ("Manushya", "Manushya"): 6, ("Rakshasa", "Rakshasa"): 6,
        ("Deva", "Manushya"): 5, ("Manushya", "Deva"): 6,
        ("Deva", "Rakshasa"): 1, ("Rakshasa", "Deva"): 0,
        ("Manushya", "Rakshasa"): 0, ("Rakshasa", "Manushya"): 3,
    }
    return float(table.get((gb, ga), 0))  # (groom, bride)


def _bhakoot(bride_sign: int, groom_sign: int) -> float:
    d1 = ((groom_sign - bride_sign) % 12) + 1
    d2 = ((bride_sign - groom_sign) % 12) + 1
    bad = {(2, 12), (12, 2), (5, 9), (9, 5), (6, 8), (8, 6)}
    return 0.0 if (d1, d2) in bad else 7.0


def _nadi(bride_nak: int, groom_nak: int) -> float:
    return 0.0 if NADI[bride_nak] == NADI[groom_nak] else 8.0


def guna_milan(bride: dict, groom: dict) -> dict:
    """bride/groom dicts must have moon_sign_index and moon_nakshatra_index."""
    bs, gs = bride["moon_sign_index"], groom["moon_sign_index"]
    bn, gn = bride["moon_nakshatra_index"], groom["moon_nakshatra_index"]
    kootas = [
        ("Varna", _varna(bs, gs), 1),
        ("Vashya", _vashya(bs, gs), 2),
        ("Tara", _tara(bn, gn), 3),
        ("Yoni", _yoni(bn, gn), 4),
        ("Graha Maitri", _graha_maitri(bs, gs), 5),
        ("Gana", _gana(bn, gn), 6),
        ("Bhakoot", _bhakoot(bs, gs), 7),
        ("Nadi", _nadi(bn, gn), 8),
    ]
    total = sum(k[1] for k in kootas)
    return {
        "total": round(total, 1),
        "max": 36,
        "kootas": [
            {"name": n, "obtained": round(v, 1), "max": m} for n, v, m in kootas
        ],
        "verdict": _verdict(total),
    }


def _verdict(total: float) -> str:
    if total >= 28:
        return "excellent"
    if total >= 21:
        return "good"
    if total >= 18:
        return "acceptable"
    return "needs_attention"
