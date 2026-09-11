// Cosmic Clarity design tokens — dark, cinematic "Glass / Luxe".
// Keys match the color block of design_guidelines.json. The app is dark-only,
// so the single palette lives in `palette` and is used for both schemes.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const palette = {
  surface: "#05060A",
  onSurface: "#E8E5DF",
  surfaceSecondary: "#10121C",
  onSurfaceSecondary: "#E8E5DF",
  surfaceTertiary: "#1A1D2B",
  onSurfaceTertiary: "#E8E5DF",
  surfaceInverse: "#E8E5DF",
  onSurfaceInverse: "#05060A",
  muted: "#8A8D9F",

  brand: "#1F1E33",
  onBrand: "#E8E5DF",
  brandPrimary: "#D0B271", // gold
  onBrandPrimary: "#05060A",
  brandSecondary: "#584E82", // violet
  onBrandSecondary: "#E8E5DF",
  brandTertiary: "#262240",
  onBrandTertiary: "#E8E5DF",

  success: "#3D5A46",
  onSuccess: "#E8E5DF",
  warning: "#8C6A3B",
  onWarning: "#E8E5DF",
  error: "#6E3737",
  onError: "#E8E5DF",
  info: "#2B4C5E",
  onInfo: "#E8E5DF",

  border: "#212333",
  borderStrong: "#3B3D55",
  divider: "#191B28",

  // Extra tokens used across the app (kept identical in light/dark).
  gold: "#D0B271",
  goldSoft: "#E7CE97",
  violet: "#584E82",
  indigoDeep: "#0B0D18",
  glassTint: "rgba(38,34,64,0.55)",
  glassBorder: "rgba(208,178,113,0.18)",
  scrim: "rgba(5,6,10,0.72)",
  starGlow: "rgba(208,178,113,0.35)",
};

export type ThemeColors = typeof palette;

export const defaultScheme = "dark" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light: palette, dark: palette };

export const fonts = {
  display: "Cormorant",
  body: "Geist",
  medium: "Geist-Medium",
  semibold: "Geist-SemiBold",
  bold: "Geist-Bold",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radii = { sm: 6, md: 12, lg: 20, xl: 28, pill: 999 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme);
}
setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
