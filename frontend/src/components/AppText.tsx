import React from "react";
import { Text, TextProps, TextStyle } from "react-native";

import { fonts, useTheme } from "@/src/theme";

type Variant = "hero" | "display" | "title" | "subtitle" | "body" | "label" | "caption" | "mono";

const SIZES: Record<Variant, { fontSize: number; lineHeight: number; family: string }> = {
  hero: { fontSize: 44, lineHeight: 48, family: fonts.display },
  display: { fontSize: 32, lineHeight: 38, family: fonts.display },
  title: { fontSize: 24, lineHeight: 30, family: fonts.display },
  subtitle: { fontSize: 18, lineHeight: 24, family: fonts.semibold },
  body: { fontSize: 15, lineHeight: 22, family: fonts.body },
  label: { fontSize: 13, lineHeight: 18, family: fonts.medium },
  caption: { fontSize: 12, lineHeight: 16, family: fonts.body },
  mono: { fontSize: 14, lineHeight: 20, family: fonts.medium },
};

export function AppText({
  variant = "body",
  color,
  muted,
  center,
  style,
  children,
  ...rest
}: TextProps & {
  variant?: Variant;
  color?: string;
  muted?: boolean;
  center?: boolean;
}) {
  const { colors } = useTheme();
  const s = SIZES[variant];
  const resolved: TextStyle = {
    fontFamily: s.family,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    color: color ?? (muted ? colors.muted : colors.onSurface),
    ...(center ? { textAlign: "center" } : {}),
  };
  return (
    <Text style={[resolved, style]} {...rest}>
      {children}
    </Text>
  );
}
