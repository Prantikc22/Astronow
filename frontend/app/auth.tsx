import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { BackHandler, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeInLeft, FadeInRight, FadeInUp } from "react-native-reanimated";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isPreviewMode } from "@/src/api/preview";
import { AppText } from "@/src/components/AppText";
import { splashRemaining } from "@/src/components/AnimatedSplash";
import { BrandMark } from "@/src/components/BrandMark";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { Orrery } from "@/src/components/Orrery";
import { OtpInput, PhoneInput } from "@/src/components/PhoneInput";
import { TactileButton } from "@/src/components/TactileButton";
import { TextField } from "@/src/components/TextField";
import { countryByIso, defaultCountryIso } from "@/src/content/countries";
import { LINKS, openLink } from "@/src/content/links";
import { useI18n } from "@/src/i18n";
import { useAuth } from "@/src/store/auth";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

type Step = "welcome" | "phone" | "otp" | "email";
const ease = Easing.bezier(0.22, 1, 0.36, 1);

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
  const [step, setStepRaw] = useState<Step>("welcome");
  const [back, setBack] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [country, setCountry] = useState(defaultCountryIso);
  const dial = countryByIso(country).code;
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const googleReady = process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === "1";
  const [enterAt] = useState(() => splashRemaining());

  const go = (next: Step, isBack = false) => {
    setBack(isBack);
    setError(null);
    setNotice(null);
    setStepRaw(next);
  };
  const goBack = () => go(step === "otp" ? "phone" : "welcome", true);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (step === "welcome") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { go(step === "otp" ? "phone" : "welcome", true); return true; });
    return () => sub.remove();
  }, [step]);

  const submitEmail = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) { setError("Please enter your email and password."); haptics.error(); return; }
    if (mode === "signup" && !firstName.trim()) { setError("Please add your first name so your readings feel like yours."); haptics.warning(); return; }
    if (password.length < 6) { setError("Your password needs at least 6 characters."); haptics.error(); return; }
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
    if (!email.trim()) { setError("Enter your email first, then tap Forgot password."); haptics.warning(); return; }
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
    if (!googleReady) { setNotice("Google sign-in is arriving in the next update. Use your mobile number for now."); haptics.warning(); return; }
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
      setCode("");
      setResendIn(r.resend_after);
      haptics.success();
      go("otp");
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
      haptics.celebrate();
      router.replace("/");
    } catch (e: any) {
      setCodeError(true);
      setError(friendlyAuthError(e));
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const messages = (
    <>
      {error ? <Animated.View entering={FadeInDown.duration(240)} style={styles.errorBox}><Icon name="alert-circle" size={15} color={colors.coralSoft} /><AppText variant="caption" style={{ color: colors.coralSoft, flex: 1 }} testID="auth-error">{error}</AppText></Animated.View> : null}
      {notice ? <Animated.View entering={FadeInDown.duration(240)} style={styles.noticeBox}><Icon name="check-circle" size={15} color={colors.goldSoft} /><AppText variant="caption" style={{ color: colors.goldSoft, flex: 1 }} testID="auth-notice">{notice}</AppText></Animated.View> : null}
      {!authConfigured ? <AppText variant="caption" center style={styles.configNote}>This local build still needs its public Supabase URL and publishable key.</AppText> : null}
    </>
  );

  if (step === "welcome") {
    return (
      <View style={styles.root}>
        <CosmicBackground />
        <Animated.View key="welcome" entering={(back ? FadeInLeft : FadeIn).duration(360).easing(ease)} style={[styles.welcome, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 14 }]}>
          <Animated.View entering={FadeInDown.delay(enterAt + 100).duration(500).easing(ease)} style={styles.brandRow}>
            <View style={styles.brandMark}><BrandMark size={28} /></View>
            <AppText style={styles.brandText}>WELCOME TO ASTRONOW</AppText>
          </Animated.View>

          <HeroSlot delay={enterAt} />

          <View style={{ alignItems: "center" }}>
            <Headline lines={["Your stars,", "read for today."]} delay={enterAt + 350} center size={46} />
            <Animated.View entering={FadeIn.delay(enterAt + 800).duration(500)}>
              <AppText center numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.kicker}>KUNDLI · DAILY GUIDANCE · 24x7 ASTROLOGER</AppText>
            </Animated.View>
          </View>

          <Animated.View entering={FadeInUp.delay(enterAt + 900).duration(520).easing(ease)} style={{ gap: 12, marginTop: 22 }}>
            <TactileButton label="Continue with mobile" icon="phone" onPress={() => go("phone")} testID="auth-start-phone" />
            {googleReady ? (
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TactileButton tone="dark" label="Google" style={{ flex: 1 }} onPress={google} testID="auth-google" haptic="light"
                  iconNode={<View style={styles.gBadge}><AppText style={styles.gGlyph}>G</AppText></View>} />
                <TactileButton tone="dark" label="Email" icon="mail" style={{ flex: 1 }} onPress={() => go("email")} testID="auth-start-email" haptic="light" />
              </View>
            ) : (
              <TactileButton tone="dark" label="Continue with email" icon="mail" onPress={() => go("email")} testID="auth-start-email" haptic="light" />
            )}
            {messages}
            {isPreviewMode() ? (
              <MotionPressable onPress={() => { enterPreview(); router.replace("/"); }} style={styles.previewButton} testID="auth-preview">
                <Icon name="eye" size={15} color={colors.muted} />
                <AppText variant="caption" muted>Preview the app without an account</AppText>
              </MotionPressable>
            ) : null}
            <AppText center style={styles.legal}>
              By continuing you agree to our{" "}
              <AppText style={[styles.legal, styles.legalLink]} onPress={() => openLink(LINKS.terms)}>Terms</AppText>
              {" & "}
              <AppText style={[styles.legal, styles.legalLink]} onPress={() => openLink(LINKS.privacy)}>Privacy Policy</AppText>
            </AppText>
          </Animated.View>
        </Animated.View>
      </View>
    );
  }

  const heads: Record<Exclude<Step, "welcome">, { lines: [string, string]; sub: string }> = {
    phone: { lines: ["What's your", "mobile number?"], sub: "We'll text you a 6-digit code. No spam, no passwords." },
    otp: { lines: ["Enter the", "6-digit code"], sub: `Sent to +${dial} ${mobile}` },
    email: mode === "signup"
      ? { lines: ["Create your", "account"], sub: "Your chart stays private to you." }
      : { lines: ["Welcome", "back"], sub: "Sign in with your email and password." },
  };
  const head = heads[step];
  const cta = step === "phone"
    ? { label: "Send code", onPress: sendCode, disabled: mobile.length < 6, testID: "auth-phone-submit" }
    : step === "otp"
      ? { label: "Verify", onPress: () => checkCode(), disabled: code.length < 6, testID: "auth-phone-submit" }
      : { label: mode === "signup" ? "Reveal my chart" : "Sign in", onPress: submitEmail, disabled: false, testID: "auth-submit" };

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <Animated.View key={step + mode} entering={(back ? FadeInLeft : FadeInRight).duration(340).easing(ease)} style={{ flex: 1 }}>
        <KeyboardAwareScrollView bottomOffset={120} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 12 }]}>
          <TactileButton tone="dark" height={42} icon="arrow-left" label={step === "otp" ? "Change number" : "Other ways"}
            onPress={goBack} style={{ alignSelf: "flex-start" }} haptic="light" testID="auth-back" />

          <View style={{ marginTop: 34 }}>
            <Headline lines={head.lines} delay={80} size={42} />
            <Animated.View entering={FadeIn.delay(360).duration(420)}>
              <AppText style={styles.sub}>{head.sub}</AppText>
            </Animated.View>
          </View>

          <Animated.View entering={FadeInDown.delay(260).duration(460).easing(ease)} style={{ marginTop: 30, gap: 12 }}>
            {step === "phone" ? <PhoneInput split autoFocus country={country} onCountry={setCountry} value={mobile} onChange={setMobile} onSubmit={sendCode} /> : null}

            {step === "otp" ? (
              <>
                <OtpInput value={code} onChange={(v) => { setCode(v); setCodeError(false); }} onComplete={checkCode} error={codeError} />
                <MotionPressable onPress={sendCode} disabled={resendIn > 0 || loading} style={styles.resend} testID="auth-resend">
                  <AppText variant="label" style={{ color: resendIn > 0 ? colors.muted : colors.gold, letterSpacing: 0.6 }}>{resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}</AppText>
                </MotionPressable>
              </>
            ) : null}

            {step === "email" ? (
              <>
                {mode === "signup" ? <TextField label="First name" value={firstName} onChangeText={setFirstName}
                  placeholder="What should Tara call you?" autoCapitalize="words" autoComplete="name" testID="auth-firstname" /> : null}
                <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com"
                  keyboardType="email-address" autoComplete="email" testID="auth-email" />
                <TextField label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters"
                  secureTextEntry autoComplete={mode === "signup" ? "new-password" : "current-password"} onSubmitEditing={submitEmail} testID="auth-password" />
                <View style={styles.emailLinks}>
                  <MotionPressable onPress={() => { setBack(false); setMode(mode === "signup" ? "signin" : "signup"); setError(null); setNotice(null); }} hitSlop={8} testID="auth-toggle-mode">
                    <AppText variant="caption" style={{ color: colors.gold }}>{mode === "signup" ? "Have an account? Sign in" : "New here? Create an account"}</AppText>
                  </MotionPressable>
                  {mode === "signin" ? <MotionPressable onPress={resetPassword} hitSlop={8} testID="auth-forgot">
                    <AppText variant="caption" style={{ color: colors.gold }}>Forgot password?</AppText>
                  </MotionPressable> : null}
                </View>
              </>
            ) : null}
            {messages}
          </Animated.View>
        </KeyboardAwareScrollView>

        <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom - 8 }}>
          <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 14 }]}>
            <TactileButton label={cta.label} iconRight="arrow-right" onPress={cta.onPress} loading={loading} disabled={cta.disabled} testID={cta.testID} />
            {step === "phone" ? (
              <View style={styles.trust}><Icon name="lock" size={12} color={colors.muted} /><AppText variant="caption" muted>One account per number. Private by design.</AppText></View>
            ) : null}
          </View>
        </KeyboardStickyView>
      </Animated.View>
    </View>
  );
}

/** Two-line editorial headline: ivory serif, then champagne italic. Words rise in one after another. */
function Headline({ lines, delay = 0, center, size = 42 }: { lines: [string, string]; delay?: number; center?: boolean; size?: number }) {
  const { t } = useI18n();
  let n = 0;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={`${t(lines[0])} ${t(lines[1])}`}>
      {lines.map((line, row) => (
        <View key={row} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: center ? "center" : "flex-start" }}>
          {t(line).split(" ").map((word, i) => (
            <Animated.Text key={`${row}-${i}`} entering={FadeInDown.delay(delay + n++ * 70).duration(560).easing(ease)}
              style={{ fontFamily: row ? fonts.wordmarkItalic : fonts.wordmark, fontSize: size, lineHeight: size * 1.08, color: row ? "#EBC98A" : "#F5EEDF", letterSpacing: 0.2 }}>
              {`${word} `}
            </Animated.Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** The orrery takes whatever height the welcome screen has left. */
function HeroSlot({ delay }: { delay: number }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 200 }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box.w ? (
        <Animated.View entering={FadeIn.delay(delay).duration(700)}>
          <Orrery width={Math.min(box.w + 20, 440)} height={Math.min(box.h, box.w * 0.95)} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  welcome: { flex: 1, paddingHorizontal: 20 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandMark: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(131,116,240,0.7)", backgroundColor: "rgba(30,24,96,0.55)" },
  brandText: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 2.2, color: colors.onSurface },
  kicker: { marginTop: 12, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.5, color: "rgba(170,166,190,0.9)" },
  gBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ivory, alignItems: "center", justifyContent: "center" },
  gGlyph: { color: "#4263EB", fontFamily: fonts.bold, fontSize: 13, lineHeight: 16 },
  legalLink: { textDecorationLine: "underline", color: "rgba(214,208,230,0.9)" },
  legal: { fontSize: 11.5, lineHeight: 16, color: "rgba(170,166,190,0.75)", marginTop: 2 },
  previewButton: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 7, padding: 4 },
  stepContent: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 24 },
  sub: { marginTop: 12, fontFamily: fonts.body, fontSize: 15.5, lineHeight: 22, color: colors.muted },
  ctaBar: { paddingHorizontal: 22, paddingTop: 10 },
  trust: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 },
  resend: { alignSelf: "center", paddingVertical: 8 },
  emailLinks: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 11, borderRadius: 12, backgroundColor: "rgba(217,121,162,0.1)", borderWidth: 1, borderColor: "rgba(217,121,162,0.3)" },
  noticeBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 11, borderRadius: 12, backgroundColor: "rgba(242,200,121,0.08)", borderWidth: 1, borderColor: "rgba(242,200,121,0.3)" },
  configNote: { color: colors.coralSoft },
}));
