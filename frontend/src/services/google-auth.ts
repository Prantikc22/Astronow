import * as Linking from "expo-linking";
import { Platform } from "react-native";

import { requireSupabase } from "@/src/services/supabase";

export function googleRedirectUrl(): string {
  if (Platform.OS === "web") return Linking.createURL("auth/callback");
  return "astronow://auth/callback";
}

export async function completeGoogleSignIn(url: string) {
  const client = requireSupabase();
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const error = query.get("error_description") || hash.get("error_description") || query.get("error") || hash.get("error");
  if (error) throw new Error(decodeURIComponent(error.replace(/\+/g, " ")));

  const code = query.get("code") || hash.get("code");
  if (code) {
    const result = await client.auth.exchangeCodeForSession(code);
    if (result.error) throw result.error;
    if (!result.data.session) throw new Error("Google did not return a session. Please try again.");
    return result.data.session;
  }

  const accessToken = hash.get("access_token") || query.get("access_token");
  const refreshToken = hash.get("refresh_token") || query.get("refresh_token");
  if (!accessToken || !refreshToken) throw new Error("Google sign-in did not finish. Please try again.");
  const result = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (result.error) throw result.error;
  if (!result.data.session) throw new Error("Google did not return a session. Please try again.");
  return result.data.session;
}
