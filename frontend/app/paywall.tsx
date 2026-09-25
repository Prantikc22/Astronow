import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { Easing, FadeIn, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { BrandMark } from "@/src/components/BrandMark";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { Shine } from "@/src/components/Shine";
import { pop, rise, springs } from "@/src/motion";
import { MotionPressable } from "@/src/components/MotionPressable";
import { isPreviewSession } from "@/src/api/preview";
import { useAppConfig } from "@/src/hooks";
import { buyPackage, findPackage, getCurrentOffering, hasActiveEntitlement } from "@/src/services/purchases";
import { useAuth } from "@/src/store/auth";
import { localizedReferencePrice, displayCurrency } from "@/src/content/pricing";
import { REPORTS, reportDisplay, reportPrice } from "@/src/content/reports";
import { makeStyles, radii, useTheme } from "@/src/theme";

const FALLBACK_PLANS = [
  { id: "monthly", period: "month", ref_price: { INR: "₹299", USD: "$7.99" } },
  { id: "annual", period: "year", badge: "BEST VALUE", ref_price: { INR: "₹1,999", USD: "$39.99" } },
];

export default function Paywall() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refresh, user, profile } = useAuth();
  const { data: config } = useAppConfig();
  const freeMessages = config?.free_chat_allowance ?? 10;
  const dailyMessages = config?.fairuse_daily_messages ?? 40;
  const matchReport = REPORTS.find((item) => item.slug === "match-report")!;
  const arthaReport = REPORTS.find((item) => item.slug === "artha-strategy")!;
  const compassReport = REPORTS.find((item) => item.slug === "twelve-year-compass")!;
  const [selected, setSelected] = useState("annual");
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const { data: offering } = useQuery({
    queryKey: ["revenuecat-offering", user?.id],
    queryFn: () => getCurrentOffering(user?.id),
    retry: false,
  });

  // Reference plans (README pricing) keep the screen whole if /config is slow or offline.
  const products = config?.paywall?.products?.length ? config.paywall.products : FALLBACK_PLANS;
  const visible = products.filter((p: any) => p.id === "monthly" || p.id === "annual");
  const selectedPackage = offering ? findPackage(offering.availablePackages, selected) : null;
  const purchaseReady = !!selectedPackage && !isPreviewSession();

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/today"));

  const purchase = useMutation({
    mutationFn: async () => {
      setPurchaseError(null);
      const item = offering ? findPackage(offering.availablePackages, selected) : null;
      if (!item) throw new Error("This plan is not available in the current RevenueCat offering yet.");
      const info = await buyPackage(item);
      if (!hasActiveEntitlement(info)) throw new Error("The purchase completed without an active AstroNow Plus entitlement. Check RevenueCat product mapping.");
      return api.post("/entitlement/sync", { rc_customer_id: user?.id });
    },
    onSuccess: async () => { await refresh(); goBack(); },
    onError: (error: any) => {
      if (!error?.userCancelled) setPurchaseError(error?.message || "The purchase could not be completed. Please try again.");
    },
  });

  const [tab, setTab] = useState<"plus" | "reports">("plus");
  const parse = (value?: string) => Number(String(value || "").replace(/[^0-9.]/g, "")) || 0;
  const monthlyRef = parse(localizedReferencePrice(products.find((p: any) => p.id === "monthly")?.ref_price));
  const annualRef = parse(localizedReferencePrice(products.find((p: any) => p.id === "annual")?.ref_price));
  const savings = monthlyRef && annualRef ? Math.round((1 - annualRef / (monthlyRef * 12)) * 100) : 0;
  const symbol = displayCurrency() === "INR" ? "₹" : "$";
  const perDay = annualRef ? (annualRef / 365) : 0;
  const perDayLabel = perDay ? `${symbol}${perDay < 1 ? perDay.toFixed(2) : perDay.toFixed(1)}` : "";
  const selectedProduct = visible.find((p: any) => p.id === selected);
  const selectedStorePrice = findPackage(offering?.availablePackages || [], selected)?.product.priceString || localizedReferencePrice(selectedProduct?.ref_price);
  const unlocks: { icon: FeatherName; title: string; detail: string }[] = [
    { icon: "message-circle", title: `${dailyMessages} questions a day with Tara`, detail: "vs. " + freeMessages + " a month on Free" },
    { icon: "file-text", title: `${REPORTS.filter((r) => r.access === "plus").length} in-depth reports`, detail: "Career, marriage, wealth, purpose and more" },
    { icon: "target", title: "Full birth chart & life periods", detail: "Dasha timelines and transit readings" },
    { icon: "heart", title: "Compatibility, Tarot, Numerology, Vastu", detail: "Every tool, fully unlocked" },
  ];
  const compare: [string, string, string][] = [
    ["Daily horoscope & timeline", "✓", "✓"],
    ["Questions to Tara", `${freeMessages}/mo`, `${dailyMessages}/day`],
    ["Core report library", "Preview", `All ${REPORTS.filter((r) => r.access === "plus").length}`],
    ["Deeper chart readings", "—", "✓"],
  ];

  return (
    <View style={{ flex: 1 }}>
      <CosmicBackground>
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 150 }}>
          <MotionPressable onPress={goBack} hitSlop={12} style={styles.close} testID="paywall-close" haptic="light">
            <Icon name="x" size={20} color={colors.onSurface} />
          </MotionPressable>
          <Animated.View entering={pop(0)} style={{ alignItems: "center" }}><HeroSeal /></Animated.View>
          <Animated.View entering={rise(1)}>
            <AppText variant="label" center style={{ color: colors.coralSoft, letterSpacing: 2, marginTop: 14 }}>ASTRONOW PLUS</AppText>
            <AppText variant="display" center style={styles.headline}>Your whole chart,{"\n"}fully unlocked.</AppText>
            <AppText variant="body" muted center style={{ marginTop: 8, lineHeight: 23 }}>Deep reports, daily answers from Tara and every tool—one membership.</AppText>
          </Animated.View>

          <Animated.View entering={rise(2)}><Segmented value={tab} onChange={setTab} /></Animated.View>

          {tab === "plus" ? (
            <Animated.View key="plus" entering={FadeIn.duration(260)}>
              <View style={{ gap: 12, marginTop: 20 }}>
                {visible.map((p: any, index: number) => {
                  const annual = p.id === "annual";
                  const storePackage = findPackage(offering?.availablePackages || [], p.id);
                  return (
                    <Animated.View key={p.id} entering={rise(3 + index)}>
                      <PlanCard selected={selected === p.id} onPress={() => setSelected(p.id)} testID={`plan-${p.id}`}
                        title={annual ? "Yearly" : "Monthly"}
                        price={storePackage?.product.priceString || localizedReferencePrice(p.ref_price)}
                        period={annual ? "/year" : "/month"}
                        badge={annual ? "BEST VALUE" : undefined}
                        save={annual && savings > 0 ? `Save ${savings}%` : undefined}
                        note={annual ? (perDayLabel ? `Just ${perDayLabel} a day · ${symbol}${Math.round(annualRef / 12)}/month` : undefined) : "Flexible · cancel anytime"} />
                    </Animated.View>
                  );
                })}
              </View>

              <Animated.View entering={rise(6)} style={styles.unlocks}>
                <AppText variant="label" style={{ color: colors.goldSoft, letterSpacing: 1.2 }}>WHAT YOU UNLOCK</AppText>
                {unlocks.map((item, index) => (
                  <Animated.View key={item.title} entering={rise(7 + index, 60)} style={styles.unlockRow}>
                    <LinearGradient colors={[colors.goldSoft, colors.coral]} style={styles.unlockIcon}><Icon name={item.icon} size={17} color={colors.ink} weight="duotone" /></LinearGradient>
                    <View style={{ flex: 1 }}>
                      <AppText variant="subtitle" style={{ fontSize: 16 }}>{item.title}</AppText>
                      <AppText variant="caption" muted style={{ marginTop: 1 }}>{item.detail}</AppText>
                    </View>
                  </Animated.View>
                ))}
              </Animated.View>

              <Animated.View entering={rise(9)} style={styles.compare}>
                <View style={styles.compareRow}>
                  <AppText variant="caption" muted style={{ flex: 1.6 }} />
                  <AppText variant="label" muted center style={{ flex: 1 }}>FREE</AppText>
                  <View style={styles.plusHead}><AppText variant="label" center style={{ color: colors.ink }}>PLUS</AppText></View>
                </View>
                {compare.map(([label, free, plus]) => (
                  <View key={label} style={[styles.compareRow, styles.compareLine]}>
                    <AppText variant="caption" style={{ flex: 1.6, color: colors.onSurface }}>{label}</AppText>
                    <AppText variant="caption" muted center style={{ flex: 1 }}>{free}</AppText>
                    <AppText variant="label" center style={{ flex: 1, color: colors.goldSoft }}>{plus}</AppText>
                  </View>
                ))}
              </Animated.View>

              <View style={styles.freeCard}>
                <Icon name="gift" size={18} color={colors.violet} weight="duotone" />
                <AppText variant="caption" muted style={{ flex: 1 }}>Daily sky, chart basics and {freeMessages} messages with Tara each month stay free, always.</AppText>
              </View>
            </Animated.View>
          ) : (
            <Animated.View key="reports" entering={FadeIn.duration(260)} style={{ gap: 12, marginTop: 20 }}>
              <AppText variant="body" muted center>One-time deep dives. No subscription needed—yours for good.</AppText>
              {[matchReport, arthaReport, compassReport].map((report, index) => {
                const display = reportDisplay(report, profile?.terminology_mode);
                return (
                  <Animated.View key={report.slug} entering={rise(index)}>
                    <MotionPressable onPress={() => router.push((report.route || `/report/${report.slug}`) as any)} style={styles.reportCard} haptic="medium" testID={`paywall-report-${report.slug}`}>
                      <LinearGradient colors={[colors.goldSoft, colors.coral]} style={styles.reportIcon}><Icon name={report.icon} size={22} color={colors.ink} weight="duotone" /></LinearGradient>
                      <View style={{ flex: 1 }}>
                        <AppText variant="label" style={{ color: colors.coralSoft, fontSize: 10, letterSpacing: 0.8 }}>{display.eyebrow}</AppText>
                        <AppText variant="subtitle" style={{ marginTop: 2 }}>{display.title}</AppText>
                        <AppText variant="caption" muted numberOfLines={2} style={{ marginTop: 3 }}>{display.description}</AppText>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 3 }}>
                        <View style={styles.discount}><AppText variant="caption" style={{ color: colors.ink, fontSize: 10 }}>{report.discount}</AppText></View>
                        <AppText variant="caption" muted style={{ textDecorationLine: "line-through" }}>{reportPrice(report, true)}</AppText>
                        <AppText variant="subtitle" style={{ color: colors.goldSoft }}>{reportPrice(report)}</AppText>
                      </View>
                    </MotionPressable>
                  </Animated.View>
                );
              })}
            </Animated.View>
          )}

          <View style={styles.trust}>
            {([["shield", "Private chart"], ["lock", "Secure store checkout"], ["refresh-cw", "Cancel anytime"]] as [FeatherName, string][]).map(([icon, label]) => (
              <View key={label} style={styles.trustItem}><Icon name={icon} size={16} color={colors.violet} weight="duotone" /><AppText variant="caption" muted center style={{ fontSize: 11 }}>{label}</AppText></View>
            ))}
          </View>
          <AppText variant="caption" muted center style={{ marginTop: 16, lineHeight: 18 }}>
            {isPreviewSession() ? "This is a design preview. Real purchases need an iOS or Android development build and live store products." :
              !purchaseReady ? "Store products are not configured for this build yet. The amounts above are target prices, not an active offer." :
                "Your store confirms the final local price before payment. Cancel through your App Store or Play Store account."}
          </AppText>
        </ScrollView>

        {tab === "plus" ? (
          <LinearGradient colors={["rgba(10,9,24,0)", "rgba(10,9,24,0.96)", "#0A0918"]} locations={[0, 0.35, 1]} style={[styles.dock, { paddingBottom: insets.bottom + 14 }]}>
            <Button label={purchaseReady ? `Start Plus · ${selectedStorePrice}${selected === "annual" ? "/year" : "/month"}` : "Store purchase unavailable"}
              iconRight={purchaseReady ? "arrow-right" : undefined} icon={purchaseReady ? undefined : "lock"} loading={purchase.isPending} disabled={!purchaseReady}
              onPress={() => purchase.mutate()} testID="paywall-continue" shine haptic="heavy" />
            {purchaseError ? <AppText variant="caption" center style={{ color: colors.coralSoft, marginTop: 8 }}>{purchaseError}</AppText> : null}
          </LinearGradient>
        ) : null}
      </CosmicBackground>
    </View>
  );
}

function HeroSeal() {
  const spin = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1);
    return () => cancelAnimation(spin);
  }, [spin, reduced]);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const counter = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.value * 540}deg` }] }));
  return (
    <View style={{ width: 150, height: 150, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(217,121,162,0.14)" }} />
      <Animated.View style={[{ position: "absolute", width: 136, height: 136, borderRadius: 68, borderWidth: 1, borderColor: "rgba(242,200,121,0.35)", borderStyle: "dashed" }, ring]}>
        <View style={{ position: "absolute", top: -4, left: 64, width: 8, height: 8, borderRadius: 4, backgroundColor: "#F7DDA6" }} />
      </Animated.View>
      <Animated.View style={[{ position: "absolute", width: 108, height: 108, borderRadius: 54, borderWidth: 1, borderColor: "rgba(168,160,232,0.4)" }, counter]}>
        <View style={{ position: "absolute", bottom: -3, left: 51, width: 6, height: 6, borderRadius: 3, backgroundColor: "#F0A0BD" }} />
      </Animated.View>
      <LinearGradient colors={["#3A1D4A", "#1C1638"]} style={{ width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(242,200,121,0.35)" }}>
        <BrandMark size={56} />
      </LinearGradient>
    </View>
  );
}

function Segmented({ value, onChange }: { value: "plus" | "reports"; onChange: (v: "plus" | "reports") => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => { x.value = withSpring(value === "plus" ? 0 : w / 2, springs.snappy); }, [value, w, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={styles.segment} onLayout={(e) => setW(e.nativeEvent.layout.width - 8)}>
      {w ? <Animated.View style={[styles.segmentPill, { width: w / 2 }, pill]} /> : null}
      {(["plus", "reports"] as const).map((key) => (
        <MotionPressable key={key} onPress={() => onChange(key)} style={styles.segmentItem} testID={`paywall-tab-${key}`}>
          <AppText variant="label" style={{ color: value === key ? colors.onSurface : colors.muted, fontSize: 14 }}>{key === "plus" ? "Plus membership" : "One-time reports"}</AppText>
        </MotionPressable>
      ))}
    </View>
  );
}

function PlanCard({ selected, onPress, title, price, period, badge, save, note, testID }: {
  selected: boolean; onPress: () => void; title: string; price: string; period: string; badge?: string; save?: string; note?: string; testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const p = useSharedValue(selected ? 1 : 0);
  useEffect(() => { p.value = withSpring(selected ? 1 : 0, springs.snappy); }, [selected, p]);
  const frame = useAnimatedStyle(() => ({ transform: [{ scale: 0.98 + p.value * 0.02 }], opacity: 0.8 + p.value * 0.2 }));
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: p.value }] }));
  return (
    <MotionPressable onPress={onPress} testID={testID} haptic="selection" pressScale={0.98}>
      <Animated.View style={frame}>
        <LinearGradient colors={selected ? ["#4A1C45", "#2A1640"] : ["rgba(28,27,52,0.95)", "rgba(21,20,43,0.95)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.plan, selected && styles.planSelected]}>
          {badge ? <View style={styles.badge}><AppText variant="label" style={{ color: colors.ink, fontSize: 10, letterSpacing: 0.8 }}>{badge}</AppText></View> : null}
          <View style={[styles.radio, selected && { borderColor: colors.gold }]}><Animated.View style={[styles.dot, dot]} /></View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AppText variant="subtitle">{title}</AppText>
              {save ? <View style={styles.save}><AppText variant="caption" style={{ color: colors.ink, fontSize: 11 }}>{save}</AppText></View> : null}
            </View>
            {note ? <AppText variant="caption" style={{ color: selected ? colors.goldSoft : colors.muted, marginTop: 3 }}>{note}</AppText> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <AppText variant="title" style={{ fontSize: 22 }}>{price}</AppText>
            <AppText variant="caption" muted>{period}</AppText>
          </View>
          {selected ? <Shine every={3600} opacity={0.12} /> : null}
        </LinearGradient>
      </Animated.View>
    </MotionPressable>
  );
}

const useStyles = makeStyles((colors) => ({
  close: { alignSelf: "flex-end", width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  headline: { color: colors.ivory, marginTop: 6, fontSize: 34, lineHeight: 40 },
  segment: { flexDirection: "row", marginTop: 22, padding: 4, borderRadius: 26, backgroundColor: "rgba(33,31,59,0.9)", borderWidth: 1, borderColor: colors.border },
  segmentPill: { position: "absolute", left: 4, top: 4, bottom: 4, borderRadius: 22, backgroundColor: "#3B3470", borderWidth: 1, borderColor: "rgba(168,160,232,0.5)" },
  segmentItem: { flex: 1, height: 44, alignItems: "center", justifyContent: "center" },
  plan: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, paddingTop: 22, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  planSelected: { borderColor: colors.gold, borderWidth: 1.5 },
  badge: { position: "absolute", top: 0, right: 18, paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: colors.gold },
  save: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: "#8FB8F0" },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold },
  unlocks: { marginTop: 20, gap: 14, padding: 20, borderRadius: radii.xl, backgroundColor: "rgba(21,20,43,0.92)", borderWidth: 1, borderColor: colors.glassBorder },
  unlockRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  unlockIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  compare: { marginTop: 14, padding: 16, borderRadius: radii.xl, backgroundColor: "rgba(21,20,43,0.92)", borderWidth: 1, borderColor: colors.border },
  compareRow: { flexDirection: "row", alignItems: "center", minHeight: 36 },
  compareLine: { borderTopWidth: 1, borderTopColor: colors.divider },
  plusHead: { flex: 1, alignItems: "center", paddingVertical: 4, borderRadius: 10, backgroundColor: colors.gold },
  freeCard: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, padding: 14, borderRadius: radii.lg, backgroundColor: "rgba(168,160,232,0.08)", borderWidth: 1, borderColor: "rgba(168,160,232,0.2)" },
  reportCard: { flexDirection: "row", alignItems: "center", gap: 13, padding: 16, borderRadius: radii.lg, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.borderStrong },
  reportIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  discount: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: "#8FB8F0" },
  trust: { flexDirection: "row", marginTop: 22, gap: 8 },
  trustItem: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: 16, backgroundColor: "rgba(235,226,250,0.04)" },
  dock: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 30 },
}));
