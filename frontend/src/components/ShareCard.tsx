import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import React, { useRef, useState } from "react";
import { Modal, Platform, Pressable, Share, StyleSheet, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { AppText } from "@/src/components/AppText";
import { BrandMark } from "@/src/components/BrandMark";
import { Button } from "@/src/components/Button";
import { ScoreRing } from "@/src/components/ScoreRing";
import type { DayRuler } from "@/src/content/day-insights";
import { fonts, makeStyles } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

export type ShareData = { name: string; date: string; score: number | null; title: string; tone: string; ruler: DayRuler; moon: string };

function Card({ d }: { d: ShareData }) {
  const styles = useStyles();
  return (
    <LinearGradient colors={["#2A1640", "#17132E", "#0D0B1F"]} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }} style={styles.card}>
      <View style={styles.glow} />
      <View style={styles.cardHead}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <BrandMark size={26} />
          <AppText style={styles.brand}>AstroNow</AppText>
        </View>
        <AppText variant="caption" style={{ color: "rgba(248,242,232,0.7)" }}>{d.date}</AppText>
      </View>
      <AppText variant="caption" center style={{ color: "#F0A0BD", marginTop: 22, letterSpacing: 1.4 }}>{d.name.toUpperCase()}&apos;S DAY</AppText>
      <View style={{ alignItems: "center", marginTop: 14 }}>
        <ScoreRing size={132} stroke={9} value={(d.score ?? 0) / 100}>
          <AppText style={styles.score}>{d.score != null ? `${d.score}%` : "—"}</AppText>
        </ScoreRing>
      </View>
      <AppText center style={styles.title}>{d.title}</AppText>
      <AppText variant="caption" center style={{ color: "#F0A0BD", marginTop: 6 }}>{d.tone}</AppText>
      <View style={styles.pill}>
        <View style={[styles.dot, { backgroundColor: d.ruler.color }]} />
        <AppText variant="body" style={{ color: "#F8F2E8" }}>Wear {d.ruler.colorName}</AppText>
        <View style={styles.sep} />
        <AppText variant="body" style={{ color: "rgba(248,242,232,0.7)" }}>Lucky</AppText>
        <AppText style={styles.lucky}>{d.ruler.number}</AppText>
      </View>
      <AppText variant="caption" center style={{ color: "rgba(248,242,232,0.6)", marginTop: 12 }}>{d.moon}</AppText>
      <AppText variant="caption" center style={styles.foot}>Get your daily reading on AstroNow</AppText>
    </LinearGradient>
  );
}

/** Previews a branded day card and hands it to the system share sheet. */
export function ShareSheet({ visible, data, onClose }: { visible: boolean; data: ShareData; onClose: () => void }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    haptics.medium();
    try {
      const uri = await captureRef(ref, { format: "png", quality: 1, result: "tmpfile" });
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your day", UTI: "public.png" });
      } else {
        await Share.share({ message: `My day on AstroNow: ${data.score ?? ""}% · ${data.title}. Wear ${data.ruler.colorName}, lucky number ${data.ruler.number}.` });
      }
      haptics.success();
      onClose();
    } catch {
      await Share.share({ message: `My day on AstroNow: ${data.score ?? ""}% · ${data.title}.` }).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(5,4,14,0.8)" }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <View style={[styles.anchor, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <Animated.View entering={SlideInDown.springify().damping(18)} style={{ alignItems: "center", width: "100%" }}>
          <View ref={ref} collapsable={false} style={{ borderRadius: 18, overflow: "hidden" }}>
            <Card d={data} />
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16, alignSelf: "stretch" }}>
            <Button label="Close" variant="ghost" full={false} onPress={onClose} haptic="light" />
            <Button label="Share my day" iconRight="send" full={false} style={{ flex: 1 }} onPress={share} loading={busy} shine testID="share-card-send" />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(() => ({
  anchor: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 20 },
  card: { width: 320, height: 420, padding: 20, overflow: "hidden" },
  glow: { position: "absolute", width: 240, height: 240, borderRadius: 120, top: 60, left: 40, backgroundColor: "rgba(217,121,162,0.14)" },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontFamily: fonts.displayStrong, fontSize: 17, color: "#F8F2E8" },
  score: { fontFamily: fonts.displayStrong, fontSize: 30, color: "#F8F2E8" },
  title: { fontFamily: fonts.displayStrong, fontSize: 21, lineHeight: 26, color: "#F8F2E8", marginTop: 14 },
  pill: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, paddingHorizontal: 14, height: 40, borderRadius: 12, backgroundColor: "rgba(11,11,26,0.55)", borderWidth: 1, borderColor: "rgba(235,226,250,0.14)" },
  dot: { width: 14, height: 14, borderRadius: 7 },
  sep: { width: 1, height: 18, backgroundColor: "rgba(235,226,250,0.25)" },
  lucky: { fontFamily: fonts.displayStrong, fontSize: 20, color: "#F8F2E8" },
  foot: { marginTop: "auto", color: "rgba(248,242,232,0.5)" },
}));
