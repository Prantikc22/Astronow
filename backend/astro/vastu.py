"""Deterministic Vastu rule engine. AI only explains the structured findings."""
from __future__ import annotations

import math

ZONES = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "Center"]

# room_type -> {"ideal": [...], "avoid": [...], "weight": int}
VASTU_RULES = {
    "entrance": {"ideal": ["N", "NE", "E"], "avoid": ["SW", "S"], "weight": 3},
    "kitchen": {"ideal": ["SE"], "acceptable": ["NW"], "avoid": ["NE", "SW"], "weight": 3},
    "master_bedroom": {"ideal": ["SW"], "acceptable": ["S", "W"], "avoid": ["NE", "SE"], "weight": 3},
    "bedroom": {"ideal": ["SW", "S", "W"], "avoid": ["NE"], "weight": 1},
    "bathroom": {"ideal": ["NW", "W"], "avoid": ["NE", "SW", "SE", "Center"], "weight": 2},
    "toilet": {"ideal": ["NW", "W", "S"], "avoid": ["NE", "SW", "Center"], "weight": 2},
    "pooja": {"ideal": ["NE", "E", "N"], "avoid": ["S", "SW"], "weight": 2},
    "living": {"ideal": ["N", "E", "NE", "NW"], "avoid": [], "weight": 2},
    "dining": {"ideal": ["W", "E"], "avoid": [], "weight": 1},
    "study": {"ideal": ["E", "N", "NE", "W"], "avoid": [], "weight": 1},
    "office": {"ideal": ["E", "N", "NE", "W"], "avoid": ["SE"], "weight": 1},
    "storage": {"ideal": ["SW", "S", "W"], "avoid": ["NE"], "weight": 1},
    "staircase": {"ideal": ["SW", "S", "W"], "avoid": ["NE", "Center"], "weight": 2},
    "balcony": {"ideal": ["N", "E", "NE"], "avoid": [], "weight": 1},
    "other": {"ideal": [], "avoid": [], "weight": 0},
}

SEVERITY_SCORE = {"strong": 100, "acceptable": 80, "review": 50, "attention": 25}


def _zone_of(cx: float, cy: float, center_x: float, center_y: float,
             half_w: float, half_h: float, north_rotation: float) -> str:
    dx = cx - center_x
    dy = cy - center_y
    # Screen y grows downward; north points up by default -> invert dy.
    if abs(dx) < half_w * 0.22 and abs(dy) < half_h * 0.22:
        return "Center"
    angle = math.degrees(math.atan2(-dy, dx))  # 0=E, 90=N (math convention)
    # Convert to compass bearing from North, clockwise, then apply rotation.
    bearing = (90.0 - angle - north_rotation) % 360.0
    sectors = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    idx = int(((bearing + 22.5) % 360.0) // 45.0)
    return sectors[idx]


def analyze(rooms: list, north_rotation: float = 0.0) -> dict:
    """rooms: list of {room_type, x, y, width, height}. Coordinates in any
    consistent unit; north_rotation in degrees (clockwise from plan-up)."""
    if not rooms:
        return {"score": 0, "findings": [], "zone_map": {}, "summary": "No rooms provided."}

    xs = [r["x"] for r in rooms] + [r["x"] + r["width"] for r in rooms]
    ys = [r["y"] for r in rooms] + [r["y"] + r["height"] for r in rooms]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    center_x = (min_x + max_x) / 2.0
    center_y = (min_y + max_y) / 2.0
    half_w = (max_x - min_x) / 2.0 or 1.0
    half_h = (max_y - min_y) / 2.0 or 1.0

    findings = []
    zone_map = {}
    weighted_sum = 0.0
    weight_total = 0.0

    for room in rooms:
        rtype = room.get("room_type", "other")
        cx = room["x"] + room["width"] / 2.0
        cy = room["y"] + room["height"] / 2.0
        zone = _zone_of(cx, cy, center_x, center_y, half_w, half_h, north_rotation)
        zone_map[room.get("name", rtype)] = zone
        rule = VASTU_RULES.get(rtype, VASTU_RULES["other"])
        weight = rule["weight"]

        if weight == 0:
            continue
        if zone in rule.get("ideal", []):
            status, severity = "ideal", "strong"
        elif zone in rule.get("acceptable", []):
            status, severity = "acceptable", "acceptable"
        elif zone in rule.get("avoid", []):
            status, severity = "avoid", "attention"
        else:
            status, severity = "neutral", "review"

        score = SEVERITY_SCORE[severity]
        weighted_sum += score * weight
        weight_total += weight

        findings.append({
            "rule_id": f"{rtype}_{zone.lower()}",
            "room": room.get("name", rtype),
            "room_type": rtype,
            "zone": zone,
            "status": status,
            "severity": severity,
            "confidence": 0.9 if rtype != "other" else 0.5,
            "category": _category(rtype),
            "explanation_key": f"vastu.{rtype}.{status}",
        })

    overall = int(round(weighted_sum / weight_total)) if weight_total else 0
    strong = [f["room"] for f in findings if f["severity"] == "strong"]
    review = [f["room"] for f in findings if f["severity"] in ("attention", "review")]

    return {
        "score": overall,
        "max_score": 100,
        "strong_areas": strong,
        "review_areas": review,
        "findings": findings,
        "zone_map": zone_map,
        "north_rotation": north_rotation,
    }


def _category(rtype: str) -> str:
    mapping = {
        "kitchen": "health_energy", "master_bedroom": "relationships",
        "bedroom": "rest", "entrance": "prosperity", "pooja": "spiritual",
        "bathroom": "hygiene", "toilet": "hygiene", "staircase": "structure",
    }
    return mapping.get(rtype, "general")
