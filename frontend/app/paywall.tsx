import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { Icon } from "@/src/components/Icon";
import { useAppConfig } from "@/src/hooks";
import { useAuth } from "@/src/store/auth";
import { makeStyles, radii, useTheme } from "@/src/theme";

const TIER_MAP: Record<string, string> = {
  monthly: "premium_monthly", annual: "premium_annual", founder_lifetime: "founder_lifetime",
};
const BENEFITS = [
  "Ongoing conversations with your AI guide",
  "Your full birth chart, dashas & transits",
  "Compatibility, Tarot & Numerology in depth",
  "Vastu home analysis with remedies",
  "Daily Panchang & auspicious timing",
];

export default function Paywall() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refresh } = useAuth();
  const { data: config } = useAppConfig();
  const [selected, setSelected] = useState("annual");

  const products = config?.paywall?.products || [];
  const lifetimeOn = config?.feature_flags?.lifetime_offer !== false;
  const visible = products.filter((p: any) => p.id !== "founder_lifetime" || lifetimeOn);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/today"));

  const purchase = useMutation({
    mutationFn: () => api.post("/entitlement/sync", { tier: TIER_MAP[selected], source: "preview_unlock" }),
    onSuccess: async () => { await refresh(); goBack(); },
  });

  return (
    <View style={{ flex: 1 }}>
      <CosmicBackground>
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}>
          <Pressable onPress={goBack} hitSlop={12} style={{ alignSelf: "flex-end" }} testID="paywall-close">
            <Icon name="x" size={24} color={colors.muted} />
          </Pressable>
          <View style={styles.crown}><Icon name="award" size={30} color={colors.gold} /></View>
          <AppText variant="display" center style={{ color: colors.gold, marginTop: 16 }}>Cosmic Clarity Premium</AppText>
          <AppText variant="body" muted center style={{ marginTop: 8 }}>
            One membership. Ask whenever you want.{"\n"}No pay-per-minute conversations, ever.
          </AppText>

          <View style={{ gap: 10, marginTop: 24 }}>
            {BENEFITS.map((b) => (
              <View key={b} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name="check" size={16} color={colors.gold} />
                <AppText variant="body" style={{ flex: 1 }}>{b}</AppText>
              </View>
            ))}
          </View>

          <View style={{ gap: 12, marginTop: 28 }}>
            {visible.map((p: any) => {
              const sel = selected === p.id;
              return (
                <Pressable key={p.id} onPress={() => setSelected(p.id)} testID={`plan-${p.id}`}
                  style={[styles.plan, sel && { borderColor: colors.gold }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <AppText variant="subtitle" style={{ textTransform: "capitalize" }}>{p.id.replace("_", " ")}</AppText>
                      {p.badge ? <View style={styles.badge}><AppText variant="caption" style={{ color: colors.onBrandPrimary, fontSize: 10 }}>{p.badge}</AppText></View> : null}
                    </View>
                    <AppText variant="caption" muted style={{ marginTop: 2 }}>
                      {p.ref_price?.USD} · {p.ref_price?.INR} {p.period !== "lifetime" ? `/ ${p.period}` : "one-time"}
                    </AppText>
                  </View>
                  <View style={[styles.radio, sel && { borderColor: colors.gold }]}>{sel ? <View style={styles.dot} /> : null}</View>
                </Pressable>
              );
            })}
          </View>

          <Button label="Continue" icon="star" loading={purchase.isPending}
            onPress={() => purchase.mutate()} style={{ marginTop: 24 }} testID="paywall-continue" />
          <AppText variant="caption" muted center style={{ marginTop: 14 }}>
            Prices shown are reference values; your store shows local pricing. Purchases are handled
            by RevenueCat in the installed app. Cancel anytime.
          </AppText>
        </ScrollView>
      </CosmicBackground>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  crown: { alignSelf: "center", width: 72, height: 72, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.glassBorder },
  plan: { flexDirection: "row", alignItems: "center", padding: 18, borderRadius: radii.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  badge: { backgroundColor: colors.gold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  radio: { width: 24, height: 24, borderRadius: 999, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  dot: { width: 11, height: 11, borderRadius: 999, backgroundColor: colors.gold },
}));
