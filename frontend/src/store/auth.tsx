import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, loadStoredToken, REFRESH_KEY, setAccessToken, TOKEN_KEY } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

type Entitlement = { tier: string; premium: boolean; source?: string };
type Profile = any;

type AuthState = {
  ready: boolean;
  authed: boolean;
  onboarded: boolean;
  user: { id: string; email?: string } | null;
  profile: Profile | null;
  entitlement: Entitlement;
  signup: (email: string, password: string, firstName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setProfileLocal: (p: Profile) => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [user, setUser] = useState<AuthState["user"]>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement>({ tier: "free", premium: false });

  const fetchMe = useCallback(async () => {
    try {
      const me = await api.get("/auth/me");
      setUser(me.user);
      setProfile(me.profile);
      setOnboarded(!!me.onboarded);
      setEntitlement(me.entitlement ?? { tier: "free", premium: false });
      setAuthed(true);
    } catch {
      setAuthed(false);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const t = await loadStoredToken();
      if (t) await fetchMe();
      setReady(true);
    })();
  }, [fetchMe]);

  const persistSession = useCallback(async (session: any) => {
    setAccessToken(session.access_token);
    await storage.secureSet(TOKEN_KEY, session.access_token);
    if (session.refresh_token) await storage.secureSet(REFRESH_KEY, session.refresh_token);
  }, []);

  const signup = useCallback(async (email: string, password: string, firstName?: string) => {
    const session = await api.post("/auth/signup", { email, password, first_name: firstName }, false);
    await persistSession(session);
    await fetchMe();
  }, [fetchMe, persistSession]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api.post("/auth/login", { email, password }, false);
    await persistSession(session);
    await fetchMe();
  }, [fetchMe, persistSession]);

  const logout = useCallback(async () => {
    setAccessToken(null);
    await storage.secureRemove(TOKEN_KEY);
    await storage.secureRemove(REFRESH_KEY);
    setAuthed(false);
    setUser(null);
    setProfile(null);
    setOnboarded(false);
    setEntitlement({ tier: "free", premium: false });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ready, authed, onboarded, user, profile, entitlement,
        signup, login, logout, refresh: fetchMe, setProfileLocal: setProfile,
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
