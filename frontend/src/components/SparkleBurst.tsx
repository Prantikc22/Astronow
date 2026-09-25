import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

const COLORS = ["#F7DDA6", "#F2C879", "#F0A0BD", "#A8A0E8", "#FFFFFF"];

function Particle({ index, total, trigger, radius }: { index: number; total: number; trigger: number; radius: number }) {
  const t = useSharedValue(0);
  const angle = (index / total) * Math.PI * 2 + (index % 2 ? 0.2 : -0.1);
  const dist = radius * (0.65 + ((index * 37) % 10) / 22);
  useEffect(() => {
    if (!trigger) return;
    t.value = 0;
    t.value = withDelay((index % 4) * 18, withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) }));
  }, [trigger, index, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1 - t.value,
    transform: [
      { translateX: Math.cos(angle) * dist * t.value },
      { translateY: Math.sin(angle) * dist * t.value - 10 * t.value },
      { scale: 1.2 - t.value * 0.8 },
      { rotate: `${t.value * 180}deg` },
    ],
  }));
  const size = index % 3 === 0 ? 7 : 5;
  return <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: index % 3 === 0 ? 1 : size, backgroundColor: COLORS[index % COLORS.length] }, style]} />;
}

/** Radial burst of star particles. Change `trigger` to fire again. */
export function SparkleBurst({ trigger, count = 18, radius = 90 }: { trigger: number; count?: number; radius?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
      {Array.from({ length: count }, (_, i) => <Particle key={i} index={i} total={count} trigger={trigger} radius={radius} />)}
    </View>
  );
}
