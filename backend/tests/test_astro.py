"""Astrology engine fixture tests using known charts and invariants."""
from datetime import date, datetime, timezone

from astro import engine, dasha, panchang, numerology, compatibility, transits, vastu
from astro import constants as C


def test_gandhi_chart_signs():
    # M. K. Gandhi: 2 Oct 1869, ~07:11 LMT, Porbandar (21.64N, 69.61E).
    # LMT offset for 69.61E ~ +4.64h -> UTC ~ 02:33.
    dt = datetime(1869, 10, 2, 2, 33, 0, tzinfo=timezone.utc)
    chart = engine.build_natal_chart(dt, 21.6422, 69.6093, birth_time_known=True)
    sun = next(p for p in chart["planets"] if p["name"] == "Sun")
    assert sun["sign"] == "Virgo", sun["sign"]
    assert chart["lagna"]["sign"] == "Libra", chart["lagna"]["sign"]


def test_planet_count_and_houses():
    dt = datetime(1990, 5, 15, 6, 30, 0, tzinfo=timezone.utc)
    chart = engine.build_natal_chart(dt, 28.6139, 77.2090, birth_time_known=True)
    assert len(chart["planets"]) == 9
    assert len(chart["houses"]) == 12
    # Rahu and Ketu exactly opposite.
    rahu = next(p for p in chart["planets"] if p["name"] == "Rahu")
    ketu = next(p for p in chart["planets"] if p["name"] == "Ketu")
    diff = abs(rahu["longitude"] - ketu["longitude"])
    assert abs(diff - 180.0) < 0.01


def test_no_lagna_when_time_unknown():
    dt = datetime(1990, 5, 15, 6, 30, 0, tzinfo=timezone.utc)
    chart = engine.build_natal_chart(dt, 28.6139, 77.2090, birth_time_known=False)
    assert chart["lagna"] is None
    assert chart["houses"] is None
    assert all(p["house"] is None for p in chart["planets"])


def test_dasha_timeline():
    dt = datetime(1990, 5, 15, 6, 30, 0, tzinfo=timezone.utc)
    chart = engine.build_natal_chart(dt, 28.6139, 77.2090)
    moon = next(p for p in chart["planets"] if p["name"] == "Moon")
    d = dasha.compute_dashas(moon["longitude"], dt)
    assert len(d["mahadashas"]) == 9
    total_years = sum(m["years"] for m in d["mahadashas"])
    assert abs(total_years - 120) < 0.001
    for md in d["mahadashas"]:
        assert len(md["antardashas"]) == 9


def test_panchang_today():
    p = panchang.compute_panchang(date(2024, 1, 15), 28.6139, 77.2090, 5.5)
    assert 1 <= p["tithi"]["number"] <= 30
    assert p["nakshatra"]["name"] in C.NAKSHATRAS
    assert "sunrise" in p


def test_numerology():
    n = numerology.compute_numerology(date(1990, 5, 15), "John Smith", 2024)
    assert 1 <= n["life_path"] <= 33
    assert "name_number" in n


def test_guna_milan_range():
    bride = {"moon_sign_index": 3, "moon_nakshatra_index": 6}
    groom = {"moon_sign_index": 7, "moon_nakshatra_index": 17}
    res = compatibility.guna_milan(bride, groom)
    assert 0 <= res["total"] <= 36
    assert len(res["kootas"]) == 8


def test_transits():
    dt = datetime(1990, 5, 15, 6, 30, 0, tzinfo=timezone.utc)
    chart = engine.build_natal_chart(dt, 28.6139, 77.2090)
    t = transits.compute_transits(chart)
    assert len(t["transits"]) == 9
    assert t["moon_today"]["phase"]


def test_vastu_engine():
    rooms = [
        {"room_type": "kitchen", "name": "Kitchen", "x": 60, "y": 60, "width": 30, "height": 30},
        {"room_type": "pooja", "name": "Pooja", "x": 60, "y": 0, "width": 20, "height": 20},
        {"room_type": "master_bedroom", "name": "Master", "x": 0, "y": 60, "width": 40, "height": 40},
        {"room_type": "entrance", "name": "Entrance", "x": 40, "y": 0, "width": 15, "height": 10},
    ]
    res = vastu.analyze(rooms, north_rotation=0.0)
    assert 0 <= res["score"] <= 100
    assert len(res["findings"]) == 4
