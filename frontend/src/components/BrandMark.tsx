import React, { useId } from "react";
import Svg, { Circle, Defs, Polygon, RadialGradient, Stop } from "react-native-svg";

// Geometry on a 100-unit square. Keep in sync with scripts/generate-brand-assets.py.
const LONG = "50,3 53.2,46.8 95,50 53.2,53.2 50,97 46.8,53.2 5,50 46.8,46.8";
const D = 25 / Math.SQRT2;
const DIAGONAL = `${50 + D},${50 - D} 53.4,50 ${50 + D},${50 + D} 50,53.4 ${50 - D},${50 + D} 46.6,50 ${50 - D},${50 - D} 50,46.6`;

type Layer = "ring" | "diagonal" | "long";

/** AstroNow guiding star: an eight-point star of light inside a fine orbit ring. */
export function BrandMark({ size = 72, color, layer }: {
  size?: number;
  /** Flat tint instead of the gold gradient. */
  color?: string;
  /** Draw one layer only, so the splash can animate them separately. */
  layer?: Layer;
}) {
  const id = useId().replace(/[^0-9a-z]/gi, "");
  const show = (l: Layer) => !layer || layer === l;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="AstroNow star">
      <Defs>
        <RadialGradient id={`bm-long-${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.18" stopColor="#FFF4D6" />
          <Stop offset="0.6" stopColor="#F8D48C" />
          <Stop offset="1" stopColor="#F2BE69" />
        </RadialGradient>
        <RadialGradient id={`bm-diag-${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFAEB" />
          <Stop offset="0.3" stopColor="#FAD696" />
          <Stop offset="1" stopColor="#F0B464" />
        </RadialGradient>
        <RadialGradient id={`bm-core-${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="0.3" stopColor="#FFF6DC" stopOpacity={0.8} />
          <Stop offset="1" stopColor="#FFDC96" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {show("ring") ? <Circle cx="50" cy="50" r="35" fill="none" stroke={color || "#8374F0"} strokeOpacity={0.75} strokeWidth={size < 40 ? 1.6 : 0.7} /> : null}
      {show("diagonal") ? <Polygon points={DIAGONAL} fill={color || `url(#bm-diag-${id})`} opacity={0.92} /> : null}
      {show("long") ? (
        <>
          <Polygon points={LONG} fill={color || `url(#bm-long-${id})`} />
          {color ? null : <Circle cx="50" cy="50" r="15" fill={`url(#bm-core-${id})`} />}
        </>
      ) : null}
    </Svg>
  );
}
