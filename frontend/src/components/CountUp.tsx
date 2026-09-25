import React, { useEffect, useState } from "react";
import { TextProps } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { AppText } from "@/src/components/AppText";

/** Counts from 0 to `value` with an ease-out curve. */
export function CountUp({ value, duration = 1100, delay = 0, suffix = "", prefix = "", variant = "title", color, style, ...rest }: TextProps & {
  value: number; duration?: number; delay?: number; suffix?: string; prefix?: string;
  variant?: React.ComponentProps<typeof AppText>["variant"]; color?: string;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let start = 0;
    const timer = setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now;
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 4);
        setShown(Math.round(value * eased));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [value, duration, delay, reduced]);
  return <AppText variant={variant} color={color} style={[{ fontVariant: ["tabular-nums"] }, style]} {...rest}>{prefix}{reduced ? value : shown}{suffix}</AppText>;
}
