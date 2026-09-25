import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { ScoreRing } from "@/src/components/ScoreRing";
import { ErrorState, Screen } from "@/src/components/Screen";
import { Skeleton } from "@/src/components/Skeleton";
import { UpsellSheet } from "@/src/components/UpsellSheet";
import { pop, rise } from "@/src/motion";
import { makeStyles, radii, useTheme } from "@/src/theme";

const ACTIVITIES: { id: string; label: string; icon: FeatherName }[] = [
  { id: "travel", label: "Travel", icon: "navigation" },
  { id: "business", label: "Sign or start", icon: "briefcase" },
  { id: "property", label: "Buy property / car", icon: "home" },
  { id: "job", label: "Join a job", icon: "trending-up" },
  { id: "housewarming", label: "Griha pravesh", icon: "sparkle" },
  { id: "engagement", label: "Engagement", icon: "heart" },
];

const fmt = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

export default function Muhurat() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [activity, setActivity] = useState("travel");
  const [upsell, setUpsell] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["muhurat", activity], queryFn: () => api.get(`/muhurat?activity=${activity}&days=21`), staleTime: 6 * 60 * 60 * 1000,
  });
  const results: any[] = data?.results || [];

  return (
    <Screen title="Muhurat finder" subtitle="The best days in the next three weeks" back>
      <Animated.View entering={rise(0)}>
        <AppText variant="body" muted>Pick what you are planning. We check every day&apos;s tithi, nakshatra and weekday against traditional muhurta guidelines, and keep you clear of Rahu Kaal.</AppText>
      </Animated.View>
      <View style={styles.grid}>
        {ACTIVITIES.map((a, i) => {
          const on = a.id === activity;
          return (
            <Animated.View key={a.id} entering={pop(i, 40)} style={styles.cellWrap}>
              <MotionPressable onPress={() => setActivity(a.id)} style={[styles.cell, on && styles.cellOn]} testID={`muhurat-${a.id}`} accessibilityState={{ selected: on }}>
                <Icon name={a.icon} size={20} color={on ? colors.goldSoft : colors.muted} weight={on ? "fill" : "regular"} />
                <AppText variant="caption" center numberOfLines={2} style={{ color: on ? colors.onSurface : colors.muted, marginTop: 6 }}>{a.label}</AppText>
              </MotionPressable>
            </Animated.View>
          );
        })}
      </View>

      {isError ? <ErrorState onRetry={refetch} /> : null}
      {isLoading ? <View style={{ gap: 10, marginTop: 20 }}><Skeleton height={230} radius={radii.xl} /><Skeleton height={70} radius={radii.lg} /><Skeleton height={70} radius={radii.lg} /></View> : null}

      {results.length ? (
        <Animated.View key={activity} entering={FadeIn.duration(280)} style={{ marginTop: 20, gap: 10 }}>
          {results.map((r, i) => r.locked ? (
            <MotionPressable key={r.date} onPress={() => setUpsell(true)} style={styles.locked} testID={`muhurat-locked-${i}`}>
              <ScoreRing size={44} stroke={3} value={r.score / 100} delay={100 + i * 60}><AppText variant="label" style={{ fontSize: 12 }}>{r.score}</AppText></ScoreRing>
              <View style={{ flex: 1 }}>
                <AppText variant="subtitle" style={{ fontSize: 15 }}>{fmt(r.date)}</AppText>
                <AppText variant="caption" muted>Timings and reasons with Plus</AppText>
              </View>
              <Icon name="lock" size={16} color={colors.coralSoft} />
            </MotionPressable>
          ) : (
            <LinearGradient key={r.date} colors={["#2A1640", "#1A1433"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.best}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <ScoreRing size={70} stroke={6} value={r.score / 100} delay={150}><AppText variant="subtitle">{r.score}</AppText></ScoreRing>
                <View style={{ flex: 1 }}>
                  {i === 0 ? <AppText variant="label" style={{ color: colors.coralSoft, letterSpacing: 1 }}>BEST DAY</AppText> : null}
                  <AppText variant="title" style={{ fontSize: 21 }}>{fmt(r.date)}</AppText>
                  <AppText variant="caption" muted>{r.tithi} · {r.nakshatra} · {r.paksha === "Shukla" ? "waxing moon" : "waning moon"}</AppText>
                </View>
              </View>
              <View style={styles.windows}>
                <View style={[styles.window, { borderColor: "rgba(242,200,121,0.4)" }]}>
                  <AppText variant="caption" style={{ color: colors.goldSoft }}>Best window</AppText>
                  <AppText variant="label" style={{ marginTop: 2 }}>{r.best_window ? `${r.best_window.start} – ${r.best_window.end}` : "Morning, after sunrise"}</AppText>
                </View>
                <View style={[styles.window, { borderColor: "rgba(224,112,143,0.4)" }]}>
                  <AppText variant="caption" style={{ color: colors.coralSoft }}>Avoid · Rahu Kaal</AppText>
                  <AppText variant="label" style={{ marginTop: 2 }}>{r.avoid_window ? `${r.avoid_window.start} – ${r.avoid_window.end}` : "—"}</AppText>
                </View>
              </View>
              {(r.reasons || []).map((t: string) => (
                <View key={t} style={styles.reason}><Icon name="check" size={13} color={colors.goldSoft} weight="bold" /><AppText variant="caption" style={{ flex: 1, color: colors.onSurface }}>{t}</AppText></View>
              ))}
              {(r.cautions || []).map((t: string) => (
                <View key={t} style={styles.reason}><Icon name="alert-circle" size={13} color={colors.coralSoft} /><AppText variant="caption" muted style={{ flex: 1 }}>{t}</AppText></View>
              ))}
            </LinearGradient>
          ))}
        </Animated.View>
      ) : null}

      <AppText variant="caption" muted center style={{ marginTop: 20 }}>A planning guide based on traditional muhurta rules. For weddings and major ceremonies, also consult your family priest.</AppText>
      <UpsellSheet visible={upsell} kind="plus" onClose={() => setUpsell(false)} />
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  cellWrap: { width: "31.8%" },
  cell: { alignItems: "center", paddingVertical: 14, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(28,27,52,0.9)" },
  cellOn: { borderColor: "rgba(242,200,121,0.55)", backgroundColor: "rgba(58,29,74,0.9)" },
  best: { padding: 18, borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(217,121,162,0.3)" },
  windows: { flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 8 },
  window: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, backgroundColor: "rgba(11,11,26,0.35)" },
  reason: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8 },
  locked: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radii.lg, backgroundColor: "rgba(28,27,52,0.8)", borderWidth: 1, borderColor: colors.border },
}));
