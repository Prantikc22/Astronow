import React from "react";
import { View } from "react-native";

import { AppText } from "@/src/components/AppText";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { useTheme } from "@/src/theme";

export function SectionHeader({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <AppText variant="label" style={{ color: colors.coralSoft, letterSpacing: 1.2 }}>{eyebrow}</AppText> : null}
        <AppText variant="title" style={{ marginTop: eyebrow ? 3 : 0 }}>{title}</AppText>
      </View>
      {action && onAction ? (
        <MotionPressable onPress={onAction} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <AppText variant="label" style={{ color: colors.gold }}>{action}</AppText>
          <Icon name="chevron-right" size={16} color={colors.gold} />
        </MotionPressable>
      ) : null}
    </View>
  );
}
