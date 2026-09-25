import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/src/components/AppText";
import { BrandMark } from "@/src/components/BrandMark";
import { Button } from "@/src/components/Button";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { displayCurrency } from "@/src/content/pricing";
import { REPORTS, reportPrice } from "@/src/content/reports";
import { makeStyles, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

export type UpsellKind = "plus" | "artha-strategy" | "twelve-year-compass" | "match-report" | "year-ahead";

type Content = { kicker: string; title: string; body: string; points: [FeatherName, string][]; cta: string; route: string; price?: string; list?: string };

function contentFor(kind: UpsellKind): Content {
  const plusCount = REPORTS.filter((r) => r.access === "plus").length;
  if (kind === "plus") {
    return {
      kicker: "ASTRONOW PLUS", title: "Your full chart is ready to unlock",
      body: "Everything your birth chart can tell you, in one membership.",
      points: [["message-circle", "40 questions a day with Tara, 24x7"], ["file-text", `All ${plusCount} in-depth reports`], ["target", "Full Kundli, life periods and transits"], ["home", "Vastu remedies, Tarot and Numerology"]],
      cta: "See Plus plans", route: "/paywall",
      price: displayCurrency() === "INR" ? "Under ₹6 a day on the yearly plan" : "About 11¢ a day on the yearly plan",
    };
  }
  const report = REPORTS.find((r) => r.slug === kind)!;
  const points: Record<string, [FeatherName, string][]> = {
    "artha-strategy": [["trending-up", "Your money personality and natural strengths"], ["calendar", "Favourable windows for big financial moves"], ["briefcase", "Where to focus your work for growth"]],
    "twelve-year-compass": [["navigation", "A year-by-year map of the next twelve years"], ["sparkle", "Growth windows and turning points"], ["refresh-cw", "When to push, when to rest and renew"]],
    "match-report": [["heart", "Emotional rhythm and attraction"], ["message-circle", "How you communicate and handle conflict"], ["users", "Long-term growth edges as a couple"]],
    "year-ahead": [["calendar", "Month-by-month themes for the year"], ["star", "Your strongest periods for love, work and money"], ["compass", "Where to be careful and why"]],
  };
  return {
    kicker: report.eyebrow, title: report.title, body: report.description, points: points[kind] || [],
    cta: report.access === "addon" ? `Get it for ${reportPrice(report)}` : "Read it now",
    route: report.route || `/report/${report.slug}`,
    price: report.access === "addon" ? reportPrice(report) : undefined, list: report.access === "addon" ? reportPrice(report, true) : undefined,
  };
}

/** Frequency cap for a nudge. `ready` is true once the cooldown has passed. */
export function useNudge(id: string, cooldownHours: number) {
  const key = `astronow.nudge.${id}`;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(key).then((v) => {
      const last = Number(v) || 0;
      setReady(Date.now() - last > cooldownHours * 3600 * 1000);
    }).catch(() => {});
  }, [key, cooldownHours]);
  const markShown = useCallback(() => {
    setReady(false);
    AsyncStorage.setItem(key, String(Date.now())).catch(() => {});
  }, [key]);
  return { ready, markShown };
}

/** A spring-loaded bottom sheet that sells one clear thing. Swipe down to dismiss. */
export function UpsellSheet({ visible, kind, onClose }: { visible: boolean; kind: UpsellKind; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(600);
  const fade = useSharedValue(0);
  const c = contentFor(kind);

  useEffect(() => {
    if (!visible) return;
    haptics.soft();
    fade.set(withTiming(1, { duration: 240 }));
    y.set(withSpring(0, { damping: 20, stiffness: 180, mass: 0.9 }));
  }, [visible, fade, y]);

  const close = useCallback((then?: () => void) => {
    fade.set(withTiming(0, { duration: 200 }));
    y.set(withTiming(600, { duration: 240, easing: Easing.in(Easing.quad) }, (done) => {
      if (done) { runOnJS(onClose)(); if (then) runOnJS(then)(); }
    }));
  }, [fade, y, onClose]);

  const drag = Gesture.Pan()
    .onUpdate((e) => { y.set(Math.max(0, e.translationY)); })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 900) runOnJS(close)();
      else y.set(withSpring(0, { damping: 20, stiffness: 200 }));
    });

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdrop = useAnimatedStyle(() => ({ opacity: fade.value }));
  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => close()} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, backdrop]}>
        {Platform.OS === "ios" ? <BlurView tint="dark" intensity={30} style={StyleSheet.absoluteFill} /> : null}
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(5,4,14,0.66)" }]} onPress={() => close()} accessibilityLabel="Close" />
      </Animated.View>
      <View style={styles.anchor} pointerEvents="box-none">
        <GestureDetector gesture={drag}>
          <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }, sheet]}>
            <LinearGradient colors={["#2A1640", "#17132E", "#110F24"]} style={StyleSheet.absoluteFill} />
            <View style={styles.handle} />
            <View style={styles.head}>
              <LinearGradient colors={["#3A1D4A", "#1C1638"]} style={styles.mark}><BrandMark size={38} /></LinearGradient>
              <View style={{ flex: 1 }}>
                <AppText variant="label" style={{ color: colors.coralSoft, letterSpacing: 1.2, fontSize: 11 }}>{c.kicker}</AppText>
                <AppText variant="title" style={{ marginTop: 2 }}>{c.title}</AppText>
              </View>
            </View>
            <AppText variant="body" muted style={{ marginTop: 10 }}>{c.body}</AppText>
            <View style={styles.points}>
              {c.points.map(([icon, text]) => (
                <View key={text} style={styles.point}>
                  <View style={styles.pointIcon}><Icon name={icon} size={15} color={colors.goldSoft} weight="duotone" /></View>
                  <AppText variant="body" style={{ flex: 1 }}>{text}</AppText>
                </View>
              ))}
            </View>
            {c.list ? (
              <View style={styles.priceRow}>
                <AppText variant="body" muted style={{ textDecorationLine: "line-through" }}>{c.list}</AppText>
                <AppText variant="title" style={{ color: colors.goldSoft }}>{c.price}</AppText>
                <View style={styles.offPill}><AppText variant="caption" style={{ color: colors.ink, fontSize: 11 }}>Launch price · 50% off</AppText></View>
              </View>
            ) : c.price ? <AppText variant="caption" style={{ color: colors.goldSoft, marginTop: 14 }}>{c.price}</AppText> : null}
            <Button label={c.cta} iconRight="arrow-right" shine haptic="medium" style={{ marginTop: 16 }} testID="upsell-cta"
              onPress={() => close(() => router.push(c.route as any))} />
            <Pressable onPress={() => close()} style={{ alignSelf: "center", padding: 12 }} testID="upsell-later">
              <AppText variant="caption" muted>Maybe later</AppText>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  anchor: { flex: 1, justifyContent: "flex-end" },
  sheet: { overflow: "hidden", paddingHorizontal: 20, paddingTop: 10, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.borderStrong },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(235,226,250,0.3)", marginBottom: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  mark: { width: 56, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.glassBorder },
  points: { gap: 11, marginTop: 16 },
  point: { flexDirection: "row", alignItems: "center", gap: 11 },
  pointIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(242,200,121,0.1)" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  offPill: { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#8FB8F0" },
}));
