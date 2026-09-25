import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp, LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
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
import { TextField } from "@/src/components/TextField";
import { useAuth } from "@/src/store/auth";
import { makeStyles, radii, useTheme } from "@/src/theme";
import { springs } from "@/src/motion";
import { haptics } from "@/src/utils/haptics";

// Written for both audiences: Vedic terms appear alongside their plain meaning.
const TAGLINES = [
  "Your Kundli, finally explained.",
  "Your birth chart, read for today.",
  "Vedic wisdom. Modern clarity.",
  "Ask anything. Tara reads your stars.",
];
const PERKS: [string, string][] = [["target", "Precise Vedic chart"], ["message-circle", "Tara, your 24x7 Astrologer"], ["shield", "Private by design"]];

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
  const { signup, login, signInWithGoogle, requestPasswordReset, enterPreview, authConfigured } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
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

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <KeyboardAwareScrollView bottomOffset={28}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <BrandLockup taglines={TAGLINES} />

        <Animated.View entering={FadeIn.delay(enterAt + 1100).duration(500)} style={styles.perks}>
          {PERKS.map(([icon, label]) => (
            <View key={label} style={styles.perk}>
              <Icon name={icon} size={15} color={colors.goldSoft} weight="duotone" />
              <AppText variant="caption" style={{ color: colors.onSurface }}>{label}</AppText>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(enterAt + 600).springify().damping(18)} style={styles.sheet}>
          <AppText variant="title" center>{mode === "signup" ? "Create your free account" : "Welcome back"}</AppText>
          <AppText variant="caption" muted center style={{ marginTop: 4, marginBottom: 16 }}>
            {mode === "signup" ? "Your birth chart in under a minute. No card needed." : "Your chart and conversations are waiting."}
          </AppText>

          <AuthToggle mode={mode} onChange={(item) => { setMode(item); setError(null); setNotice(null); }} />

          <Animated.View key={mode} entering={FadeInDown.duration(280)} layout={LinearTransition.springify().damping(18)} style={styles.fields}>
            {mode === "signup" ? <TextField label="First name" value={firstName} onChangeText={setFirstName}
              placeholder="What should Tara call you?" autoCapitalize="words" autoComplete="name" testID="auth-firstname" /> : null}
            <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com"
              keyboardType="email-address" autoComplete="email" testID="auth-email" />
            <TextField label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters"
              secureTextEntry autoComplete={mode === "signup" ? "new-password" : "current-password"}
              onSubmitEditing={submit} testID="auth-password" />
          </Animated.View>

          {mode === "signin" ? <MotionPressable onPress={resetPassword} style={styles.forgot} testID="auth-forgot">
            <AppText variant="caption" style={{ color: colors.violet }}>Forgot password?</AppText>
          </MotionPressable> : null}
          {error ? <Animated.View entering={FadeInDown.duration(240).springify()} style={styles.errorBox}><Icon name="alert-circle" size={15} color={colors.coralSoft} /><AppText variant="caption" style={{ color: colors.coralSoft, flex: 1 }} testID="auth-error">{error}</AppText></Animated.View> : null}
          {notice ? <Animated.View entering={FadeInDown.duration(240)} style={styles.noticeBox}><Icon name="check-circle" size={15} color={colors.goldSoft} /><AppText variant="caption" style={{ color: colors.goldSoft, flex: 1 }} testID="auth-notice">{notice}</AppText></Animated.View> : null}
          {!authConfigured ? <AppText variant="caption" center style={styles.configNote}>This local build still needs its public Supabase URL and publishable key.</AppText> : null}

          <Button label={mode === "signup" ? "Reveal my chart" : "Sign in"} onPress={submit} shine
            loading={loading} iconRight="arrow-right" testID="auth-submit" style={{ marginTop: 18 }} haptic="medium" />
          {loading ? <Animated.View entering={FadeIn.duration(180)}><AppText variant="caption" muted center style={styles.loadingCopy}>Opening your private chart…</AppText></Animated.View> : null}
          <View style={styles.divider}><View style={styles.dividerLine} /><AppText variant="caption" muted>or</AppText><View style={styles.dividerLine} /></View>
          <MotionPressable onPress={google} disabled={loading || !authConfigured || !googleReady} style={[styles.googleButton, (loading || !authConfigured || !googleReady) && { opacity: 0.5 }]} testID="auth-google" accessibilityLabel="Continue with Google">
            <View style={styles.googleBadge}><AppText style={styles.googleGlyph}>G</AppText></View>
            <AppText variant="label" style={{ color: colors.onSurface, fontSize: 15 }}>Continue with Google</AppText>
          </MotionPressable>
          {!googleReady ? <AppText variant="caption" muted center style={{ marginTop: 6 }}>Google sign-in is coming soon. Email works today.</AppText> : null}
          {isPreviewMode() ? <MotionPressable onPress={() => { enterPreview(); router.replace("/"); }}
            style={styles.previewButton} testID="auth-preview">
            <Icon name="eye" size={16} color={colors.muted} />
            <AppText variant="caption" muted>Preview the app without an account</AppText>
          </MotionPressable> : null}
        </Animated.View>

        <View style={styles.promiseRow}>
          <Icon name="lock" size={13} color={colors.violet} />
          <AppText variant="caption" muted center>Your birth details stay private to your account. Delete anytime.</AppText>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

function AuthToggle({ mode, onChange }: { mode: "signin" | "signup"; onChange: (mode: "signin" | "signup") => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => { x.value = withSpring(mode === "signup" ? 0 : w / 2, springs.snappy); }, [mode, w, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={styles.toggle} onLayout={(e) => setW(e.nativeEvent.layout.width - 8)}>
      {w ? <Animated.View style={[styles.togglePill, { width: w / 2 }, pill]} /> : null}
      {(["signup", "signin"] as const).map((item) => (
        <MotionPressable key={item} onPress={() => onChange(item)} testID={`auth-toggle-${item}`} style={styles.toggleItem}>
          <AppText variant="label" style={{ color: mode === item ? colors.ink : colors.muted, fontSize: 14 }}>{item === "signup" ? "Create account" : "Sign in"}</AppText>
        </MotionPressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { minHeight: "100%", paddingHorizontal: 20 },
  perks: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 18 },
  perk: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 30, borderRadius: 8, backgroundColor: "rgba(33,31,59,0.8)", borderWidth: 1, borderColor: colors.border },
  sheet: { marginTop: 22, padding: 20, borderRadius: radii.xl, backgroundColor: "rgba(17,16,42,0.94)", borderWidth: 1, borderColor: colors.borderStrong, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  toggle: { flexDirection: "row", borderRadius: 12, padding: 4, backgroundColor: colors.surfaceTertiary },
  togglePill: { position: "absolute", left: 4, top: 4, bottom: 4, borderRadius: 9, backgroundColor: colors.gold },
  toggleItem: { flex: 1, height: 42, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  fields: { gap: 12, marginTop: 16 },
  forgot: { alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 3 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 11, borderRadius: 10, backgroundColor: "rgba(217,121,162,0.1)", borderWidth: 1, borderColor: "rgba(217,121,162,0.3)" },
  noticeBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 11, borderRadius: 10, backgroundColor: "rgba(242,200,121,0.08)", borderWidth: 1, borderColor: "rgba(242,200,121,0.3)" },
  loadingCopy: { marginTop: 8 },
  configNote: { color: colors.coralSoft, marginTop: 11 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, marginBottom: 13 },
  dividerLine: { height: 1, flex: 1, backgroundColor: colors.divider },
  googleButton: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  googleBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ivory, alignItems: "center", justifyContent: "center" },
  googleGlyph: { color: "#4263EB", fontFamily: "NunitoSans-Bold", fontSize: 15 },
  previewButton: { alignSelf: "center", marginTop: 13, flexDirection: "row", alignItems: "center", gap: 7, padding: 6 },
  promiseRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 18, paddingHorizontal: 20 },
}));
