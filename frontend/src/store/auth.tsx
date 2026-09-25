import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { api, setAccessToken } from "@/src/api/client";
import { getPreviewProfile, isPreviewMode, isPreviewSession, setPreviewSession } from "@/src/api/preview";
import { queryClient } from "@/src/query-client";
import { completeGoogleSignIn, googleRedirectUrl } from "@/src/services/google-auth";
import { requireSupabase, supabase, supabaseConfigured } from "@/src/services/supabase";
import { haptics } from "@/src/utils/haptics";

type Entitlement = { tier: string; premium: boolean; source?: string };
type Profile = any;

type AuthState = {
  ready: boolean;
  authed: boolean;
  onboarded: boolean;
  user: { id: string; email?: string } | null;
  profile: Profile | null;
  entitlement: Entitlement;
  signup: (email: string, password: string, firstName?: string) => Promise<{ needsEmailConfirmation: boolean }>;
  login: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  enterPreview: () => void;
  authConfigured: boolean;
  refresh: () => Promise<boolean>;
  setProfileLocal: (p: Profile) => void;
};

function sessionFirstName(sessionUser?: { email?: string; user_metadata?: any }) {
  const metadata = sessionUser?.user_metadata || {};
  const supplied = metadata.first_name || metadata.full_name || metadata.name;
  if (typeof supplied === "string" && supplied.trim()) return supplied.trim().split(/\s+/)[0];
  const emailName = sessionUser?.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (!emailName) return "friend";
  return emailName.charAt(0).toUpperCase() + emailName.slice(1);
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!supabase);
  const [authed, setAuthed] = useState(isPreviewSession());
  const [onboarded, setOnboarded] = useState(isPreviewSession());
  const [user, setUser] = useState<AuthState["user"]>(isPreviewSession() ? { id: "preview-user", email: "preview@astronow.app" } : null);
  const [profile, setProfile] = useState<Profile | null>(isPreviewSession() ? getPreviewProfile() : null);
  const [entitlement, setEntitlement] = useState<Entitlement>({ tier: "free", premium: false });

  const fetchMe = useCallback(async (sessionUser?: { id: string; email?: string; user_metadata?: any }) => {
    if (isPreviewSession()) {
      const previewProfile = getPreviewProfile();
      // Preview data may fill missing chart content, but it must never replace a
      // real signed-in person's identity with the demo name.
      const firstName = sessionUser ? sessionFirstName(sessionUser) : previewProfile.first_name;
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email } : { id: "preview-user", email: "preview@astronow.app" });
      setProfile({ ...previewProfile, first_name: firstName });
      setOnboarded(true);
      setEntitlement({ tier: "free", premium: false, source: "preview" });
      setAuthed(true);
      return true;
    }
    try {
      const me = await api.get("/auth/me");
      setUser(me.user);
      setProfile(me.profile ? { ...me.profile, first_name: me.profile.first_name || sessionFirstName(sessionUser || me.user) } : null);
      setOnboarded(!!me.onboarded);
      setEntitlement(me.entitlement ?? { tier: "free", premium: false });
      setAuthed(true);
      return true;
    } catch {
      setAuthed(false);
      setUser(null);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const session = data.session;
      setAccessToken(session?.access_token || null);
      if (session) await fetchMe(session.user);
      else if (isPreviewSession()) await fetchMe();
      else setAuthed(false);
      if (active) setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token || null);
      if (session) fetchMe(session.user);
      else if (isPreviewSession()) fetchMe();
      else {
        setAuthed(false);
        setUser(null);
        setProfile(null);
        setOnboarded(false);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchMe]);

  const signup = useCallback(async (email: string, password: string, firstName?: string) => {
    setPreviewSession(false);
    queryClient.clear();
    const client = requireSupabase();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName || "" } },
    });
    if (error) throw error;
    if (data.session) {
      setAccessToken(data.session.access_token);
      const synced = await fetchMe(data.user || undefined);
      if (!synced) throw new Error("Your account was created, but AstroNow could not load it. Please check your connection and try signing in.");
      haptics.success();
    }
    return { needsEmailConfirmation: !data.session };
  }, [fetchMe]);

  const login = useCallback(async (email: string, password: string) => {
    setPreviewSession(false);
    queryClient.clear();
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error("No session was returned. Please verify your email and try again.");
    setAccessToken(data.session.access_token);
    const synced = await fetchMe(data.user);
    if (!synced) throw new Error("You are signed in, but AstroNow could not load your account. Please check your connection and try again.");
    haptics.success();
  }, [fetchMe]);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    if (process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED !== "1") {
      throw new Error("Google sign-in is being set up. Please use email for now.");
    }
    if (Platform.OS !== "web" && Constants.appOwnership === "expo") {
      throw new Error("Google sign-in needs an AstroNow development build. Expo Go cannot return from the Google sign-in page.");
    }
    setPreviewSession(false);
    queryClient.clear();
    const client = requireSupabase();
    const redirectTo = googleRedirectUrl();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: Platform.OS !== "web", scopes: "email profile" },
    });
    if (error) throw error;
    if (Platform.OS === "web") return false; // The browser navigates to the callback route.
    if (!data.url) throw new Error("Google sign-in is not available yet. Please try email sign-in.");
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === "cancel" || result.type === "dismiss") return false;
    if (result.type !== "success") throw new Error("Google sign-in did not finish. Please try again.");
    const session = await completeGoogleSignIn(result.url);
    setAccessToken(session.access_token);
    const synced = await fetchMe(session.user);
    if (!synced) throw new Error("Google sign-in finished, but AstroNow could not load your account. Please try again.");
    haptics.success();
    return true;
  }, [fetchMe]);

  const logout = useCallback(async () => {
    setPreviewSession(false);
    queryClient.clear();
    if (supabase) await supabase.auth.signOut();
    setAccessToken(null);
    setAuthed(false);
    setUser(null);
    setProfile(null);
    setOnboarded(false);
    setEntitlement({ tier: "free", premium: false });
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const client = requireSupabase();
    const { error } = await client.auth.resetPasswordForEmail(email);
    if (error) throw error;
    haptics.success();
  }, []);

  const enterPreview = useCallback(() => {
    if (!isPreviewMode()) return;
    setPreviewSession(true);
    queryClient.clear();
    const previewProfile = getPreviewProfile();
    setUser({ id: "preview-user", email: "preview@astronow.app" });
    setProfile(previewProfile);
    setOnboarded(true);
    setEntitlement({ tier: "free", premium: false, source: "preview" });
    setAuthed(true);
    haptics.selection();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ready, authed, onboarded, user, profile, entitlement,
        signup, login, signInWithGoogle, logout, requestPasswordReset, enterPreview, authConfigured: supabaseConfigured,
        refresh: () => fetchMe(user || undefined), setProfileLocal: setProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
