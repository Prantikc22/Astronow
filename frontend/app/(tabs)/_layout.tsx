import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/src/components/AppText";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { makeStyles, useTheme } from "@/src/theme";

const TABS: { name: string; label: string; icon: FeatherName }[] = [
  { name: "today", label: "Today", icon: "sun" },
  { name: "explore", label: "Explore", icon: "compass" },
  { name: "ask", label: "Ask", icon: "message-circle" },
  { name: "calendar", label: "Calendar", icon: "calendar" },
  { name: "you", label: "You", icon: "user" },
];

export const TAB_BAR_BASE = 64;

function TabBar({ state, navigation }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom || 12 }]}>
      <BlurView tint="dark" intensity={Platform.OS === "ios" ? 40 : 0} style={styles.bar}>
        <View style={styles.barInner}>
          {state.routes.map((route: any, index: number) => {
            const tab = TABS.find((t) => t.name === route.name);
            if (!tab) return null;
            const focused = state.index === index;
            const isAsk = tab.name === "ask";
            const onPress = () => {
              Haptics.selectionAsync().catch(() => {});
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };
            if (isAsk) {
              return (
                <Pressable key={route.key} onPress={onPress} style={styles.item} testID={`tab-${tab.name}`}>
                  <View style={styles.askOrb}>
                    <Icon name={tab.icon} size={24} color={colors.onBrandPrimary} />
                  </View>
                  <AppText variant="caption" style={{ color: colors.gold, marginTop: 4, fontSize: 10 }}>{tab.label}</AppText>
                </Pressable>
              );
            }
            return (
              <Pressable key={route.key} onPress={onPress} style={styles.item} testID={`tab-${tab.name}`}>
                <Icon name={tab.icon} size={22} color={focused ? colors.gold : colors.muted} />
                <AppText variant="caption" style={{ color: focused ? colors.onSurface : colors.muted, marginTop: 4, fontSize: 10 }}>
                  {tab.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="today" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="ask" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    backgroundColor: Platform.OS === "ios" ? "rgba(10,12,20,0.6)" : colors.surfaceSecondary,
  },
  bar: { overflow: "hidden" },
  barInner: { flexDirection: "row", height: TAB_BAR_BASE, alignItems: "center", paddingHorizontal: 8 },
  item: { flex: 1, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  askOrb: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -18,
    borderWidth: 3,
    borderColor: colors.surface,
    shadowColor: colors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
}));
