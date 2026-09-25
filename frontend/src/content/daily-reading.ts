import { translateText } from "@/src/i18n";

export type DailyReadingCategory = { id: string; title: string; summary: string; focus: string };
export type DailyReading = { title: string; theme: string; signals: string[]; action: string; categories: DailyReadingCategory[] };

type Copy = {
  title: string; today: string; glance: string; threads: string; touches: string;
  timing: string; move: string; window: string; pause: string; location: string;
  calendar: string; intention: string; ask: string; work: string; love: string;
  energy: string; reflection: string; moonIn: string;
};

const english: Copy = {
  title: "Your daily reading", today: "TODAY", glance: "YOUR DAY AT A GLANCE",
  threads: "ALL PARTS OF YOUR DAY", touches: "What today touches", timing: "TIMING",
  move: "Move with the day", window: "Supportive window", pause: "Pause and review",
  location: "Add location", calendar: "See calendar", intention: "ONE INTENTION",
  ask: "Ask Tara about today", work: "Work & purpose", love: "Love & connection",
  energy: "Inner energy", reflection: "Today's reflection", moonIn: "Moon in",
};

const bengali: Copy = {
  title: "আপনার আজকের পাঠ", today: "আজ", glance: "আজকের দিন এক নজরে",
  threads: "আপনার দিনের সব দিক", touches: "আজ যা গুরুত্বপূর্ণ", timing: "সময়",
  move: "দিনের সঙ্গে তাল মিলিয়ে", window: "অনুকূল সময়", pause: "থামুন ও ভাবুন",
  location: "স্থান যোগ করুন", calendar: "ক্যালেন্ডার দেখুন", intention: "আজকের সংকল্প",
  ask: "আজকের দিন নিয়ে তারাকে জিজ্ঞেস করুন", work: "কাজ ও উদ্দেশ্য",
  love: "ভালোবাসা ও সম্পর্ক", energy: "মনের শক্তি",
  reflection: "আজকের ভাবনা", moonIn: "চাঁদ",
};

export function dailyCopy(language?: string): Copy {
  if (language === "bn") return bengali;
  if (!language || language === "en") return english;
  return Object.fromEntries(Object.entries(english).map(([key, value]) => [key, translateText(value, language)])) as Copy;
}

export function energyTerm(value: string, language?: string): string {
  const terms: Record<string, Record<string, string>> = {
    bn: { career: "কর্মজীবন", relationships: "সম্পর্ক", energy: "শক্তি", Low: "কম", Reflective: "ভাবনাময়", Moderate: "মাঝারি", Strong: "প্রবল", Excellent: "চমৎকার", Steady: "স্থিতিশীল" },
    hi: { career: "करियर", relationships: "रिश्ते", energy: "ऊर्जा", Low: "कम", Reflective: "चिंतनशील", Moderate: "मध्यम", Strong: "मज़बूत", Excellent: "बहुत अच्छा", Steady: "स्थिर" },
    ta: { career: "தொழில்", relationships: "உறவுகள்", energy: "ஆற்றல்", Low: "குறைவு", Reflective: "சிந்தனைமிக்க", Moderate: "மிதமான", Strong: "வலுவான", Excellent: "மிகச் சிறப்பு", Steady: "நிலையான" },
    te: { career: "వృత్తి", relationships: "సంబంధాలు", energy: "శక్తి", Low: "తక్కువ", Reflective: "ఆలోచనాత్మకం", Moderate: "మధ్యస్థం", Strong: "బలంగా", Excellent: "అద్భుతం", Steady: "స్థిరంగా" },
    es: { career: "Carrera", relationships: "Relaciones", energy: "Energía", Low: "Baja", Reflective: "Reflexiva", Moderate: "Moderada", Strong: "Fuerte", Excellent: "Excelente", Steady: "Estable" },
    fr: { career: "Carrière", relationships: "Relations", energy: "Énergie", Low: "Faible", Reflective: "Réfléchie", Moderate: "Modérée", Strong: "Forte", Excellent: "Excellente", Steady: "Stable" },
    de: { career: "Beruf", relationships: "Beziehungen", energy: "Energie", Low: "Niedrig", Reflective: "Nachdenklich", Moderate: "Mäßig", Strong: "Stark", Excellent: "Ausgezeichnet", Steady: "Stabil" },
    pt: { career: "Carreira", relationships: "Relacionamentos", energy: "Energia", Low: "Baixa", Reflective: "Reflexiva", Moderate: "Moderada", Strong: "Forte", Excellent: "Excelente", Steady: "Estável" },
  };
  return terms[language || "en"]?.[value] || value;
}

export function readingLocale(language?: string): string {
  return ({ en: "en-IN", hi: "hi-IN", bn: "bn-IN", ta: "ta-IN", te: "te-IN",
    es: "es-ES", fr: "fr-FR", de: "de-DE", pt: "pt-PT" } as Record<string, string>)[language || "en"] || "en-IN";
}

const bengaliSigns: Record<string, string> = {
  Aries: "মেষ", Taurus: "বৃষ", Gemini: "মিথুন", Cancer: "কর্কট",
  Leo: "সিংহ", Virgo: "কন্যা", Libra: "তুলা", Scorpio: "বৃশ্চিক",
  Sagittarius: "ধনু", Capricorn: "মকর", Aquarius: "কুম্ভ", Pisces: "মীন",
};

const signOrder = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const localizedSigns: Record<string, string[]> = {
  hi: ["मेष", "वृषभ", "मिथुन", "कर्क", "सिंह", "कन्या", "तुला", "वृश्चिक", "धनु", "मकर", "कुंभ", "मीन"],
  ta: ["மேஷம்", "ரிஷபம்", "மிதுனம்", "கடகம்", "சிம்மம்", "கன்னி", "துலாம்", "விருச்சிகம்", "தனுசு", "மகரம்", "கும்பம்", "மீனம்"],
  te: ["మేషం", "వృషభం", "మిథునం", "కర్కాటకం", "సింహం", "కన్య", "తుల", "వృశ్చికం", "ధనుస్సు", "మకరం", "కుంభం", "మీనం"],
  es: ["Aries", "Tauro", "Géminis", "Cáncer", "Leo", "Virgo", "Libra", "Escorpio", "Sagitario", "Capricornio", "Acuario", "Piscis"],
  fr: ["Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge", "Balance", "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons"],
  de: ["Widder", "Stier", "Zwillinge", "Krebs", "Löwe", "Jungfrau", "Waage", "Skorpion", "Schütze", "Steinbock", "Wassermann", "Fische"],
  pt: ["Áries", "Touro", "Gêmeos", "Câncer", "Leão", "Virgem", "Libra", "Escorpião", "Sagitário", "Capricórnio", "Aquário", "Peixes"],
};

const bengaliPhases: Record<string, string> = {
  "New Moon": "অমাবস্যা", "Waxing Crescent": "শুক্লপক্ষের চাঁদ",
  "First Quarter": "প্রথম চতুর্থী", "Waxing Gibbous": "পূর্ণিমার দিকে চাঁদ",
  "Full Moon": "পূর্ণিমা", "Waning Gibbous": "ক্ষয়িষ্ণু চাঁদ",
  "Last Quarter": "শেষ চতুর্থী", "Waning Crescent": "কৃষ্ণপক্ষের চাঁদ",
};

const bengaliNakshatras: Record<string, string> = {
  Ashwini: "অশ্বিনী", Bharani: "ভরণী", Krittika: "কৃত্তিকা", Rohini: "রোহিণী",
  Mrigashira: "মৃগশিরা", Ardra: "আর্দ্রা", Punarvasu: "পুনর্বসু", Pushya: "পুষ্যা",
  Ashlesha: "আশ্লেষা", Magha: "মঘা", "Purva Phalguni": "পূর্বফাল্গুনী",
  "Uttara Phalguni": "উত্তরফাল্গুনী", Hasta: "হস্তা", Chitra: "চিত্রা", Swati: "স্বাতী",
  Vishakha: "বিশাখা", Anuradha: "অনুরাধা", Jyeshtha: "জ্যেষ্ঠা", Mula: "মূলা",
  "Purva Ashadha": "পূর্বাষাঢ়া", "Uttara Ashadha": "উত্তরাষাঢ়া", Shravana: "শ্রবণা",
  Dhanishta: "ধনিষ্ঠা", Shatabhisha: "শতভিষা", "Purva Bhadrapada": "পূর্বভাদ্রপদ",
  "Uttara Bhadrapada": "উত্তরভাদ্রপদ", Revati: "রেবতী",
};

export function moonPhaseLabel(phase?: string, language?: string): string {
  if (language === "bn") return bengaliPhases[phase || ""] || "আজকের চাঁদ";
  return translateText(phase || "Your day in the sky", language || "en");
}

export function moonPosition(sign?: string, nakshatra?: string, language?: string): string {
  if (language === "bn") return `${bengaliSigns[sign || ""] || sign || "—"} রাশিতে চাঁদ · ${bengaliNakshatras[nakshatra || ""] || nakshatra || "—"}`;
  const lang = language || "en";
  const index = signOrder.indexOf(sign || "");
  const localizedSign = index >= 0 ? localizedSigns[lang]?.[index] || sign : translateText("your daily sign", lang);
  const star = nakshatra || translateText("personal timing", lang);
  if (lang === "hi") return `${localizedSign} राशि में चंद्रमा · ${star}`;
  if (lang === "ta") return `${localizedSign} ராசியில் நிலவு · ${star}`;
  if (lang === "te") return `${localizedSign} రాశిలో చంద్రుడు · ${star}`;
  const prefix: Record<string, string> = { es: "Luna en", fr: "Lune en", de: "Mond in", pt: "Lua em" };
  return `${prefix[lang] || "Moon in"} ${localizedSign} · ${star}`;
}

export function plainReadingText(text?: string): string {
  return String(text || "")
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function dailyReading(data: any, language?: string): DailyReading {
  const reading = data?.reading;
  if (reading && typeof reading.title === "string" && typeof reading.theme === "string"
    && Array.isArray(reading.signals) && typeof reading.action === "string") {
    return {
      title: plainReadingText(reading.title), theme: plainReadingText(reading.theme),
      signals: reading.signals.filter((signal: unknown) => typeof signal === "string").map(plainReadingText),
      action: plainReadingText(reading.action),
      categories: Array.isArray(reading.categories) ? reading.categories
        .filter((item: unknown) => item && typeof item === "object")
        .map((item: any) => ({ id: String(item.id || ""), title: plainReadingText(item.title), summary: plainReadingText(item.summary), focus: plainReadingText(item.focus) }))
        .filter((item: DailyReadingCategory) => item.id && item.title && item.summary && item.focus) : [],
    };
  }
  // Older cached responses were free-form Markdown. Keep them readable without
  // promoting the entire first paragraph into a giant duplicate headline.
  return { title: dailyCopy(language).reflection, theme: plainReadingText(data?.insight), signals: [], action: "", categories: [] };
}
