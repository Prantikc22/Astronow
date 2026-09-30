import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { AppText } from "@/src/components/AppText";
import { BrandMark } from "@/src/components/BrandMark";
import { Starfield } from "@/src/components/Starfield";
import { fonts } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

const WORD = "ASTRONOW";
const MARK = 150;
// Lines the star up with the native splash image (mark-only, 280pt wide) so
// the hand-off from the OS splash to this one is invisible.
const MARK_OFFSET = -39;
const MIN_SHOW_MS = 2300;
const LAUNCHED_AT = Date.now();

/** Milliseconds until the launch splash has finished leaving (0 afterwards). */
export function splashRemaining() {
  return Math.max(0, MIN_SHOW_MS + 500 - (Date.now() - LAUNCHED_AT));
}

function Letter({ char, index }: { char: string; index: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(760 + index * 60, withTiming(1, { duration: 640, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
  }, [t, index]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * 6 }] }));
  return <Animated.Text style={[styles.letter, style]}>{char}</Animated.Text>;
}

/** A ring of light that leaves the star and fades, like a ripple. */
function Ripple({ delay }: { delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({ opacity: t.value === 0 ? 0 : (1 - t.value) * 0.7, transform: [{ scale: 1 + t.value * 1.5 }] }));
  return <Animated.View style={[styles.ripple, style]} />;
}

// Small companion stars around the mark, as in the app icon.
const SPARKS = [
  { x: -118, y: -92, size: 9, delay: 700 }, { x: 104, y: -128, size: 7, delay: 900 }, { x: 132, y: -20, size: 5, delay: 1100 },
  { x: -96, y: 58, size: 6, delay: 1000 }, { x: 122, y: 96, size: 8, delay: 1250 }, { x: -140, y: -18, size: 4, delay: 1350 },
];

function Spark({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withSequence(withTiming(1, { duration: 420 }), withRepeat(withTiming(0.35, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true)));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateX: x }, { translateY: y + MARK_OFFSET }, { scale: 0.6 + t.value * 0.4 }] }));
  return <Animated.Text style={[{ position: "absolute", color: "#F7DDA6", fontSize: size * 1.6 }, style]}>✦</Animated.Text>;
}

/** A gold hairline that draws outward from a small star under the wordmark. */
function Hairline() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(1350, withTiming(1, { duration: 700, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
  }, [t]);
  const line = useAnimatedStyle(() => ({ width: t.value * 64, opacity: t.value }));
  const star = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ rotate: `${(1 - t.value) * 90}deg` }] }));
  return (
    <View style={styles.hairline} pointerEvents="none">
      <Animated.View style={[styles.rule, line]} />
      <Animated.Text style={[{ color: "#F2C879", fontSize: 10 }, star]}>✦</Animated.Text>
      <Animated.View style={[styles.rule, line]} />
    </View>
  );
}

/**
 * Brand intro that continues from the native splash, then opens onto the app
 * once `ready` is true and the sequence has played.
 */
export function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const reduced = useReducedMotion();
  const [minElapsed, setMinElapsed] = useState(false);
  const stars = useSharedValue(0);
  const bloom = useSharedValue(0);
  const mark = useSharedValue(1);
  const tagline = useSharedValue(0);
  const twirl = useSharedValue(0);
  const breathe = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), reduced ? 400 : MIN_SHOW_MS);
    if (!reduced) {
      stars.value = withTiming(1, { duration: 900 });
      bloom.value = withDelay(120, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));
      mark.value = withDelay(380, withSequence(withTiming(1.16, { duration: 320, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })));
      // The short rays turn a quarter circle, which lands them exactly where they began.
      twirl.value = withDelay(380, withTiming(1, { duration: 1300, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
      breathe.value = withDelay(1200, withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true));
      tagline.value = withDelay(1450, withTiming(1, { duration: 600 }));
    } else {
      stars.value = 1; bloom.value = 1; tagline.value = 1;
    }
    const pulse = setTimeout(() => haptics.soft(), reduced ? 0 : 500);
    return () => { clearTimeout(timer); clearTimeout(pulse); };
  }, [reduced, stars, bloom, mark, tagline, twirl, breathe]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    haptics.light();
    exit.value = withTiming(1, { duration: reduced ? 200 : 620, easing: Easing.bezier(0.7, 0, 0.3, 1) }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
  }, [ready, minElapsed, exit, onDone, reduced]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.max(0, exit.value - 0.35) / 0.65 }));
  const starStyle = useAnimatedStyle(() => ({ opacity: stars.value }));
  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloom.value * (1 - exit.value), transform: [{ scale: 0.4 + bloom.value * 0.8 + exit.value * 1.2 }] }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ translateY: MARK_OFFSET }, { scale: mark.value * (1 + exit.value * 0.5) }] }));
  const diagStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${twirl.value * 90}deg` }, { scale: 1 + Math.sin(twirl.value * Math.PI) * 0.35 + breathe.value * 0.06 }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.75 + breathe.value * 0.25, transform: [{ scale: 1 + breathe.value * 0.03 }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value * 1.6, transform: [{ translateY: -exit.value * 12 }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tagline.value * (1 - exit.value * 1.6), transform: [{ translateY: (1 - tagline.value) * 8 }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} pointerEvents={ready && minElapsed ? "none" : "auto"}>
      <Animated.View style={[StyleSheet.absoluteFill, starStyle]}><Starfield count={60} seed={11} shooting={false} /></Animated.View>
      <View style={styles.center}>
        <Animated.View style={[styles.bloom, bloomStyle]}>
          <Svg width={420} height={420}>
            <Defs>
              <RadialGradient id="splash-bloom" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#F2C879" stopOpacity={0.3} />
                <Stop offset="0.28" stopColor="#5B4BE0" stopOpacity={0.3} />
                <Stop offset="0.6" stopColor="#3B2FB0" stopOpacity={0.14} />
                <Stop offset="1" stopColor="#0B0B1A" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={210} cy={210} r={210} fill="url(#splash-bloom)" />
          </Svg>
        </Animated.View>
        {!reduced ? (
          <View style={[styles.orbits, { transform: [{ translateY: MARK_OFFSET }] }]} pointerEvents="none">
            <Ripple delay={420} />
            <Ripple delay={820} />
          </View>
        ) : null}
        {!reduced ? SPARKS.map((sp, i) => <Spark key={i} {...sp} />) : null}
        <Animated.View style={markStyle}>
          <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}><BrandMark size={MARK} layer="ring" /></Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, diagStyle]}><BrandMark size={MARK} layer="diagonal" /></Animated.View>
          <BrandMark size={MARK} layer="long" />
        </Animated.View>
        <Animated.View style={[styles.word, wordStyle]}>
          {reduced ? <AppText style={styles.letter}>{WORD}</AppText> : WORD.split("").map((c, i) => <Letter key={i} char={c} index={i} />)}
        </Animated.View>
        <Hairline />
        <Animated.View style={[styles.tag, tagStyle]}>
          <AppText style={styles.tagText}>YOUR SKY  ·  READ FOR YOU</AppText>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#0B0B1A", zIndex: 1000 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bloom: { position: "absolute", width: 420, height: 420, marginTop: MARK_OFFSET * 2 },
  orbits: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ripple: { position: "absolute", width: MARK * 0.7, height: MARK * 0.7, borderRadius: MARK * 0.35, borderWidth: 1, borderColor: "rgba(131,116,240,0.9)" },
  word: { position: "absolute", flexDirection: "row", marginTop: 176 },
  // Wide-tracked champagne capitals in a high-contrast display serif.
  letter: { fontFamily: fonts.wordmark, fontSize: 34, lineHeight: 42, color: "#F2E4C4", letterSpacing: 9 },
  hairline: { position: "absolute", marginTop: 250, flexDirection: "row", alignItems: "center", gap: 8 },
  rule: { height: StyleSheet.hairlineWidth * 2, backgroundColor: "rgba(242,200,121,0.55)" },
  tag: { position: "absolute", marginTop: 290 },
  tagText: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 3.2, color: "rgba(242,228,196,0.62)" },
});
