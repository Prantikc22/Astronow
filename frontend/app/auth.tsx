import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isPreviewMode } from "@/src/api/preview";
import { AppText } from "@/src/components/AppText";
import { splashRemaining } from "@/src/components/AnimatedSplash";
import { BrandLockup } from "@/src/components/BrandLockup";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { Button } from "@/src/components/Button";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { OtpInput, PhoneInput } from "@/src/components/PhoneInput";
import { countryByIso, defaultCountryIso } from "@/src/content/countries";
import { TextField } from "@/src/components/TextField";
import { useAuth } from "@/src/store/auth";
import { makeStyles, useTheme } from "@/src/theme";
import { springs } from "@/src/motion";
import { haptics } from "@/src/utils/haptics";

// Written for both audiences: Vedic terms appear alongside their plain meaning.
const TAGLINES = [
  "Your Kundli, finally explained.",
  "Your birth chart, read for today.",
  "Vedic wisdom. Modern clarity.",
  "Ask anything. Tara reads your stars.",
];

function friendlyAuthError(cause: any) {
  const message = String(cause?.message || "");
  if (/invalid login credentials/i.test(message)) return "That email and password do not match. Check them and try again.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email from the message we sent, then sign in.";
  if (/failed to fetch|network request failed|load failed/i.test(message)) return "AstroNow could not connect. Check your internet connection and try again.";
  return message || "Something went wrong. Please try again.";
}

export default function AuthScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signup, login, signInWithGoogle, requestPasswordReset, enterPreview, authConfigured, sendPhoneCode, verifyPhone } = useAuth();
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [country, setCountry] = useState(defaultCountryIso);
  const dial = countryByIso(country).code;
  const [mobile, setMobile] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const googleReady = process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === "1";
  const [enterAt] = useState(() => splashRemaining());

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      haptics.error();
      return;
    }
    if (mode === "signup" && !firstName.trim()) {
      setError("Please add your first name so your readings feel like yours.");
      haptics.warning();
      return;
    }
    if (password.length < 6) {
      setError("Your password needs at least 6 characters.");
      haptics.error();
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const result = await signup(email.trim(), password, firstName.trim() || undefined);
        if (result.needsEmailConfirmation) {
          setNotice("Check your inbox to confirm your email, then sign in here.");
          setMode("signin");
          haptics.success();
          return;
        }
      } else {
        await login(email.trim(), password);
      }
      router.replace("/");
    } catch (e: any) {
      setError(friendlyAuthError(e));
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email first, then tap Forgot password.");
      haptics.warning();
      return;
    }
    try {
      await requestPasswordReset(email.trim());
      setNotice("Password reset email sent. Check your inbox.");
    } catch (e: any) {
      setError(e?.message || "We could not send a reset email.");
      haptics.error();
    }
  };

  const google = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (await signInWithGoogle()) router.replace("/");
    } catch (cause: any) {
      setError(cause?.message || "Google sign-in did not finish. Please try again.");
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const sendCode = async () => {
    setError(null);
    setNotice(null);
    if (mobile.length < 6) { setError("Enter your mobile number."); haptics.warning(); return; }
    setLoading(true);
    try {
      const r = await sendPhoneCode(dial, mobile);
      setCodeSent(true);
      setCode("");
      setResendIn(r.resend_after);
    } catch (e: any) {
      setError(friendlyAuthError(e));
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const checkCode = async (value = code) => {
    if (value.length < 6 || loading) return;
    setError(null);
    setCodeError(false);
    setLoading(true);
    try {
      await verifyPhone(dial, mobile, value);
      router.replace("/");
    } catch (e: any) {
      setCodeError(true);
      setError(friendlyAuthError(e));
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <KeyboardAwareScrollView bottomOffset={28}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <BrandLockup taglines={TAGLINES} />


        <Animated.View entering={FadeInUp.delay(enterAt + 600).duration(460).easing(Easing.bezier(0.22, 1, 0.36, 1))} style={styles.sheet}>
          <AppText variant="title" style={{ fontSize: 21, lineHeight: 27 }}>{method === "email" && mode === "signin" ? "Welcome back" : "Welcome to AstroNow"}</AppText>
          <AppText variant="caption" muted style={{ marginTop: 3, marginBottom: 16 }}>
            {method === "phone" ? "Sign in or create an account in seconds." : mode === "signup" ? "Create your account with email." : "Sign in with your email and password."}
          </AppText>

          <AuthToggle value={method} items={[["phone", "Mobile"], ["email", "Email"]]} onChange={(item) => { setMethod(item as "phone" | "email"); setError(null); setNotice(null); }} />

          {method === "phone" ? (
            <Animated.View key={codeSent ? "code" : "number"} entering={FadeInDown.duration(280)} style={styles.fields}>
              {!codeSent ? (
                <>
                  <PhoneInput country={country} onCountry={setCountry} value={mobile} onChange={setMobile} onSubmit={sendCode} />
                  <AppText variant="caption" muted style={{ fontSize: 12 }}>We&apos;ll text you a 6-digit code.</AppText>
                </>
              ) : (
                <>
                  <View style={styles.sentRow}>
                    <AppText variant="caption" muted style={{ flex: 1 }}>{`Enter the code sent to +${dial} ${mobile}`}</AppText>
                    <MotionPressable onPress={() => { setCodeSent(false); setError(null); }} hitSlop={8} testID="auth-change-number">
                      <AppText variant="caption" style={{ color: colors.violet }}>Change</AppText>
                    </MotionPressable>
                  </View>
                  <OtpInput value={code} onChange={(v) => { setCode(v); setCodeError(false); }} onComplete={checkCode} error={codeError} />
                  <MotionPressable onPress={sendCode} disabled={resendIn > 0 || loading} style={styles.resend} testID="auth-resend">
                    <AppText variant="caption" style={{ color: resendIn > 0 ? colors.muted : colors.violet }}>{resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}</AppText>
                  </MotionPressable>
                </>
              )}
            </Animated.View>
          ) : null}

          {method === "email" ? <Animated.View key={mode} entering={FadeInDown.duration(280)} layout={LinearTransition.duration(220)} style={styles.fields}>
            {mode === "signup" ? <TextField label="First name" value={firstName} onChangeText={setFirstName}
              placeholder="What should Tara call you?" autoCapitalize="words" autoComplete="name" testID="auth-firstname" /> : null}
            <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com"
              keyboardType="email-address" autoComplete="email" testID="auth-email" />
            <TextField label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters"
              secureTextEntry autoComplete={mode === "signup" ? "new-password" : "current-password"}
              onSubmitEditing={submit} testID="auth-password" />
          </Animated.View> : null}

          {method === "email" ? (
            <View style={styles.emailLinks}>
              <MotionPressable onPress={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); setNotice(null); }} hitSlop={8} testID="auth-toggle-mode">
                <AppText variant="caption" style={{ color: colors.violet }}>{mode === "signup" ? "Have an account? Sign in" : "New here? Create an account"}</AppText>
              </MotionPressable>
              {mode === "signin" ? <MotionPressable onPress={resetPassword} hitSlop={8} testID="auth-forgot">
                <AppText variant="caption" style={{ color: colors.violet }}>Forgot password?</AppText>
              </MotionPressable> : null}
            </View>
          ) : null}
          {error ? <Animated.View entering={FadeInDown.duration(240)} style={styles.errorBox}><Icon name="alert-circle" size={15} color={colors.coralSoft} /><AppText variant="caption" style={{ color: colors.coralSoft, flex: 1 }} testID="auth-error">{error}</AppText></Animated.View> : null}
          {notice ? <Animated.View entering={FadeInDown.duration(240)} style={styles.noticeBox}><Icon name="check-circle" size={15} color={colors.goldSoft} /><AppText variant="caption" style={{ color: colors.goldSoft, flex: 1 }} testID="auth-notice">{notice}</AppText></Animated.View> : null}
          {!authConfigured ? <AppText variant="caption" center style={styles.configNote}>This local build still needs its public Supabase URL and publishable key.</AppText> : null}

          {method === "phone" ? (
            <Button label={codeSent ? "Verify and continue" : "Send code"} onPress={codeSent ? () => checkCode() : sendCode} shine
              loading={loading} disabled={codeSent ? code.length < 6 : mobile.length < 6} iconRight="arrow-right" testID="auth-phone-submit" style={{ marginTop: 18 }} haptic="medium" />
          ) : (
            <Button label={mode === "signup" ? "Reveal my chart" : "Sign in"} onPress={submit} shine
              loading={loading} iconRight="arrow-right" testID="auth-submit" style={{ marginTop: 18 }} haptic="medium" />
          )}
          {loading ? <Animated.View entering={FadeIn.duration(180)}><AppText variant="caption" muted center style={styles.loadingCopy}>Opening your private chart…</AppText></Animated.View> : null}
          <View style={styles.divider}><View style={styles.dividerLine} /><AppText variant="caption" muted>or</AppText><View style={styles.dividerLine} /></View>
          <MotionPressable onPress={google} disabled={loading || !authConfigured || !googleReady} style={[styles.googleButton, (loading || !authConfigured || !googleReady) && { opacity: 0.5 }]} testID="auth-google" accessibilityLabel="Continue with Google">
            <View style={styles.googleBadge}><AppText style={styles.googleGlyph}>G</AppText></View>
            <AppText variant="label" style={{ color: colors.onSurface, fontSize: 15 }}>Continue with Google</AppText>
            {!googleReady ? <View style={styles.soon}><AppText variant="caption" style={{ fontSize: 10, color: colors.muted }}>Soon</AppText></View> : null}
          </MotionPressable>
          {isPreviewMode() ? <MotionPressable onPress={() => { enterPreview(); router.replace("/"); }}
            style={styles.previewButton} testID="auth-preview">
            <Icon name="eye" size={16} color={colors.muted} />
            <AppText variant="caption" muted>Preview the app without an account</AppText>
          </MotionPressable> : null}
        </Animated.View>

        <View style={styles.promiseRow}>
          <Icon name="lock" size={12} color={colors.muted} />
          <AppText variant="caption" muted center style={{ fontSize: 11.5 }}>Private by design. By continuing you agree to our Terms and Privacy Policy.</AppText>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

function AuthToggle({ value, items, onChange }: { value: string; items: [string, string][]; onChange: (key: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const slot = w / items.length;
  useEffect(() => { x.value = withSpring(Math.max(0, items.findIndex(([k]) => k === value)) * slot, springs.snappy); }, [value, slot, items, x]);
  const bar = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // Text tabs with a sliding gold underline: lighter than a filled pill.
  return (
    <View style={styles.toggle} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {items.map(([key, label]) => (
        <MotionPressable key={key} onPress={() => onChange(key)} testID={`auth-toggle-${key}`} style={styles.toggleItem} haptic="selection">
          <AppText variant="label" style={{ color: value === key ? colors.onSurface : colors.muted, fontSize: 14.5 }}>{label}</AppText>
        </MotionPressable>
      ))}
      {w ? <Animated.View style={[styles.toggleBar, { width: slot }, bar]}><View style={styles.toggleBarInner} /></Animated.View> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { minHeight: "100%", paddingHorizontal: 20 },
  sheet: { marginTop: 26, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 16, borderRadius: 20, backgroundColor: "rgba(20,18,44,0.78)", borderWidth: 1, borderColor: "rgba(235,226,250,0.09)" },
  toggle: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(235,226,250,0.08)" },
  toggleBar: { position: "absolute", left: 0, bottom: -1, height: 2, alignItems: "center" },
  toggleBarInner: { width: 42, height: 2, borderRadius: 1, backgroundColor: colors.gold },
  toggleItem: { flex: 1, height: 40, alignItems: "center", justifyContent: "center" },
  fields: { gap: 12, marginTop: 16 },
  soon: { marginLeft: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: colors.border },
  sentRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  resend: { alignSelf: "center", paddingVertical: 6 },
  emailLinks: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  forgot: { alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 3 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 11, borderRadius: 10, backgroundColor: "rgba(217,121,162,0.1)", borderWidth: 1, borderColor: "rgba(217,121,162,0.3)" },
  noticeBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 11, borderRadius: 10, backgroundColor: "rgba(242,200,121,0.08)", borderWidth: 1, borderColor: "rgba(242,200,121,0.3)" },
  loadingCopy: { marginTop: 8 },
  configNote: { color: colors.coralSoft, marginTop: 11 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, marginBottom: 13 },
  dividerLine: { height: 1, flex: 1, backgroundColor: colors.divider },
  googleButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 12, backgroundColor: "rgba(235,226,250,0.04)", borderWidth: 1, borderColor: "rgba(235,226,250,0.12)" },
  googleBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ivory, alignItems: "center", justifyContent: "center" },
  googleGlyph: { color: "#4263EB", fontFamily: "NunitoSans-Bold", fontSize: 15 },
  previewButton: { alignSelf: "center", marginTop: 13, flexDirection: "row", alignItems: "center", gap: 7, padding: 6 },
  promiseRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 18, paddingHorizontal: 20 },
}));
