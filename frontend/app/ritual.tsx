import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { AppText } from "@/src/components/AppText";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { Screen } from "@/src/components/Screen";
import { SparkleBurst } from "@/src/components/SparkleBurst";
import { dayRuler } from "@/src/content/day-insights";
import { rise, springs } from "@/src/motion";
import { makeStyles, radii, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

// Traditional Navagraha beej mantras for each weekday's ruling planet.
const MANTRAS: Record<string, { latin: string; devanagari: string; meaning: string }> = {
  Sun: { latin: "Om Hraam Hreem Hraum Sah Suryaya Namah", devanagari: "ॐ ह्रां ह्रीं ह्रौं सः सूर्याय नमः", meaning: "A salutation to the Sun, source of vitality, confidence and clear purpose." },
  Moon: { latin: "Om Shraam Shreem Shraum Sah Chandraya Namah", devanagari: "ॐ श्रां श्रीं श्रौं सः चन्द्राय नमः", meaning: "A salutation to the Moon, keeper of the mind, emotions and inner calm." },
  Mars: { latin: "Om Kraam Kreem Kraum Sah Bhaumaya Namah", devanagari: "ॐ क्रां क्रीं क्रौं सः भौमाय नमः", meaning: "A salutation to Mars, planet of courage, drive and decisive action." },
  Mercury: { latin: "Om Braam Breem Braum Sah Budhaya Namah", devanagari: "ॐ ब्रां ब्रीं ब्रौं सः बुधाय नमः", meaning: "A salutation to Mercury, planet of intellect, speech and learning." },
  Jupiter: { latin: "Om Graam Greem Graum Sah Gurave Namah", devanagari: "ॐ ग्रां ग्रीं ग्रौं सः गुरवे नमः", meaning: "A salutation to Jupiter, the Guru: wisdom, growth and good fortune." },
  Venus: { latin: "Om Draam Dreem Draum Sah Shukraya Namah", devanagari: "ॐ द्रां द्रीं द्रौं सः शुक्राय नमः", meaning: "A salutation to Venus, planet of love, beauty and harmony." },
  Saturn: { latin: "Om Praam Preem Praum Sah Shanaischaraya Namah", devanagari: "ॐ प्रां प्रीं प्रौं सः शनैश्चराय नमः", meaning: "A salutation to Saturn, planet of patience, discipline and lasting results." },
};
const BEADS = 108;

export default function Ritual() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [mode, setMode] = useState<"chant" | "breathe">("chant");
  const ruler = dayRuler();
  const mantra = MANTRAS[ruler.planet];

  return (
    <Screen title="Daily ritual" subtitle={`${ruler.glyph} ${ruler.planet} rules today`} back>
      <Animated.View entering={rise(0)} style={styles.mantraCard}>
        <AppText variant="label" style={{ color: colors.coralSoft, letterSpacing: 1.2 }}>MANTRA OF THE DAY</AppText>
        <AppText center style={styles.devanagari}>{mantra.devanagari}</AppText>
        <AppText variant="subtitle" center style={{ color: colors.goldSoft, marginTop: 6 }}>{mantra.latin}</AppText>
        <AppText variant="caption" muted center style={{ marginTop: 8 }}>{mantra.meaning}</AppText>
      </Animated.View>

      <Animated.View entering={rise(1)}><ModeSwitch mode={mode} onChange={setMode} /></Animated.View>
      {mode === "chant" ? <Japa key="chant" /> : <Breath key="breathe" />}
    </Screen>
  );
}

function ModeSwitch({ mode, onChange }: { mode: "chant" | "breathe"; onChange: (m: "chant" | "breathe") => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => { x.set(withSpring(mode === "chant" ? 0 : w / 2, springs.snappy)); }, [mode, w, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <View style={styles.switch} onLayout={(e) => setW(e.nativeEvent.layout.width - 8)}>
      {w ? <Animated.View style={[styles.switchPill, { width: w / 2 }, pill]} /> : null}
      {(["chant", "breathe"] as const).map((m) => (
        <MotionPressable key={m} onPress={() => onChange(m)} style={styles.switchItem} testID={`ritual-${m}`}>
          <Icon name={m === "chant" ? "sparkle" : "activity"} size={15} color={mode === m ? colors.onSurface : colors.muted} />
          <AppText variant="label" style={{ color: mode === m ? colors.onSurface : colors.muted, fontSize: 14 }}>{m === "chant" ? "Chant 108" : "Breathe"}</AppText>
        </MotionPressable>
      ))}
    </View>
  );
}

function Japa() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const size = Math.min(width - 60, 320);
  const now = new Date();
  const key = `astronow.japa.${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const [count, setCount] = useState(0);
  const [burst, setBurst] = useState(0);
  const pulse = useSharedValue(1);
  useEffect(() => { AsyncStorage.getItem(key).then((v) => setCount(Math.min(BEADS, Number(v) || 0))).catch(() => {}); }, [key]);

  const beads = useMemo(() => Array.from({ length: BEADS }, (_, i) => {
    const a = (i / BEADS) * Math.PI * 2 - Math.PI / 2;
    const r = size / 2 - 8;
    return { x: size / 2 + Math.cos(a) * r, y: size / 2 + Math.sin(a) * r, meru: i % 27 === 0 };
  }), [size]);

  const tap = () => {
    if (count >= BEADS) return;
    const next = count + 1;
    setCount(next);
    AsyncStorage.setItem(key, String(next)).catch(() => {});
    pulse.set(withSequence(withTiming(0.94, { duration: 70 }), withSpring(1, springs.bouncy)));
    if (next === BEADS) { haptics.celebrate(); setBurst((n) => n + 1); }
    else if (next % 27 === 0) haptics.medium();
    else haptics.selection();
  };
  const reset = () => { setCount(0); AsyncStorage.setItem(key, "0").catch(() => {}); haptics.light(); };
  const orb = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));
  const done = count >= BEADS;

  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: "center", marginTop: 22 }}>
      <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={`Count a mantra. ${count} of ${BEADS}`} testID="japa-tap">
        <View style={{ width: size, height: size }}>
          {beads.map((b, i) => {
            const lit = i < count;
            const d = b.meru ? 9 : 6;
            return <View key={i} style={{ position: "absolute", left: b.x - d / 2, top: b.y - d / 2, width: d, height: d, borderRadius: d / 2,
              backgroundColor: lit ? (b.meru ? colors.goldSoft : colors.coral) : "rgba(235,226,250,0.14)" }} />;
          })}
          <Animated.View style={[styles.japaOrb, { width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31, left: size * 0.19, top: size * 0.19 }, orb]}>
            <LinearGradient colors={done ? ["#5A4518", "#2A1640"] : ["#3A1D4A", "#1C1638"]} style={{ flex: 1, borderRadius: size * 0.31, alignItems: "center", justifyContent: "center" }}>
              <AppText style={styles.count}>{count}</AppText>
              <AppText variant="caption" muted>{done ? "Complete. Well done." : `of ${BEADS} · tap to count`}</AppText>
            </LinearGradient>
          </Animated.View>
          <SparkleBurst trigger={burst} radius={size / 2} count={28} />
        </View>
      </Pressable>
      <AppText variant="caption" muted center style={{ marginTop: 16, maxWidth: 300 }}>Chant once with each tap. A gold bead marks every 27; a full mala is 108.</AppText>
      {count ? <MotionPressable onPress={reset} style={styles.reset} haptic="none"><Icon name="rotate-ccw" size={14} color={colors.muted} /><AppText variant="caption" muted>Start over</AppText></MotionPressable> : null}
    </Animated.View>
  );
}

const PHASES = [
  { label: "Breathe in", ms: 4000, to: 1 },
  { label: "Hold", ms: 4000, to: 1 },
  { label: "Breathe out", ms: 6000, to: 0 },
];

function Breath() {
  const styles = useStyles();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [rounds, setRounds] = useState(0);
  const s = useSharedValue(0);

  useEffect(() => {
    if (!running) { cancelAnimation(s); s.set(withTiming(0, { duration: 600 })); return; }
    const p = PHASES[phase];
    haptics.soft();
    s.set(withTiming(p.to, { duration: reduced ? 0 : p.ms, easing: Easing.inOut(Easing.sin) }));
    const t = setTimeout(() => {
      const next = (phase + 1) % PHASES.length;
      if (next === 0) setRounds((r) => r + 1);
      setPhase(next);
    }, p.ms);
    return () => clearTimeout(t);
  }, [running, phase, s, reduced]);

  const orb = useAnimatedStyle(() => ({ transform: [{ scale: 0.55 + s.get() * 0.45 }], opacity: 0.55 + s.get() * 0.45 }));
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: 0.7 + s.get() * 0.5 }], opacity: 0.15 + s.get() * 0.25 }));

  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: "center", marginTop: 22 }}>
      <View style={{ width: 280, height: 280, alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={[{ position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(168,160,232,0.35)" }, halo]} />
        <Animated.View style={[{ width: 220, height: 220, borderRadius: 110, overflow: "hidden" }, orb]}>
          <LinearGradient colors={["#C7D4FF", "#8E83E0", "#5E3E8E"]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1 }} />
        </Animated.View>
        <View style={{ position: "absolute", alignItems: "center" }}>
          <AppText variant="title" style={{ color: colors.ivory }}>{running ? PHASES[phase].label : "Ready"}</AppText>
          {running ? <AppText variant="caption" style={{ color: "rgba(248,242,232,0.8)", marginTop: 2 }}>Round {rounds + 1}</AppText> : null}
        </View>
      </View>
      <AppText variant="caption" muted center style={{ marginTop: 14, maxWidth: 300 }}>In for 4, hold for 4, out for 6. A calm way to settle the mind before chanting or a big decision.</AppText>
      <MotionPressable onPress={() => { setRunning((r) => !r); setPhase(0); if (running) setRounds(0); }} style={styles.breathBtn} haptic="medium" testID="breath-toggle">
        <Icon name={running ? "x" : "activity"} size={16} color={colors.ink} />
        <AppText variant="label" style={{ color: colors.ink, fontSize: 15 }}>{running ? "Stop" : "Begin"}</AppText>
      </MotionPressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  mantraCard: { marginTop: 6, padding: 20, borderRadius: radii.xl, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.glassBorder, alignItems: "center" },
  devanagari: { marginTop: 14, fontSize: 22, lineHeight: 34, color: colors.ivory },
  switch: { flexDirection: "row", marginTop: 16, padding: 4, borderRadius: 14, backgroundColor: "rgba(33,31,59,0.9)", borderWidth: 1, borderColor: colors.border },
  switchPill: { position: "absolute", left: 4, top: 4, bottom: 4, borderRadius: 10, backgroundColor: "#3B3470", borderWidth: 1, borderColor: "rgba(168,160,232,0.5)" },
  switchItem: { flex: 1, height: 42, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  japaOrb: { position: "absolute", overflow: "hidden", borderWidth: 1, borderColor: colors.glassBorder },
  count: { fontFamily: "Fraunces-SemiBold", fontSize: 56, lineHeight: 64, color: colors.ivory, fontVariant: ["tabular-nums"] },
  reset: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, padding: 8 },
  breathBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, height: 50, paddingHorizontal: 28, borderRadius: 14, backgroundColor: colors.goldSoft },
}));
