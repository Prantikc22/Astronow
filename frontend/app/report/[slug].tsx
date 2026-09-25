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

      {sections.map(([title, body], index) => {
        const locked = !hasFullReport && index > 0;
        return <Animated.View key={title} entering={FadeInDown.delay(70 + index * 50).duration(420)} style={styles.section}>
          <View style={styles.sectionNumber}><AppText variant="label" style={{ color: colors.gold }}>{String(index + 1).padStart(2, "0")}</AppText></View>
          <View style={{ flex: 1 }}>
            <View style={styles.sectionTitle}><AppText variant="title" style={{ flex: 1 }}>{title}</AppText>{locked ? <Icon name="lock" size={17} color={colors.muted} /> : null}</View>
            {locked ? <View style={styles.lockedCopy}><View style={styles.blurLine} /><View style={[styles.blurLine, { width: "82%" }]} /><View style={[styles.blurLine, { width: "63%" }]} /><AppText variant="caption" muted style={{ marginTop: 12 }}>{isAddon ? `${report.discount} · ${listPrice} → ${price}` : "Included with AstroNow Plus"}</AppText></View>
              : <AppText variant="body" muted style={{ marginTop: 10, lineHeight: 26 }}>{body}</AppText>}
          </View>
        </Animated.View>;
      })}

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

const useStyles = makeStyles((colors) => ({
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
