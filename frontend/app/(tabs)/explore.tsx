import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, FadeIn, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { EditorialFooter } from "@/src/components/EditorialFooter";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { ScoreRing } from "@/src/components/ScoreRing";
import { Screen } from "@/src/components/Screen";
import { REPORTS, reportPrice } from "@/src/content/reports";
import { pop, rise } from "@/src/motion";
import { useAuth } from "@/src/store/auth";
import { makeStyles, radii, useTheme } from "@/src/theme";

const MATCH_TYPES: { id: string; label: string; copy: string; icon: FeatherName; tint: [string, string] }[] = [
  { id: "love", label: "Love", copy: "Attraction, emotional rhythm and how you both show care.", icon: "heart", tint: ["#F6B6CB", "#D0628F"] },
  { id: "marriage", label: "Marriage", copy: "Traditional Guna Milan (36-point Kundli match) with long-term themes.", icon: "users", tint: ["#F7DDA6", "#E3A866"] },
  { id: "friendship", label: "Friendship", copy: "Trust, ease and how you communicate.", icon: "smile", tint: ["#B9E3E0", "#6FB3B4"] },
  { id: "business", label: "Business", copy: "Working styles, decisions and how you handle risk together.", icon: "briefcase", tint: ["#C7D4FF", "#7C8FE6"] },
];

export default function MatchHub() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [type, setType] = useState("love");
  const { data } = useQuery({ queryKey: ["compatibility-history"], queryFn: () => api.get("/compatibility/history"), retry: false });
  const history = data?.matches || [];
  const selected = MATCH_TYPES.find((item) => item.id === type)!;
  const matchReport = REPORTS.find((report) => report.slug === "match-report");
  const initials = (profile?.first_name || "You").charAt(0).toUpperCase();
  const open = () => router.push({ pathname: "/compatibility", params: { relation: type } });

  return (
    <Screen contentStyle={{ paddingBottom: 130 }}>
      <Animated.View entering={rise(0)}>
        <AppText variant="display">Match</AppText>
        <AppText variant="body" muted style={{ marginTop: 4 }}>Kundli matching for love, marriage, friendship and work.</AppText>
      </Animated.View>

      <Animated.View entering={rise(1)} style={{ marginTop: 20 }}>
        <LinearGradient colors={["#2B1840", "#1D1838", "#15122E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <View style={styles.pair}>
            <View style={{ alignItems: "center" }}>
              <LinearGradient colors={[colors.goldSoft, colors.coral]} style={styles.avatar}><AppText variant="title" style={{ color: colors.ink }}>{initials}</AppText></LinearGradient>
              <AppText variant="subtitle" style={{ marginTop: 10 }}>{profile?.first_name || "You"}</AppText>
            </View>
            <Connector tint={selected.tint} />
            <MotionPressable onPress={open} style={{ alignItems: "center" }} testID="match-add-person">
              <View style={styles.ghost}><Icon name="plus" size={26} color={colors.muted} /></View>
              <AppText variant="subtitle" muted style={{ marginTop: 10 }}>Add person</AppText>
            </MotionPressable>
          </View>

          <View style={styles.types}>
            {MATCH_TYPES.map((item, i) => {
              const active = item.id === type;
              return (
                <Animated.View key={item.id} entering={pop(i)} style={{ flex: 1 }}>
                  <MotionPressable onPress={() => setType(item.id)} style={[styles.type, active && { borderColor: item.tint[1], backgroundColor: item.tint[1] + "22" }]} testID={`match-${item.id}`}
                    accessibilityRole="tab" accessibilityState={{ selected: active }}>
                    <Icon name={item.icon} size={20} color={active ? item.tint[0] : colors.muted} weight={active ? "fill" : "regular"} />
                    <AppText variant="caption" style={{ color: active ? colors.onSurface : colors.muted, marginTop: 4 }}>{item.label}</AppText>
                  </MotionPressable>
                </Animated.View>
              );
            })}
          </View>
          <Animated.View key={type} entering={FadeIn.duration(260)}>
            <AppText variant="caption" muted center style={{ marginTop: 12, minHeight: 34 }}>{selected.copy}</AppText>
          </Animated.View>
          <Button label="Check match" iconRight="arrow-right" onPress={open} variant="rose" shine style={{ marginTop: 14 }} testID="match-start" />
        </LinearGradient>
      </Animated.View>

      {matchReport ? (
        <Animated.View entering={rise(2)}>
          <MotionPressable onPress={() => router.push("/compatibility")} style={styles.upsell} haptic="light">
            <Icon name="file-text" size={20} color={colors.goldSoft} weight="duotone" />
            <View style={{ flex: 1 }}>
              <AppText variant="subtitle" style={{ fontSize: 15 }}>Full compatibility report</AppText>
              <AppText variant="caption" muted>Communication, conflict style and growth edges</AppText>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <AppText variant="caption" muted style={{ textDecorationLine: "line-through" }}>{reportPrice(matchReport, true)}</AppText>
              <AppText variant="subtitle" style={{ color: colors.goldSoft }}>{reportPrice(matchReport)}</AppText>
            </View>
          </MotionPressable>
        </Animated.View>
      ) : null}

      <Animated.View entering={rise(3)} style={{ marginTop: 28 }}>
        <AppText variant="title">{history.length ? "Recent matches" : "No matches yet"}</AppText>
        {history.length ? (
          <View style={{ gap: 10, marginTop: 14 }}>
            {history.slice(0, 5).map((item: any, i: number) => {
              const total = Number(item.result?.total);
              return (
                <Animated.View key={item.id} entering={rise(i)}>
                  <View style={styles.historyRow}>
                    <ScoreRing size={54} stroke={4} value={Number.isFinite(total) ? total / 36 : 0} delay={200 + i * 80}>
                      <AppText variant="label">{Number.isFinite(total) ? total : "—"}</AppText>
                    </ScoreRing>
                    <View style={{ flex: 1 }}>
                      <AppText variant="subtitle">{item.partner_name}</AppText>
                      <AppText variant="caption" muted style={{ textTransform: "capitalize" }}>{item.relation || "relationship"} · out of 36 Gunas</AppText>
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        ) : (
          <AppText variant="body" muted style={{ marginTop: 6 }}>Add a partner, friend or co-founder to see how your charts meet.</AppText>
        )}
      </Animated.View>

      <View style={styles.trustCard}>
        <Icon name="shield" size={22} color={colors.violet} weight="duotone" />
        <View style={{ flex: 1 }}>
          <AppText variant="subtitle" style={{ fontSize: 16 }}>A score is never a verdict</AppText>
          <AppText variant="caption" muted style={{ marginTop: 4 }}>AstroNow never tells you to marry, leave, trust or reject someone. The reading helps you ask better questions.</AppText>
        </View>
      </View>

      <EditorialFooter kicker="BETTER THAN A SCORE" title={"Compatibility grows\nthrough clarity."} note="Use the stars to start a conversation, not to end one." />
    </Screen>
  );
}

function Connector({ tint }: { tint: [string, string] }) {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [t, reduced]);
  const heart = useAnimatedStyle(() => ({ transform: [{ scale: 0.9 + t.value * 0.25 }] }));
  const dotA = useAnimatedStyle(() => ({ transform: [{ translateX: -30 + t.value * 22 }], opacity: 1 - t.value * 0.6 }));
  const dotB = useAnimatedStyle(() => ({ transform: [{ translateX: 30 - t.value * 22 }], opacity: 1 - t.value * 0.6 }));
  return (
    <View style={{ width: 90, height: 72, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", left: 0, right: 0, height: 1, borderTopWidth: 1, borderColor: "rgba(235,226,250,0.22)", borderStyle: "dashed" }} />
      <Animated.View style={[{ position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: tint[0] }, dotA]} />
      <Animated.View style={[{ position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: tint[0] }, dotB]} />
      <Animated.View style={heart}>
        <LinearGradient colors={tint} style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }}>
          <Icon name="heart" size={16} color="#171326" weight="fill" />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { padding: 20, borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(217,121,162,0.28)" },
  pair: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  ghost: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.borderStrong },
  types: { flexDirection: "row", gap: 8, marginTop: 20 },
  type: { alignItems: "center", paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(11,11,26,0.35)" },
  upsell: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: radii.lg, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.glassBorder },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: radii.lg, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.border },
  trustCard: { marginTop: 26, flexDirection: "row", alignItems: "flex-start", gap: 13, padding: 18, borderRadius: radii.xl, backgroundColor: "rgba(21,20,43,0.92)", borderWidth: 1, borderColor: colors.border },
}));
