import React from "react";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";

import { useTheme } from "@/src/theme";

/** AstroNow aperture: an eye, an orbit and a north-star spark. */
export function BrandMark({ size = 72, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const ink = color || colors.goldSoft;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="AstroNow aperture mark">
      <Ellipse cx="50" cy="50" rx="39" ry="27" fill="none" stroke={ink} strokeWidth="3.2" strokeDasharray="5 5" opacity={0.58} transform="rotate(-18 50 50)" />
      <Path d="M13 52C24 35 36 27 50 27s26 8 37 25C76 68 64 76 50 76S24 68 13 52Z" fill="none" stroke={ink} strokeWidth="4.4" strokeLinejoin="round" />
      <Circle cx="50" cy="52" r="14" fill="none" stroke={ink} strokeWidth="4" />
      <Circle cx="50" cy="52" r="5.5" fill={colors.coralSoft} />
      <Path d="M77 15v14M70 22h14M73 18l8 8M81 18l-8 8" fill="none" stroke={ink} strokeWidth="2.8" strokeLinecap="round" />
    </Svg>
  );
}
