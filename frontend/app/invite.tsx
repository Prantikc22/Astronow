import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Share, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { Screen } from "@/src/components/Screen";
import { SparkleBurst } from "@/src/components/SparkleBurst";
import { TextField } from "@/src/components/TextField";
import { pop, rise } from "@/src/motion";
import { fonts, makeStyles, radii, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

export default function Invite() {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["referral"], queryFn: () => api.get("/referral") });
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [burst, setBurst] = useState(0);

  const copy = async () => {
    if (!data?.code) return;
    await Clipboard.setStringAsync(data.code).catch(() => {});
    setCopied(true);
    haptics.success();
    setTimeout(() => setCopied(false), 1800);
  };

  const share = () => {
    if (!data?.code) return;
    haptics.medium();
    Share.share({
      message: `I've been using AstroNow for my daily Vedic reading and Kundli. Join with my code ${data.code} and we both get 2 free questions with Tara, the 24x7 Astrologer.`,
    }).catch(() => {});
  };

  const redeem = async () => {
    setRedeeming(true);
    setMessage(null);
    try {
      await api.post("/referral/redeem", { code });
      setMessage({ ok: true, text: "Done. 2 bonus questions are now in your account." });
      setBurst((n) => n + 1);
      haptics.celebrate();
      qc.invalidateQueries({ queryKey: ["usage"] });
      qc.invalidateQueries({ queryKey: ["referral"] });
    } catch (e: any) {
      setMessage({ ok: false, text: e?.message || "That code didn't work. Check it and try again." });
      haptics.error();
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <Screen title="Invite friends" subtitle="Share AstroNow, earn free questions" back>
      <Animated.View entering={rise(0)}>
        <LinearGradient colors={["#3A1638", "#1D1838"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Animated.View entering={pop(1)} style={styles.giftWrap}><Icon name="gift" size={34} color={colors.goldSoft} weight="duotone" /></Animated.View>
          <AppText variant="title" center style={{ marginTop: 14 }}>Give 2, get 2</AppText>
          <AppText variant="body" muted center style={{ marginTop: 6 }}>When a friend joins with your code, you both get 2 free questions with Tara.</AppText>

          <MotionPressable onPress={copy} style={styles.codeBox} testID="invite-copy" accessibilityLabel="Copy invite code">
            <AppText style={styles.code}>{data?.code || "········"}</AppText>
            <View style={styles.copyTag}>
              <Icon name={copied ? "check" : "layers"} size={14} color={colors.ink} />
              <AppText variant="label" style={{ color: colors.ink, fontSize: 12 }}>{copied ? "Copied" : "Copy"}</AppText>
            </View>
          </MotionPressable>
          <Button label="Share invite" iconRight="send" onPress={share} shine style={{ marginTop: 14 }} testID="invite-share" />
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={rise(1)} style={styles.stats}>
        <View style={styles.stat}><AppText variant="title">{data?.invited ?? 0}</AppText><AppText variant="caption" muted>friends joined</AppText></View>
        <View style={styles.statDivider} />
        <View style={styles.stat}><AppText variant="title" style={{ color: colors.goldSoft }}>{data?.earned ?? 0}</AppText><AppText variant="caption" muted>questions earned</AppText></View>
      </Animated.View>

      {data?.can_redeem !== false || message?.ok ? (
        <Animated.View entering={rise(2)} style={styles.redeem}>
          <AppText variant="subtitle">Have a friend&apos;s code?</AppText>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12, alignItems: "flex-end" }}>
            <TextField value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="Enter code" autoCapitalize="characters" containerStyle={{ flex: 1 }} testID="invite-code-input" />
            <Button label="Apply" full={false} onPress={redeem} disabled={code.trim().length < 4} loading={redeeming} testID="invite-redeem" />
          </View>
          {message ? <Animated.View entering={FadeIn}><AppText variant="caption" style={{ color: message.ok ? colors.goldSoft : colors.coralSoft, marginTop: 10 }}>{message.text}</AppText></Animated.View> : null}
          <SparkleBurst trigger={burst} radius={140} count={24} />
        </Animated.View>
      ) : null}

      <AppText variant="caption" muted center style={{ marginTop: 18 }}>Bonus questions never expire and are used after your monthly free questions.</AppText>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  hero: { marginTop: 6, padding: 22, borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(240,160,189,0.25)", alignItems: "stretch" },
  giftWrap: { alignSelf: "center", width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(242,200,121,0.1)", borderWidth: 1, borderColor: "rgba(242,200,121,0.25)" },
  codeBox: { marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 18, paddingRight: 8, height: 60, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(242,200,121,0.55)", backgroundColor: "rgba(11,11,26,0.45)" },
  code: { fontFamily: fonts.displayStrong, fontSize: 26, letterSpacing: 4, color: colors.goldSoft },
  copyTag: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, height: 36, borderRadius: 10, backgroundColor: colors.goldSoft },
  stats: { flexDirection: "row", marginTop: 12, paddingVertical: 16, borderRadius: radii.lg, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.border },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: colors.divider },
  redeem: { marginTop: 12, padding: 18, borderRadius: radii.lg, backgroundColor: "rgba(21,20,43,0.92)", borderWidth: 1, borderColor: colors.border },
}));
