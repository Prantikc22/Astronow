import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "astronow.streak.v1";

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** Records today's visit and returns the consecutive-day count (local only). */
export function useVisitStreak() {
  const [streak, setStreak] = useState<{ days: number; isNew: boolean } | null>(null);
  useEffect(() => {
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    AsyncStorage.getItem(KEY).then((raw) => {
      const saved = raw ? JSON.parse(raw) as { last: string; days: number } : null;
      let days = 1;
      let isNew = true;
      if (saved?.last === dayKey(today)) { days = saved.days; isNew = false; }
      else if (saved?.last === dayKey(yesterday)) days = saved.days + 1;
      setStreak({ days, isNew });
      if (isNew) AsyncStorage.setItem(KEY, JSON.stringify({ last: dayKey(today), days })).catch(() => {});
    }).catch(() => setStreak({ days: 1, isNew: false }));
  }, []);
  return streak;
}
