// Derived, deterministic day facts shown on Home and the daily reading.
// Nothing here invents astrology: scores come straight from the API's
// transit-based energy meter, and the day ruler follows the classical
// Vedic weekday lords (Vara) with their traditional colours and numbers.

import type { FeatherName } from "@/src/components/Icon";

export type AreaKey = "self" | "career" | "money" | "love" | "family" | "wellbeing" | "learning" | "spiritual";

export const AREAS: { key: AreaKey; title: string; icon: FeatherName; tint: [string, string] }[] = [
  { key: "self", title: "Self", icon: "user", tint: ["#C9C2FF", "#8E83E0"] },
  { key: "career", title: "Work", icon: "briefcase", tint: ["#9CC6F2", "#5D86D6"] },
  { key: "money", title: "Wealth", icon: "trending-up", tint: ["#F7DDA6", "#E3A866"] },
  { key: "love", title: "Love", icon: "heart", tint: ["#F6B6CB", "#D0628F"] },
  { key: "family", title: "Family", icon: "home", tint: ["#F3C1A8", "#D98A6A"] },
  { key: "wellbeing", title: "Wellbeing", icon: "activity", tint: ["#B9E3E0", "#6FB3B4"] },
  { key: "learning", title: "Learning", icon: "book-open", tint: ["#C7D4FF", "#7C8FE6"] },
  { key: "spiritual", title: "Inner life", icon: "star", tint: ["#E4C9FF", "#A77BDB"] },
];

const LEGACY: Record<AreaKey, string> = {
  self: "energy", wellbeing: "energy", spiritual: "energy",
  career: "career", money: "career", learning: "career",
  love: "relationships", family: "relationships",
};

export type Meter = { value: number; label: string };

export function areaMeter(energy: any, key: AreaKey): Meter {
  const hit = energy?.[key] || energy?.[LEGACY[key]];
  const value = Number(hit?.value);
  return { value: Number.isFinite(value) ? Math.max(1, Math.min(5, value)) : 3, label: hit?.label || "Steady" };
}

/** The API meter is 1–5; present it as a percentage the way people read scores. */
export function meterPercent(meter: Meter): number {
  return Math.round(meter.value * 20);
}

export function dayScore(energy: any): number | null {
  if (!energy || typeof energy !== "object" || !Object.keys(energy).length) return null;
  const values = AREAS.map((area) => areaMeter(energy, area.key).value);
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 20);
}

export function scoreTone(score: number): string {
  if (score >= 80) return "A high-flow day";
  if (score >= 65) return "A supportive day";
  if (score >= 50) return "A steady day";
  return "A day to go gently";
}

export type DayRuler = { planet: string; colorName: string; color: string; number: number; glyph: string };

// Vara lords: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn (Sunday → Saturday).
const RULERS: DayRuler[] = [
  { planet: "Sun", colorName: "Saffron", color: "#F29B38", number: 1, glyph: "☉" },
  { planet: "Moon", colorName: "Pearl White", color: "#EEEAF7", number: 2, glyph: "☽" },
  { planet: "Mars", colorName: "Coral Red", color: "#E0584F", number: 9, glyph: "♂" },
  { planet: "Mercury", colorName: "Emerald", color: "#3FB57A", number: 5, glyph: "☿" },
  { planet: "Jupiter", colorName: "Turmeric Yellow", color: "#F2C230", number: 3, glyph: "♃" },
  { planet: "Venus", colorName: "Rose Pink", color: "#F0A0BD", number: 6, glyph: "♀" },
  { planet: "Saturn", colorName: "Royal Blue", color: "#4A63E0", number: 8, glyph: "♄" },
];

export function dayRuler(date = new Date()): DayRuler {
  return RULERS[date.getDay()];
}

/** "6:08 AM" or "18:05" → minutes after midnight. */
export function parseClock(value?: string): number | null {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!match) return null;
  let hours = Number(match[1]) % 24;
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.max(0, Math.round(minutes % 60));
  return h ? `${h}h ${m}m` : `${m}m`;
}
