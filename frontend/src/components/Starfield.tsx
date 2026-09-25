import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// Deterministic pseudo-random so stars do not jump between renders.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Star = { x: number; y: number; size: number; base: number; delay: number; period: number; warm: boolean };

function makeStars(count: number, seed: number): Star[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => {
    const big = rand() > 0.88;
    return {
      x: rand(),
      y: rand(),
      size: big ? 2 + rand() * 1.4 : 0.8 + rand() * 1.1,
      base: 0.18 + rand() * 0.4,
      delay: Math.round(rand() * 4000),
      period: 1800 + Math.round(rand() * 2600),
      warm: rand() > 0.72,
    };
  });
}

function Twinkle({ star, width, height, still }: { star: Star; width: number; height: number; still: boolean }) {
  const glow = useSharedValue(star.base);
  useEffect(() => {
    if (still) return;
    glow.value = withDelay(star.delay, withRepeat(withSequence(
      withTiming(Math.min(1, star.base + 0.55), { duration: star.period, easing: Easing.inOut(Easing.sin) }),
      withTiming(star.base, { duration: star.period, easing: Easing.inOut(Easing.sin) }),
    ), -1));
    return () => cancelAnimation(glow);
  }, [glow, star, still]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.8 + glow.value * 0.35 }] }));
  return (
    <Animated.View
      style={[{
        position: "absolute",
        left: star.x * width,
        top: star.y * height,
        width: star.size,
        height: star.size,
        borderRadius: star.size,
        backgroundColor: star.warm ? "#F7DDA6" : "#EDE8FF",
        shadowColor: star.warm ? "#F2C879" : "#C9C2FF",
        shadowOpacity: star.size > 2 ? 0.9 : 0,
        shadowRadius: 4,
      }, style]}
    />
  );
}

function ShootingStar({ width, height }: { width: number; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withSequence(
      withDelay(7000, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) })),
      withTiming(0, { duration: 0 }),
    ), -1);
    return () => cancelAnimation(t);
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value > 0 && t.value < 1 ? Math.sin(t.value * Math.PI) : 0,
    transform: [
      { translateX: width * 0.15 + t.value * width * 0.55 },
      { translateY: height * 0.08 + t.value * height * 0.18 },
      { rotate: "18deg" },
    ],
  }));
  return <Animated.View style={[styles.shooting, style]} />;
}

/** A slowly breathing field of stars with an occasional shooting star. */
export function Starfield({ count = 46, seed = 7, shooting = true }: { count?: number; seed?: number; shooting?: boolean }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const stars = useMemo(() => makeStars(count, seed), [count, seed]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {stars.map((star, index) => <Twinkle key={index} star={star} width={width} height={height} still={reduced} />)}
      {shooting && !reduced ? <ShootingStar width={width} height={height} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shooting: {
    position: "absolute",
    width: 90,
    height: 1.4,
    borderRadius: 1,
    backgroundColor: "rgba(247,221,166,0.85)",
    shadowColor: "#F2C879",
    shadowOpacity: 1,
    shadowRadius: 6,
  },
});
