import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";

/** A diagonal light sweep that passes over its parent every few seconds. */
export function Shine({ every = 3200, width = 90, opacity = 0.45 }: { every?: number; width?: number; opacity?: number }) {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withSequence(
      withDelay(every, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })),
      withTiming(0, { duration: 0 }),
    ), -1);
    return () => cancelAnimation(t);
  }, [t, every, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -width * 1.5 + t.value * 560 }, { skewX: "-20deg" }] }));
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      <Animated.View style={[{ position: "absolute", top: -10, bottom: -10, width }, style]}>
        <LinearGradient colors={["transparent", `rgba(255,255,255,${opacity})`, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}
