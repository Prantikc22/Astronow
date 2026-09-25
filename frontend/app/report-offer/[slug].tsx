import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";

import { isPreviewSession } from "@/src/api/preview";
import { AppText } from "@/src/components/AppText";
import { BrandMark } from "@/src/components/BrandMark";
import { Button } from "@/src/components/Button";
import { Icon } from "@/src/components/Icon";
import { Screen } from "@/src/components/Screen";
import { REPORTS, reportDisplay, reportPrice } from "@/src/content/reports";
import { buyPackage, findPackage, getCurrentOffering } from "@/src/services/purchases";
import { useAuth } from "@/src/store/auth";
import { makeStyles, radii, useTheme } from "@/src/theme";

export default function ReportOffer() {
  const { slug = "artha-strategy" } = useLocalSearchParams<{ slug: string }>();
  const report = REPORTS.find((item) => item.slug === slug && item.access === "addon") || REPORTS.find((item) => item.slug === "artha-strategy")!;
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const display = reportDisplay(report, profile?.terminology_mode);
  const [error, setError] = useState<string | null>(null);
  const { data: offering } = useQuery({ queryKey: ["revenuecat-offering", user?.id], queryFn: () => getCurrentOffering(user?.id), retry: false });
  const productPackage = offering ? findPackage(offering.availablePackages, report.productId || report.slug) : null;
  const storePrice = productPackage?.product.priceString || reportPrice(report);
  const listPrice = reportPrice(report, true);
  const purchase = useMutation({
    mutationFn: async () => {
      setError(null);
      if (!productPackage) throw new Error("This report product is not available in the current store offering yet.");
      return buyPackage(productPackage);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["customer-info", user?.id] });
      if (report.route) {
        if (router.canGoBack()) router.back();
        else router.replace(report.route as any);
      } else router.replace(`/report/${report.slug}` as any);
    },
    onError: (e: any) => {
      if (!e?.userCancelled) setError(e?.message || "The purchase could not be completed.");
    },
  });
  const ready = !!productPackage && !isPreviewSession();

  return <Screen title="Premium report" subtitle="One-time purchase · yours to revisit" back>
    <LinearGradient colors={["#3B316F", "#211A47", "#141127"]} style={styles.hero}>
      <View style={styles.top}><View style={styles.pill}><Icon name={report.icon} size={15} color={colors.ink} /><AppText variant="label" style={{ color: colors.ink }}>{display.eyebrow}</AppText></View><BrandMark size={46} /></View>
      <View style={{ marginTop: 42 }}>
        <AppText variant="hero" style={{ fontSize: 42, lineHeight: 45 }}>{display.title}</AppText>
        <AppText variant="body" style={{ color: "rgba(248,242,232,0.76)", marginTop: 10, lineHeight: 24 }}>{display.description}</AppText>
      </View>
      <View style={styles.priceBlock}>
        <View style={styles.offerBadge}><AppText variant="label" style={{ color: colors.ink }}>{report.discount || "50% OFF"}</AppText></View>
        <View style={styles.priceRow}><AppText variant="body" muted style={styles.listPrice}>{listPrice}</AppText><AppText variant="display" style={{ color: colors.gold }}>{storePrice}</AppText><AppText variant="caption" muted>one time</AppText></View>
      </View>
    </LinearGradient>

    <View style={styles.includes}>
      <AppText variant="label" style={{ color: colors.coralSoft }}>WHAT YOU RECEIVE</AppText>
      {[
        report.slug === "match-report" ? "A multi-section reading comparing your chart with a partner's" : "A multi-section reading built from your saved birth chart",
        "Practical prompts and timing themes—not generic zodiac copy",
        "Permanent access for this locked birth profile",
      ].map((line) => <View key={line} style={styles.row}><View style={styles.check}><Icon name="check" size={12} color={colors.ink} /></View><AppText variant="body" style={{ flex: 1 }}>{line}</AppText></View>)}
    </View>
    <Button label={ready ? `Unlock for ${storePrice}` : "Store product not configured"} icon={ready ? "arrow-right" : "lock"} disabled={!ready} loading={purchase.isPending} onPress={() => purchase.mutate()} style={{ marginTop: 18 }} />
    {error ? <AppText variant="caption" center style={{ color: colors.coralSoft, marginTop: 12 }}>{error}</AppText> : null}
    <AppText variant="caption" muted center style={{ marginTop: 12 }}>{isPreviewSession() ? "Preview mode shows the complete purchase experience. Add the matching one-time product to RevenueCat to enable checkout." : !ready ? `Create the RevenueCat product “${report.productId}” and add it to the current offering.` : "Your App Store or Play Store confirms the final local price before payment."}</AppText>
  </Screen>;
}

const useStyles = makeStyles((colors) => ({
  hero: { minHeight: 405, borderRadius: radii.xl, padding: 22, borderWidth: 1, borderColor: colors.borderStrong, overflow: "hidden" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8 },
  priceBlock: { marginTop: "auto", alignItems: "flex-start", gap: 7 },
  offerBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.gold },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 9 },
  listPrice: { textDecorationLine: "line-through" },
  includes: { marginTop: 18, padding: 19, borderRadius: radii.xl, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, gap: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 11 },
  check: { width: 23, height: 23, borderRadius: 12, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
}));
