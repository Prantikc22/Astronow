import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, StyleProp, View, ViewStyle } from "react-native";

import { makeStyles, radii, useTheme } from "@/src/theme";

export function GlassCard({
  children,
  style,
  intensity = 24,
  padded = true,
  bordered = true,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  padded?: boolean;
  bordered?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const inner = <View style={[padded && styles.pad, { flex: 0 }]}>{children}</View>;

  if (Platform.OS === "android" || Platform.OS === "web") {
    return (
      <View
        testID={testID}
        style={[styles.solid, bordered && styles.border, style]}
      >
        <LinearGradient colors={["rgba(31,28,68,0.95)", "rgba(20,18,45,0.99)"]} style={{ flex: 0 }}>
          {inner}
        </LinearGradient>
      </View>
    );
  }
  return (
    <BlurView
      tint="dark"
      intensity={intensity}
      testID={testID}
      style={[styles.blur, bordered && styles.border, style]}
    >
      <LinearGradient
        colors={["rgba(50,45,98,0.80)", colors.glassTint]}
        style={styles.fill}
      >
        {inner}
      </LinearGradient>
    </BlurView>
  );
}

const useStyles = makeStyles((colors) => ({
  blur: { borderRadius: radii.lg, overflow: "hidden" },
  fill: { flex: 0 },
  solid: {
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSecondary,
    overflow: "hidden",
  },
  border: { borderWidth: 1, borderColor: colors.glassBorder },
  pad: { padding: 18 },
}));
