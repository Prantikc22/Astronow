"""Tarot deck + draws. Tarot is a reflection tool (randomized), kept explicitly
separate from the deterministic astrology engine."""
from __future__ import annotations

import random

MAJOR_ARCANA = [
    ("The Fool", "new beginnings, spontaneity, a leap of faith"),
    ("The Magician", "manifestation, resourcefulness, focused will"),
    ("The High Priestess", "intuition, inner voice, the unseen"),
    ("The Empress", "abundance, nurturing, creativity"),
    ("The Emperor", "structure, authority, stability"),
    ("The Hierophant", "tradition, guidance, shared values"),
    ("The Lovers", "union, choice, alignment of values"),
    ("The Chariot", "determination, direction, momentum"),
    ("Strength", "courage, gentle power, patience"),
    ("The Hermit", "reflection, solitude, inner guidance"),
    ("Wheel of Fortune", "cycles, turning points, destiny"),
    ("Justice", "fairness, truth, cause and effect"),
    ("The Hanged Man", "pause, surrender, new perspective"),
    ("Death", "endings, transformation, release"),
    ("Temperance", "balance, moderation, patience"),
    ("The Devil", "attachment, shadow, what binds you"),
    ("The Tower", "sudden change, revelation, upheaval"),
    ("The Star", "hope, renewal, quiet faith"),
    ("The Moon", "intuition, illusion, the subconscious"),
    ("The Sun", "joy, vitality, clarity"),
    ("Judgement", "awakening, reckoning, renewal"),
    ("The World", "completion, wholeness, arrival"),
]

SUITS = {
    "Wands": "energy, passion, and inspiration",
    "Cups": "emotions, relationships, and intuition",
    "Swords": "thought, truth, and conflict",
    "Pentacles": "work, resources, and the material world",
}
RANKS = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
         "Nine", "Ten", "Page", "Knight", "Queen", "King"]

SPREADS = {
    "one": ["Your card"],
    "three": ["Situation", "Action", "Outcome"],
    "ppf": ["Past", "Present", "Future"],
    "love": ["You", "Them", "The connection"],
    "career": ["Where you are", "The challenge", "The path forward"],
    "decision": ["Option A", "Option B", "Guidance"],
}


def _full_deck() -> list:
    deck = [{"name": n, "arcana": "major", "keywords": kw} for n, kw in MAJOR_ARCANA]
    for suit, theme in SUITS.items():
        for rank in RANKS:
            deck.append({
                "name": f"{rank} of {suit}",
                "arcana": "minor",
                "suit": suit,
                "keywords": f"{theme}",
            })
    return deck


def draw(spread: str = "one", seed: int | None = None) -> dict:
    positions = SPREADS.get(spread, SPREADS["one"])
    rng = random.Random(seed)
    deck = _full_deck()
    rng.shuffle(deck)
    picked = deck[: len(positions)]
    cards = []
    for pos, card in zip(positions, picked):
        reversed_ = rng.random() < 0.35
        cards.append({
            "position": pos,
            "name": card["name"],
            "arcana": card["arcana"],
            "suit": card.get("suit"),
            "orientation": "reversed" if reversed_ else "upright",
            "keywords": card["keywords"],
        })
    return {"spread": spread, "positions": positions, "cards": cards}
