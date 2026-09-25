import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ActivityIndicator, StyleProp, ViewStyle } from "react-native";

import { AppText } from "@/src/components/AppText";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { Shine } from "@/src/components/Shine";
import { makeStyles, radii, useTheme } from "@/src/theme";
import type { HapticName } from "@/src/utils/haptics";

type Variant = "primary" | "secondary" | "ghost" | "rose";

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  iconRight,
  loading,
  disabled,
  style,
  testID,
  full = true,
  haptic = "medium",
  shine,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: FeatherName;
  iconRight?: FeatherName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  full?: boolean;
  haptic?: HapticName;
  /** Adds a periodic light sweep — reserve for the one primary action on a screen. */
  shine?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const filled = variant === "primary" || variant === "rose";
  const onColor = variant === "primary" ? colors.onBrandPrimary : colors.onSurface;
  const fill: [string, string, ...string[]] = variant === "primary"
    ? [colors.goldSoft, colors.gold, "#E3A866"]
    : variant === "rose"
      ? ["#B4447A", "#8A2A5E", "#5E1F48"]
      : variant === "secondary"
        ? ["rgba(50,45,98,0.98)", "rgba(27,24,57,0.98)"]
        : ["transparent", "transparent"];

  return (
    <MotionPressable
      testID={testID}
      disabled={isDisabled}
      haptic={haptic}
      onPress={onPress}
      style={[full && { alignSelf: "stretch" }, filled && !isDisabled && styles.glow, filled && variant === "rose" && { shadowColor: "#B4447A" }, style]}
    >
      <LinearGradient
        colors={fill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.base, variant === "secondary" && styles.secondary, variant === "ghost" && styles.ghost]}
      >
        {loading ? (
          <ActivityIndicator color={onColor} />
        ) : (
          <>
            {icon ? <Icon name={icon} size={18} color={onColor} weight="bold" /> : null}
            <AppText variant="label" style={{ color: onColor, fontSize: 15.5, letterSpacing: 0.2 }}>{label}</AppText>
            {iconRight ? <Icon name={iconRight} size={18} color={onColor} weight="bold" /> : null}
          </>
        )}
        {shine && filled && !isDisabled ? <Shine /> : null}
      </LinearGradient>
    </MotionPressable>
  );
}

const useStyles = makeStyles((colors) => ({
  base: {
    minHeight: 56,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 24,
    overflow: "hidden",
  },
  glow: {
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.borderStrong },
}));
