import React from "react";
import { View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

import { useTheme } from "@/src/theme";

const ABBR: Record<string, string> = {
  Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me", Jupiter: "Ju",
  Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke",
};

// Anchor points for the 12 houses of a North-Indian chart in a 300x300 box.
const HOUSE_POS = [
  { x: 150, y: 55 }, { x: 78, y: 38 }, { x: 38, y: 78 }, { x: 58, y: 150 },
  { x: 38, y: 222 }, { x: 78, y: 262 }, { x: 150, y: 245 }, { x: 222, y: 262 },
  { x: 262, y: 222 }, { x: 242, y: 150 }, { x: 262, y: 78 }, { x: 222, y: 38 },
];
const SIGN_POS = [
  { x: 150, y: 92 }, { x: 96, y: 60 }, { x: 60, y: 96 }, { x: 92, y: 150 },
  { x: 60, y: 204 }, { x: 96, y: 240 }, { x: 150, y: 208 }, { x: 204, y: 240 },
  { x: 240, y: 204 }, { x: 208, y: 150 }, { x: 240, y: 96 }, { x: 204, y: 60 },
];

export function NorthChart({ houses }: { houses: any[] }) {
  const { colors } = useTheme();
  const S = 300;
  const line = colors.gold;
  if (!houses?.length) return null;
  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={S} height={S}>
        <Rect x={1} y={1} width={S - 2} height={S - 2} stroke={line} strokeWidth={1.2} fill="none" />
        <Line x1={0} y1={0} x2={S} y2={S} stroke={line} strokeWidth={0.8} opacity={0.7} />
        <Line x1={S} y1={0} x2={0} y2={S} stroke={line} strokeWidth={0.8} opacity={0.7} />
        <Line x1={S / 2} y1={0} x2={S} y2={S / 2} stroke={line} strokeWidth={0.8} opacity={0.7} />
        <Line x1={S} y1={S / 2} x2={S / 2} y2={S} stroke={line} strokeWidth={0.8} opacity={0.7} />
        <Line x1={S / 2} y1={S} x2={0} y2={S / 2} stroke={line} strokeWidth={0.8} opacity={0.7} />
        <Line x1={0} y1={S / 2} x2={S / 2} y2={0} stroke={line} strokeWidth={0.8} opacity={0.7} />
        {houses.map((h, i) => {
          const sp = SIGN_POS[i];
          const hp = HOUSE_POS[i];
          const planets = (h.planets || []).map((p: string) => ABBR[p] || p).join(" ");
          return (
            <React.Fragment key={i}>
              <SvgText x={sp.x} y={sp.y} fill={colors.muted} fontSize={11} textAnchor="middle">
                {h.sign_index + 1}
              </SvgText>
              {planets ? (
                <SvgText x={hp.x} y={hp.y} fill={colors.onSurface} fontSize={13} fontWeight="600" textAnchor="middle">
                  {planets}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
