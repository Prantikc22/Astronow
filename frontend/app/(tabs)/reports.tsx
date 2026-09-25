import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ScrollView, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { AppText } from "@/src/components/AppText";
import { BrandMark } from "@/src/components/BrandMark";
import { EditorialFooter } from "@/src/components/EditorialFooter";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { Screen } from "@/src/components/Screen";
import { Shine } from "@/src/components/Shine";
import { REPORTS, reportDisplay, reportPrice, type ReportDefinition } from "@/src/content/reports";
import { pop, rise } from "@/src/motion";
import { useAuth } from "@/src/store/auth";
import { makeStyles, radii, useTheme } from "@/src/theme";

const TOOLS: { label: string; sub: string; icon: FeatherName; route: string; tint: [string, string] }[] = [
  { label: "Birth chart", sub: "Kundli", icon: "target", route: "/chart", tint: ["#F7DDA6", "#E3A866"] },
  { label: "Daily ritual", sub: "Mantra & breath", icon: "sparkle", route: "/ritual", tint: ["#F7DDA6", "#B08A3E"] },
  { label: "Vastu home", sub: "Upload or draw", icon: "home", route: "/vastu", tint: ["#B9E3E0", "#6FB3B4"] },
  { label: "Tarot", sub: "Draw a spread", icon: "layers", route: "/tarot", tint: ["#E4C9FF", "#A77BDB"] },
  { label: "Numerology", sub: "Your numbers", icon: "hash", route: "/numerology", tint: ["#F6B6CB", "#D0628F"] },
  { label: "Life periods", sub: "Dasha timeline", icon: "hourglass", route: "/dasha", tint: ["#C7D4FF", "#7C8FE6"] },
  { label: "Planets now", sub: "Transits · Gochar", icon: "globe", route: "/transits", tint: ["#9CC6F2", "#5D86D6"] },
  { label: "Panchang", sub: "Daily calendar", icon: "calendar", route: "/(tabs)/calendar", tint: ["#F3C1A8", "#D98A6A"] },
];

const GROUPS: { title: string; slugs: string[] }[] = [
  { title: "Love & Marriage", slugs: ["love-patterns", "marriage-partner", "ideal-partner", "family-dynamics"] },
  { title: "Money & Work", slugs: ["wealth-rhythm", "career-blueprint", "business-enterprise", "first-job", "public-service"] },
  { title: "Self & Growth", slugs: ["life-purpose", "intelligence-strengths", "education-path", "health-wellbeing"] },
];

export default function Reports() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { entitlement, profile } = useAuth();
  const featured = REPORTS[0];
  const premiumReports = REPORTS.filter((report) => report.access === "addon");
  const plusCount = REPORTS.filter((report) => report.access === "plus").length;
  const openReport = (report: ReportDefinition) => router.push((report.route || `/report/${report.slug}`) as any);
  let tileIndex = 0;

  return <Screen contentStyle={{ paddingBottom: 130 }}>
    <Animated.View entering={rise(0)}>
      <AppText variant="display">Reports</AppText>
      <AppText variant="body" muted style={{ marginTop: 4, maxWidth: 340 }}>In-depth readings from your birth chart.</AppText>
    </Animated.View>

    {!entitlement.premium ? (
      <Animated.View entering={rise(1)}>
        <MotionPressable onPress={() => router.push("/paywall")} style={styles.unlock} haptic="medium" testID="reports-plus">
          <View style={styles.unlockRing}><AppText variant="label" style={{ color: colors.goldSoft }}>{plusCount}</AppText></View>
          <View style={{ flex: 1 }}>
            <AppText variant="subtitle" style={{ fontSize: 16 }}>Unlock all {plusCount} reports</AppText>
            <AppText variant="caption" muted>Included with AstroNow Plus</AppText>
          </View>
          <View style={styles.unlockBtn}><AppText variant="label" style={{ color: colors.ink }}>See Plus</AppText><Shine every={3000} opacity={0.5} /></View>
        </MotionPressable>
      </Animated.View>
    ) : null}

    <Animated.View entering={rise(2)} style={{ marginTop: 18 }}>
      <MotionPressable onPress={() => router.push(`/report/${featured.slug}` as any)} style={styles.featured} pressScale={0.985} haptic="medium" testID="report-featured">
        <LinearGradient colors={["#3A2470", "#221C4F", "#17132E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featuredFill}>
          <Orbits />
          <View style={styles.featuredTag}><Icon name="gift" size={13} color={colors.ink} weight="fill" /><AppText variant="label" style={{ color: colors.ink }}>FREE PREVIEW</AppText></View>
          <View style={{ marginTop: "auto" }}>
            <AppText variant="label" style={{ color: colors.goldSoft, letterSpacing: 1.2 }}>{featured.eyebrow}</AppText>
            <AppText variant="display" style={{ marginTop: 4 }}>{featured.title}</AppText>
            <AppText variant="body" style={{ color: "rgba(248,242,232,0.74)", maxWidth: 290, marginTop: 6 }}>{featured.description}</AppText>
            <View style={styles.readRow}><AppText variant="label" style={{ color: colors.ink, fontSize: 14 }}>Start reading</AppText><Icon name="arrow-right" size={16} color={colors.ink} /></View>
          </View>
        </LinearGradient>
      </MotionPressable>
    </Animated.View>

    <Animated.View entering={rise(3)} style={{ marginTop: 28 }}>
      <AppText variant="title">Explore your chart</AppText>
    </Animated.View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
      {TOOLS.map((tool, i) => (
        <Animated.View key={tool.label} entering={pop(i, 45)}>
          <MotionPressable onPress={() => router.push(tool.route as any)} style={styles.tool} testID={`tool-${tool.route.replace(/\W/g, "")}`}>
            <LinearGradient colors={tool.tint} style={styles.toolIcon}><Icon name={tool.icon} size={22} color={colors.ink} weight="duotone" /></LinearGradient>
            <AppText variant="label" style={{ marginTop: 12, fontSize: 14 }}>{tool.label}</AppText>
            <AppText variant="caption" muted numberOfLines={1}>{tool.sub}</AppText>
          </MotionPressable>
        </Animated.View>
      ))}
    </ScrollView>

    {GROUPS.map((group) => (
      <View key={group.title} style={{ marginTop: 30 }}>
        <Ornament title={group.title} />
        <View style={styles.tiles}>
          {group.slugs.map((slug) => {
            const report = REPORTS.find((item) => item.slug === slug);
            if (!report) return null;
            const i = tileIndex++;
            return (
              <Animated.View key={slug} entering={pop(i % 8, 40)} style={styles.tileCell}>
                <MotionPressable onPress={() => openReport(report)} style={styles.tile} testID={`report-${slug}`} pressScale={0.95}>
                  <Icon name={report.icon} size={30} color={colors.coralSoft} weight="fill" />
                  {!entitlement.premium ? <View style={styles.lock}><Icon name="lock" size={11} color={colors.coralSoft} weight="bold" /></View> : null}
                </MotionPressable>
                <AppText variant="caption" center numberOfLines={2} style={{ marginTop: 7, color: colors.onSurface, fontSize: 13, lineHeight: 17 }}>{report.title}</AppText>
              </Animated.View>
            );
          })}
        </View>
      </View>
    ))}

    <View style={{ marginTop: 34 }}>
      <Ornament title="Signature deep dives" />
      <AppText variant="caption" muted center style={{ marginTop: 8 }}>One-time purchases. No subscription. Yours to keep.</AppText>
    </View>
    <View style={{ gap: 10, marginTop: 14 }}>
      {premiumReports.map((report, index) => {
        const display = reportDisplay(report, profile?.terminology_mode);
        return <Animated.View key={report.slug} entering={rise(index)}>
          <MotionPressable onPress={() => openReport(report)} style={styles.premiumCard} haptic="medium" testID={`report-${report.slug}`}>
            <LinearGradient colors={[colors.goldSoft, colors.coral]} style={styles.premiumIcon}><Icon name={report.icon} size={23} color={colors.ink} weight="duotone" /></LinearGradient>
            <View style={{ flex: 1 }}>
              <AppText variant="label" style={{ color: colors.coralSoft, fontSize: 10, letterSpacing: 0.8 }}>{display.eyebrow}</AppText>
              <AppText variant="subtitle" style={{ marginTop: 2 }}>{display.title}</AppText>
              <AppText variant="caption" muted numberOfLines={2} style={{ marginTop: 3 }}>{display.description}</AppText>
            </View>
            <View style={styles.priceStack}>
              <View style={styles.discountPill}><AppText variant="caption" style={{ color: colors.ink, fontSize: 10 }}>{report.discount}</AppText></View>
              <AppText variant="caption" muted style={{ textDecorationLine: "line-through" }}>{reportPrice(report, true)}</AppText>
              <AppText variant="subtitle" style={{ color: colors.goldSoft }}>{reportPrice(report)}</AppText>
            </View>
          </MotionPressable>
        </Animated.View>;
      })}
    </View>

    <EditorialFooter kicker="READ DEEPER" title={"Not generic fortunes.\nA map made from your chart."} note="Every interpretation is computed from your birth details and leaves the decision with you." />
  </Screen>;
}

function Ornament({ title }: { title: string }) {
  const styles = useStyles();
  return (
    <View style={styles.ornament}>
      <LinearGradient colors={["rgba(235,226,250,0)", "rgba(235,226,250,0.25)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ornLine} />
      <View style={styles.ornPill}><AppText variant="subtitle" style={{ fontSize: 16 }}>{title}</AppText></View>
      <LinearGradient colors={["rgba(235,226,250,0.25)", "rgba(235,226,250,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ornLine} />
    </View>
  );
}

function Orbits() {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 20000, easing: Easing.linear }), -1);
    return () => cancelAnimation(t);
  }, [t, reduced]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value * 360}deg` }] }));
  const b = useAnimatedStyle(() => ({ transform: [{ rotate: `${-t.value * 540}deg` }] }));
  return (
    <View style={{ position: "absolute", top: -60, right: -70, width: 260, height: 260, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: 250, height: 250, borderRadius: 125, borderWidth: 1, borderColor: "rgba(242,200,121,0.18)" }, a]}>
        <View style={{ position: "absolute", top: 40, left: 20, width: 8, height: 8, borderRadius: 4, backgroundColor: "#F7DDA6" }} />
      </Animated.View>
      <Animated.View style={[{ position: "absolute", width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: "rgba(168,160,232,0.24)" }, b]}>
        <View style={{ position: "absolute", bottom: 10, left: 30, width: 6, height: 6, borderRadius: 3, backgroundColor: "#F0A0BD" }} />
      </Animated.View>
      <View style={{ opacity: 0.9 }}><BrandMark size={58} /></View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  eyebrow: { color: colors.coralSoft, letterSpacing: 1.4 },
  unlock: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 12, padding: 10, paddingLeft: 12, borderRadius: radii.lg, backgroundColor: "rgba(33,31,59,0.92)", borderWidth: 1, borderColor: colors.glassBorder },
  unlockRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: colors.coral, alignItems: "center", justifyContent: "center" },
  unlockBtn: { paddingHorizontal: 16, height: 40, borderRadius: 10, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  featured: { height: 300, borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.borderStrong },
  featuredFill: { flex: 1, padding: 20, overflow: "hidden" },
  featuredTag: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.gold },
  readRow: { alignSelf: "flex-start", flexDirection: "row", gap: 8, alignItems: "center", marginTop: 16, paddingHorizontal: 18, height: 44, borderRadius: 12, backgroundColor: colors.ivory },
  tool: { width: 120, padding: 14, borderRadius: radii.lg, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.border },
  toolIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  ornament: { flexDirection: "row", alignItems: "center", gap: 10 },
  ornLine: { flex: 1, height: 1 },
  ornPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10, backgroundColor: "#2E2B4F" },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 10, rowGap: 16, marginTop: 16 },
  tileCell: { width: "22.5%", alignItems: "center" },
  tile: { width: "100%", aspectRatio: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(33,31,59,0.95)", borderWidth: 1, borderColor: colors.border },
  lock: { position: "absolute", right: 6, bottom: 6, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(11,11,26,0.7)" },
  premiumCard: { flexDirection: "row", alignItems: "center", gap: 13, padding: 16, borderRadius: radii.lg, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.borderStrong },
  premiumIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  priceStack: { alignItems: "flex-end", gap: 2, minWidth: 64 },
  discountPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "#8FB8F0" },
}));
