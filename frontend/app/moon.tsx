import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { ErrorState, Screen } from "@/src/components/Screen";
import { Skeleton } from "@/src/components/Skeleton";
import { rise } from "@/src/motion";
import { enableNotifications, scheduleMoonDays } from "@/src/services/notifications";
import { makeStyles, radii, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

type MoonDay = { date: string; tithi: string; paksha: string; nakshatra?: string; illumination: number; waxing: boolean; events: string[]; sunrise?: string; sunset?: string };

/** Moon phase drawn from illumination (0 new → 1 full); the lit side follows waxing/waning. */
export function MoonGlyph({ size, illumination, waxing }: { size: number; illumination: number; waxing: boolean }) {
  const r = size / 2 - 1;
  const c = size / 2;
  const k = Math.max(0, Math.min(1, illumination));
  const rx = Math.max(0.01, r * Math.abs(1 - 2 * k));
  const outer = waxing ? 1 : 0;
  const inner = waxing ? (k < 0.5 ? 0 : 1) : (k < 0.5 ? 1 : 0);
  const d = `M ${c} ${c - r} A ${r} ${r} 0 0 ${outer} ${c} ${c + r} A ${rx} ${r} 0 0 ${inner} ${c} ${c - r} Z`;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} fill="#2A2748" />
      {k > 0.02 ? <Path d={d} fill="#F4EEDD" /> : null}
    </Svg>
  );
}

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

export default function MoonCalendar() {
  const styles = useStyles();
  const { colors } = useTheme();
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 });
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [selected, setSelected] = useState(todayIso);
  const [reminded, setReminded] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["moon-calendar", cursor.y, cursor.m],
    queryFn: () => api.get(`/moon-calendar?year=${cursor.y}&month=${cursor.m}`),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const days: MoonDay[] = useMemo(() => data?.days || [], [data]);
  const lead = new Date(cursor.y, cursor.m - 1, 1).getDay();
  const sel = days.find((d) => d.date === selected) || days[0];
  const events = days.filter((d) => d.events.length);
  const monthLabel = new Date(cursor.y, cursor.m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const shift = (delta: number) => {
    haptics.selection();
    setCursor(({ y, m }) => {
      const d = new Date(y, m - 1 + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() + 1 };
    });
  };

  const remind = async () => {
    const ok = await enableNotifications();
    if (ok) { await scheduleMoonDays(days); setReminded(true); haptics.success(); }
  };

  return (
    <Screen title="Moon calendar" subtitle="Tithis, fasting days and full moons" back>
      <Animated.View entering={rise(0)} style={styles.monthBar}>
        <MotionPressable onPress={() => shift(-1)} style={styles.navBtn} accessibilityLabel="Previous month"><Icon name="chevron-left" size={18} color={colors.onSurface} /></MotionPressable>
        <AppText variant="title" style={{ fontSize: 20 }}>{monthLabel}</AppText>
        <MotionPressable onPress={() => shift(1)} style={styles.navBtn} accessibilityLabel="Next month"><Icon name="chevron-right" size={18} color={colors.onSurface} /></MotionPressable>
      </Animated.View>

      {isError ? <ErrorState onRetry={refetch} /> : null}
      {isLoading ? <Skeleton height={330} radius={radii.xl} style={{ marginTop: 14 }} /> : null}
      {days.length ? (
        <Animated.View key={`${cursor.y}-${cursor.m}`} entering={FadeIn.duration(260)} style={styles.grid}>
          <View style={styles.weekRow}>{WEEK.map((w, i) => <AppText key={i} variant="caption" muted center style={{ flex: 1 }}>{w}</AppText>)}</View>
          <View style={styles.cells}>
            {Array.from({ length: lead }, (_, i) => <View key={`b${i}`} style={styles.cell} />)}
            {days.map((d) => {
              const isSel = d.date === selected;
              const isToday = d.date === todayIso;
              const special = d.events.length > 0;
              return (
                <MotionPressable key={d.date} onPress={() => setSelected(d.date)} style={[styles.cell, isSel && styles.cellSel]} haptic="selection" testID={`moon-${d.date}`}>
                  <AppText variant="caption" style={{ fontSize: 11, color: isToday ? colors.goldSoft : colors.muted }}>{Number(d.date.slice(-2))}</AppText>
                  <MoonGlyph size={22} illumination={d.illumination} waxing={d.waxing} />
                  <View style={[styles.eventDot, { opacity: special ? 1 : 0 }]} />
                </MotionPressable>
              );
            })}
          </View>
        </Animated.View>
      ) : null}

      {sel ? (
        <Animated.View key={sel.date} entering={FadeIn.duration(220)} style={styles.detail}>
          <MoonGlyph size={64} illumination={sel.illumination} waxing={sel.waxing} />
          <View style={{ flex: 1 }}>
            <AppText variant="caption" muted>{new Date(sel.date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</AppText>
            <AppText variant="title" style={{ fontSize: 20, marginTop: 2 }}>{sel.tithi}</AppText>
            <AppText variant="caption" style={{ color: colors.onSurface }}>{sel.paksha === "Shukla" ? "Waxing · Shukla paksha" : "Waning · Krishna paksha"}{sel.nakshatra ? ` · ${sel.nakshatra}` : ""}</AppText>
            {sel.events.map((e) => <View key={e} style={styles.eventTag}><AppText variant="caption" style={{ color: colors.ink, fontSize: 11 }}>{e}</AppText></View>)}
          </View>
        </Animated.View>
      ) : null}

      {events.length ? (
        <View style={{ marginTop: 22 }}>
          <AppText variant="title" style={{ fontSize: 20 }}>This month</AppText>
          <View style={{ gap: 8, marginTop: 12 }}>
            {events.map((d, i) => (
              <Animated.View key={d.date} entering={rise(i, 40)}>
                <MotionPressable onPress={() => setSelected(d.date)} style={styles.eventRow}>
                  <MoonGlyph size={30} illumination={d.illumination} waxing={d.waxing} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="subtitle" style={{ fontSize: 15 }}>{d.events.join(" · ")}</AppText>
                    <AppText variant="caption" muted>{new Date(d.date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {d.tithi}</AppText>
                  </View>
                </MotionPressable>
              </Animated.View>
            ))}
          </View>
        </View>
      ) : null}

      <MotionPressable onPress={remind} disabled={reminded} style={styles.remind} haptic="medium" testID="moon-remind">
        <Icon name={reminded ? "check-circle" : "bell"} size={18} color={colors.goldSoft} weight="duotone" />
        <AppText variant="label" style={{ flex: 1, color: colors.onSurface }}>{reminded ? "Reminders set for this month" : "Remind me on Purnima, Amavasya and Ekadashi"}</AppText>
      </MotionPressable>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  monthBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  navBtn: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  grid: { marginTop: 14, padding: 12, borderRadius: radii.xl, backgroundColor: "rgba(21,20,43,0.92)", borderWidth: 1, borderColor: colors.border },
  weekRow: { flexDirection: "row", marginBottom: 6 },
  cells: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, height: 58, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 10 },
  cellSel: { backgroundColor: "rgba(242,200,121,0.12)", borderWidth: 1, borderColor: "rgba(242,200,121,0.45)" },
  eventDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.coral },
  detail: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12, padding: 18, borderRadius: radii.lg, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.glassBorder },
  eventTag: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.goldSoft },
  eventRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, backgroundColor: "rgba(28,27,52,0.9)", borderWidth: 1, borderColor: colors.border },
  remind: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: "rgba(242,200,121,0.07)", borderWidth: 1, borderColor: "rgba(242,200,121,0.25)" },
}));
