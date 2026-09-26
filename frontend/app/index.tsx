import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { isPreviewSession } from "@/src/api/preview";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { useAuth } from "@/src/store/auth";
import { useTheme } from "@/src/theme";

export default function Index() {
  const { ready, authed, onboarded, user } = useAuth();
  const { colors } = useTheme();

  if (!ready) {
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
  return <Redirect href="/(tabs)/today" />;
}
