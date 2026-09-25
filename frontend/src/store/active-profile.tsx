import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/store/auth";

export type FamilyMember = {
  id: string; name: string; relation?: string | null; dob?: string; birthplace?: string | null;
  moon_sign?: string | null; sun_sign?: string | null; lagna?: string | null;
};

type Ctx = {
  members: FamilyMember[];
  limit: number;
  /** null = the account holder. */
  active: FamilyMember | null;
  setActive: (id: string | null) => void;
  refetch: () => void;
};

const ActiveProfileContext = createContext<Ctx>({ members: [], limit: 1, active: null, setActive: () => {}, refetch: () => {} });
const KEY = "astronow.activeProfile";

export function ActiveProfileProvider({ children }: { children: React.ReactNode }) {
  const { authed, onboarded } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data, refetch } = useQuery({
    queryKey: ["family"], queryFn: () => api.get("/family"), enabled: !!authed && !!onboarded, staleTime: 5 * 60 * 1000, retry: false,
  });
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => setActiveId(v || null)).catch(() => {}); }, []);
  const members: FamilyMember[] = useMemo(() => data?.members || [], [data]);
  const active = members.find((m) => m.id === activeId) || null;
  const setActive = useCallback((id: string | null) => {
    setActiveId(id);
    if (id) AsyncStorage.setItem(KEY, id).catch(() => {}); else AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);
  const value = useMemo(() => ({ members, limit: data?.limit ?? 1, active, setActive, refetch }), [members, data?.limit, active, setActive, refetch]);
  return <ActiveProfileContext.Provider value={value}>{children}</ActiveProfileContext.Provider>;
}

export function useActiveProfile() {
  return useContext(ActiveProfileContext);
}

/** The /today endpoint for whoever is active. */
export function todayPath(active: FamilyMember | null, day?: string) {
  const base = active ? `/family/${active.id}/today` : "/today";
  return day ? `${base}?day=${day}` : base;
}
