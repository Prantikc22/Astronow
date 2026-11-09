import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { Screen } from "@/src/components/Screen";
import { LINKS, openLink } from "@/src/content/links";
import { rise } from "@/src/motion";
import { markAiConsentAsked } from "@/src/services/ai-consent";
import { useAuth } from "@/src/store/auth";
import { makeStyles, radii, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

const SENT: { icon: FeatherName; text: string }[] = [
  { icon: "user", text: "Your first name" },
  { icon: "calendar", text: "Your birth date, time and place, and the chart made from them" },
  { icon: "message-circle", text: "Questions you ask the 24x7 Astrologer" },
  { icon: "globe", text: "Your reading language" },
  { icon: "image", text: "A floor-plan photo, only if you upload one for Vastu" },
];

/**
 * Explains what is shared with the AI provider and asks permission before any of it is sent
 * (App Store guidelines 5.1.1 and 5.1.2). The server enforces the same choice.
 */
export default function AiConsent() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { profile, refresh } = useAuth();
  const allowed = !!profile?.ai_consent_at;
  const [busy, setBusy] = useState<"allow" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const leave = () => {
    if (next === "today") router.replace("/(tabs)/today");
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/today");
  };

  const choose = async (grant: boolean) => {
    setBusy(grant ? "allow" : "decline");
    setError(null);
    try {
      await markAiConsentAsked();
      if (grant !== allowed) await api.patch("/profile", { ai_consent: grant });
      await refresh();
      if (grant) haptics.success(); else haptics.selection();
      leave();
    } catch (e: any) {
      setError(e?.message || "We couldn't save your choice. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title="AI-written readings" subtitle="Your choice, and you can change it any time" back={next !== "today"}>
      <Animated.View entering={rise(0)}>
        <AppText variant="body" style={{ lineHeight: 24 }}>
          AstroNow's daily readings, reports, Vastu advice and 24x7 Astrologer answers are written by an AI model. To do that, we need to send some of your details to our AI provider. Nothing is sent unless you allow it.
        </AppText>
      </Animated.View>

      <Animated.View entering={rise(1)} style={styles.card}>
        <AppText variant="label" style={{ color: colors.coralSoft }}>WHAT IS SENT</AppText>
        {SENT.map((row) => (
          <View key={row.text} style={styles.row}>
            <Icon name={row.icon} size={16} color={colors.gold} />
            <AppText variant="body" style={{ flex: 1 }}>{row.text}</AppText>
          </View>
        ))}
        <View style={styles.row}>
          <Icon name="shield" size={16} color={colors.violet} />
          <AppText variant="body" muted style={{ flex: 1 }}>Never sent: your phone number, email address or payment details.</AppText>
        </View>
      </Animated.View>

      <Animated.View entering={rise(2)} style={styles.card}>
        <AppText variant="label" style={{ color: colors.coralSoft }}>WHO RECEIVES IT</AppText>
        <AppText variant="body" style={{ lineHeight: 23 }}>
          OpenRouter, Inc. (United States), which passes the request to the DeepSeek AI model run by its model providers. They use it to write your reading and send the text back to us.
        </AppText>
        <MotionPressable onPress={() => openLink(LINKS.privacy)} hitSlop={8} testID="ai-consent-privacy">
          <AppText variant="caption" style={{ color: colors.violet, marginTop: 4 }}>Read our Privacy Policy</AppText>
        </MotionPressable>
      </Animated.View>

      <Animated.View entering={rise(3)}>
        <AppText variant="caption" muted style={{ lineHeight: 18, marginBottom: 14 }}>
          {allowed
            ? "AI-written readings are on. Turning them off stops anything new being sent; you'll get readings calculated by AstroNow without AI."
            : "If you choose not now, AstroNow still works with readings calculated by AstroNow without AI. You can turn this on later in Profile."}
        </AppText>
        {allowed ? (
          <>
            <Button label="Keep AI-written readings on" onPress={leave} testID="ai-consent-keep" />
            <Button label="Turn off and stop sharing" variant="ghost" onPress={() => choose(false)} loading={busy === "decline"} style={{ marginTop: 10 }} testID="ai-consent-withdraw" />
          </>
        ) : (
          <>
            <Button label="Allow and continue" iconRight="arrow-right" onPress={() => choose(true)} loading={busy === "allow"} shine testID="ai-consent-allow" />
            <Button label="Not now" variant="ghost" onPress={() => choose(false)} loading={busy === "decline"} style={{ marginTop: 10 }} testID="ai-consent-decline" />
          </>
        )}
        {error ? <AppText variant="caption" center style={{ color: colors.coralSoft, marginTop: 10 }}>{error}</AppText> : null}
      </Animated.View>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { marginTop: 18, marginBottom: 4, padding: 18, gap: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(26,24,51,0.72)" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
}));
