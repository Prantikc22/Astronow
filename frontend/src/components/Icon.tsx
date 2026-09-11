import Feather from "@react-native-vector-icons/feather";
import React from "react";

import { useTheme } from "@/src/theme";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: FeatherName;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return <Feather name={name} size={size} color={color ?? colors.onSurface} />;
}

export type { FeatherName };
