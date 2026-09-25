import { useFonts } from "expo-font";
import { Fraunces_500Medium, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { NunitoSans_400Regular, NunitoSans_600SemiBold, NunitoSans_700Bold } from "@expo-google-fonts/nunito-sans";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AnimatedSplash } from "@/src/components/AnimatedSplash";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { PurchasesBridge } from "@/src/components/PurchasesBridge";
import { AuthProvider, useAuth } from "@/src/store/auth";
import { I18nProvider } from "@/src/i18n";
import { queryClient } from "@/src/query-client";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded] = useFonts({
    "Fraunces-Medium": Fraunces_500Medium,
    "Fraunces-SemiBold": Fraunces_600SemiBold,
    "NunitoSans-Regular": NunitoSans_400Regular,
    "NunitoSans-SemiBold": NunitoSans_600SemiBold,
    "NunitoSans-Bold": NunitoSans_700Bold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: "#0B0B1A" }} />;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0B0B1A" }}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider><LocalizedApp /></AuthProvider>
            </QueryClientProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function LocalizedApp() {
  const { profile, ready } = useAuth();
  const [splash, setSplash] = useState(true);
  return <I18nProvider language={profile?.language || "en"}>
    <PurchasesBridge />
    <StatusBar style="light" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0B0B1A" }, animation: "fade_from_bottom", animationDuration: 260 }}>
      <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
    </Stack>
    {splash ? <AnimatedSplash ready={ready} onDone={() => setSplash(false)} /> : null}
  </I18nProvider>;
}
