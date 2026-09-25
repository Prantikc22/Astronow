import React from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { haptics, type HapticName } from "@/src/utils/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MotionPressable({
  children,
  onPress,
  style,
  haptic = "selection",
  pressScale = 0.965,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  haptic?: HapticName | "none";
  /** Scale reached while held. Large cards read better with a subtler value. */
  pressScale?: number;
}) {
  const pressed = useSharedValue(0);
  const motionStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0.55 : 1 - pressed.value * 0.06,
    transform: [{ scale: 1 - pressed.value * (1 - pressScale) }],
  }), [disabled, pressScale]);

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        pressed.value = withTiming(1, { duration: 110 });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withSpring(0, { damping: 12, stiffness: 280, mass: 0.5 });
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic !== "none") haptics[haptic]();
        onPress?.(event);
      }}
      style={[style, motionStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
