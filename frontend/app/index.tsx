import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { isPreviewSession } from "@/src/api/preview";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { useAiConsentAsked } from "@/src/services/ai-consent";
import { useAuth } from "@/src/store/auth";
import { useTheme } from "@/src/theme";

export default function Index() {
  const { ready, authed, onboarded, user, profile } = useAuth();
  const { colors } = useTheme();
  const consentAsked = useAiConsentAsked();
  const needsConsentQuestion = !isPreviewSession() && !!profile && !profile.ai_consent_at;

  if (!ready || (authed && onboarded && needsConsentQuestion && consentAsked === null)) {
    return (
      <View style={{ flex: 1 }}>
        <CosmicBackground>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.gold} />
          </View>
        </CosmicBackground>
      </View>
    );
  }
  if (!authed) return <Redirect href="/auth" />;
  // Every account confirms one mobile number (unique), so nobody ends up with two accounts.
  if (user && !user.phone_verified && !isPreviewSession()) return <Redirect href="/verify-phone" />;
  if (!onboarded) return <Redirect href="/onboarding" />;
  // Ask before any personal data goes to the AI provider (App Store 5.1.1/5.1.2).
  if (needsConsentQuestion && !consentAsked) return <Redirect href={"/ai-consent?next=today" as any} />;
  return <Redirect href="/(tabs)/today" />;
}
