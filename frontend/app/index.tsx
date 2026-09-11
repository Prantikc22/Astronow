import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { CosmicBackground } from "@/src/components/CosmicBackground";
import { useAuth } from "@/src/store/auth";
import { useTheme } from "@/src/theme";

export default function Index() {
  const { ready, authed, onboarded } = useAuth();
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
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/today" />;
}
