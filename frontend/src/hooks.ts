import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/store/auth";

export function useAppConfig() {
  return useQuery({ queryKey: ["config"], queryFn: () => api.get("/config"), staleTime: 60_000 });
}

export function useTerms() {
  const { profile } = useAuth();
  const mode = profile?.terminology_mode || "both";
  const q = useQuery({
    queryKey: ["terms", mode],
    queryFn: () => api.get(`/terminology?mode=${mode}`),
    staleTime: 300_000,
  });
  const terms = q.data?.terms || {};
  const t = (key: string, fallback?: string) => terms[key] || fallback || key;
  return { t, mode, terms };
}
