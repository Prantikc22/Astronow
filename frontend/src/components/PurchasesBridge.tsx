import { useEffect } from "react";

import { configurePurchases } from "@/src/services/purchases";
import { useAuth } from "@/src/store/auth";

export function PurchasesBridge() {
  const { ready, user } = useAuth();
  useEffect(() => {
    if (ready) configurePurchases(user?.id).catch(() => {});
  }, [ready, user?.id]);
  return null;
}
