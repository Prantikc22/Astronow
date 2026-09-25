import React, { useEffect, useId } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

import { useTheme } from "@/src/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Circular progress that sweeps in; children render in the centre. */
export function ScoreRing({
  size = 56, stroke = 4, value, delay = 0, colors: gradient, track, dashed, children,
}: {
  size?: number; stroke?: number; value: number; delay?: number;
  colors?: [string, string]; track?: string; dashed?: boolean; children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = useSharedValue(reduced ? value : 0);
  useEffect(() => {
    progress.value = reduced ? value : withDelay(delay, withTiming(Math.max(0, Math.min(1, value)), { duration: 1100, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [value, delay, reduced, progress]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - progress.value) }));
  const [from, to] = gradient || [colors.goldSoft, colors.coral];
  // Unique per instance: on web, duplicate SVG ids resolve to the first (possibly hidden) match.
  const id = `ring-${useId().replace(/[^a-z0-9]/gi, "")}`;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track || "rgba(235,226,250,0.12)"} strokeWidth={stroke} fill="none"
          strokeDasharray={dashed ? "2 4" : undefined} />
        {value > 0 ? (
          <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${id})`} strokeWidth={stroke} fill="none"
            strokeLinecap="round" strokeDasharray={`${c} ${c}`} animatedProps={animatedProps} />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}
