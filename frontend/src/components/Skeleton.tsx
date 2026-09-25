import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { DimensionValue, StyleProp, View, ViewStyle } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

/** A shimmering placeholder block. */
export function Skeleton({ width = "100%", height = 16, radius = 12, style }: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1);
    return () => cancelAnimation(t);
  }, [t]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: -260 + t.value * 620 }] }));
  return (
    <View style={[{ width, height, borderRadius: radius, overflow: "hidden", backgroundColor: "rgba(235,226,250,0.07)" }, style]}>
      <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, width: 220 }, sweep]}>
        <LinearGradient colors={["transparent", "rgba(235,226,250,0.10)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}
