// Shared motion language. Springs are tuned to feel weighty but quick;
// every entrance respects the OS "reduce motion" setting.

import { Easing, FadeInDown, FadeInUp, ReduceMotion, ZoomIn } from "react-native-reanimated";

export const springs = {
  snappy: { damping: 18, stiffness: 320, mass: 0.6 },
  gentle: { damping: 20, stiffness: 140, mass: 0.9 },
  bouncy: { damping: 11, stiffness: 220, mass: 0.7 },
  settle: { damping: 26, stiffness: 180, mass: 1 },
} as const;

export const durations = { fast: 160, base: 280, slow: 520, ring: 1100 } as const;

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/** Staggered rise-in for list/section entrances. */
export function rise(index = 0, base = 70) {
  return FadeInDown.delay(index * base)
    .springify()
    .damping(19)
    .stiffness(150)
    .mass(0.9)
    .reduceMotion(ReduceMotion.System);
}

export function dropIn(index = 0, base = 60) {
  return FadeInUp.delay(index * base).duration(420).easing(easeOut).reduceMotion(ReduceMotion.System);
}

export function pop(index = 0, base = 50) {
  return ZoomIn.delay(index * base).springify().damping(13).stiffness(210).reduceMotion(ReduceMotion.System);
}
