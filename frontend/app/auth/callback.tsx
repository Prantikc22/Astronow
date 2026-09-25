import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";

import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { Screen } from "@/src/components/Screen";
import { completeGoogleSignIn } from "@/src/services/google-auth";

export default function GoogleAuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    completeGoogleSignIn(window.location.href)
      .then(() => router.replace("/"))
      .catch((cause) => setError(cause?.message || "Google sign-in did not finish. Please try again."));
  }, [router]);

  return <Screen title="Signing you in" subtitle="Completing Google sign-in">
    <View style={{ marginTop: 24, gap: 16 }}>
      <AppText variant="body" muted>{error || "Checking your secure session…"}</AppText>
      {error ? <Button label="Back to sign in" variant="secondary" onPress={() => router.replace("/auth")} /> : null}
    </View>
  </Screen>;
}
