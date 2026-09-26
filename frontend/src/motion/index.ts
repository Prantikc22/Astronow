// Shared motion language. Everything settles without overshoot: springs are
// critically damped and clamped, entrances are short ease-out fades. Every
// entrance respects the OS "reduce motion" setting.

import { Easing, FadeIn, FadeInDown, FadeInUp, ReduceMotion } from "react-native-reanimated";

export const springs = {
  snappy: { damping: 28, stiffness: 320, mass: 0.6, overshootClamping: true },
  gentle: { damping: 24, stiffness: 140, mass: 0.9, overshootClamping: true },
  /** Kept for existing call sites; now settles without a wobble. */
  bouncy: { damping: 26, stiffness: 220, mass: 0.7, overshootClamping: true },
  settle: { damping: 28, stiffness: 180, mass: 1, overshootClamping: true },
} as const;

export const durations = { fast: 160, base: 280, slow: 520, ring: 1100 } as const;

export const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

/** Staggered fade-and-rise for sections and list items. */
export function rise(index = 0, base = 60) {
  return FadeInDown.delay(index * base).duration(420).easing(easeOut).reduceMotion(ReduceMotion.System);
}

export function dropIn(index = 0, base = 60) {
  return FadeInUp.delay(index * base).duration(380).easing(easeOut).reduceMotion(ReduceMotion.System);
}

/** Gentle fade for small elements (tiles, chips, rings). No scaling, no bounce. */
export function pop(index = 0, base = 45) {
  return FadeIn.delay(index * base).duration(320).easing(easeOut).reduceMotion(ReduceMotion.System);
}
