import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { AppText } from "@/src/components/AppText";
import { Icon } from "@/src/components/Icon";
import { formatDuration, parseClock } from "@/src/content/day-insights";
import { makeStyles, useTheme } from "@/src/theme";

type Window = { start?: string; end?: string };

function useNowMinutes() {
  const read = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const [now, setNow] = useState(read);
  useEffect(() => { const id = setInterval(() => setNow(read()), 30000); return () => clearInterval(id); }, []);
  return now;
}

function NowPulse() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1);
    return () => cancelAnimation(t);
  }, [t]);
  const ring = useAnimatedStyle(() => ({ opacity: 1 - t.value, transform: [{ scale: 1 + t.value * 1.6 }] }));
  return (
    <View style={{ width: 14, height: 14, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: "#F7DDA6" }, ring]} />
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFF6E0", borderWidth: 2, borderColor: "#F2C879" }} />
    </View>
  );
}

/**
 * A sunrise → sunset track marking the supportive window (Abhijit) and the
 * pause window (Rahu Kaal), with a live "now" marker and a countdown line.
 */
export function DayTimeline({ sunrise, sunset, good, pause }: { sunrise?: string; sunset?: string; good?: Window; pause?: Window }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const now = useNowMinutes();
  const rise = parseClock(sunrise) ?? 6 * 60;
  const set = parseClock(sunset) ?? 18 * 60 + 30;
  const span = Math.max(60, set - rise);
  const pos = (m: number) => `${Math.max(0, Math.min(100, ((m - rise) / span) * 100))}%` as const;
  const seg = (w?: Window) => {
    const a = parseClock(w?.start); const b = parseClock(w?.end);
    return a != null && b != null && b > a ? { a, b } : null;
  };
  const g = seg(good);
  const p = seg(pause);

  let status: { icon: string; text: string; color: string };
  if (p && now >= p.a && now < p.b) status = { icon: "hourglass", text: `Rahu Kaal is on, a traditionally cautious window. Hold big decisions for ${formatDuration(p.b - now)}.`, color: colors.coralSoft };
  else if (g && now >= g.a && now < g.b) status = { icon: "sparkle", text: `Your best window is open · ${formatDuration(g.b - now)} left.`, color: colors.goldSoft };
  else if (g && now < g.a) status = { icon: "timer", text: `Best window opens in ${formatDuration(g.a - now)} (${good?.start}).`, color: colors.goldSoft };
  else if (p && now < p.a) status = { icon: "timer", text: `Rahu Kaal begins in ${formatDuration(p.a - now)} (${pause?.start}).`, color: colors.coralSoft };
  else if (now >= set) status = { icon: "moon", text: "The sun has set. A good hour to reflect, not to start.", color: colors.violet };
  else status = { icon: "sun", text: "Clear sky for the rest of the day. Move steadily.", color: colors.goldSoft };

  const showNow = now >= rise && now <= set;
  return (
    <View>
      <View style={styles.trackWrap}>
        <View style={styles.track} />
        {g ? <View style={[styles.seg, { left: pos(g.a), width: `${((g.b - g.a) / span) * 100}%`, backgroundColor: colors.gold }]} /> : null}
        {p ? <View style={[styles.seg, { left: pos(p.a), width: `${((p.b - p.a) / span) * 100}%`, backgroundColor: "#E0708F" }]} /> : null}
        {showNow ? <View style={[styles.now, { left: pos(now) }]}><NowPulse /></View> : null}
      </View>
      <View style={styles.ends}>
        <View style={styles.end}><Icon name="sunrise" size={14} color={colors.muted} /><AppText variant="caption" muted>{sunrise || "Sunrise"}</AppText></View>
        <View style={styles.end}><AppText variant="caption" muted>{sunset || "Sunset"}</AppText><Icon name="moon" size={14} color={colors.muted} /></View>
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBar, { backgroundColor: colors.gold }]} />
          <View><AppText variant="label" style={{ color: colors.goldSoft }}>{good?.start && good?.end ? `${good.start} – ${good.end}` : "—"}</AppText><AppText variant="caption" muted>Best window · Abhijit</AppText></View>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBar, { backgroundColor: "#E0708F" }]} />
          <View><AppText variant="label" style={{ color: colors.coralSoft }}>{pause?.start && pause?.end ? `${pause.start} – ${pause.end}` : "—"}</AppText><AppText variant="caption" muted>Pause window · Rahu Kaal</AppText></View>
        </View>
      </View>
      <View style={[styles.status, { borderColor: status.color + "40", backgroundColor: status.color + "12" }]}>
        <Icon name={status.icon} size={16} color={status.color} weight="duotone" />
        <AppText variant="caption" style={{ color: colors.onSurface, flex: 1 }}>{status.text}</AppText>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  trackWrap: { height: 22, justifyContent: "center", marginTop: 6 },
  track: { height: 4, borderRadius: 2, backgroundColor: "rgba(235,226,250,0.12)" },
  seg: { position: "absolute", height: 8, borderRadius: 4 },
  now: { position: "absolute", marginLeft: -7 },
  ends: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  end: { flexDirection: "row", alignItems: "center", gap: 5 },
  legend: { flexDirection: "row", gap: 12, marginTop: 16 },
  legendItem: { flex: 1, flexDirection: "row", gap: 10, alignItems: "center" },
  legendBar: { width: 4, height: 34, borderRadius: 2 },
  status: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 14, borderWidth: 1 },
}));
