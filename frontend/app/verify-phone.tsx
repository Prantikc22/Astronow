import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { BrandMark } from "@/src/components/BrandMark";
import { Button } from "@/src/components/Button";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { OtpInput, PhoneInput } from "@/src/components/PhoneInput";
import { countryByIso, defaultCountryIso } from "@/src/content/countries";
import { rise } from "@/src/motion";
import { useAuth } from "@/src/store/auth";
import { makeStyles, radii, useTheme } from "@/src/theme";

/**
 * Email and Google accounts confirm a mobile number once. Numbers are unique,
 * so the same person can't end up with two AstroNow accounts.
 */
export default function VerifyPhone() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sendPhoneCode, linkPhone, logout, user } = useAuth();
  const [country, setCountry] = useState(defaultCountryIso);
  const dial = countryByIso(country).code;
  const [mobile, setMobile] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const send = async () => {
    setError(null);
    setTaken(false);
    setBusy(true);
    try {
      const r = await sendPhoneCode(dial, mobile);
      setSent(true);
      setCode("");
      setResendIn(r.resend_after);
    } catch (e: any) {
      setError(e?.message || "We couldn't send the code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (value.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    setCodeError(false);
    try {
      await linkPhone(dial, mobile, value);
      router.replace("/");
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 409) {
        setTaken(true);
        setSent(false);
      } else {
        setCodeError(true);
        setCode("");
      }
      setError(e?.message || "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const switchToPhone = async () => {
    await logout();
    router.replace("/auth");
  };

  return (
    <View style={{ flex: 1 }}>
      <CosmicBackground>
        <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={rise(0)} style={{ alignItems: "center" }}>
            <View style={styles.mark}><BrandMark size={44} /></View>
            <AppText variant="display" center style={{ marginTop: 18, fontSize: 30, lineHeight: 36 }}>Verify your mobile</AppText>
            <AppText variant="body" muted center style={{ marginTop: 8 }}>
              One account per person. Your number keeps your chart safe and lets you sign in with a code, no password needed.
            </AppText>
          </Animated.View>

          <Animated.View entering={rise(1)} style={styles.card}>
            {!sent ? (
              <>
                <PhoneInput country={country} onCountry={setCountry} value={mobile} onChange={setMobile} onSubmit={send} autoFocus />
                <Button label="Send code" iconRight="arrow-right" onPress={send} loading={busy} disabled={mobile.length < 6} style={{ marginTop: 16 }} testID="verify-send" />
              </>
            ) : (
              <Animated.View entering={FadeInDown.duration(260)}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                  <AppText variant="caption" muted style={{ flex: 1 }}>{`Enter the code sent to +${dial} ${mobile}`}</AppText>
                  <MotionPressable onPress={() => setSent(false)} hitSlop={8}><AppText variant="caption" style={{ color: colors.violet }}>Change</AppText></MotionPressable>
                </View>
                <OtpInput value={code} onChange={(v) => { setCode(v); setCodeError(false); }} onComplete={verify} error={codeError} />
                <Button label="Verify" iconRight="check" onPress={() => verify()} loading={busy} disabled={code.length < 6} style={{ marginTop: 16 }} testID="verify-submit" />
                <MotionPressable onPress={send} disabled={resendIn > 0 || busy} style={{ alignSelf: "center", paddingVertical: 10 }}>
                  <AppText variant="caption" style={{ color: resendIn > 0 ? colors.muted : colors.violet }}>{resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}</AppText>
                </MotionPressable>
              </Animated.View>
            )}

            {error ? (
              <View style={[styles.notice, taken && styles.noticeStrong]}>
                <Icon name="alert-circle" size={16} color={colors.coralSoft} />
                <AppText variant="caption" style={{ flex: 1, color: colors.onSurface }}>{error}</AppText>
              </View>
            ) : null}
            {taken ? <Button label="Sign out and use my number" variant="secondary" onPress={switchToPhone} style={{ marginTop: 12 }} testID="verify-use-number" /> : null}
          </Animated.View>

          <MotionPressable onPress={switchToPhone} style={{ alignSelf: "center", padding: 12, marginTop: 8 }} testID="verify-signout">
            <AppText variant="caption" muted>{user?.email ? `Signed in as ${user.email} · Sign out` : "Sign out"}</AppText>
          </MotionPressable>
        </KeyboardAwareScrollView>
      </CosmicBackground>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  mark: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(58,29,74,0.9)", borderWidth: 1, borderColor: colors.glassBorder },
  card: { marginTop: 24, padding: 18, borderRadius: radii.xl, backgroundColor: "rgba(17,16,42,0.94)", borderWidth: 1, borderColor: colors.borderStrong },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: "rgba(217,121,162,0.08)", borderWidth: 1, borderColor: "rgba(217,121,162,0.25)" },
  noticeStrong: { borderColor: "rgba(217,121,162,0.5)" },
}));
