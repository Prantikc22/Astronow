import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from "react-native-svg";

import { useTheme } from "@/src/theme";

const PLANETS = [
  { orbit: 44, angle: -90, size: 2.6, color: "#E6BC78" },
  { orbit: 44, angle: 28, size: 3.6, color: "#91AEB7" },
  { orbit: 44, angle: 148, size: 2.9, color: "#C8765F" },
  { orbit: 35, angle: -28, size: 2.5, color: "#E5A184" },
  { orbit: 35, angle: 90, size: 3.3, color: "#A8A0E8" },
  { orbit: 35, angle: 208, size: 2.7, color: "#A6BBC4" },
  { orbit: 25, angle: 8, size: 2.2, color: "#E6BC78" },
  { orbit: 25, angle: 128, size: 2.5, color: "#C8765F" },
  { orbit: 25, angle: 248, size: 2.3, color: "#A8A0E8" },
].map((planet) => {
  const radians = planet.angle * Math.PI / 180;
  return { ...planet, x: 50 + planet.orbit * Math.cos(radians), y: 50 + planet.orbit * Math.sin(radians) };
});

export function CelestialSeal({ size = 220, compact = false }: { size?: number; compact?: boolean }) {
  const { colors } = useTheme();
  const [progress] = useState(() => new Animated.Value(0));
  const { fontScale } = useWindowDimensions();
  const reducedMotion = fontScale > 3;

  useEffect(() => {
    if (!reducedMotion) {
      const motion = Animated.loop(Animated.timing(progress, {
        toValue: 1, duration: 40000, easing: Easing.linear, useNativeDriver: true,
      }));
      motion.start();
      return () => motion.stop();
    }
  }, [progress, reducedMotion]);

  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <View accessible accessibilityLabel="Animated Navagraha orbit garden" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="sun" cx="44%" cy="38%" r="62%">
            <Stop offset="0" stopColor="#FFF5D7" />
            <Stop offset="0.58" stopColor={colors.goldSoft} />
            <Stop offset="1" stopColor="#D88968" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="44" stroke="rgba(230,188,120,0.30)" strokeWidth="0.62" fill="none" />
        <Circle cx="50" cy="50" r="35" stroke="rgba(168,160,232,0.28)" strokeWidth="0.62" fill="none" />
        <Circle cx="50" cy="50" r="25" stroke="rgba(230,188,120,0.24)" strokeWidth="0.62" fill="none" />
        {!compact ? <Line x1="50" y1="4" x2="50" y2="96" stroke="rgba(230,188,120,0.10)" strokeWidth="0.4" /> : null}
        {!compact ? <Line x1="4" y1="50" x2="96" y2="50" stroke="rgba(230,188,120,0.08)" strokeWidth="0.4" /> : null}
        <Circle cx="50" cy="50" r={compact ? 9 : 11} fill="url(#sun)" />
        <Circle cx="50" cy="50" r={compact ? 13 : 15} stroke="rgba(230,188,120,0.18)" strokeWidth="0.5" fill="none" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {PLANETS.map((planet, index) => (
            <Circle key={index} cx={planet.x} cy={planet.y} r={planet.size} fill={planet.color} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}
