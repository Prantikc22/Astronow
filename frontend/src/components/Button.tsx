import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ActivityIndicator, Pressable, StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { AppText } from "@/src/components/AppText";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { makeStyles, radii, useTheme } from "@/src/theme";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  style,
  testID,
  full = true,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: FeatherName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  full?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;

  const onColor = variant === "primary" ? colors.onBrandPrimary : colors.onSurface;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={onColor} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={onColor} /> : null}
          <AppText variant="label" style={{ color: onColor, fontSize: 15 }}>
            {label}
          </AppText>
        </>
      )}
    </>
  );

  return (
    <Animated.View style={[anim, full && { alignSelf: "stretch" }, style]}>
      <Pressable
        testID={testID}
        disabled={isDisabled}
        onPressIn={() => (scale.value = withSpring(0.97, { damping: 18 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 18 }))}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress();
        }}
        style={{ opacity: isDisabled ? 0.55 : 1 }}
      >
        {variant === "primary" ? (
          <LinearGradient
            colors={[colors.goldSoft, colors.gold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.base}
          >
            {content}
          </LinearGradient>
        ) : (
          <Animated.View
            style={[
              styles.base,
              variant === "secondary" ? styles.secondary : styles.ghost,
            ]}
          >
            {content}
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  base: {
    minHeight: 52,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 22,
  },
  secondary: {
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  ghost: { backgroundColor: "transparent" },
}));
