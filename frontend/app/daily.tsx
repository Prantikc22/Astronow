import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { LayoutAnimation, Platform, UIManager, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, withTiming } from "react-native-reanimated";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { CountUp } from "@/src/components/CountUp";
import { DayTimeline } from "@/src/components/DayTimeline";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { ProgressBar } from "@/src/components/ProgressBar";
import { ErrorState, Screen } from "@/src/components/Screen";
import { Skeleton } from "@/src/components/Skeleton";
import { UpsellSheet, useNudge } from "@/src/components/UpsellSheet";
import { WeekStrip } from "@/src/components/WeekStrip";
import { AREAS, areaMeter, dayRuler, dayScore, meterPercent, scoreTone, type AreaKey } from "@/src/content/day-insights";
import { dailyCopy, dailyReading, moonPhaseLabel, moonPosition, readingLocale } from "@/src/content/daily-reading";
import { translateText } from "@/src/i18n";
import { rise } from "@/src/motion";
import { todayPath, useActiveProfile } from "@/src/store/active-profile";
import { useAuth } from "@/src/store/auth";
import { makeStyles, radii, useTheme } from "@/src/theme";

if (Platform.OS === "android") UIManager.setLayoutAnimationEnabledExperimental?.(true);

export default function DailyReading() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ offset?: string; area?: string }>();
  const { profile, entitlement } = useAuth();
  const { active } = useActiveProfile();
  const nudge = useNudge("daily-year", 24);
  const [sheet, setSheet] = useState(false);
  const [opened, setOpened] = useState(0);
  const language = profile?.language || "en";
  const copy = dailyCopy(language);
  const locale = readingLocale(language);
  const [selectedOffset, setSelectedOffset] = useState(() => Math.max(-3, Math.min(3, Number(params.offset) || 0)));
  const [open, setOpen] = useState<AreaKey | null>((params.area as AreaKey) || null);
  const todayDate = new Date();
  const selectedDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + selectedOffset);
  const selectedDay = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
  const available = selectedOffset === 0 || selectedOffset === 1;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...(selectedOffset === 0 ? ["today", language] : ["today", language, selectedDay]), ...(active ? ["member", active.id] : [])],
    queryFn: () => api.get(todayPath(active, selectedOffset === 0 ? undefined : selectedDay)),
    enabled: available, staleTime: 10 * 60 * 1000,
    refetchInterval: (query) => query.state.data?.reading_status === "generating" ? 5000 : false,
  });
  const reading = dailyReading(data, language);
  const score = available ? dayScore(data?.energy) : null;
  const ruler = dayRuler(selectedDate);
  const askAbout = (q: string) => router.push({ pathname: "/(tabs)/ask", params: { q, at: String(Date.now()) } });
  const toggle = (key: AreaKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(260, "easeInEaseOut", "opacity"));
    setOpen((current) => (current === key ? null : key));
    const count = opened + 1;
    setOpened(count);
    // Someone reading a second life area is engaged: offer the whole year once a day.
    if (count === 2 && !entitlement.premium && nudge.ready) setTimeout(() => { setSheet(true); nudge.markShown(); }, 900);
  };

  return (
    <Screen title={`${active?.name || profile?.first_name || "Your"}'s insights`} subtitle={(selectedOffset === 0 ? copy.today.charAt(0) + copy.today.slice(1).toLowerCase() + " · " : "") + selectedDate.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })} back>
      <Animated.View entering={rise(0)} style={{ marginTop: 6 }}>
        <WeekStrip language={language} selected={selectedOffset} scores={{ [selectedOffset]: score }} onSelect={setSelectedOffset}
          todayLabel={selectedOffset === 1 ? tomorrowLabel(language) : copy.today} />
      </Animated.View>

      {!available ? <Animated.View entering={FadeIn} style={styles.unavailable} testID="daily-unavailable">
        <Icon name={selectedOffset < 0 ? "clock" : "moon"} size={27} color={colors.gold} />
        <AppText variant="title" style={{ marginTop: 12 }}>{availabilityMessage(language, selectedOffset).title}</AppText>
        <AppText variant="body" muted style={{ marginTop: 8 }}>{availabilityMessage(language, selectedOffset).body}</AppText>
        <Button label={language === "bn" ? "আজকের পাঠ দেখুন" : translateText("Read your full day", language)} variant="secondary" onPress={() => setSelectedOffset(0)} style={{ marginTop: 20 }} />
      </Animated.View> : null}
      {available && isLoading ? <View style={{ gap: 12, marginTop: 24 }}><Skeleton height={260} radius={radii.xl} /><Skeleton height={120} radius={radii.lg} /><Skeleton height={120} radius={radii.lg} /></View> : null}
      {available && isError ? <ErrorState onRetry={refetch} /> : null}
      {available && data ? <View key={selectedOffset} style={styles.content}>

        <Animated.View entering={rise(1)}>
          <LinearGradient colors={["#1F2148", "#191632", "#2A1535"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summary} testID="daily-full-reading">
            <View style={styles.rulerPill}>
              <View style={[styles.colorDot, { backgroundColor: ruler.color, shadowColor: ruler.color }]} />
              <AppText variant="body">Wear {ruler.colorName}</AppText>
              <View style={styles.pillDivider} />
              <AppText variant="body" muted>Lucky</AppText>
              <AppText variant="title" style={{ fontSize: 24, lineHeight: 28 }}>{ruler.number}</AppText>
            </View>
            <AppText variant="label" center style={{ color: colors.coralSoft, marginTop: 18, letterSpacing: 1.2 }}>{score != null ? scoreTone(score).toUpperCase() : copy.glance}</AppText>
            <AppText variant="title" center style={{ marginTop: 8, fontSize: 25, lineHeight: 32 }}>{reading.title}</AppText>
            <AppText variant="body" center style={{ color: "rgba(248,242,232,0.82)", lineHeight: 25, marginTop: 10 }}>{reading.theme}</AppText>
            <AppText variant="caption" muted center style={{ marginTop: 12 }}>{moonPhaseLabel(data.moon_today?.phase, language)} · {moonPosition(data.moon_today?.sign, data.moon_today?.nakshatra, language)}</AppText>
            <View style={{ marginTop: 18, alignItems: "center" }}>
              <Button label={copy.ask} variant="rose" icon="message-circle" full={false} onPress={() => askAbout(translateText("What should I focus on today?", language))} shine />
            </View>
          </LinearGradient>
        </Animated.View>

        {reading.signals.length ? (
          <Animated.View entering={rise(2)} style={styles.signals}>
            <AppText variant="label" style={{ color: colors.violet, letterSpacing: 1.1 }}>WHY TODAY FEELS THIS WAY</AppText>
            {reading.signals.map((signal, index) => <View key={index} style={styles.signalRow}>
              <View style={styles.signalIcon}><Icon name="sparkle" size={12} color={colors.violet} weight="fill" /></View>
              <AppText variant="body" muted style={{ flex: 1, lineHeight: 23 }}>{signal}</AppText>
            </View>)}
          </Animated.View>
        ) : null}

        {data.panchang ? (
          <Animated.View entering={rise(3)} style={styles.card}>
            <AppText variant="label" style={{ color: colors.coralSoft, letterSpacing: 1.1 }}>{copy.timing}</AppText>
            <AppText variant="title" style={{ marginTop: 3, marginBottom: 12 }}>Timeline</AppText>
            <DayTimeline sunrise={data.panchang.sunrise} sunset={data.panchang.sunset} good={data.panchang.abhijit_muhurat} pause={data.panchang.rahu_kalam} />
          </Animated.View>
        ) : null}

        <Animated.View entering={rise(4)}>
          <AppText variant="display" style={{ fontSize: 30 }}>Daily insights</AppText>
          <AppText variant="body" muted style={{ marginTop: 2 }}>Here&apos;s your day at a glance</AppText>
        </Animated.View>
        <View style={{ gap: 10, marginTop: -8 }}>
          {AREAS.map((area, index) => {
            const meter = areaMeter(data.energy, area.key);
            const pct = meterPercent(meter);
            const generated = reading.categories.find((item) => item.id === area.key);
            const summary = generated?.summary || (language !== "en" && language !== "bn" ? reading.theme : areaText(area.key, meter.label, language));
            const focus = generated?.focus || (language !== "en" && language !== "bn" ? reading.action : areaFocus(area.key, language));
            const isOpen = open === area.key;
            return (
              <Animated.View key={area.key} entering={rise(5 + index, 45)}>
                <MotionPressable onPress={() => toggle(area.key)} pressScale={0.985} style={[styles.area, isOpen && { borderColor: area.tint[1] + "80" }]} testID={`daily-area-${area.key}`}
                  accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
                  <View style={{ flexDirection: "row", gap: 14 }}>
                    <LinearGradient colors={area.tint} style={styles.medal}><Icon name={area.icon} size={24} color={colors.ink} weight="duotone" /></LinearGradient>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <AppText variant="label" style={{ color: colors.muted, letterSpacing: 1, flex: 1 }}>{categoryTitle(area.key, area.title, language).toUpperCase()}</AppText>
                        <Chevron open={isOpen} />
                      </View>
                      <AppText variant="body" numberOfLines={isOpen ? undefined : 2} style={{ marginTop: 5, lineHeight: 23 }}>{summary}</AppText>
                    </View>
                  </View>
                  {isOpen ? (
                    <Animated.View entering={FadeIn.duration(260)} style={styles.focus}>
                      <Icon name="arrow-right" size={14} color={area.tint[0]} />
                      <AppText variant="caption" style={{ color: colors.onSurface, flex: 1 }}>{focus}</AppText>
                    </Animated.View>
                  ) : null}
                  <View style={styles.areaFoot}>
                    <View style={{ flex: 1 }}><ProgressBar value={pct / 100} delay={200 + index * 60} colors={area.tint} /></View>
                    <CountUp value={pct} suffix="%" variant="label" delay={200 + index * 60} color={colors.muted} style={{ width: 40, textAlign: "right" }} />
                    <MotionPressable onPress={() => askAbout(translateText(`Tell me more about my ${area.title.toLowerCase()} today`, language))} style={styles.askBtn} haptic="light">
                      <AppText variant="label" style={{ color: colors.onSurface }}>Ask</AppText>
                      <Icon name="arrow-right" size={14} color={colors.onSurface} />
                    </MotionPressable>
                  </View>
                </MotionPressable>
              </Animated.View>
            );
          })}
        </View>

        <View style={styles.actionCard}>
          <AppText variant="label" style={{ color: colors.gold }}>{copy.intention}</AppText>
          <AppText variant="title" style={{ marginTop: 8 }}>{reading.action || (language === "bn" ? "আজ একটি বিষয়কে পুরো মনোযোগ দিন।" : "Give one important thing your full attention.")}</AppText>
        </View>
      </View> : null}
      <UpsellSheet visible={sheet} kind="year-ahead" onClose={() => setSheet(false)} />
    </Screen>
  );
}

function Chevron({ open }: { open: boolean }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(open ? "180deg" : "0deg", { duration: 240 }) }] }), [open]);
  return <Animated.View style={style}><Icon name="chevron-down" size={18} color={colors.muted} /></Animated.View>;
}

function tomorrowLabel(language: string): string {
  return ({ en: "TOMORROW", hi: "कल", bn: "আগামীকাল", ta: "நாளை", te: "రేపు", es: "MAÑANA", fr: "DEMAIN", de: "MORGEN", pt: "AMANHÃ" } as Record<string, string>)[language] || "TOMORROW";
}

function availabilityMessage(language: string, offset: number): { title: string; body: string } {
  const messages: Record<string, { past: [string, string]; future: [string, string] }> = {
    en: { past: ["That day has passed", "Choose today or tomorrow for a current reading."], future: ["Your reading is on its way", "This day's horoscope will be ready when the day arrives. Tomorrow's preview is available now."] },
    hi: { past: ["यह दिन बीत चुका है", "नई रीडिंग के लिए आज या कल चुनें।"], future: ["आपकी रीडिंग आने वाली है", "इस दिन का राशिफल उसी दिन उपलब्ध होगा। कल की झलक अभी देखें।"] },
    bn: { past: ["দিনটি পেরিয়ে গেছে", "নতুন পাঠের জন্য আজ বা আগামীকাল বেছে নিন।"], future: ["আপনার পাঠ আসছে", "এই দিনের রাশিফল সেদিনই পাওয়া যাবে। আগামীকালের পাঠ এখনই দেখতে পারেন।"] },
    ta: { past: ["அந்த நாள் கடந்துவிட்டது", "புதிய வாசிப்புக்கு இன்று அல்லது நாளையைத் தேர்ந்தெடுக்கவும்."], future: ["உங்கள் வாசிப்பு விரைவில் வரும்", "அந்த நாளுக்கான பலன் அன்றே கிடைக்கும். நாளைய முன்னோட்டம் இப்போது உள்ளது."] },
    te: { past: ["ఆ రోజు గడిచిపోయింది", "కొత్త రీడింగ్ కోసం ఈ రోజు లేదా రేపు ఎంచుకోండి."], future: ["మీ రీడింగ్ త్వరలో వస్తుంది", "ఆ రోజు జాతక ఫలితం అదే రోజు అందుబాటులో ఉంటుంది. రేపటి ముందస్తు చూపు ఇప్పుడే ఉంది."] },
    es: { past: ["Ese día ya pasó", "Elige hoy o mañana para una lectura actual."], future: ["Tu lectura está en camino", "El horóscopo de ese día estará disponible cuando llegue. Ya puedes ver el adelanto de mañana."] },
    fr: { past: ["Ce jour est passé", "Choisissez aujourd'hui ou demain pour une lecture actuelle."], future: ["Votre lecture arrive", "L'horoscope de ce jour sera disponible le jour même. L'aperçu de demain est déjà prêt."] },
    de: { past: ["Dieser Tag ist vorbei", "Wähle heute oder morgen für eine aktuelle Deutung."], future: ["Deine Deutung kommt", "Das Horoskop für diesen Tag erscheint, wenn er beginnt. Die Vorschau für morgen ist schon da."] },
    pt: { past: ["Esse dia já passou", "Escolha hoje ou amanhã para uma leitura atual."], future: ["Sua leitura está chegando", "O horóscopo desse dia estará disponível quando ele chegar. A prévia de amanhã já está aqui."] },
  };
  const [title, body] = (messages[language] || messages.en)[offset < 0 ? "past" : "future"];
  return { title, body };
}

function areaText(key: string, label: string, language: string) {
  if (language === "bn") {
    const bn: Record<string, string> = {
      self: "নিজের কণ্ঠে ভরসা রাখুন, তবে সিদ্ধান্তের আগে এক মুহূর্ত থামুন।",
      wellbeing: "শরীর ও মনের ছন্দ লক্ষ্য করুন; বিশ্রাম ও কাজের মধ্যে ভারসাম্য রাখুন।",
      career: "একটি স্পষ্ট কাজ আগে শেষ করুন। তারপর নতুন কাজ শুরু করুন।",
      money: "আজ ছোট, বাস্তব আর্থিক সিদ্ধান্তে মন দিন; তাড়াহুড়ো এড়িয়ে চলুন।",
      love: "প্রথম প্রতিক্রিয়ার আড়ালে অন্যের কথা মন দিয়ে শুনুন।",
      family: "ঘরের মানুষের সঙ্গে শান্ত, পরিষ্কার কথোপকথনের জন্য সময় রাখুন।",
      learning: "যে তথ্যটি সবচেয়ে দরকার, সেটি আগে বোঝার চেষ্টা করুন।",
      spiritual: "কাজ আর প্রতিক্রিয়ার মাঝে নিজের জন্য একটু নীরব সময় রাখুন।",
    };
    return bn[key] || bn.self;
  }
  const tone = String(label).toLowerCase();
  const text: Record<string, string> = {
    self: `Your inner rhythm feels ${tone}. Let confidence and reflection work together before you choose a direction.`,
    wellbeing: `Your wellbeing rhythm is ${tone}. Notice where a steadier pace would help you stay present.`,
    career: `A ${tone} work rhythm rewards focus. Finish the clearest priority before opening another loop.`,
    money: `Your resource rhythm looks ${tone}. Prefer clear, practical choices over an emotional or hurried response.`,
    love: `Connection feels ${tone}. Listen for what is being asked beneath the first reaction.`,
    family: `Home and family energy feels ${tone}. A calm, direct conversation can create more ease than assumption.`,
    learning: `Your learning rhythm is ${tone}. Follow the question that brings useful clarity, not just more information.`,
    spiritual: `Your inner life feels ${tone}. Protect a little quiet space between effort and response.`,
  };
  return text[key] || text.self;
}

function categoryTitle(key: string, fallback: string, language: string): string {
  const titles: Record<string, Record<string, string>> = {
    hi: { self: "स्वयं और आत्मविश्वास", wellbeing: "सेहत और संतुलन", career: "काम और उद्देश्य", money: "धन और संसाधन", love: "प्रेम और जुड़ाव", family: "घर और परिवार", learning: "सीख और निर्णय", spiritual: "अंतरमन" },
    bn: { self: "নিজস্ব সত্তা ও আত্মবিশ্বাস", wellbeing: "সুস্থতা", career: "কাজ ও উদ্দেশ্য", money: "অর্থ ও সম্পদ", love: "ভালোবাসা ও সংযোগ", family: "ঘর ও পরিবার", learning: "শেখা ও সিদ্ধান্ত", spiritual: "অন্তর্জগৎ" },
    ta: { self: "சுயமும் நம்பிக்கையும்", wellbeing: "நலவாழ்வு", career: "வேலையும் நோக்கமும்", money: "பணமும் வளங்களும்", love: "அன்பும் இணைப்பும்", family: "வீடும் குடும்பமும்", learning: "கற்றலும் முடிவுகளும்", spiritual: "உள்ளார்ந்த வாழ்க்கை" },
    te: { self: "స్వయం మరియు ఆత్మవిశ్వాసం", wellbeing: "శ్రేయస్సు", career: "పని మరియు లక్ష్యం", money: "ధనం మరియు వనరులు", love: "ప్రేమ మరియు అనుబంధం", family: "ఇల్లు మరియు కుటుంబం", learning: "నేర్చుకోవడం మరియు నిర్ణయాలు", spiritual: "అంతరంగ జీవితం" },
    es: { self: "Identidad y confianza", wellbeing: "Bienestar", career: "Trabajo y propósito", money: "Dinero y recursos", love: "Amor y conexión", family: "Hogar y familia", learning: "Aprendizaje y decisiones", spiritual: "Vida interior" },
    fr: { self: "Soi et confiance", wellbeing: "Bien-être", career: "Travail et vocation", money: "Argent et ressources", love: "Amour et liens", family: "Foyer et famille", learning: "Apprentissage et décisions", spiritual: "Vie intérieure" },
    de: { self: "Selbst und Vertrauen", wellbeing: "Wohlbefinden", career: "Arbeit und Sinn", money: "Geld und Ressourcen", love: "Liebe und Verbindung", family: "Zuhause und Familie", learning: "Lernen und Entscheidungen", spiritual: "Inneres Leben" },
    pt: { self: "Eu e confiança", wellbeing: "Bem-estar", career: "Trabalho e propósito", money: "Dinheiro e recursos", love: "Amor e conexão", family: "Lar e família", learning: "Aprendizado e decisões", spiritual: "Vida interior" },
  };
  return titles[language]?.[key] || fallback;
}

function areaFocus(key: string, language: string): string {
  const en: Record<string, string> = { self: "Name what you want before seeking outside approval.", wellbeing: "Build one deliberate pause into the day.", career: "Complete the task with the clearest consequence.", money: "Review one practical choice without rushing it.", love: "Ask one honest question and leave room for the answer.", family: "Make one small gesture that brings steadiness home.", learning: "Turn one useful insight into a concrete next step.", spiritual: "Take ten quiet minutes without trying to solve anything." };
  const bn: Record<string, string> = { self: "অন্যের মতামত চাওয়ার আগে নিজের ইচ্ছাটি স্পষ্ট করুন।", wellbeing: "দিনের মধ্যে একটি সচেতন বিরতি রাখুন।", career: "সবচেয়ে গুরুত্বপূর্ণ কাজটি আগে শেষ করুন।", money: "তাড়াহুড়ো না করে একটি বাস্তব সিদ্ধান্ত পর্যালোচনা করুন।", love: "একটি সৎ প্রশ্ন করুন এবং উত্তর শোনার সময় দিন।", family: "ঘরে স্থিরতা আনে এমন একটি ছোট কাজ করুন।", learning: "একটি উপকারী উপলব্ধিকে বাস্তব পদক্ষেপে বদলান।", spiritual: "কিছু সমাধান না করেই দশ মিনিট নীরবে থাকুন।" };
  return language === "bn" ? bn[key] || bn.self : translateText(en[key] || en.self, language);
}

const useStyles = makeStyles((colors) => ({
  content: { gap: 24, paddingTop: 24 },
  unavailable: { marginTop: 28, padding: 24, borderRadius: radii.xl, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderStrong },
  summary: { padding: 22, borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(217,121,162,0.3)" },
  rulerPill: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, height: 48, borderRadius: 14, backgroundColor: "rgba(11,11,26,0.55)", borderWidth: 1, borderColor: colors.border },
  colorDot: { width: 18, height: 18, borderRadius: 9, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  pillDivider: { width: 1, height: 24, backgroundColor: colors.borderStrong },
  signals: { padding: 20, borderRadius: radii.xl, backgroundColor: "rgba(21,20,43,0.92)", borderWidth: 1, borderColor: colors.border },
  signalRow: { flexDirection: "row", alignItems: "flex-start", gap: 11, marginTop: 13 },
  signalIcon: { width: 22, height: 22, borderRadius: 11, marginTop: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(168,160,232,0.14)" },
  card: { padding: 20, borderRadius: radii.xl, backgroundColor: "rgba(21,20,43,0.92)", borderWidth: 1, borderColor: colors.border },
  area: { padding: 18, borderRadius: radii.xl, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.border },
  medal: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.15)" },
  focus: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: "rgba(235,226,250,0.05)" },
  areaFoot: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  askBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: "rgba(240,160,189,0.55)" },
  actionCard: { padding: 22, borderRadius: radii.xl, backgroundColor: colors.brand, borderWidth: 1, borderColor: colors.glassBorder },
}));
