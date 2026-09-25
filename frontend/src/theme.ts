// AstroNow's "Twilight Observatory" system: midnight indigo, iris and saffron.
// It stays warm and editorial without leaning on the green palette it replaced.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const palette = {
  surface: "#0B0B1A",
  onSurface: "#F8F2E8",
  surfaceSecondary: "#15142B",
  onSurfaceSecondary: "#F8F2E8",
  surfaceTertiary: "#211F3B",
  onSurfaceTertiary: "#F8F2E8",
  surfaceInverse: "#F8F2E8",
  onSurfaceInverse: "#171326",
  muted: "#AAA6BE",

  brand: "#2D2854",
  onBrand: "#F8F2E8",
  brandPrimary: "#F2C879",
  onBrandPrimary: "#171326",
  brandSecondary: "#D979A2",
  onBrandSecondary: "#FFF9EE",
  brandTertiary: "#322D62",
  onBrandTertiary: "#F8F2E8",

  success: "#6F63B6",
  onSuccess: "#F8F2E8",
  warning: "#8C6A3B",
  onWarning: "#E8E5DF",
  error: "#6E3737",
  onError: "#E8E5DF",
  info: "#344E7A",
  onInfo: "#E8E5DF",

  border: "rgba(235,226,250,0.13)",
  borderStrong: "rgba(235,226,250,0.26)",
  divider: "rgba(235,226,250,0.09)",

  // Extra tokens used across the app (kept identical in light/dark).
  gold: "#F2C879",
  goldSoft: "#F7DDA6",
  violet: "#A8A0E8",
  indigoDeep: "#11102A",
  glassTint: "rgba(21,20,43,0.91)",
  glassBorder: "rgba(242,200,121,0.20)",
  scrim: "rgba(8,7,24,0.84)",
  starGlow: "rgba(242,200,121,0.24)",
  coral: "#D979A2",
  coralSoft: "#F0A0BD",
  teal: "#A8A0E8",
  blue: "#83B5E8",
  ivory: "#F8F2E8",
  ink: "#171326",
};

export type ThemeColors = typeof palette;

export const defaultScheme = "dark" satisfies ColorScheme;
export const themes: Record<ColorScheme, ThemeColors> = { light: palette, dark: palette };

export const fonts = {
  display: "Fraunces-Medium",
  displayStrong: "Fraunces-SemiBold",
  body: "NunitoSans-Regular",
  medium: "NunitoSans-SemiBold",
  semibold: "NunitoSans-SemiBold",
  bold: "NunitoSans-Bold",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radii = { sm: 6, md: 10, lg: 14, xl: 18, pill: 999 };

export function setColorScheme(scheme: ColorScheme | null) {
  if (scheme) Appearance.setColorScheme?.(scheme);
}
setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system === "light" || system === "dark" ? system : defaultScheme;
  return { scheme, colors: themes[scheme] };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
