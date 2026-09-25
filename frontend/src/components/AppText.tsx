import React from "react";
import { Text, TextProps, TextStyle } from "react-native";

import { fonts, useTheme } from "@/src/theme";
import { translateChildren, useI18n } from "@/src/i18n";

type Variant = "hero" | "display" | "title" | "subtitle" | "body" | "label" | "caption" | "mono";

const SIZES: Record<Variant, { fontSize: number; lineHeight: number; family: string }> = {
  hero: { fontSize: 42, lineHeight: 47, family: fonts.displayStrong },
  display: { fontSize: 32, lineHeight: 38, family: fonts.displayStrong },
  title: { fontSize: 23, lineHeight: 29, family: fonts.displayStrong },
  subtitle: { fontSize: 17, lineHeight: 23, family: fonts.semibold },
  body: { fontSize: 15, lineHeight: 22, family: fonts.body },
  label: { fontSize: 12, lineHeight: 17, family: fonts.bold },
  caption: { fontSize: 12, lineHeight: 17, family: fonts.body },
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
  const { t } = useI18n();
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
      {translateChildren(children, t)}
    </Text>
  );
}
