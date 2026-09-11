import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/src/theme";

// Deterministic pseudo-random star field so it doesn't reshuffle each render.
function makeStars(count: number, seed = 7) {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, () => ({
    top: `${(rnd() * 100).toFixed(2)}%`,
    left: `${(rnd() * 100).toFixed(2)}%`,
    size: 1 + rnd() * 2.2,
    opacity: 0.25 + rnd() * 0.6,
  }));
}

function Twinkle({ style }: { style: ViewStyle }) {
  const v = useSharedValue(0);
  React.useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [v]);
  const anim = useAnimatedStyle(() => ({ opacity: 0.2 + v.value * 0.7 }));
  return <Animated.View style={[style, anim]} />;
}

export function CosmicBackground({ children, glow = true }: { children?: React.ReactNode; glow?: boolean }) {
  const { colors } = useTheme();
  const stars = useMemo(() => makeStars(46), []);
  const twinkles = useMemo(() => makeStars(8, 21), []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[colors.surface, colors.indigoDeep, "#0E0B1A", colors.surface]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      {glow ? (
        <LinearGradient
          colors={["rgba(88,78,130,0.35)", "rgba(88,78,130,0.0)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {stars.map((st, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: st.top as any,
            left: st.left as any,
            width: st.size,
            height: st.size,
            borderRadius: st.size,
            backgroundColor: colors.onSurface,
            opacity: st.opacity,
          }}
        />
      ))}
      {twinkles.map((st, i) => (
        <Twinkle
          key={`t${i}`}
          style={{
            position: "absolute",
            top: st.top as any,
            left: st.left as any,
            width: 2.5,
            height: 2.5,
            borderRadius: 3,
            backgroundColor: colors.gold,
          }}
        />
      ))}
      {children}
    </View>
  );
}
