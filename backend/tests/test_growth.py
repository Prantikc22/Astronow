from datetime import date

import growth

KOLKATA = (22.5726, 88.3639, 5.5)


def test_moon_calendar_marks_full_and_new_moon():
    days = growth.moon_calendar(2026, 10, *KOLKATA)
    assert len(days) == 31
    events = {d["date"]: d["events"] for d in days if d["events"]}
    assert any("Purnima" in e for ev in events.values() for e in ev)
    assert any("Amavasya" in e for ev in events.values() for e in ev)
    full = next(d for d in days if any("Purnima" in e for e in d["events"]))
    new = next(d for d in days if any("Amavasya" in e for e in d["events"]))
    assert full["illumination"] > 0.95 and new["illumination"] < 0.05
    assert all(0 <= d["illumination"] <= 1 for d in days)


def test_muhurat_ranks_and_explains():
    ranked = growth.find_muhurat("travel", *KOLKATA, date(2026, 9, 26), 14)
    assert len(ranked) == 14
    assert ranked[0]["score"] >= ranked[-1]["score"]
    top = ranked[0]
    assert top["reasons"] and top["avoid_window"]
    # Abhijit is never offered on a Wednesday.
    assert all(r["best_window"] is None for r in ranked if r["weekday"] == "Wednesday")


def test_muhurat_penalises_amavasya():
    days = growth.moon_calendar(2026, 10, *KOLKATA)
    amavasya = date.fromisoformat(next(d["date"] for d in days if any("Amavasya" in e for e in d["events"])))
    scored = growth.find_muhurat("business", *KOLKATA, amavasya, 1)[0]
    assert any("Amavasya" in c for c in scored["cautions"])


def test_referral_code_is_stable_and_readable():
    a = growth.referral_code("user-1")
    assert a == growth.referral_code("user-1")
    assert a != growth.referral_code("user-2")
    assert len(a) == 8 and not set(a) & set("0O1I")
