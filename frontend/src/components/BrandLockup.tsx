import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { AppText } from "@/src/components/AppText";
import { splashRemaining } from "@/src/components/AnimatedSplash";
import { BrandMark } from "@/src/components/BrandMark";
import { fonts } from "@/src/theme";

const WORD = "AstroNow";

function Letter({ char, index, reduced, base }: { char: string; index: number; reduced: boolean; base: number }) {
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(base + 350 + index * 65, withSpring(1, { damping: 12, stiffness: 150 }));
  }, [t, index, reduced, base]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, t.value * 1.4),
    transform: [{ translateY: (1 - t.value) * -22 }, { rotate: `${(1 - t.value) * (index % 2 ? 12 : -12)}deg` }, { scale: 0.7 + t.value * 0.3 }],
  }));
  const isNow = index >= 5;
  return <Animated.Text style={[{ fontFamily: fonts.displayStrong, fontSize: 40, lineHeight: 48, color: isNow ? "#F7DDA6" : "#F8F2E8", letterSpacing: 0.4 }, style]}>{char}</Animated.Text>;
}

/**
 * Animated brand lockup: the aperture mark with a turning orbit, the wordmark
 * dropping in letter by letter, a drawn underline, and rotating taglines.
 */
export function BrandLockup({ taglines }: { taglines: string[] }) {
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);
  const glow = useSharedValue(0);
  const line = useSharedValue(reduced ? 1 : 0);
  const spark = useSharedValue(0);
  const [tag, setTag] = useState(0);
  const [base] = useState(() => splashRemaining());

  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(withTiming(1, { duration: 12000, easing: Easing.linear }), -1);
    glow.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
    line.value = withDelay(base + 950, withTiming(1, { duration: 700, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
    spark.value = withDelay(base + 950, withSequence(withTiming(1, { duration: 700, easing: Easing.bezier(0.16, 1, 0.3, 1) }), withTiming(2, { duration: 400 })));
    return () => { cancelAnimation(spin); cancelAnimation(glow); };
  }, [reduced, spin, glow, line, spark, base]);

  useEffect(() => {
    if (taglines.length < 2) return;
    const id = setInterval(() => setTag((n) => (n + 1) % taglines.length), 3200);
    return () => clearInterval(id);
  }, [taglines.length]);

  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + glow.value * 0.45, transform: [{ scale: 0.95 + glow.value * 0.15 }] }));
  const underline = useAnimatedStyle(() => ({ width: `${line.value * 100}%` }));
  const sparkStyle = useAnimatedStyle(() => ({
    left: `${Math.min(1, spark.value) * 100}%`,
    opacity: spark.value <= 0 ? 0 : spark.value > 1 ? 2 - spark.value : 1,
    transform: [{ scale: spark.value > 1 ? 1 + (spark.value - 1) * 1.5 : 1 }],
  }));

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: 104, height: 104, alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={[{ position: "absolute", width: 104, height: 104, borderRadius: 52, backgroundColor: "rgba(217,121,162,0.28)" }, halo]} />
        <Animated.View style={[{ position: "absolute", width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: "rgba(242,200,121,0.4)", borderStyle: "dashed" }, ring]}>
          <View style={{ position: "absolute", top: -4, left: 44, width: 8, height: 8, borderRadius: 4, backgroundColor: "#F7DDA6" }} />
        </Animated.View>
        <LinearGradient colors={["#3A1D4A", "#1C1638"]} style={{ width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(242,200,121,0.35)" }}>
          <BrandMark size={52} />
        </LinearGradient>
      </View>
      <View style={{ marginTop: 12, alignItems: "center" }}>
        <View style={{ flexDirection: "row" }} accessible accessibilityLabel="AstroNow">
          {WORD.split("").map((c, i) => <Letter key={i} char={c} index={i} reduced={reduced} base={base} />)}
        </View>
        <View style={{ alignSelf: "stretch", height: 2, marginTop: 2 }}>
          <Animated.View style={[{ height: 2, borderRadius: 1, overflow: "hidden" }, underline]}>
            <LinearGradient colors={["rgba(242,200,121,0)", "#F2C879", "#D979A2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          </Animated.View>
          <Animated.View style={[{ position: "absolute", top: -4, marginLeft: -5, width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFF6E0", shadowColor: "#F2C879", shadowOpacity: 1, shadowRadius: 8 }, sparkStyle]} />
        </View>
      </View>
      <View style={{ height: 24, marginTop: 12, justifyContent: "center" }}>
        <Animated.View key={tag} entering={FadeInDown.duration(420)} exiting={FadeOutUp.duration(300)}>
          <AppText variant="body" center style={{ color: "rgba(248,242,232,0.78)" }}>{taglines[tag]}</AppText>
        </Animated.View>
      </View>
    </View>
  );
}
