import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { Starfield } from "@/src/components/Starfield";

function Aurora({ style, color, drift, period, size }: { style: object; color: string; drift: number; period: number; size: number }) {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [t, period, reduced]);
  const motion = useAnimatedStyle(() => ({
    opacity: 0.7 + t.value * 0.3,
    transform: [{ translateX: t.value * drift }, { translateY: t.value * drift * -0.5 }, { scale: 1 + t.value * 0.1 }],
  }));
  const id = `aurora-${color.replace(/[^0-9a-z]/gi, "")}`;
  // A radial gradient that fades to nothing reads as light, not as a shape.
  return (
    <Animated.View style={[styles.blob, style, { width: size, height: size }, motion]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.34} />
            <Stop offset="0.45" stopColor={color} stopOpacity={0.12} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

// A living indigo-night foundation: drifting aurora fields and twinkling stars.
export function CosmicBackground({ children, glow = true, stars = true }: { children?: React.ReactNode; glow?: boolean; stars?: boolean }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={["#0A0918", "#100E27", "#170D26"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {glow ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Aurora style={styles.dawn} size={520} color="#F2C879" drift={-26} period={11000} />
          <Aurora style={styles.iris} size={480} color="#8E83E0" drift={30} period={14000} />
          <Aurora style={styles.rose} size={560} color="#B4447A" drift={-22} period={17000} />
        </View>
      ) : null}
      {stars ? <Starfield /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: "absolute" },
  dawn: { top: -300, right: -220 },
  iris: { top: "30%", left: -300 },
  rose: { bottom: -300, right: -260 },
});
