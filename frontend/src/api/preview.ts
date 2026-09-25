const planets = [
  ["Sun", "Leo", "12° 41'", 5, "Magha"],
  ["Moon", "Taurus", "18° 22'", 2, "Rohini"],
  ["Mars", "Virgo", "03° 14'", 6, "Uttara Phalguni"],
  ["Mercury", "Leo", "26° 08'", 5, "Purva Phalguni"],
  ["Jupiter", "Sagittarius", "09° 51'", 9, "Mula"],
  ["Venus", "Cancer", "21° 17'", 4, "Ashlesha"],
  ["Saturn", "Aquarius", "17° 06'", 11, "Shatabhisha"],
  ["Rahu", "Gemini", "05° 42'", 3, "Mrigashira"],
  ["Ketu", "Sagittarius", "05° 42'", 9, "Mula"],
].map(([name, sign, degree_dms, house, nakshatra], index) => ({
  name, sign, degree_dms, house, nakshatra, nakshatra_lord: ["Ketu", "Moon", "Sun", "Venus"][index % 4], retrograde: name === "Saturn" || name === "Rahu" || name === "Ketu",
}));

const houses = Array.from({ length: 12 }, (_, index) => ({
  house: index + 1,
  sign_index: index,
  planets: planets.filter((planet) => planet.house === index + 1).map((planet) => planet.name),
}));

const panchang = {
  paksha: "Shukla", tithi: { name: "Dashami" }, nakshatra: { name: "Rohini" },
  yoga: { name: "Siddhi" }, karana: { name: "Taitila" }, sunrise: "6:08 AM", sunset: "6:32 PM",
  rahu_kalam: { start: "10:36 AM", end: "12:08 PM" }, abhijit_muhurat: { start: "11:48 AM", end: "12:36 PM" },
};

function previewPanchang(iso?: string) {
  const chosen = iso ? new Date(`${iso}T12:00:00Z`) : new Date();
  const date = Number.isNaN(chosen.getTime()) ? new Date() : chosen;
  const weekday = new Intl.DateTimeFormat("en-US", iso ? { weekday: "long", timeZone: "UTC" } : { weekday: "long" }).format(date);
  return { ...panchang, weekday };
}

const dashas = [
  ["Venus", 1999, 2019, 20], ["Sun", 2019, 2025, 6], ["Moon", 2025, 2035, 10],
  ["Mars", 2035, 2042, 7], ["Rahu", 2042, 2060, 18], ["Jupiter", 2060, 2076, 16],
  ["Saturn", 2076, 2095, 19], ["Mercury", 2095, 2112, 17],
].map(([lord, start_year, end_year, years]) => ({ lord, start_year, end_year, years }));

export const previewProfile = {
  first_name: "Maya", birthplace: "Kolkata, India", terminology_mode: "both", language: "en",
  dob: "1994-08-21", birth_time: "09:15:00", birth_time_known: true, lat: 22.5726, lon: 88.3639, tz_name: "Asia/Kolkata",
  onboarded: true, birth_details_change_count: 0, interests: ["Career", "Love", "Personal growth"],
};

// Keep an explicit preview session alive across Expo Fast Refresh. A genuine
// Supabase sign-in always calls setPreviewSession(false) before using the API.
const previewRuntime = globalThis as typeof globalThis & {
  __astronowPreviewSession?: boolean;
  __astronowPreviewProfile?: typeof previewProfile;
  __astronowFamily?: any[];
  __astronowBonus?: number;
};
let previewCurrentProfile = previewRuntime.__astronowPreviewProfile || { ...previewProfile };

export function getPreviewProfile() {
  return previewCurrentProfile;
}

const chart = {
  birth_time_known: true, lagna: { sign: "Aries" }, moon_sign: "Taurus", sun_sign: "Leo",
  moon_nakshatra: "Rohini", moon_pada: 3, planets, houses,
  yogas: [{ id: "gajakesari", name: "Gaja Kesari Yoga" }, { id: "budha_aditya", name: "Budha Aditya Yoga" }], doshas: [],
};

const products = [
  { id: "monthly", period: "month", ref_price: { INR: "₹299", USD: "$7.99" } },
  { id: "annual", period: "year", recommended: true, badge: "BEST VALUE", ref_price: { INR: "₹1,999", USD: "$39.99" } },
  { id: "report_match", period: "one_time", type: "report", ref_price: { INR: "₹249", USD: "$2.99" }, list_price: { INR: "₹498", USD: "$5.98" }, discount: "50% OFF" },
  { id: "report_artha_strategy", period: "one_time", type: "report", ref_price: { INR: "₹299", USD: "$3.99" }, list_price: { INR: "₹598", USD: "$7.98" }, discount: "50% OFF" },
  { id: "report_12_year_compass", period: "one_time", type: "report", ref_price: { INR: "₹399", USD: "$4.99" }, list_price: { INR: "₹798", USD: "$9.98" }, discount: "50% OFF" },
];

export function isPreviewMode() {
  return process.env.EXPO_PUBLIC_PREVIEW_MODE === "1" && __DEV__;
}

export function setPreviewSession(active: boolean) {
  previewRuntime.__astronowPreviewSession = active && isPreviewMode();
}

export function isPreviewSession() {
  return isPreviewMode() && !!previewRuntime.__astronowPreviewSession;
}

export async function previewRequest(method: string, path: string, body?: any): Promise<any> {
  await new Promise((resolve) => setTimeout(resolve, method === "GET" ? 180 : 320));
  if (path === "/auth/me") return { user: { id: "preview-user", email: "preview@astronow.app" }, profile: previewCurrentProfile, onboarded: true, entitlement: { tier: "free", premium: false, source: "preview" } };
  if (path.startsWith("/terminology")) return { mode: "both", terms: { kundli: "Birth Chart · Kundli", nakshatra: "Birth Star · Nakshatra", mahadasha: "Major Life Period · Mahadasha", gochar: "Transit · Gochar", guna_milan: "Compatibility · Guna Milan", vastu: "Vastu Home Analysis", muhurat: "Auspicious Timing · Muhurat", panchang: "Daily Calendar · Panchang", lagna: "Ascendant · Lagna", tithi: "Tithi", yoga: "Yoga", karana: "Karana" } };
  if (path === "/config") return { feature_flags: { lifetime_offer: false }, free_chat_allowance: 10, fairuse_daily_messages: 40, paywall: { products }, persistence_enabled: false, preview: true };
  if (path.startsWith("/geo/search")) {
    const query = new URL(path, "https://preview.local").searchParams.get("q") || "Kolkata";
    return { results: [{ place_id: "preview-city", description: `${query}, India` }] };
  }
  if (path.startsWith("/geo/details")) return { formatted_address: "Kolkata, West Bengal, India", lat: 22.5726, lon: 88.3639, tz_name: "Asia/Kolkata" };
  if (path === "/today" || path.startsWith("/today?day=")) {
    const tomorrow = path.startsWith("/today?day=");
    const language = previewCurrentProfile.language || "en";
    const reading = language === "bn" ? {
      title: tomorrow ? "আগামীকালের নতুন দিশা" : "ধীরে এগোনোর দিন",
      theme: tomorrow ? "আগামীকাল একটি গুরুত্বপূর্ণ সিদ্ধান্ত নিয়ে একটু সময় দিলে পথ পরিষ্কার হতে পারে।" : "আজ ধৈর্য ধরে এগোলে নিজের অগ্রগতি আরও স্পষ্ট হতে পারে।",
      signals: ["বৃষ রাশিতে চাঁদ স্থিরতার দিকে মন টানতে পারে।", "চলমান চন্দ্র পর্বে অনুভূতিগুলো একটু মন দিয়ে দেখুন।"],
      action: "নতুন কিছু শুরু করার আগে একটি গুরুত্বপূর্ণ কাজ শেষ করুন।",
    } : {
      title: tomorrow ? "A clearer next step" : "A steadier way forward",
      theme: tomorrow ? "Tomorrow may favour one focused decision over several rushed ones. Make room to review the facts before committing." : "A steady Moon supports patient progress today. Clarity may come through completion rather than urgency.",
      signals: ["The Moon in Taurus may favour a grounded pace.", "Your current Moon period can make emotional clarity worth noticing."],
      action: "Give one important task your full attention before widening your focus.",
    };
    return {
    greeting: "Good evening", name: "Maya", date: tomorrow ? new URL(path, "https://preview.local").searchParams.get("day") : new Date().toISOString().slice(0, 10), moon_today: { phase: "Waxing Gibbous", sign: "Taurus", nakshatra: "Rohini" },
    energy: { career: { value: 4, label: "Strong" }, relationships: { value: 3, label: "Reflective" }, energy: { value: 4, label: "Steady" }, self: { value: 4, label: "Steady" }, wellbeing: { value: 4, label: "Steady" }, love: { value: 3, label: "Reflective" }, money: { value: 4, label: "Strong" }, family: { value: 3, label: "Moderate" }, learning: { value: 4, label: "Strong" }, spiritual: { value: 4, label: "Steady" } },
    insight: reading.theme, reading, language,
    current_period: { mahadasha: "Moon", antardasha: "Jupiter" }, panchang: previewPanchang(),
    daily_tarot: { cards: [{ name: "The Star", orientation: "upright", keywords: "renewal, hope, direction" }] },
    };
  }
  if (path === "/chart") return { chart, dasha: { mahadashas: dashas }, numerology: { life_path: 7 }, terminology_mode: "both" };
  if (path === "/dasha") return { current_mahadasha: dashas[2], current_antardasha: { lord: "Jupiter" }, mahadashas: dashas };
  if (path === "/transits") return {
    reference: "lagna", moon_today: { phase: "Waxing Gibbous", sign: "Taurus", nakshatra: "Rohini" },
    transits: planets.slice(0, 7).map((planet, index) => ({ planet: planet.name, sign: planet.sign, nakshatra: planet.nakshatra, retrograde: planet.retrograde, house_from_moon: (index * 2 + 1) % 12 + 1 })),
  };
  if (path.startsWith("/panchang")) return previewPanchang(new URL(path, "https://preview.local").searchParams.get("date") || undefined);
  if (path === "/numerology") return { life_path: 7, birth_number: 3, personal_year: 8, name_number: 6, soul_urge: 9 };
  if (path === "/tarot/draw") {
    const cards = [
      { position: "Past", name: "The Hermit", orientation: "upright", keywords: "reflection, inner guidance" },
      { position: "Present", name: "The Star", orientation: "upright", keywords: "renewal, calm direction" },
      { position: "Future", name: "Strength", orientation: "upright", keywords: "courage, gentle resolve" },
    ];
    return { cards: body?.spread === "one" ? cards.slice(1, 2) : cards, interpretation: "The thread across these cards is quiet confidence. What you have learned in solitude can now become a gentler, steadier way forward." };
  }
  if (path === "/compatibility") return { guna_milan: { total: 27, verdict: "supportive", kootas: [{ name: "Varna", obtained: 1, max: 1 }, { name: "Vashya", obtained: 1.5, max: 2 }, { name: "Tara", obtained: 2, max: 3 }, { name: "Yoni", obtained: 3, max: 4 }, { name: "Graha Maitri", obtained: 4, max: 5 }, { name: "Gana", obtained: 5, max: 6 }, { name: "Bhakoot", obtained: 5.5, max: 7 }, { name: "Nadi", obtained: 5, max: 8 }] }, partner_moon_sign: "Cancer", premium: false, overview: null, locked: true };
  if (path === "/vastu/analyze") {
    const rooms = body?.rooms || [];
    const findings = rooms.map((room: any, index: number) => ({ room: room.name || room.room_type, zone: ["NE", "E", "SE", "S", "SW", "W", "NW", "N"][index % 8], status: index % 3 === 0 ? "ideal" : "neutral", severity: index % 3 === 0 ? "strong" : "review" }));
    return { premium: false, advice: null, analysis: { score: 82, strong_areas: findings.filter((item: any) => item.severity === "strong").map((item: any) => item.room), review_areas: findings.filter((item: any) => item.severity !== "strong").map((item: any) => item.room), findings } };
  }
  if (path === "/vastu/parse-floorplan") return { rooms: [{ room_type: "living", name: "Living room", x: 8, y: 8, width: 44, height: 34 }, { room_type: "kitchen", name: "Kitchen", x: 56, y: 8, width: 34, height: 28 }, { room_type: "master_bedroom", name: "Master bedroom", x: 8, y: 48, width: 38, height: 42 }, { room_type: "bathroom", name: "Bathroom", x: 52, y: 50, width: 20, height: 22 }], notes: "Four labelled rooms detected. Confirm before analysis." };
  if (path === "/conversations" && method === "GET") return { conversations: [{ id: "preview-1", title: "Career direction this season", updated_at: new Date().toISOString() }] };
  if (path === "/conversations/preview-1/messages") return { messages: [{ role: "user", content: "What does this period emphasize for my career?" }, { role: "assistant", content: "Your current Moon period may bring greater attention to belonging, intuition and work that feels personally meaningful. Jupiter’s sub-period supports learning and wise mentorship." }] };
  if (path === "/conversations" && method === "POST") return { id: "preview-new", title: "New conversation" };
  if (path === "/entitlement") return { tier: "free", premium: false, source: "preview" };
  if (path === "/profile") {
    if (method === "PATCH") previewRuntime.__astronowPreviewProfile = previewCurrentProfile = { ...previewCurrentProfile, ...body };
    return previewCurrentProfile;
  }
  if (path === "/birth-profile" && method === "GET") return { profile: previewCurrentProfile, locked: true, changes_remaining: 1 - previewCurrentProfile.birth_details_change_count };
  if (path === "/birth-profile" && method === "PATCH") {
    if (previewCurrentProfile.birth_details_change_count >= 1) throw new Error("Your one birth-detail correction has already been used.");
    previewRuntime.__astronowPreviewProfile = previewCurrentProfile = { ...previewCurrentProfile, ...body, birth_details_change_count: 1 };
    return { profile: previewCurrentProfile, locked: true, changes_remaining: 0 };
  }
  if (path === "/usage") return { premium: false, period: "month", used: 3, allowance: 10, bonus: previewRuntime.__astronowBonus ?? 0, remaining: 7 + (previewRuntime.__astronowBonus ?? 0) };
  if (path === "/referral") return { code: "L6ZR6VMP", invited: 1, earned: 2, bonus_per_friend: 2, can_redeem: !previewRuntime.__astronowBonus };
  if (path === "/referral/redeem") {
    if (String(body?.code || "").toUpperCase() !== "FRIEND22") throw new Error("That invite code was not found. Check it and try again.");
    previewRuntime.__astronowBonus = 2;
    return { redeemed: true, bonus: 2 };
  }
  if (path === "/family" && method === "GET") return { members: previewFamily(), limit: 1, premium: false };
  if (path === "/family" && method === "POST") {
    const member = { id: `m${Date.now()}`, name: body?.name || "Family", relation: body?.relation, dob: body?.dob, birthplace: body?.birthplace, moon_sign: "Cancer", sun_sign: "Libra", lagna: "Scorpio" };
    previewRuntime.__astronowFamily = [...previewFamily(), member];
    return member;
  }
  if (path.startsWith("/family/") && path.endsWith("/today")) {
    const member = previewFamily().find((m) => path.includes(m.id));
    const base = await previewRequest("GET", "/today");
    return { ...base, name: member?.name || "Family", energy: { ...base.energy, career: { value: 3, label: "Moderate" }, love: { value: 5, label: "Excellent" }, self: { value: 3, label: "Moderate" } } };
  }
  if (path.startsWith("/family/") && method === "DELETE") {
    previewRuntime.__astronowFamily = previewFamily().filter((m) => !path.includes(m.id));
    return { deleted: true };
  }
  if (path.startsWith("/moon-calendar")) return previewMoonCalendar(path);
  if (path === "/muhurat/activities") return { activities: [
    { id: "travel", label: "Travel" }, { id: "business", label: "Sign a deal or start a business" }, { id: "property", label: "Buy property or a vehicle" },
    { id: "job", label: "Join a new job" }, { id: "housewarming", label: "Griha pravesh (housewarming)" }, { id: "engagement", label: "Engagement or marriage talks" }] };
  if (path.startsWith("/muhurat?")) {
    const start = new Date();
    const results = [85, 85, 70, 60, 60, 45].map((score, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 2 + i * 3);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
      return i === 0 ? { date: iso, weekday, score, locked: false, tithi: "Dwitiya", paksha: "Shukla", nakshatra: "Ashwini",
        best_window: { start: "11:03 AM", end: "11:51 AM" }, avoid_window: { start: "1:30 PM", end: "3:00 PM" }, sunrise: "5:27 AM", sunset: "5:26 PM",
        reasons: ["Ashwini nakshatra is traditionally favourable for this", "Dwitiya tithi supports new beginnings", "Waxing moon (Shukla paksha) favours growth"], cautions: [] }
        : { date: iso, weekday, score, locked: true };
    });
    return { activity: "travel", label: "Travel", premium: false, results };
  }
  if (path === "/account" && method === "DELETE") return { deleted: true };
  return {};
}

function previewFamily(): any[] {
  return previewRuntime.__astronowFamily || [];
}

function previewMoonCalendar(path: string) {
  const params = new URL(path, "https://preview.local").searchParams;
  const now = new Date();
  const year = Number(params.get("year")) || now.getFullYear();
  const month = Number(params.get("month")) || now.getMonth() + 1;
  const names = ["Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi"];
  const knownNew = Date.UTC(2026, 9, 10);
  const days = [];
  for (let day = 1; day <= new Date(year, month, 0).getDate(); day++) {
    const t = Date.UTC(year, month - 1, day);
    const age = (((t - knownNew) / 86400000) % 29.53 + 29.53) % 29.53;
    const n = Math.min(30, Math.floor(age / 29.53 * 30) + 1);
    const waxing = n <= 15;
    const name = n === 15 ? "Purnima" : n === 30 ? "Amavasya" : names[(n - 1) % 15];
    const events = [];
    if (n === 15) events.push("Purnima · Full moon");
    if (n === 30) events.push("Amavasya · New moon");
    if (name === "Ekadashi") events.push("Ekadashi · fasting day");
    if (name === "Trayodashi") events.push("Pradosh");
    if (name === "Chaturthi") events.push(waxing ? "Vinayaka Chaturthi" : "Sankashti Chaturthi");
    days.push({ date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, tithi: name, tithi_number: n,
      paksha: waxing ? "Shukla" : "Krishna", nakshatra: "Rohini", illumination: Math.round((1 - Math.abs(1 - 2 * n / 30)) * 1000) / 1000,
      waxing, events, sunrise: "5:40 AM", sunset: "5:20 PM" });
  }
  return { year, month, days };
}

export async function previewStream(content: string, onChunk: (text: string) => void) {
  const base = content.toLowerCase().includes("career")
    ? "Your current Moon–Jupiter period may favour patient expansion: learning, teaching, or work that connects expertise with care. This is less a signal to rush and more an invitation to choose the path that can deepen over time."
    : "This moment may be asking for steadiness before certainty. Your chart suggests that clarity grows when you name what is actually within your control, then take one grounded step from there.";
  const reply = base + " A practical place to begin: write down the smallest decision you can make this week.";
  for (const part of reply.match(/.{1,18}(?:\s|$)/g) || [reply]) {
    await new Promise((resolve) => setTimeout(resolve, 35));
    onChunk(part);
  }
}
