import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/src/components/AppText";
import { BrandMark } from "@/src/components/BrandMark";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { springs } from "@/src/motion";
import { makeStyles, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

const TABS: { name: string; label: string; icon: FeatherName }[] = [
  { name: "today", label: "Home", icon: "home" },
  { name: "reports", label: "Reports", icon: "file-text" },
  { name: "ask", label: "Ask", icon: "message-circle" },
  { name: "explore", label: "Match", icon: "heart" },
  { name: "you", label: "Profile", icon: "user" },
];

export const TAB_BAR_BASE = 72;

function TabIcon({ icon, focused, label }: { icon: FeatherName; focused: boolean; label: string }) {
  const { colors } = useTheme();
  const p = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    p.value = focused ? withSequence(withTiming(1.18, { duration: 120 }), withSpring(1, springs.bouncy)) : withTiming(0, { duration: 180 });
  }, [focused, p]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: focused ? p.value : 1 }, { translateY: focused ? -1 : 0 }] }));
  return (
    <>
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={23} color={focused ? colors.onSurface : colors.muted} weight={focused ? "fill" : "regular"} />
      </Animated.View>
      <AppText variant="caption" style={{ marginTop: 3, fontSize: 11, lineHeight: 14, color: focused ? colors.onSurface : colors.muted }}>{label}</AppText>
    </>
  );
}

function AskOrb({ focused }: { focused: boolean }) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1);
    breathe.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => { cancelAnimation(spin); cancelAnimation(breathe); };
  }, [spin, breathe, reduced]);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + breathe.value * 0.4, transform: [{ scale: 1 + breathe.value * 0.12 }] }));
  return (
    <View style={styles.orbWrap}>
      <Animated.View style={[styles.orbHalo, halo]} />
      <Animated.View style={[styles.orbRing, ring]}>
        <LinearGradient colors={["#F7DDA6", "#D979A2", "#8E83E0", "#F7DDA6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 40 }} />
      </Animated.View>
      <LinearGradient colors={focused ? ["#3A1D4A", "#1C1638"] : ["#22203F", "#15132B"]} style={styles.orb}>
        <BrandMark size={40} />
      </LinearGradient>
    </View>
  );
}

function TabBar({ state, navigation }: any) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const routes = state.routes.filter((route: any) => TABS.some((tab) => tab.name === route.name));
  const activeName = state.routes[state.index]?.name;
  const activeIndex = Math.max(0, routes.findIndex((route: any) => route.name === activeName));
  const slot = width / Math.max(1, routes.length);
  const x = useSharedValue(0);
  const isAsk = activeName === "ask";
  useEffect(() => {
    if (slot) x.value = withSpring(activeIndex * slot, springs.snappy);
  }, [activeIndex, slot, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: isAsk ? 0 : 1 }), [isAsk]);

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom - 6, 10) }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {Platform.OS === "ios" ? <BlurView tint="dark" intensity={55} style={styles.fill} /> : null}
        <LinearGradient colors={Platform.OS === "ios" ? ["rgba(40,22,52,0.78)", "rgba(16,14,36,0.9)"] : ["rgba(38,22,52,0.98)", "rgba(16,14,36,0.99)"]} style={styles.fill} />
        <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width ? (
            <Animated.View style={[styles.indicator, { width: slot - 10 }, indicator]}>
              <LinearGradient colors={["rgba(217,121,162,0.34)", "rgba(138,42,94,0.22)"]} style={{ flex: 1, borderRadius: 26 }} />
            </Animated.View>
          ) : null}
          {routes.map((route: any) => {
            const tab = TABS.find((item) => item.name === route.name)!;
            const focused = activeName === route.name;
            const onPress = () => {
              if (tab.name === "ask") haptics.medium(); else haptics.selection();
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };
            return (
              <MotionPressable key={route.key} onPress={onPress} haptic="none" style={styles.item} testID={"tab-" + tab.name}
                accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={tab.label} pressScale={0.9}>
                {tab.name === "ask" ? (
                  <>
                    <View style={{ height: 25 }} />
                    <AppText variant="caption" style={{ marginTop: 3, fontSize: 11, lineHeight: 14, color: focused ? "#F8F2E8" : "#AAA6BE" }}>{tab.label}</AppText>
                  </>
                ) : <TabIcon icon={tab.icon} focused={focused} label={tab.label} />}
              </MotionPressable>
            );
          })}
        </View>
      </View>
      {/* The Ask orb floats above the bar and shares its hit target. */}
      <MotionPressable onPress={() => {
        haptics.medium();
        const route = routes.find((r: any) => r.name === "ask");
        if (route && activeName !== "ask") navigation.navigate("ask");
      }} haptic="none" style={styles.orbHit} accessibilityLabel="Ask Tara" testID="tab-ask-orb" pressScale={0.9}>
        <AskOrb focused={isAsk} />
      </MotionPressable>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, animation: "fade" }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="today" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="ask" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="you" />
      <Tabs.Screen name="calendar" options={{ href: null }} />
    </Tabs>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { position: "absolute", left: 14, right: 14, alignItems: "center" },
  bar: {
    alignSelf: "stretch",
    height: TAB_BAR_BASE,
    borderRadius: 36,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(235,226,250,0.16)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  fill: { position: "absolute", inset: 0 },
  row: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 0 },
  indicator: { position: "absolute", left: 5, top: 7, bottom: 7, borderRadius: 26 },
  item: { flex: 1, height: TAB_BAR_BASE, alignItems: "center", justifyContent: "center" },
  orbHit: { position: "absolute", top: -30, alignSelf: "center" },
  orbWrap: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  orbHalo: { position: "absolute", width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(217,121,162,0.35)" },
  orbRing: { position: "absolute", width: 68, height: 68, borderRadius: 34, overflow: "hidden" },
  orb: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
}));
