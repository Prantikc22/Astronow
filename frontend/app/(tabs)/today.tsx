import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Platform, RefreshControl, ScrollView, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  FadeIn,
  cancelAnimation,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { AskBar } from "@/src/components/AskBar";
import { Carousel } from "@/src/components/Carousel";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { CountUp } from "@/src/components/CountUp";
import { DayTimeline } from "@/src/components/DayTimeline";
import { EditorialFooter } from "@/src/components/EditorialFooter";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { ProgressBar } from "@/src/components/ProgressBar";
import { ErrorState } from "@/src/components/Screen";
import { Shine } from "@/src/components/Shine";
import { Skeleton } from "@/src/components/Skeleton";
import { SparkleBurst } from "@/src/components/SparkleBurst";
import { ShareSheet } from "@/src/components/ShareCard";
import { UpsellSheet, useNudge, type UpsellKind } from "@/src/components/UpsellSheet";
import { enableNotifications, getPrefs, syncDailyNotifications } from "@/src/services/notifications";
import { todayPath, useActiveProfile } from "@/src/store/active-profile";
import { WeekStrip } from "@/src/components/WeekStrip";
import { AREAS, areaMeter, dayRuler, dayScore, meterPercent, scoreTone } from "@/src/content/day-insights";
import { dailyReading, moonPosition, readingLocale } from "@/src/content/daily-reading";
import { displayCurrency } from "@/src/content/pricing";
import { REPORTS, reportDisplay, reportPrice } from "@/src/content/reports";
import { translateText } from "@/src/i18n";
import { rise } from "@/src/motion";
import { useAuth } from "@/src/store/auth";
import { useVisitStreak } from "@/src/store/streak";
import { makeStyles, radii, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

const TARA = require("../../assets/images/guides/tara.png");
const QUICK: { label: string; q: string; icon: FeatherName }[] = [
  { label: "Career this month", q: "What does this month hold for my career?", icon: "briefcase" },
  { label: "Love & marriage", q: "What is active in my love life right now?", icon: "heart" },
  { label: "Money timing", q: "When is a good time for me to make a big money decision?", icon: "trending-up" },
  { label: "Should I switch jobs?", q: "Is this a good period for me to switch jobs?", icon: "compass" },
];

export default function Today() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, entitlement } = useAuth();
  const language = profile?.language || "en";
  const { active, members, setActive } = useActiveProfile();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: active ? ["today", language, "member", active.id] : ["today", language], queryFn: () => api.get(todayPath(active)), staleTime: 10 * 60 * 1000,
    refetchInterval: (query) => query.state.data?.reading_status === "generating" ? 5000 : false,
  });
  const reading = dailyReading(data, language);
  // Only a user's pull shows the spinner; background polling while the reading
  // generates must never move the page.
  const [pulling, setPulling] = useState(false);
  const onPull = async () => {
    haptics.light();
    setPulling(true);
    try { await refetch(); } finally { setPulling(false); }
  };
  const streak = useVisitStreak();
  const now = new Date();
  const locale = readingLocale(language);
  const ownName = profile?.first_name || "friend";
  const name = active ? active.name : ownName;
  const { data: usage } = useQuery({ queryKey: ["usage"], queryFn: () => api.get("/usage"), staleTime: 60 * 1000, retry: false });
  const [shareOpen, setShareOpen] = useState(false);
  const [notifPrompt, setNotifPrompt] = useState(false);
  useEffect(() => {
    getPrefs().then(async (prefs) => {
      if (prefs.enabled) return;
      const dismissed = await AsyncStorage.getItem("astronow.notifPromptDismissed").catch(() => null);
      if (!dismissed) setNotifPrompt(true);
    });
  }, []);
  useEffect(() => {
    if (data?.panchang && !active) syncDailyNotifications({ rahu: data.panchang.rahu_kalam, streakDays: streak?.days }).catch(() => {});
  }, [data?.panchang, active, streak?.days]);
  const score = dayScore(data?.energy);
  const ruler = dayRuler(now);
  const dateLabel = now.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });

  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
  const miniHeader = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [70, 130], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [70, 130], [-10, 0], Extrapolation.CLAMP) }],
  }));
  const heroParallax = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, 120], [1, 0.3], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [-100, 0, 200], [30, 0, -40], Extrapolation.CLAMP) }],
  }));

  const nudge = useNudge("home", 36);
  const [sheet, setSheet] = useState(false);
  const rotation: UpsellKind[] = ["plus", "artha-strategy", "plus", "twelve-year-compass", "year-ahead"];
  const sheetKind = rotation[now.getDate() % rotation.length];
  useEffect(() => {
    if (!data || entitlement.premium || !nudge.ready) return;
    const timer = setTimeout(() => { setSheet(true); nudge.markShown(); }, 7000);
    return () => clearTimeout(timer);
  }, [data, entitlement.premium, nudge]);

  const revealed = useRef(false);
  useEffect(() => {
    if (score != null && !revealed.current) {
      revealed.current = true;
      const timer = setTimeout(() => haptics.reveal(), 650);
      return () => clearTimeout(timer);
    }
  }, [score]);

  const artha = REPORTS.find((report) => report.slug === "artha-strategy")!;
  const compass = REPORTS.find((report) => report.slug === "twelve-year-compass")!;
  const match = REPORTS.find((report) => report.slug === "match-report")!;

  return (
    <View style={{ flex: 1 }}>
      <CosmicBackground>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 130, paddingHorizontal: 20 }}
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.gold} />}
        >
          <Animated.View style={heroParallax}>
            <View style={styles.topbar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: "center" }} style={{ flex: 1 }}>
                <ProfileChip label={ownName} selected={!active} onPress={() => setActive(null)} testID="profile-self" />
                {members.map((m) => <ProfileChip key={m.id} label={m.name} selected={active?.id === m.id} onPress={() => setActive(m.id)} testID={`profile-${m.id}`} />)}
                <MotionPressable onPress={() => router.push("/family/add" as any)} style={styles.addChip} accessibilityLabel="Add a family member" testID="profile-add">
                  <Icon name="plus" size={18} color={colors.muted} />
                </MotionPressable>
              </ScrollView>
              {streak ? <StreakChip days={streak.days} fresh={streak.isNew} /> : null}
            </View>
            <AppText variant="caption" muted style={{ marginTop: 14 }}>{active ? `${active.relation ? active.relation + " · " : ""}Family profile` : localGreeting(now.getHours(), language)}</AppText>
            <AppText variant="display" numberOfLines={1} style={{ fontSize: 30, lineHeight: 36 }}>{active ? `${name}'s day` : name}</AppText>
          </Animated.View>

          <Animated.View entering={rise(0)} style={{ marginTop: 18 }}>
            <AskBar />
          </Animated.View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginTop: 12 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {QUICK.map((item, i) => (
              <Animated.View key={item.label} entering={rise(i + 1, 50)}>
                <MotionPressable onPress={() => router.push({ pathname: "/(tabs)/ask", params: { q: translateText(item.q, language), at: String(Date.now()) } })} style={styles.quick} testID={`home-quick-${i}`}>
                  <Icon name={item.icon} size={15} color={colors.goldSoft} weight="duotone" />
                  <AppText variant="caption" style={{ color: colors.onSurface }}>{item.label}</AppText>
                </MotionPressable>
              </Animated.View>
            ))}
          </ScrollView>
          {usage && !usage.premium ? (
            <MotionPressable onPress={() => router.push("/paywall")} style={styles.credits} haptic="light" testID="home-credits">
              <View style={[styles.creditRing, { borderColor: usage.remaining > 2 ? colors.goldSoft : colors.coral }]}><AppText variant="label" style={{ fontSize: 12 }}>{usage.remaining}</AppText></View>
              <AppText variant="caption" style={{ flex: 1, color: colors.onSurface }}>{usage.remaining === 1 ? "question" : "questions"} left this month{usage.bonus ? ` · includes ${usage.bonus} bonus` : ""}</AppText>
              <AppText variant="label" style={{ color: colors.goldSoft }}>Get more</AppText>
              <Icon name="arrow-right" size={14} color={colors.goldSoft} />
            </MotionPressable>
          ) : null}

          {isError ? <ErrorState onRetry={refetch} /> : null}
          {isLoading ? <HomeSkeleton /> : null}

          {data ? (
            <View style={{ gap: 28, marginTop: 24 }}>
              {/* Daily horoscope hero */}
              <Animated.View entering={rise(1)}>
                <MotionPressable onPress={() => router.push("/daily" as any)} pressScale={0.985} haptic="light" testID="today-daily-reading">
                  <LinearGradient colors={["#2A1640", "#1A1433", "#12102A"]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={styles.hero}>
                    <View style={styles.heroGlow} />
                    <View style={styles.heroHead}>
                      <AppText variant="label" style={{ color: colors.muted, letterSpacing: 1 }}>YOUR DAILY HOROSCOPE</AppText>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <AppText variant="label" style={{ color: colors.muted }}>{dateLabel}</AppText>
                        <MotionPressable onPress={() => setShareOpen(true)} hitSlop={10} style={styles.shareBtn} accessibilityLabel="Share your day" testID="home-share">
                          <Icon name="send" size={14} color={colors.onSurface} />
                        </MotionPressable>
                      </View>
                    </View>
                    <View style={{ marginTop: 18 }}>
                      <WeekStrip key={active?.id || "self"} language={language} scores={{ 0: score }} onSelect={(offset) => router.push({ pathname: "/daily", params: { offset: String(offset) } } as any)} />
                    </View>
                    <AppText variant="title" center style={{ marginTop: 20, fontSize: 25, lineHeight: 31 }}>{reading.title}</AppText>
                    {data.reading_status === "generating" ? <Writing /> : null}
                    {score != null ? <AppText variant="caption" center style={{ color: colors.coralSoft, marginTop: 4 }}>{scoreTone(score)} · {moonPosition(data.moon_today?.sign, data.moon_today?.nakshatra, language)}</AppText> : null}
                    <View style={styles.rulerPill}>
                      <View style={[styles.colorDot, { backgroundColor: ruler.color, shadowColor: ruler.color }]} />
                      <AppText variant="body" style={{ color: colors.onSurface }}>Wear {ruler.colorName}</AppText>
                      <View style={styles.pillDivider} />
                      <AppText variant="body" muted>Lucky</AppText>
                      <AppText variant="title" style={{ fontSize: 24, lineHeight: 28 }}>{ruler.number}</AppText>
                    </View>
                    <AppText variant="caption" muted center style={{ marginTop: 8 }}>{ruler.glyph}  Ruled by {ruler.planet} · the day lord in Vedic tradition</AppText>
                    <View style={styles.heroCta}>
                      <AppText variant="label" style={{ color: colors.onSurface, fontSize: 14 }}>Read full day</AppText>
                      <Icon name="arrow-right" size={16} color={colors.onSurface} />
                    </View>
                  </LinearGradient>
                </MotionPressable>
              </Animated.View>

              {/* Life areas */}
              <Animated.View entering={rise(2)}>
                <SectionTitle title="Your day by area" action="All 8" onAction={() => router.push("/daily" as any)} />
                <View style={styles.areaGrid}>
                  {AREAS.slice(0, 4).map((area, i) => {
                    const meter = areaMeter(data.energy, area.key);
                    const pct = meterPercent(meter);
                    return (
                      <MotionPressable key={area.key} onPress={() => router.push({ pathname: "/daily", params: { area: area.key } } as any)} style={styles.areaCell} testID={`home-area-${area.key}`}>
                        <View style={styles.areaTop}>
                          <LinearGradient colors={area.tint} style={styles.areaIcon}><Icon name={area.icon} size={18} color={colors.ink} weight="duotone" /></LinearGradient>
                          <CountUp value={pct} suffix="%" variant="subtitle" delay={300 + i * 90} />
                        </View>
                        <AppText variant="label" style={{ color: colors.muted, marginTop: 14, letterSpacing: 0.8 }}>{area.title.toUpperCase()}</AppText>
                        <AppText variant="body" numberOfLines={1} style={{ marginTop: 2 }}>{meter.label}</AppText>
                        <View style={{ marginTop: 12 }}><ProgressBar value={pct / 100} delay={300 + i * 90} colors={area.tint} height={5} /></View>
                      </MotionPressable>
                    );
                  })}
                </View>
              </Animated.View>

              {/* Timeline */}
              {data.panchang ? (
                <Animated.View entering={rise(3)} style={styles.card}>
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="title">Today&apos;s timeline</AppText>
                      <AppText variant="caption" muted style={{ marginTop: 2 }}>When to act, and when to wait</AppText>
                    </View>
                    <MotionPressable onPress={() => router.push("/(tabs)/calendar")} style={styles.iconBtn} accessibilityLabel="Open Panchang calendar">
                      <Icon name="calendar" size={18} color={colors.goldSoft} />
                    </MotionPressable>
                  </View>
                  <View style={{ marginTop: 14 }}>
                    <DayTimeline sunrise={data.panchang.sunrise} sunset={data.panchang.sunset} good={data.panchang.abhijit_muhurat} pause={data.panchang.rahu_kalam} />
                  </View>
                  <View style={styles.panchangRow}>
                    <Marker label="Tithi" value={data.panchang.tithi?.name} />
                    <Marker label="Nakshatra" value={data.panchang.nakshatra?.name} />
                    <Marker label="Yoga" value={data.panchang.yoga?.name} />
                  </View>
                </Animated.View>
              ) : null}

              {/* Action of the day */}
              <Animated.View entering={rise(4)}>
                <ActionOfDay action={reading.action || "Give one important thing your full attention."} />
              </Animated.View>

              {/* Daily ritual */}
              <Animated.View entering={rise(5)}>
                <MotionPressable onPress={() => router.push("/ritual" as any)} style={styles.ritual} pressScale={0.985} testID="home-ritual">
                  <LinearGradient colors={["#B08A3E", "#6A4A1C"]} style={styles.ritualIcon}><AppText style={{ fontSize: 22, color: "#FFF6E0" }}>{ruler.glyph}</AppText></LinearGradient>
                  <View style={{ flex: 1 }}>
                    <AppText variant="label" style={{ color: colors.goldSoft, letterSpacing: 1 }}>MANTRA OF THE DAY</AppText>
                    <AppText variant="subtitle" style={{ marginTop: 2 }}>{ruler.planet} mantra · 108 japa</AppText>
                    <AppText variant="caption" muted>Two quiet minutes for today&apos;s ruling planet</AppText>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.muted} />
                </MotionPressable>
              </Animated.View>

              {/* Planning tools */}
              <Animated.View entering={rise(5)} style={{ flexDirection: "row", gap: 10 }}>
                <MotionPressable onPress={() => router.push("/muhurat" as any)} style={styles.tool} testID="home-muhurat">
                  <LinearGradient colors={["#F7DDA6", "#E3A866"]} style={styles.toolIcon}><Icon name="calendar" size={18} color={colors.ink} weight="duotone" /></LinearGradient>
                  <AppText variant="subtitle" style={{ marginTop: 12, fontSize: 16 }}>Muhurat finder</AppText>
                  <AppText variant="caption" muted>Best days to travel, sign, buy or begin</AppText>
                </MotionPressable>
                <MotionPressable onPress={() => router.push("/moon" as any)} style={styles.tool} testID="home-moon">
                  <LinearGradient colors={["#E4E1F5", "#8E83E0"]} style={styles.toolIcon}><Icon name="moon" size={18} color={colors.ink} weight="fill" /></LinearGradient>
                  <AppText variant="subtitle" style={{ marginTop: 12, fontSize: 16 }}>Moon calendar</AppText>
                  <AppText variant="caption" muted>Purnima, Ekadashi and festival days</AppText>
                </MotionPressable>
              </Animated.View>

              {notifPrompt ? (
                <Animated.View entering={rise(5)} style={styles.notif}>
                  <Icon name="bell" size={20} color={colors.goldSoft} weight="duotone" />
                  <View style={{ flex: 1 }}>
                    <AppText variant="subtitle" style={{ fontSize: 15 }}>Your reading every morning</AppText>
                    <AppText variant="caption" muted>At 7am, plus a heads-up before Rahu Kaal</AppText>
                  </View>
                  <MotionPressable onPress={async () => { setNotifPrompt(false); await AsyncStorage.setItem("astronow.notifPromptDismissed", "1").catch(() => {}); if (await enableNotifications()) haptics.success(); }} style={styles.notifBtn} testID="home-notif-on">
                    <AppText variant="label" style={{ color: colors.ink }}>Turn on</AppText>
                  </MotionPressable>
                  <MotionPressable onPress={() => { setNotifPrompt(false); AsyncStorage.setItem("astronow.notifPromptDismissed", "1").catch(() => {}); }} hitSlop={10} accessibilityLabel="Dismiss">
                    <Icon name="x" size={16} color={colors.muted} />
                  </MotionPressable>
                </Animated.View>
              ) : null}

              {/* Offers */}
              <Animated.View entering={rise(5)}>
                <SectionTitle title="Deep-dive reports" action="All reports" onAction={() => router.push("/(tabs)/reports")} />
                <View style={{ marginTop: 14 }}>
                  <Carousel>
                    {[
                      <PromoCard key="artha" kicker={reportDisplay(artha, profile?.terminology_mode).eyebrow} title="From financial stress to a clear wealth plan."
                        body="A chart-led playbook for work, money and timing." price={reportPrice(artha)} list={reportPrice(artha, true)}
                        icon="award" colors={["#3D2A12", "#1F1B42"]} onPress={() => router.push(`/report/${artha.slug}` as any)} />,
                      <PromoCard key="compass" kicker="12-YEAR COMPASS" title="See the next twelve years, one chapter at a time."
                        body="Growth windows, turning points and renewal." price={reportPrice(compass)} list={reportPrice(compass, true)}
                        icon="navigation" colors={["#1C2A55", "#171335"]} onPress={() => router.push(`/report/${compass.slug}` as any)} />,
                      <PromoCard key="match" kicker="COMPATIBILITY" title="Two charts. One honest conversation."
                        body="Guna Milan decoded into real relationship patterns." price={reportPrice(match)} list={reportPrice(match, true)}
                        icon="heart" colors={["#4A1838", "#1D1538"]} onPress={() => router.push("/compatibility" as any)} />,
                      <PromoCard key="vastu" kicker="VASTU HOME REPORT" title="Is your home working for you?"
                        body="Upload a floor plan or draw it in the app. Get a room-by-room score." price="Free score" cta="Start"
                        icon="home" colors={["#123A3E", "#171335"]} onPress={() => router.push("/vastu" as any)} />,
                      ...(!entitlement.premium ? [<PromoCard key="plus" kicker="ASTRONOW PLUS" title="Every core report. Daily guidance from Tara."
                        body={`${REPORTS.filter((r) => r.access === "plus").length} deep reports and up to 40 messages a day.`} price={displayCurrency() === "INR" ? "Under ₹6/day" : "Under 11¢/day"} icon="crown" colors={["#2F2462", "#15122E"]} onPress={() => router.push("/paywall")} />] : []),
                    ]}
                  </Carousel>
                </View>
              </Animated.View>

              {/* Invite */}
              <Animated.View entering={rise(6)}>
                <MotionPressable onPress={() => router.push("/invite" as any)} pressScale={0.985} testID="home-invite">
                  <LinearGradient colors={["#3A1638", "#241536"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.invite}>
                    <View style={styles.inviteIcon}><Icon name="gift" size={22} color={colors.goldSoft} weight="duotone" /></View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="subtitle">Earn 2 free questions</AppText>
                      <AppText variant="caption" muted>For every friend who joins with your code. They get 2 too.</AppText>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.muted} />
                  </LinearGradient>
                </MotionPressable>
              </Animated.View>

              {/* Tara's note */}
              <Animated.View entering={rise(6)}>
                <View style={styles.note} testID="today-insight">
                  <View style={styles.noteHead}>
                    <Image source={TARA} style={styles.noteAvatar} contentFit="cover" />
                    <View style={{ flex: 1 }}>
                      <AppText variant="subtitle" style={{ color: colors.ink }}>A note from Tara</AppText>
                      <AppText variant="caption" style={{ color: "#6E6680" }}>Read from your chart this morning</AppText>
                    </View>
                  </View>
                  <AppText variant="body" style={styles.noteBody}>{reading.theme}</AppText>
                  {reading.signals.slice(0, 2).map((signal, i) => (
                    <View key={i} style={styles.signal}><Icon name="sparkle" size={13} color="#9C6A2E" weight="fill" /><AppText variant="caption" style={{ color: "#4E4660", flex: 1 }}>{signal}</AppText></View>
                  ))}
                  <MotionPressable onPress={() => router.push("/(tabs)/ask")} style={styles.noteCta} haptic="light">
                    <AppText variant="label" style={{ color: colors.ivory }}>Ask Tara about today</AppText>
                    <Icon name="arrow-right" size={15} color={colors.ivory} />
                  </MotionPressable>
                </View>
              </Animated.View>

              {/* Life period */}
              {data.current_period?.mahadasha ? (
                <Animated.View entering={rise(7)}>
                  <MotionPressable onPress={() => router.push("/dasha")} style={styles.period} testID="home-period">
                    <View style={styles.periodIcon}><Icon name="hourglass" size={22} color={colors.violet} weight="duotone" /></View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="label" style={{ color: colors.violet, letterSpacing: 1 }}>YOUR LIFE CHAPTER</AppText>
                      <AppText variant="subtitle" style={{ marginTop: 3 }}>{data.current_period.mahadasha} period{data.current_period.antardasha ? ` · ${data.current_period.antardasha} sub-period` : ""}</AppText>
                      <AppText variant="caption" muted style={{ marginTop: 2 }}>See what this chapter asks of you</AppText>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.muted} />
                  </MotionPressable>
                </Animated.View>
              ) : null}

              <EditorialFooter kicker="PRIVATE BY DESIGN" title={"Your chart is personal.\nIt stays yours."} note="Private to your account. Delete anytime from Profile." />
            </View>
          ) : null}
        </Animated.ScrollView>

        {/* Condensed header that fades in on scroll */}
        <Animated.View pointerEvents="none" style={[styles.mini, { paddingTop: insets.top + 6 }, miniHeader]}>
          {Platform.OS === "ios" ? <BlurView tint="dark" intensity={40} style={{ position: "absolute", inset: 0 }} /> : <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(10,9,24,0.94)" }} />}
          <AppText variant="subtitle">{name}</AppText>
          {score != null ? <View style={styles.miniScore}><AppText variant="label" style={{ color: colors.ink }}>{score}% today</AppText></View> : null}
        </Animated.View>
      </CosmicBackground>
      <UpsellSheet visible={sheet} kind={sheetKind} onClose={() => setSheet(false)} />
      <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} data={{
        name, date: now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }), score, title: reading.title,
        tone: score != null ? scoreTone(score) : "", ruler, moon: moonPosition(data?.moon_today?.sign, data?.moon_today?.nakshatra, language),
      }} />
    </View>
  );
}

function ProfileChip({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <MotionPressable onPress={onPress} style={[styles.profileChip, selected && styles.profileChipOn]} testID={testID} accessibilityState={{ selected }}>
      <LinearGradient colors={selected ? [colors.goldSoft, colors.coral] : ["#2E2B4F", "#2E2B4F"]} style={styles.profileInitial}>
        <AppText variant="label" style={{ color: selected ? colors.ink : colors.onSurface, fontSize: 12 }}>{label.charAt(0).toUpperCase()}</AppText>
      </LinearGradient>
      <AppText variant="label" numberOfLines={1} style={{ color: selected ? colors.onSurface : colors.muted, maxWidth: 90 }}>{label}</AppText>
    </MotionPressable>
  );
}

function Writing() {
  const styles = useStyles();
  const { colors } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
    return () => cancelAnimation(t);
  }, [t]);
  const dot = useAnimatedStyle(() => ({ opacity: 0.3 + t.get() * 0.7 }));
  return (
    <Animated.View entering={FadeIn} style={styles.writing}>
      <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.goldSoft }, dot]} />
      <AppText variant="caption" style={{ color: colors.goldSoft }}>Tara is writing today&apos;s full reading…</AppText>
    </Animated.View>
  );
}

function StreakChip({ days, fresh }: { days: number; fresh: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const s = useSharedValue(1);
  useEffect(() => {
    if (fresh) {
      const timer = setTimeout(() => { s.value = withSequence(withSpring(1.25, { damping: 6 }), withSpring(1)); haptics.soft(); }, 900);
      return () => clearTimeout(timer);
    }
  }, [fresh, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[styles.streak, style]} accessibilityLabel={`${days} day streak`}>
      <Icon name="flame" size={16} color="#F29B38" weight="fill" />
      <AppText variant="label" style={{ color: colors.goldSoft }}>{days}</AppText>
      <AppText variant="caption" muted>{days === 1 ? "day" : "days"}</AppText>
    </Animated.View>
  );
}

function ActionOfDay({ action }: { action: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const now = new Date();
  const key = `astronow.ritual.${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const [done, setDone] = useState(false);
  const [burst, setBurst] = useState(0);
  const check = useSharedValue(0);
  useEffect(() => {
    AsyncStorage.getItem(key).then((v) => { if (v === "done") { setDone(true); check.set(1); } }).catch(() => {});
  }, [key, check]);
  const toggle = () => {
    const next = !done;
    setDone(next);
    check.set(withSpring(next ? 1 : 0, { damping: 12, stiffness: 200 }));
    if (next) { setBurst((n) => n + 1); haptics.celebrate(); } else haptics.light();
    AsyncStorage.setItem(key, next ? "done" : "open").catch(() => {});
  };
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + check.value * 0.4 }], opacity: check.value }));
  return (
    <View style={styles.actionWrap}>
      <View style={styles.actionBadge}><AppText variant="label" style={{ color: colors.onSurface }}>Action of the day</AppText></View>
      <LinearGradient colors={["#1C2146", "#191632", "#2B1535"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.action}>
        <AppText variant="title" center style={{ fontSize: 22, lineHeight: 30 }}>“{action}”</AppText>
        <View style={{ marginTop: 20, alignItems: "center" }}>
          <MotionPressable onPress={toggle} haptic="none" testID="today-ritual" accessibilityLabel={done ? "Undo today's action" : "Commit to today's action"}>
            <LinearGradient colors={done ? ["#2F2A5E", "#241F4A"] : ["#8A2A5E", "#5E1F48"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionBtn}>
              {done ? (
                <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, checkStyle]}>
                  <Icon name="check-circle" size={19} color={colors.goldSoft} weight="fill" />
                  <AppText variant="label" style={{ color: colors.goldSoft, fontSize: 15 }}>Committed for today</AppText>
                </Animated.View>
              ) : (
                <>
                  <Icon name="checks" size={18} color={colors.onSurface} />
                  <AppText variant="label" style={{ color: colors.onSurface, fontSize: 15 }}>I am taking this today</AppText>
                  <Shine every={2600} opacity={0.25} />
                </>
              )}
            </LinearGradient>
          </MotionPressable>
          <SparkleBurst trigger={burst} radius={120} count={22} />
        </View>
      </LinearGradient>
    </View>
  );
}

function PromoCard({ kicker, title, body, price, list, icon, colors: fill, onPress, cta = "Get yours" }: {
  cta?: string; kicker: string; title: string; body: string; price: string; list?: string; icon: FeatherName; colors: [string, string]; onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <MotionPressable onPress={onPress} pressScale={0.98} haptic="medium">
      <LinearGradient colors={fill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.promo}>
        <View style={styles.promoOrbitA} /><View style={styles.promoOrbitB} />
        <View style={styles.promoGlyph}><Icon name={icon} size={38} color={colors.goldSoft} weight="duotone" /></View>
        <View style={styles.promoKicker}><AppText variant="label" style={{ color: colors.goldSoft, fontSize: 11, letterSpacing: 1 }}>{kicker}</AppText></View>
        <AppText variant="title" style={{ marginTop: 12, maxWidth: 240 }}>{title}</AppText>
        <AppText variant="caption" style={{ color: "rgba(248,242,232,0.7)", marginTop: 6, maxWidth: 230 }}>{body}</AppText>
        <View style={styles.promoFoot}>
          <View style={styles.promoBtn}><AppText variant="label" style={{ color: colors.ink, fontSize: 14 }}>{cta}</AppText><Icon name="arrow-right" size={15} color={colors.ink} /><Shine every={4200} opacity={0.5} /></View>
          <View style={{ alignItems: "flex-end" }}>
            {list ? <AppText variant="caption" muted style={{ textDecorationLine: "line-through" }}>{list}</AppText> : null}
            <AppText variant="subtitle" style={{ color: colors.goldSoft }}>{price}</AppText>
          </View>
        </View>
      </LinearGradient>
    </MotionPressable>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
      <AppText variant="title" style={{ flex: 1 }}>{title}</AppText>
      {action && onAction ? (
        <MotionPressable onPress={onAction} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingBottom: 3 }}>
          <AppText variant="label" style={{ color: colors.goldSoft }}>{action}</AppText>
          <Icon name="chevron-right" size={14} color={colors.goldSoft} />
        </MotionPressable>
      ) : null}
    </View>
  );
}

function Marker({ label, value }: { label: string; value?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.marker}>
      <AppText variant="caption" muted>{label}</AppText>
      <AppText variant="label" numberOfLines={1} style={{ marginTop: 2, fontSize: 13 }}>{value || "—"}</AppText>
    </View>
  );
}

function HomeSkeleton() {
  return (
    <View style={{ gap: 14, marginTop: 24 }}>
      <Skeleton height={420} radius={radii.xl} />
      <View style={{ flexDirection: "row", gap: 10 }}><Skeleton height={130} radius={radii.lg} style={{ flex: 1 }} /><Skeleton height={130} radius={radii.lg} style={{ flex: 1 }} /></View>
      <Skeleton height={200} radius={radii.xl} />
    </View>
  );
}

function localGreeting(hour: number, language: string): string {
  const source = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return translateText(source, language);
}

const useStyles = makeStyles((colors) => ({
  topbar: { flexDirection: "row", alignItems: "center", gap: 10 },
  profileChip: { flexDirection: "row", alignItems: "center", gap: 7, height: 38, paddingLeft: 4, paddingRight: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(28,27,52,0.9)" },
  profileChipOn: { borderColor: "rgba(242,200,121,0.5)", backgroundColor: "rgba(58,29,74,0.9)" },
  profileInitial: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  addChip: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong },
  credits: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: "rgba(28,27,52,0.9)", borderWidth: 1, borderColor: colors.border },
  creditRing: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  shareBtn: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(235,226,250,0.08)" },
  tool: { flex: 1, padding: 15, borderRadius: radii.lg, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.border },
  toolIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  notif: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.lg, backgroundColor: "rgba(242,200,121,0.07)", borderWidth: 1, borderColor: "rgba(242,200,121,0.25)" },
  notifBtn: { paddingHorizontal: 12, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldSoft },
  invite: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radii.lg, borderWidth: 1, borderColor: "rgba(240,160,189,0.25)" },
  inviteIcon: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(242,200,121,0.1)" },
  avatar: { width: 46, height: 46, borderRadius: 23, overflow: "hidden" },
  avatarFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  streak: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, height: 34, borderRadius: 10, backgroundColor: "rgba(242,155,56,0.12)", borderWidth: 1, borderColor: "rgba(242,155,56,0.3)" },
  quick: { flexDirection: "row", alignItems: "center", gap: 7, height: 36, paddingHorizontal: 13, borderRadius: 10, backgroundColor: "rgba(33,31,59,0.85)", borderWidth: 1, borderColor: colors.border },
  hero: { borderRadius: radii.xl, padding: 20, paddingBottom: 22, overflow: "hidden", borderWidth: 1, borderColor: "rgba(217,121,162,0.28)" },
  heroGlow: { position: "absolute", width: 200, height: 200, borderRadius: 100, top: 40, alignSelf: "center", backgroundColor: "rgba(217,121,162,0.09)" },
  heroHead: { flexDirection: "row", justifyContent: "space-between" },
  rulerPill: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, paddingHorizontal: 18, height: 48, borderRadius: 14, backgroundColor: "rgba(11,11,26,0.55)", borderWidth: 1, borderColor: colors.border },
  colorDot: { width: 18, height: 18, borderRadius: 9, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  pillDivider: { width: 1, height: 24, backgroundColor: colors.borderStrong },
  heroCta: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, paddingHorizontal: 22, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(217,121,162,0.6)" },
  areaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  areaCell: { width: "48.4%", padding: 15, borderRadius: radii.lg, backgroundColor: "rgba(21,20,43,0.92)", borderWidth: 1, borderColor: colors.border },
  areaTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  areaIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  card: { padding: 20, borderRadius: radii.xl, backgroundColor: "rgba(21,20,43,0.92)", borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBtn: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  panchangRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  marker: { flex: 1, paddingVertical: 10, paddingHorizontal: 11, borderRadius: 10, backgroundColor: "rgba(235,226,250,0.05)" },
  actionWrap: { paddingTop: 18 },
  actionBadge: { position: "absolute", top: 0, zIndex: 2, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: "#2E2B4F", borderWidth: 1, borderColor: colors.borderStrong },
  action: { paddingHorizontal: 22, paddingTop: 36, paddingBottom: 24, borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(131,181,232,0.3)" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 9, height: 50, paddingHorizontal: 22, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "rgba(240,160,189,0.4)" },
  promo: { height: 250, borderRadius: radii.xl, padding: 20, overflow: "hidden", borderWidth: 1, borderColor: colors.borderStrong },
  promoOrbitA: { position: "absolute", width: 240, height: 240, borderRadius: 120, borderWidth: 1, borderColor: "rgba(242,200,121,0.14)", top: -80, right: -90 },
  promoOrbitB: { position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: "rgba(168,160,232,0.2)", top: -35, right: -45 },
  promoGlyph: { position: "absolute", top: 20, right: 20, width: 64, height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(11,11,26,0.45)" },
  promoKicker: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: "rgba(242,200,121,0.4)" },
  promoFoot: { marginTop: "auto", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  promoBtn: { flexDirection: "row", alignItems: "center", gap: 7, height: 44, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.gold, overflow: "hidden" },
  note: { padding: 20, borderRadius: radii.xl, backgroundColor: colors.ivory },
  noteHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  noteAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: colors.gold },
  noteBody: { color: "#3C3450", lineHeight: 24, marginTop: 14 },
  signal: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 10 },
  noteCta: { marginTop: 18, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.ink },
  ritual: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radii.lg, backgroundColor: "rgba(28,24,40,0.95)", borderWidth: 1, borderColor: "rgba(242,200,121,0.22)" },
  ritualIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  writing: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "rgba(242,200,121,0.1)" },
  period: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radii.lg, backgroundColor: "rgba(21,20,43,0.92)", borderWidth: 1, borderColor: colors.border },
  periodIcon: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(168,160,232,0.13)" },
  mini: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, overflow: "hidden", borderBottomWidth: 1, borderBottomColor: colors.divider },
  miniScore: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.goldSoft },
}));
