"""Personal, AI-written long-form reports.

Deterministic engines compute the chart facts; the model only explains them.
Each report has a brief (focus + section outline) so every user gets the same
structure, written for their own placements, periods and transits.
"""
from __future__ import annotations

from typing import Any

import prompts

BRIEFS: dict[str, dict[str, Any]] = {
    "year-ahead": {"title": "Your Year Ahead", "focus": "the next 12 months: themes, turning points and timing",
                   "sections": ["The shape of your year", "Months that open doors", "Months to move carefully", "Love and relationships this year", "Work and money this year", "Your one focus for the year"]},
    "career-blueprint": {"title": "Career Blueprint", "focus": "work strengths, ideal environments and career timing",
                         "sections": ["How you are built to work", "Where you shine", "Blind spots at work", "Timing for moves and promotions", "Roles and fields that fit", "Your next career step"]},
    "love-patterns": {"title": "Love Patterns", "focus": "how the person loves, attaches and communicates in relationships",
                      "sections": ["How you love", "What you need from a partner", "Patterns that repeat", "Communication and conflict", "Timing in your love life", "Growing together"]},
    "wealth-rhythm": {"title": "Wealth Rhythm", "focus": "money temperament, earning style and financial timing",
                      "sections": ["Your money temperament", "How wealth comes to you", "Leaks and risks", "Good periods for financial moves", "Building long-term security", "Your money practice"]},
    "life-purpose": {"title": "Life Purpose", "focus": "deeper motivations, dharma and life lessons",
                     "sections": ["What drives you", "Your dharma in this life", "Lessons that keep returning", "Gifts to develop", "Where this chapter is leading", "Living it daily"]},
    "marriage-partner": {"title": "Marriage & Partner", "focus": "marriage, commitment and the qualities of a lasting partnership",
                         "sections": ["What marriage means for you", "The partner your chart describes", "Timing for commitment", "Harmony and friction", "Family and in-laws", "Building a lasting bond"]},
    "ideal-partner": {"title": "Ideal Partner", "focus": "the qualities, temperament and values that suit the person in a partner",
                      "sections": ["Who draws you in", "Who is actually good for you", "Values that must match", "Red flags for your chart", "Where you may meet", "Being ready"]},
    "family-dynamics": {"title": "Family Dynamics", "focus": "home, parents, siblings and emotional belonging",
                        "sections": ["Your role in the family", "Parents and elders", "Siblings and relatives", "Home and belonging", "Healing old patterns", "Boundaries that help"]},
    "business-enterprise": {"title": "Business & Enterprise", "focus": "entrepreneurship, risk appetite, partnerships and business timing",
                            "sections": ["Your enterprise style", "Strengths as a founder or leader", "Risk and decision-making", "Partnerships", "Timing to launch or expand", "Your business edge"]},
    "first-job": {"title": "First Job & Search", "focus": "early career choices, job search and interviews",
                  "sections": ["What to look for first", "Strengths to show", "Fields that fit", "Timing for applications and offers", "Handling interviews", "Your first 90 days"]},
    "public-service": {"title": "Public Service", "focus": "government jobs, competitive exams and institutional careers",
                       "sections": ["Fit for public service", "Exam and preparation style", "Favourable periods", "Departments and roles that suit", "Discipline and consistency", "Your preparation plan"]},
    "education-path": {"title": "Education Path", "focus": "learning style, subjects and education timing",
                       "sections": ["How you learn best", "Subjects that suit you", "Higher studies and abroad", "Timing for exams and admissions", "Focus and memory", "Your study practice"]},
    "intelligence-strengths": {"title": "Mind & Intelligence", "focus": "thinking style, communication and mental strengths",
                               "sections": ["How your mind works", "Communication style", "Creative intelligence", "Where you overthink", "Sharpening your mind", "Using your mind well"]},
    "health-wellbeing": {"title": "Wellbeing Rhythms", "focus": "energy, stress and rest patterns (reflective only, never medical)",
                         "sections": ["Your energy rhythm", "Stress patterns", "Rest and recovery", "Periods to be gentle with yourself", "Daily routines that suit you", "A calmer week"]},
    "artha-strategy": {"title": "Artha Strategy", "focus": "a practical wealth strategy: earning, saving, investing mindset and timing",
                       "sections": ["Your Artha profile", "Primary income engine", "Where money slips away", "Windows for big financial decisions", "A 12-month money plan", "Habits that compound"]},
    "twelve-year-compass": {"title": "The 12-Year Compass", "focus": "the next twelve years year by year, based on dasha periods and major transits",
                            "sections": ["The arc of the next twelve years", "Years 1 to 3", "Years 4 to 6", "Years 7 to 9", "Years 10 to 12", "How to use this map"]},
}


def report_prompt(slug: str, name: str, terminology: str, language: str, context_json: str) -> str:
    brief = BRIEFS[slug]
    language_name = prompts.LANGUAGE_NAMES.get(language, "English")
    outline = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(brief["sections"]))
    return (
        f"Write the AstroNow report \"{brief['title']}\" for {name}. Focus: {brief['focus']}.\n"
        f"Write every field in {language_name}. Terminology preference: {terminology}.\n\n"
        "Use ONLY the chart facts in CONTEXT (placements, houses, nakshatras, dashas, transits, numerology). "
        "Name the specific placements behind each point (for example 'Venus in your 7th house'), so the reader "
        "can see the report is theirs. Be specific and practical; avoid generic horoscope lines, fear, "
        "guarantees, and medical, legal or financial certainty. Give timing using the dasha periods and transit "
        "dates provided, and say plainly when something is a tendency rather than an event.\n\n"
        f"Use exactly these sections, in order, as the section titles (translated):\n{outline}\n\n"
        "Return JSON only, with this shape:\n"
        '{"title": str, "intro": str (2-3 sentences), "sections": [{"title": str, "body": str (120-220 words, '
        'short paragraphs separated by \\n\\n)}], "key_dates": [{"when": str, "what": str}] (3-6 items), '
        '"closing": str (1-2 sentences)}\n\n'
        "CONTEXT:\n" + context_json
    )


def valid_report(value: object, slug: str) -> bool:
    if not isinstance(value, dict):
        return False
    sections = value.get("sections")
    if not isinstance(sections, list) or len(sections) < len(BRIEFS[slug]["sections"]) - 1:
        return False
    return all(isinstance(s, dict) and isinstance(s.get("title"), str) and isinstance(s.get("body"), str) and len(s["body"]) > 80
               for s in sections) and isinstance(value.get("intro"), str)
