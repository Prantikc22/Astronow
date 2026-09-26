import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { BrandMark } from "@/src/components/BrandMark";
import { Button } from "@/src/components/Button";
import { Icon } from "@/src/components/Icon";
import { ErrorState, Loading, Screen } from "@/src/components/Screen";
import { Skeleton } from "@/src/components/Skeleton";
import { REPORTS, reportDisplay, reportPrice, reportSections } from "@/src/content/reports";
import { getCustomerInfo, hasPurchasedProduct } from "@/src/services/purchases";
import { useAuth } from "@/src/store/auth";
import { makeStyles, radii, useTheme } from "@/src/theme";

export default function ReportDetail() {
  const { slug = "year-ahead" } = useLocalSearchParams<{ slug: string }>();
  const report = REPORTS.find((item) => item.slug === slug) || REPORTS[0];
  const { entitlement, profile, user } = useAuth();
  const display = reportDisplay(report, profile?.terminology_mode);
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["report-data", user?.id],
    queryFn: async () => {
      const [chart, dasha, numerology] = await Promise.all([
        api.get("/chart"), api.get("/dasha"), api.get("/numerology"),
      ]);
      return { chart, dasha, numerology };
    },
    staleTime: 30 * 60 * 1000,
  });
  const sections = data ? reportSections(report.slug, data, profile?.language, profile?.terminology_mode) : [];
  const { data: customerInfo } = useQuery({
    queryKey: ["customer-info", user?.id],
    queryFn: () => getCustomerInfo(user?.id),
    retry: false,
  });
  const isAddon = report.access === "addon";
  const price = reportPrice(report);
  const listPrice = reportPrice(report, true);
  const hasFullReport = isAddon ? hasPurchasedProduct(customerInfo, report.productId) : entitlement.premium || report.access === "free";
  const language = profile?.language || "en";
  // Paid readers get a report written from their own chart; it's generated once and cached.
  const personal = useQuery({
    queryKey: ["personal-report", report.slug, language],
    queryFn: () => api.get(`/reports/${report.slug}/personal`),
    enabled: hasFullReport && report.slug !== "match-report",
    refetchInterval: (query) => query.state.data?.status === "generating" ? 4000 : false,
    retry: false,
  });
  const written = personal.data?.status === "ready" ? personal.data.report : null;
  const writing = hasFullReport && (personal.isLoading || personal.data?.status === "generating");

  return <Screen title={display.title} subtitle="Personalised from your saved birth details" back>
    {isLoading ? <Loading /> : null}
    {isError ? <ErrorState message="We couldn't assemble this report yet." onRetry={refetch} /> : null}
    {data ? <View style={styles.content}>
      <Animated.View entering={FadeInDown.duration(440)} style={styles.cover}>
        <LinearGradient colors={["#37316F", "#211D4D", "#141127"]} style={styles.coverFill}>
          <View style={styles.coverTop}><View style={styles.typePill}><Icon name={report.icon} size={15} color={colors.ink} /><AppText variant="label" style={{ color: colors.ink }}>{display.eyebrow}</AppText></View><BrandMark size={42} /></View>
          <View style={{ flex: 1, justifyContent: "flex-end", zIndex: 2 }}>
            <AppText variant="hero" style={{ fontSize: 38, lineHeight: 42 }}>{display.title}</AppText>
            <AppText variant="body" style={{ color: "rgba(248,242,232,0.76)", marginTop: 8, maxWidth: 300 }}>{display.description}</AppText>
            <AppText variant="caption" style={{ color: colors.goldSoft, marginTop: 18 }}>Prepared for {profile?.first_name || "you"} · AstroNow</AppText>
          </View>
          <View style={styles.arcOne} /><View style={styles.arcTwo} />
        </LinearGradient>
      </Animated.View>

      <View style={styles.summary}>
        <View style={styles.summaryIcon}><Icon name="check" size={18} color={colors.ink} /></View>
        <View style={{ flex: 1 }}><AppText variant="subtitle">Built from your actual chart</AppText><AppText variant="caption" muted style={{ marginTop: 3 }}>Personalised from your saved birth details</AppText></View>
      </View>

      {written ? <PersonalReport report={written} name={profile?.first_name || "you"} /> : null}
      {writing ? <WritingState /> : null}
      {hasFullReport && personal.isError ? (
        <View style={styles.unlockCard}>
          <Icon name="alert-circle" size={22} color={colors.coralSoft} />
          <AppText variant="subtitle" center style={{ marginTop: 10 }}>We couldn&apos;t prepare your personal report just now</AppText>
          <AppText variant="caption" muted center style={{ marginTop: 6 }}>{(personal.error as any)?.message || "Please try again in a moment."}</AppText>
          <Button label="Try again" variant="secondary" onPress={() => personal.refetch()} style={{ marginTop: 14 }} />
        </View>
      ) : null}

      {!hasFullReport ? (
        <View style={styles.sampleBanner}>
          <Icon name="eye" size={16} color={colors.goldSoft} />
          <AppText variant="caption" style={{ flex: 1, color: colors.onSurface }}>{isAddon ? "Sample preview. Your full report is written from your exact chart after purchase." : "Sample preview. With Plus, this whole report is written personally from your exact chart."}</AppText>
        </View>
      ) : null}
      {!hasFullReport ? sections.map(([title, body], index) => {
        const locked = !hasFullReport && index > 0;
        return <Animated.View key={title} entering={FadeInDown.delay(70 + index * 50).duration(420)} style={styles.section}>
          <View style={styles.sectionNumber}><AppText variant="label" style={{ color: colors.gold }}>{String(index + 1).padStart(2, "0")}</AppText></View>
          <View style={{ flex: 1 }}>
            <View style={styles.sectionTitle}><AppText variant="title" style={{ flex: 1 }}>{title}</AppText>{locked ? <Icon name="lock" size={17} color={colors.muted} /> : null}</View>
            {locked ? <View style={styles.lockedCopy}><View style={styles.blurLine} /><View style={[styles.blurLine, { width: "82%" }]} /><View style={[styles.blurLine, { width: "63%" }]} /><AppText variant="caption" muted style={{ marginTop: 12 }}>{isAddon ? `${report.discount} · ${listPrice} → ${price}` : "Included with AstroNow Plus"}</AppText></View>
              : <AppText variant="body" muted style={{ marginTop: 10, lineHeight: 26 }}>{body}</AppText>}
          </View>
        </Animated.View>;
      }) : null}

      {!hasFullReport ? <View style={styles.unlockCard}>
        <Icon name="star" size={25} color={colors.gold} weight="duotone" />
        <AppText variant="title" style={{ marginTop: 12 }}>{isAddon ? `Unlock this deep dive for ${price}` : "Unlock the core report library"}</AppText>
        <AppText variant="body" muted center style={{ marginTop: 7 }}>{isAddon ? "A one-time unlock for your saved birth profile. Reopen it whenever you want." : "Core reports, deeper readings and daily conversations with Tara are included in AstroNow Plus."}</AppText>
        {isAddon ? <AppText variant="caption" muted style={{ textDecorationLine: "line-through", marginTop: 6 }}>List price {listPrice}</AppText> : null}
        <Button label={isAddon ? `${report.discount} · Get it for ${price}` : "See AstroNow Plus"} icon="arrow-right" onPress={() => router.push(isAddon ? `/report-offer/${report.slug}` as any : "/paywall")} style={{ marginTop: 18 }} />
      </View> : null}

      <View style={styles.disclaimer}><Icon name="info" size={15} color={colors.muted} /><AppText variant="caption" muted style={{ flex: 1 }}>This report offers reflective guidance, not certainty or medical, legal, or financial advice.</AppText></View>
    </View> : null}
  </Screen>;
}

function PersonalReport({ report, name }: { report: any; name: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ gap: 14 }}>
      <Animated.View entering={FadeInDown.duration(420)} style={styles.writtenFor}>
        <Icon name="sparkle" size={16} color={colors.goldSoft} weight="fill" />
        <AppText variant="caption" style={{ flex: 1, color: colors.onSurface }}>{`Written for ${name} from your exact birth chart`}</AppText>
      </Animated.View>
      {report.intro ? <AppText variant="body" style={{ lineHeight: 26, color: colors.onSurface }}>{report.intro}</AppText> : null}
      {(report.sections || []).map((section: any, index: number) => (
        <Animated.View key={index} entering={FadeInDown.delay(60 + index * 50).duration(420)} style={styles.section}>
          <View style={styles.sectionNumber}><AppText variant="label" style={{ color: colors.gold }}>{String(index + 1).padStart(2, "0")}</AppText></View>
          <View style={{ flex: 1 }}>
            <AppText variant="title">{section.title}</AppText>
            {String(section.body || "").split(/\n\n+/).map((para: string, i: number) => (
              <AppText key={i} variant="body" style={{ marginTop: 10, lineHeight: 26, color: "rgba(248,242,232,0.86)" }}>{para.trim()}</AppText>
            ))}
          </View>
        </Animated.View>
      ))}
      {report.key_dates?.length ? (
        <View style={styles.dates}>
          <AppText variant="title" style={{ fontSize: 20 }}>Key dates</AppText>
          {report.key_dates.map((d: any, i: number) => (
            <View key={i} style={styles.dateRow}>
              <View style={styles.dateDot} />
              <View style={{ flex: 1 }}>
                <AppText variant="label" style={{ color: colors.goldSoft }}>{d.when}</AppText>
                <AppText variant="body" style={{ marginTop: 3, lineHeight: 23 }}>{d.what}</AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {report.closing ? <AppText variant="body" center style={{ fontFamily: "Fraunces-Medium", fontSize: 18, lineHeight: 27, marginTop: 6 }}>{report.closing}</AppText> : null}
    </View>
  );
}

const WRITING_STEPS = ["Reading your planets and houses…", "Mapping your life periods…", "Checking the transits ahead…", "Writing your report…", "Adding your key dates…"];

function WritingState() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setStep((n) => Math.min(n + 1, WRITING_STEPS.length - 1)), 9000);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.writing}>
      <BrandMark size={46} />
      <Animated.View key={step} entering={FadeInDown.duration(360)}>
        <AppText variant="subtitle" center style={{ marginTop: 14 }}>{WRITING_STEPS[step]}</AppText>
      </Animated.View>
      <AppText variant="caption" muted center style={{ marginTop: 6 }}>Your personal report takes a minute or two the first time. You can leave this screen; it will be ready when you return.</AppText>
      <View style={{ alignSelf: "stretch", gap: 8, marginTop: 18 }}>
        {[100, 92, 84, 96, 70].map((w, i) => <Skeleton key={i} width={`${w}%`} height={12} radius={6} />)}
      </View>
      <View style={[styles.writingBar]}><Animated.View style={[styles.writingFill, { width: `${((step + 1) / WRITING_STEPS.length) * 100}%`, backgroundColor: colors.goldSoft }]} /></View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  sampleBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderRadius: 12, backgroundColor: "rgba(242,200,121,0.08)", borderWidth: 1, borderColor: "rgba(242,200,121,0.3)" },
  writtenFor: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, backgroundColor: "rgba(242,200,121,0.08)" },
  writing: { alignItems: "center", padding: 22, borderRadius: radii.xl, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.glassBorder },
  writingBar: { alignSelf: "stretch", height: 3, borderRadius: 2, marginTop: 18, backgroundColor: "rgba(235,226,250,0.1)", overflow: "hidden" },
  writingFill: { height: 3, borderRadius: 2 },
  dates: { padding: 20, borderRadius: radii.xl, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.border, gap: 14 },
  dateRow: { flexDirection: "row", gap: 12 },
  dateDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: colors.coral },
  content: { gap: 15, paddingTop: 8 },
  cover: { height: 330, borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.borderStrong },
  coverFill: { flex: 1, padding: 22, overflow: "hidden" },
  coverTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 2 },
  typePill: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.gold },
  arcOne: { position: "absolute", width: 270, height: 270, borderRadius: 999, borderWidth: 1, borderColor: "rgba(242,200,121,0.15)", top: -85, right: -95 },
  arcTwo: { position: "absolute", width: 180, height: 180, borderRadius: 999, borderWidth: 1, borderColor: "rgba(168,160,232,0.23)", top: -40, right: -50 },
  summary: { flexDirection: "row", alignItems: "center", gap: 13, padding: 17, borderRadius: radii.lg, backgroundColor: colors.brand, borderWidth: 1, borderColor: colors.glassBorder },
  summaryIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  section: { flexDirection: "row", gap: 14, padding: 20, borderRadius: radii.xl, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  sectionNumber: { paddingTop: 5 },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  lockedCopy: { marginTop: 13 },
  blurLine: { width: "100%", height: 11, borderRadius: 6, backgroundColor: colors.surfaceTertiary, marginBottom: 8, opacity: 0.72 },
  unlockCard: { alignItems: "center", padding: 23, borderRadius: radii.xl, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.glassBorder },
  disclaimer: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4, marginTop: 4 },
}));
