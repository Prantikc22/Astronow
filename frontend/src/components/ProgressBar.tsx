import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

export function ProgressBar({ value, delay = 0, height = 6, colors = ["#F7DDA6", "#D979A2"], track = "rgba(235,226,250,0.10)" }: {
  value: number; delay?: number; height?: number; colors?: [string, string]; track?: string;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? value : 0);
  useEffect(() => {
    p.value = reduced ? value : withDelay(delay, withTiming(Math.max(0, Math.min(1, value)), { duration: 950, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [value, delay, reduced, p]);
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: "hidden" }}>
      <Animated.View style={[{ height, borderRadius: height, overflow: "hidden" }, fill]}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}
