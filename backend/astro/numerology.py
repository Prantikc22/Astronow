"""Deterministic numerology (Pythagorean). AI only interprets the numbers."""
from __future__ import annotations

from datetime import date, datetime

_MASTER = {11, 22, 33}
_LETTER = {
    **{c: (i % 9) + 1 for i, c in enumerate("abcdefghi")},
    **{c: (i % 9) + 1 for i, c in enumerate("jklmnopqr")},
    **{c: (i % 9) + 1 for i, c in enumerate("stuvwxyz")},
}
_VOWELS = set("aeiou")


def _reduce(n: int, keep_master: bool = True) -> int:
    while n > 9:
        if keep_master and n in _MASTER:
            return n
        n = sum(int(d) for d in str(n))
    return n


def life_path(dob: date) -> int:
    total = _reduce(dob.year) + _reduce(dob.month) + _reduce(dob.day)
    return _reduce(total)


def birth_number(dob: date) -> int:
    return _reduce(dob.day)


def _name_value(name: str, letters: set | None = None) -> int:
    total = 0
    for ch in name.lower():
        if ch.isalpha() and (letters is None or ch in letters):
            total += _LETTER[ch]
    return _reduce(total)


def name_number(name: str) -> int:
    return _name_value(name)


def personal_year(dob: date, year: int | None = None) -> int:
    if year is None:
        year = datetime.utcnow().year
    return _reduce(_reduce(dob.month) + _reduce(dob.day) + _reduce(year))


def compute_numerology(dob: date, name: str | None = None, year: int | None = None) -> dict:
    result = {
        "life_path": life_path(dob),
        "birth_number": birth_number(dob),
        "personal_year": personal_year(dob, year),
    }
    if name:
        result["name_number"] = name_number(name)
        result["soul_urge"] = _name_value(name, _VOWELS)
        result["personality"] = _name_value(
            name, set("bcdfghjklmnpqrstvwxyz")
        )
    return result
