import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useId } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, Line, RadialGradient, Stop } from "react-native-svg";

import { haptics } from "@/src/utils/haptics";

const TILT = 0.34; // how flat the orbital plane looks
const TWO_PI = Math.PI * 2;

// The nine grahas, loosely: warm, cool and dusky spheres on three orbits.
const PLANETS = [
  { orbit: 0, phase: 0.2, period: 14, size: 11, colors: ["#F4F1EC", "#8E8A9C"] }, // Moon
  { orbit: 0, phase: 3.4, period: 14, size: 8, colors: ["#FFD9A8", "#B8763C"] }, // Mercury
  { orbit: 1, phase: 1.1, period: 22, size: 14, colors: ["#FFB38A", "#B23A2E"] }, // Mars
  { orbit: 1, phase: 3.3, period: 22, size: 12, colors: ["#FFF1D6", "#C99B5B"] }, // Venus
  { orbit: 1, phase: 5.3, period: 22, size: 9, colors: ["#B9A8FF", "#3E2E86"] }, // Rahu
  { orbit: 2, phase: 0.6, period: 34, size: 20, colors: ["#F7D9A4", "#A5663A"] }, // Jupiter
  { orbit: 2, phase: 2.7, period: 34, size: 16, colors: ["#D8E6F2", "#4B6C93"], ring: true }, // Saturn
  { orbit: 2, phase: 4.3, period: 34, size: 10, colors: ["#9FE3D6", "#23665F"] }, // Ketu
  { orbit: 2, phase: 5.6, period: 34, size: 8, colors: ["#E6D2FF", "#6B4FA8"] },
];

type Planet = (typeof PLANETS)[number];

function PlanetDot({ p, rx, cx, cy, t, index, reduced }: { p: Planet; rx: number; cx: number; cy: number; t: SharedValue<number>; index: number; reduced: boolean }) {
  const shown = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) shown.set(withDelay(500 + index * 90, withTiming(1, { duration: 700, easing: Easing.bezier(0.22, 1, 0.36, 1) })));
  }, [shown, index, reduced]);
  const style = useAnimatedStyle(() => {
    const a = p.phase + (t.get() * TWO_PI) / p.period;
    const depth = Math.sin(a); // +1 in front of the sun, -1 behind it
    const scale = (0.78 + 0.3 * ((depth + 1) / 2)) * (0.4 + 0.6 * shown.get());
    return {
      opacity: shown.get() * (0.55 + 0.45 * ((depth + 1) / 2)),
      zIndex: depth > 0 ? 20 : 1,
      transform: [
        { translateX: cx + Math.cos(a) * rx - p.size / 2 },
        { translateY: cy + depth * rx * TILT - p.size / 2 },
        { scale },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: p.size, height: p.size }, style]}>
      {p.ring ? <View style={{ position: "absolute", left: -p.size * 0.45, top: p.size * 0.38, width: p.size * 1.9, height: p.size * 0.26, borderRadius: p.size, borderWidth: 1.2, borderColor: "rgba(232,222,200,0.75)", transform: [{ rotate: "-16deg" }] }} /> : null}
      <LinearGradient colors={p.colors as [string, string]} start={{ x: 0.2, y: 0.1 }} end={{ x: 0.85, y: 0.95 }}
        style={{ width: p.size, height: p.size, borderRadius: p.size / 2, shadowColor: p.colors[0], shadowOpacity: 0.6, shadowRadius: p.size / 2 }} />
      <View style={{ position: "absolute", left: p.size * 0.22, top: p.size * 0.16, width: p.size * 0.3, height: p.size * 0.22, borderRadius: p.size, backgroundColor: "rgba(255,255,255,0.55)" }} />
    </Animated.View>
  );
}

/**
 * A living orrery: the nine grahas circle a glowing sun on a tilted plane,
 * passing in front of and behind it. Tap it and the heavens speed up.
 */
export function Orrery({ width, height }: { width: number; height: number }) {
  const reduced = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const t = useSharedValue(0);
  const boost = useSharedValue(0);
  const intro = useSharedValue(reduced ? 1 : 0);
  const pulse = useSharedValue(0);
  const spin = useSharedValue(0);
  const cx = width / 2;
  const cy = height / 2;
  const radii = [width * 0.2, width * 0.31, width * 0.43];
  const sun = Math.min(60, width * 0.15);
  const k = Math.max(1, width / 330); // planets grow with the stage

  useFrameCallback((frame) => {
    const dt = (frame.timeSincePreviousFrame ?? 16) / 1000;
    t.set(t.get() + dt * (1 + boost.get()));
  }, !reduced);

  useEffect(() => {
    if (reduced) return;
    intro.set(withTiming(1, { duration: 1100, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
    pulse.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
    spin.set(withRepeat(withTiming(1, { duration: 90000, easing: Easing.linear }), -1));
  }, [reduced, intro, pulse, spin]);

  const plane = useAnimatedStyle(() => ({ opacity: intro.get(), transform: [{ scale: 0.82 + 0.18 * intro.get() }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.55 + pulse.get() * 0.35, transform: [{ scale: (0.92 + pulse.get() * 0.12) * (0.5 + 0.5 * intro.get()) }] }));
  const wheel = useAnimatedStyle(() => ({ opacity: intro.get() * 0.9, transform: [{ rotate: `${spin.get() * 360}deg` }] }));

  const tap = () => {
    haptics.reveal();
    boost.set(withSequence(withTiming(7, { duration: 160 }), withTiming(0, { duration: 1800, easing: Easing.out(Easing.cubic) })));
  };

  const wheelR = Math.min(width, height) * 0.49;
  return (
    <Pressable onPress={tap} accessibilityLabel="The nine grahas in orbit" style={{ width, height }}>
      {/* Faint zodiac wheel turning behind everything. */}
      <Animated.View style={[StyleSheet.absoluteFill, wheel]} pointerEvents="none">
        <Svg width={width} height={height}>
          <Circle cx={cx} cy={cy} r={wheelR} stroke="rgba(242,200,121,0.13)" strokeWidth={1} fill="none" />
          <Circle cx={cx} cy={cy} r={wheelR - 14} stroke="rgba(242,200,121,0.08)" strokeWidth={1} strokeDasharray="2 6" fill="none" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * TWO_PI;
            return <Line key={i} x1={cx + Math.cos(a) * (wheelR - 14)} y1={cy + Math.sin(a) * (wheelR - 14)} x2={cx + Math.cos(a) * wheelR} y2={cy + Math.sin(a) * wheelR} stroke="rgba(242,200,121,0.22)" strokeWidth={1} />;
          })}
          {Array.from({ length: 12 }, (_, i) => {
            const a = ((i + 0.5) / 12) * TWO_PI;
            return <Circle key={`d${i}`} cx={cx + Math.cos(a) * (wheelR - 7)} cy={cy + Math.sin(a) * (wheelR - 7)} r={1.4} fill="rgba(247,221,166,0.5)" />;
          })}
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, plane]} pointerEvents="none">
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={`halo${id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFD58A" stopOpacity="0.55" />
              <Stop offset="0.45" stopColor="#E88A5A" stopOpacity="0.16" />
              <Stop offset="1" stopColor="#D979A2" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {radii.map((r, i) => (
            <Ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * TILT} stroke={i === 1 ? "rgba(242,200,121,0.34)" : "rgba(235,226,250,0.16)"} strokeWidth={1} strokeDasharray={i === 2 ? "3 5" : undefined} fill="none" />
          ))}
        </Svg>

        {/* Sun, sitting between the far and near halves of each orbit. */}
        <Animated.View style={[{ position: "absolute", left: cx - sun * 1.6, top: cy - sun * 1.6, width: sun * 3.2, height: sun * 3.2, zIndex: 5 }, halo]}>
          <Svg width={sun * 3.2} height={sun * 3.2}><Circle cx={sun * 1.6} cy={sun * 1.6} r={sun * 1.6} fill={`url(#halo${id})`} /></Svg>
        </Animated.View>
        <View style={{ position: "absolute", left: cx - sun / 2, top: cy - sun / 2, width: sun, height: sun, zIndex: 10, borderRadius: sun / 2, shadowColor: "#FFC46B", shadowOpacity: 0.9, shadowRadius: 22 }}>
          <LinearGradient colors={["#FFF6DD", "#FFD27A", "#E5913F"]} start={{ x: 0.25, y: 0.1 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1, borderRadius: sun / 2 }} />
        </View>

        {PLANETS.map((p, i) => <PlanetDot key={i} p={{ ...p, size: Math.round(p.size * k) }} rx={radii[p.orbit]} cx={cx} cy={cy} t={t} index={i} reduced={reduced} />)}
      </Animated.View>
    </Pressable>
  );
}
