import daily_reading
import prompts


def test_fallback_is_structured_in_bengali():
    reading = daily_reading.fallback_reading("bn")
    assert daily_reading.valid_reading(reading, "bn")
    assert not daily_reading.valid_reading(reading, "hi")


def test_english_reading_is_rejected_for_bengali():
    reading = daily_reading.fallback_reading("en")
    assert daily_reading.valid_reading(reading, "en")
    assert not daily_reading.valid_reading(reading, "bn")


def test_daily_prompt_names_language_and_forbids_markdown():
    prompt = prompts.daily_insight_prompt("Maya", "both", "bn")
    assert "Bengali" in prompt
    assert "No Markdown" in prompt
    assert '"signals"' in prompt


def test_tomorrow_prompt_uses_requested_date_without_claiming_today():
    prompt = prompts.daily_insight_prompt("Maya", "simple", "en", "2026-09-21")
    assert "2026-09-21" in prompt
    assert "For a future date, write for that date" in prompt
    assert "human theme" in prompt


def test_rich_reading_requires_all_daily_categories():
    reading = daily_reading.fallback_reading("en")
    assert not daily_reading.valid_reading(reading, "en", require_categories=True)
    reading["categories"] = [
        {"id": category, "title": category.title(), "summary": "A balanced daily interpretation.", "focus": "Take one practical step."}
        for category in ("self", "wellbeing", "career", "money", "love", "family", "learning", "spiritual")
    ]
    assert daily_reading.valid_reading(reading, "en", require_categories=True)
