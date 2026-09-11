import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, ViewStyle } from "react-native";

import { AppText } from "@/src/components/AppText";
import { makeStyles, radii, useTheme } from "@/src/theme";

export function Chip({
  label,
  selected,
  onPress,
  testID,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
  style?: ViewStyle;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={[styles.chip, selected && styles.selected, style]}
    >
      <AppText variant="label" style={{ color: selected ? colors.onBrandPrimary : colors.onSurface }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  chip: {
    flexShrink: 0,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
}));
