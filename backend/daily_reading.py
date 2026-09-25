"""Validate and provide a small, language-aware fallback for daily guidance."""
from __future__ import annotations

import re


_SCRIPT = {"hi": r"[\u0900-\u097F]", "bn": r"[\u0980-\u09FF]",
           "ta": r"[\u0B80-\u0BFF]", "te": r"[\u0C00-\u0C7F]"}


_CATEGORY_IDS = {"self", "wellbeing", "career", "money", "love", "family", "learning", "spiritual"}


def valid_reading(value: object, language: str, require_categories: bool = False) -> bool:
    if not isinstance(value, dict):
        return False
    title, theme, action = (value.get(key) for key in ("title", "theme", "action"))
    signals = value.get("signals")
    if not all(isinstance(item, str) and item.strip() for item in (title, theme, action)):
        return False
    if not isinstance(signals, list) or len(signals) != 2 or not all(
        isinstance(item, str) and item.strip() for item in signals
    ):
        return False
    categories = value.get("categories")
    if require_categories and not isinstance(categories, list):
        return False
    category_text: list[str] = []
    if categories is not None:
        if not isinstance(categories, list) or len(categories) != len(_CATEGORY_IDS):
            return False
        if {item.get("id") for item in categories if isinstance(item, dict)} != _CATEGORY_IDS:
            return False
        for item in categories:
            if not isinstance(item, dict):
                return False
            fields = (item.get("title"), item.get("summary"), item.get("focus"))
            if not all(isinstance(field, str) and field.strip() for field in fields):
                return False
            category_text.extend(fields)
    if any(len(item) > 750 for item in (title, theme, action, *signals, *category_text)):
        return False
    if language in _SCRIPT:
        content = " ".join((title, theme, action, *signals, *category_text))
        local_letters = len(re.findall(_SCRIPT[language], content))
        latin_letters = len(re.findall(r"[A-Za-z]", content))
        # Proper chart names can remain Latin, but the reading itself must not.
        if local_letters < 20 or local_letters / max(1, local_letters + latin_letters) < 0.35:
            return False
    return True


_FALLBACK = {
    "en": ("A moment to reflect", "Notice what feels important today.", "The Moon's current position offers a point for reflection.", "Your current life period may add another layer to this theme.", "Choose one small, thoughtful step today."),
    "hi": ("आज का विचार", "आज आपके लिए क्या महत्वपूर्ण है, इस पर ध्यान दें।", "चंद्रमा की वर्तमान स्थिति चिंतन का एक संकेत देती है।", "आपका वर्तमान जीवन-चक्र इस विषय में एक और पहलू जोड़ सकता है।", "आज एक छोटा, सोच-समझकर कदम उठाएँ।"),
    "bn": ("আজকের ভাবনা", "আজ আপনার কাছে কী গুরুত্বপূর্ণ, তা একটু খেয়াল করুন।", "চাঁদের বর্তমান অবস্থান ভাবনার একটি সূত্র দিতে পারে।", "আপনার চলমান জীবনপর্ব এই ভাবনায় আরেকটি দিক যোগ করতে পারে।", "আজ একটি ছোট, ভেবেচিন্তে পদক্ষেপ নিন।"),
    "ta": ("இன்றைய சிந்தனை", "இன்று உங்களுக்கு முக்கியமானதை கவனியுங்கள்.", "நிலவின் தற்போதைய நிலை சிந்திக்க ஒரு குறிப்பாக இருக்கலாம்.", "உங்கள் தற்போதைய வாழ்க்கைக் காலம் இன்னொரு கோணத்தைத் தரலாம்.", "இன்று ஒரு சிறிய, நிதானமான படி எடுங்கள்."),
    "te": ("నేటి ఆలోచన", "ఈ రోజు మీకు ముఖ్యమైనదానిపై దృష్టి పెట్టండి.", "చంద్రుని ప్రస్తుత స్థానం ఆలోచనకు ఒక సూచన కావచ్చు.", "మీ ప్రస్తుత జీవిత దశ దీనికి మరో కోణాన్ని జోడించవచ్చు.", "ఈ రోజు ఒక చిన్న, ఆలోచనాత్మక అడుగు వేయండి."),
    "es": ("Una pausa para reflexionar", "Observa qué te importa hoy.", "La posición actual de la Luna puede invitarte a reflexionar.", "Tu etapa vital actual puede añadir otra perspectiva.", "Da hoy un paso pequeño y consciente."),
    "fr": ("Un moment de réflexion", "Remarquez ce qui compte pour vous aujourd’hui.", "La position actuelle de la Lune peut nourrir votre réflexion.", "Votre période de vie actuelle peut apporter une autre perspective.", "Faites aujourd’hui un petit pas réfléchi."),
    "de": ("Ein Moment zum Nachdenken", "Achte heute darauf, was dir wichtig ist.", "Die aktuelle Stellung des Mondes kann ein Denkanstoß sein.", "Deine gegenwärtige Lebensphase kann eine weitere Sichtweise eröffnen.", "Mach heute einen kleinen, bewussten Schritt."),
    "pt": ("Um momento de reflexão", "Observe o que é importante para você hoje.", "A posição atual da Lua pode oferecer um ponto de reflexão.", "Sua fase de vida atual pode trazer outra perspectiva.", "Dê hoje um pequeno passo consciente."),
}


def fallback_reading(language: str) -> dict:
    title, theme, first, second, action = _FALLBACK.get(language, _FALLBACK["en"])
    return {"title": title, "theme": theme, "signals": [first, second], "action": action}
