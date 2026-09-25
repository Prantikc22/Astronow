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
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { AppText } from "@/src/components/AppText";
import { BrandMark } from "@/src/components/BrandMark";
import { Starfield } from "@/src/components/Starfield";
import { fonts } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

const WORD = "ASTRONOW";
const MARK = 116;
// Lines the eye up with the native splash image (mark-only, 280pt wide) so
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
    t.value = withDelay(820 + index * 70, withTiming(1, { duration: 520, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [t, index]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * 14 }, { scale: 0.9 + t.value * 0.1 }] }));
  return <Animated.Text style={[styles.letter, style]}>{char}</Animated.Text>;
}

function Orbit({ size, delay, duration, dot, reverse }: { size: number; delay: number; duration: number; dot: string; reverse?: boolean }) {
  const reveal = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    reveal.value = withDelay(delay, withSpring(1, { damping: 16, stiffness: 90 }));
    spin.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1));
  }, [reveal, spin, delay, duration]);
  const style = useAnimatedStyle(() => ({
    opacity: reveal.value * 0.9,
    transform: [{ scale: 0.55 + reveal.value * 0.45 }, { rotate: `${(reverse ? -1 : 1) * spin.value * 360}deg` }],
  }));
  return (
    <Animated.View style={[styles.orbit, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <View style={[styles.planet, { backgroundColor: dot, shadowColor: dot, left: size / 2 - 4 }]} />
    </Animated.View>
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
  const exit = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), reduced ? 400 : MIN_SHOW_MS);
    if (!reduced) {
      stars.value = withTiming(1, { duration: 900 });
      bloom.value = withDelay(120, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));
      mark.value = withDelay(480, withSequence(withTiming(1.1, { duration: 260, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 9, stiffness: 160 })));
      tagline.value = withDelay(1450, withTiming(1, { duration: 600 }));
    } else {
      stars.value = 1; bloom.value = 1; tagline.value = 1;
    }
    const pulse = setTimeout(() => haptics.soft(), reduced ? 0 : 500);
    return () => { clearTimeout(timer); clearTimeout(pulse); };
  }, [reduced, stars, bloom, mark, tagline]);

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
                <Stop offset="0" stopColor="#D979A2" stopOpacity={0.42} />
                <Stop offset="0.4" stopColor="#8E83E0" stopOpacity={0.16} />
                <Stop offset="1" stopColor="#0B0B1A" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={210} cy={210} r={210} fill="url(#splash-bloom)" />
          </Svg>
        </Animated.View>
        {!reduced ? (
          <View style={[styles.orbits, { transform: [{ translateY: MARK_OFFSET + 2 }] }]}>
            <Orbit size={190} delay={260} duration={9000} dot="#F7DDA6" />
            <Orbit size={250} delay={420} duration={14000} dot="#F0A0BD" reverse />
          </View>
        ) : null}
        <Animated.View style={markStyle}><BrandMark size={MARK} /></Animated.View>
        <Animated.View style={[styles.word, wordStyle]}>
          {reduced ? <AppText style={styles.letter}>{WORD}</AppText> : WORD.split("").map((c, i) => <Letter key={i} char={c} index={i} />)}
        </Animated.View>
        <Animated.View style={[styles.tag, tagStyle]}>
          <AppText variant="caption" style={{ color: "rgba(248,242,232,0.62)", letterSpacing: 1.6 }}>YOUR SKY, READ FOR YOU</AppText>
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
  orbit: { position: "absolute", borderWidth: 1, borderColor: "rgba(242,200,121,0.22)" },
  planet: { position: "absolute", top: -4, width: 8, height: 8, borderRadius: 4, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  word: { position: "absolute", flexDirection: "row", marginTop: 150 },
  letter: { fontFamily: fonts.displayStrong, fontSize: 30, color: "#F8F2E8", letterSpacing: 6 },
  tag: { position: "absolute", marginTop: 222 },
});
