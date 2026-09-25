import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/src/components/AppText";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { makeStyles, useTheme } from "@/src/theme";

export function Screen({
  title,
  subtitle,
  children,
  scroll = true,
  back = false,
  right,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
  back?: boolean;
  right?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: any;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const header = title ? (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
        {back ? (
          <MotionPressable onPress={() => router.back()} hitSlop={12} testID="screen-back">
            <Icon name="chevron-left" size={26} color={colors.onSurface} />
          </MotionPressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <AppText variant="title" numberOfLines={1}>{title}</AppText>
          {subtitle ? <AppText variant="caption" muted>{subtitle}</AppText> : null}
        </View>
      </View>
      {right}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      <CosmicBackground>
        {header}
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              { paddingHorizontal: 20, paddingBottom: 120, paddingTop: title ? 4 : insets.top + 8 },
              contentStyle,
            ]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{children}</View>
        )}
      </CosmicBackground>
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 60, alignItems: "center" }}>
      <ActivityIndicator color={colors.gold} />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 60, alignItems: "center", gap: 12, paddingHorizontal: 24 }}>
      <Icon name="cloud-off" size={28} color={colors.muted} />
      <AppText variant="body" muted center>{message || "We couldn't reconnect with the cosmos. Please try again."}</AppText>
      {onRetry ? (
        <MotionPressable onPress={onRetry} testID="retry-btn" haptic="light">
          <AppText variant="label" style={{ color: colors.gold }}>Try again</AppText>
        </MotionPressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
}));
