import React from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { AppText } from "@/src/components/AppText";
import { CountUp } from "@/src/components/CountUp";
import { MotionPressable } from "@/src/components/MotionPressable";
import { ScoreRing } from "@/src/components/ScoreRing";
import { pop } from "@/src/motion";
import { readingLocale } from "@/src/content/daily-reading";
import { useTheme } from "@/src/theme";

/**
 * Seven days centred on today. Today shows its score as a large ring; the
 * other days are compact rings (filled when a score is known, dashed when not).
 */
export function WeekStrip({ selected = 0, scores = {}, onSelect, language = "en", todayLabel = "TODAY" }: {
  selected?: number; scores?: Record<number, number | null | undefined>; onSelect?: (offset: number) => void; language?: string; todayLabel?: string;
}) {
  const { colors } = useTheme();
  const base = new Date();
  const locale = readingLocale(language);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
      {Array.from({ length: 7 }, (_, i) => {
        const offset = i - 3;
        const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
        const isSel = offset === selected;
        const score = scores[offset];
        const known = typeof score === "number";
        const size = isSel ? 76 : 40;
        return (
          <Animated.View key={offset} entering={pop(Math.abs(offset), 60)} style={{ alignItems: "center" }}>
            <AppText variant="label" style={{ color: isSel ? colors.coralSoft : colors.muted, fontSize: isSel ? 12 : 12, marginBottom: 7, letterSpacing: isSel ? 1.2 : 0 }}>
              {isSel ? (offset === 0 ? todayLabel : day.toLocaleDateString(locale, { weekday: "short" }).toUpperCase()) : day.toLocaleDateString(locale, { weekday: "narrow" })}
            </AppText>
            <MotionPressable onPress={() => onSelect?.(offset)} haptic="selection" accessibilityRole="button" accessibilityState={{ selected: isSel }}
              accessibilityLabel={day.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }) + (known ? `, score ${score}%` : "")}
              testID={`week-day-${offset}`} disabled={!onSelect}>
              <View style={isSel ? { borderRadius: size / 2, shadowColor: colors.coral, shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } } : null}>
                <ScoreRing size={size} stroke={isSel ? 6 : 3} value={known ? score! / 100 : 0} dashed={!known} delay={180 + Math.abs(offset) * 70}
                  colors={isSel ? [colors.goldSoft, colors.coral] : ["#E6B4CC", "#B4447A"]}>
                  {isSel && known ? (
                    <CountUp value={score!} suffix="%" variant="subtitle" delay={250} style={{ fontSize: 19 }} />
                  ) : (
                    <AppText variant="label" style={{ color: isSel ? colors.onSurface : colors.muted, fontSize: isSel ? 18 : 13 }}>{day.getDate()}</AppText>
                  )}
                </ScoreRing>
              </View>
            </MotionPressable>
          </Animated.View>
        );
      })}
    </View>
  );
}
