import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { Icon } from "@/src/components/Icon";
import { TextField } from "@/src/components/TextField";
import { useAuth } from "@/src/store/auth";
import { makeStyles, useTheme } from "@/src/theme";

export default function AuthScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signup, login } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") await signup(email.trim(), password, firstName.trim() || undefined);
      else await login(email.trim(), password);
      router.replace("/");
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <CosmicBackground>
        <KeyboardAwareScrollView
          bottomOffset={24}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandMark}>
            <Icon name="moon" size={30} color={colors.gold} />
          </View>
          <AppText variant="display" center style={{ color: colors.gold }}>
            Cosmic Clarity
          </AppText>
          <AppText variant="body" muted center style={{ marginTop: 6, marginBottom: 32 }}>
            Your personal Vedic astrology guide,{"\n"}available whenever you need clarity.
          </AppText>

          <View style={styles.toggle}>
            {(["signup", "signin"] as const).map((m) => (
              <Button
                key={m}
                label={m === "signup" ? "Create account" : "Sign in"}
                variant={mode === m ? "primary" : "ghost"}
                full={false}
                onPress={() => setMode(m)}
                testID={`auth-toggle-${m}`}
                style={{ flex: 1 }}
              />
            ))}
          </View>

          <View style={{ gap: 14, marginTop: 24 }}>
            {mode === "signup" ? (
              <TextField
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Maya"
                autoCapitalize="words"
                testID="auth-firstname"
              />
            ) : null}
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              testID="auth-email"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              testID="auth-password"
            />
          </View>

          {error ? (
            <AppText variant="caption" center style={{ color: colors.gold, marginTop: 16 }} testID="auth-error">
              {error}
            </AppText>
          ) : null}

          <Button
            label={mode === "signup" ? "Begin your journey" : "Welcome back"}
            onPress={submit}
            loading={loading}
            icon="arrow-right"
            testID="auth-submit"
            style={{ marginTop: 24 }}
          />
          <AppText variant="caption" muted center style={{ marginTop: 20 }}>
            By continuing you agree to our Terms and acknowledge our Privacy Policy.
            Astrology is offered for reflection, not as professional advice.
          </AppText>
        </KeyboardAwareScrollView>
      </CosmicBackground>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  content: { paddingHorizontal: 24 },
  brandMark: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: 18,
  },
  toggle: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 999,
    padding: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
}));
