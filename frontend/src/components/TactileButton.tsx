import React from "react";
import { ActivityIndicator, Pressable, StyleProp, View, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { AppText } from "@/src/components/AppText";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { fonts } from "@/src/theme";
import { haptics, type HapticName } from "@/src/utils/haptics";

type Tone = "gold" | "ivory" | "dark";

const TONES: Record<Tone, { face: string; lip: string; border: string; text: string }> = {
  gold: { face: "#F2C879", lip: "#A9793A", border: "#F7DDA6", text: "#1A1428" },
  ivory: { face: "#F8F2E8", lip: "#A8A1B8", border: "#FFFFFF", text: "#171326" },
  dark: { face: "#1A1833", lip: "#3A3563", border: "rgba(235,226,250,0.22)", text: "#F8F2E8" },
};

const LIP = 5;

/** A physical key: the face sits on a darker lip and presses down into it. */
export function TactileButton({
  label, onPress, tone = "gold", icon, iconNode, iconRight, loading, disabled, style, height = 58, testID, haptic = "medium", caps = true, accessibilityLabel,
}: {
  label?: string; onPress: () => void; tone?: Tone; icon?: FeatherName; iconNode?: React.ReactNode; iconRight?: FeatherName;
  loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; height?: number; testID?: string; haptic?: HapticName; caps?: boolean; accessibilityLabel?: string;
}) {
  // Disabled keys go dark with a faint outline rather than a washed-out fill.
  const t = disabled ? { face: "#151329", lip: "#2A2645", border: "rgba(235,226,250,0.12)", text: "rgba(170,166,190,0.7)" } : TONES[tone];
  const press = useSharedValue(0);
  const off = disabled || loading;
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: press.get() * (LIP - 1) }] }));
  const ease = { duration: 90, easing: Easing.out(Easing.quad) };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={off}
      onPressIn={() => { press.set(withTiming(1, ease)); haptics[haptic](); }}
      onPressOut={() => press.set(withTiming(0, { duration: 140, easing: Easing.out(Easing.quad) }))}
      onPress={onPress}
      style={[{ height: height + LIP }, style]}
    >
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height, borderRadius: 16, backgroundColor: t.lip }} />
      <Animated.View style={[{ height, borderRadius: 16, backgroundColor: t.face, borderWidth: 1, borderColor: t.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 16 }, face]}>
        {loading ? <ActivityIndicator color={t.text} /> : (
          <>
            {iconNode ?? (icon ? <Icon name={icon} size={19} color={t.text} weight="bold" /> : null)}
            {label ? <AppText numberOfLines={1} style={{ color: t.text, fontFamily: fonts.bold, fontSize: caps ? 14.5 : 16, letterSpacing: caps ? 1.4 : 0.2, textTransform: caps ? "uppercase" : "none" }}>{label}</AppText> : null}
            {iconRight ? <Icon name={iconRight} size={18} color={t.text} weight="bold" /> : null}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}
