// Local, on-device notifications. Nothing here needs a push server, so it works
// in Expo Go and in store builds alike. Each kind is rescheduled idempotently.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { dayRuler, parseClock } from "@/src/content/day-insights";

export type NotificationPrefs = { daily: boolean; rahu: boolean; streak: boolean; moon: boolean };
export const DEFAULT_PREFS: NotificationPrefs = { daily: true, rahu: true, streak: true, moon: true };
const PREFS_KEY = "astronow.notificationPrefs";
const supported = Platform.OS === "ios" || Platform.OS === "android";

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export async function getPrefs(): Promise<NotificationPrefs & { enabled: boolean }> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    return { ...DEFAULT_PREFS, ...(saved?.prefs || {}), enabled: !!saved?.enabled };
  } catch {
    return { ...DEFAULT_PREFS, enabled: false };
  }
}

async function savePrefs(enabled: boolean, prefs: NotificationPrefs) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ enabled, prefs })).catch(() => {});
}

/** Asks the OS for permission. Returns true when notifications may be shown. */
export async function enableNotifications(): Promise<boolean> {
  if (!supported) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("daily", { name: "Daily guidance", importance: Notifications.AndroidImportance.DEFAULT }).catch(() => {});
  }
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  const prefs = await getPrefs();
  await savePrefs(granted, prefs);
  if (granted) await rescheduleDaily(prefs);
  return granted;
}

export async function updatePrefs(next: NotificationPrefs) {
  const { enabled } = await getPrefs();
  await savePrefs(enabled, next);
  if (!enabled || !supported) return;
  await rescheduleDaily(next);
  if (!next.rahu) await cancelPrefix("rahu-");
  if (!next.streak) await cancelPrefix("streak-");
  if (!next.moon) await cancelPrefix("moon-");
}

async function cancelPrefix(prefix: string) {
  const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(all.filter((n) => n.identifier.startsWith(prefix)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
}

async function at(identifier: string, date: Date, title: string, body: string, route: string) {
  if (date.getTime() <= Date.now() + 30 * 1000) return;
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, data: { route } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: "daily" },
  }).catch(() => {});
}

/** Morning reading for the next seven days, each naming that day's ruler. */
async function rescheduleDaily(prefs: NotificationPrefs) {
  await cancelPrefix("daily-");
  if (!prefs.daily) return;
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 7, 0, 0);
    const r = dayRuler(d);
    const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
    await at(`daily-${d.toDateString()}`, d, `Your ${weekday} reading is ready`,
      `${r.planet} rules today. Wear ${r.colorName}, lucky number ${r.number}. See what the day holds.`, "/daily");
  }
}

/** Call on every app open with today's Panchang and streak. */
export async function syncDailyNotifications(opts: { rahu?: { start?: string; end?: string }; streakDays?: number }) {
  if (!supported) return;
  const prefs = await getPrefs();
  if (!prefs.enabled) return;
  const now = new Date();
  if (prefs.daily) await rescheduleDaily(prefs);
  if (prefs.rahu && opts.rahu?.start) {
    const start = parseClock(opts.rahu.start);
    if (start != null) {
      const when = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor((start - 10) / 60), (start - 10) % 60);
      await cancelPrefix("rahu-");
      await at(`rahu-${now.toDateString()}`, when, "Rahu Kaal starts in 10 minutes",
        `A traditionally cautious window from ${opts.rahu.start} to ${opts.rahu.end}. Hold big decisions until it passes.`, "/(tabs)/today");
    }
  }
  if (prefs.streak) {
    // Opening today moves the reminder to tomorrow, so it only fires on a missed day.
    await cancelPrefix("streak-");
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 20, 0, 0);
    const days = opts.streakDays || 1;
    await at(`streak-${tomorrow.toDateString()}`, tomorrow, days > 1 ? `Keep your ${days}-day streak going` : "Your stars checked in today",
      "Your daily reading and today's mantra are waiting. Two minutes is enough.", "/(tabs)/today");
  }
}

/** Moon days (Purnima, Amavasya, Ekadashi) from the moon calendar. */
export async function scheduleMoonDays(days: { date: string; events: string[] }[]) {
  if (!supported) return;
  const prefs = await getPrefs();
  if (!prefs.enabled || !prefs.moon) return;
  await cancelPrefix("moon-");
  for (const d of days) {
    const main = d.events.find((e) => /Purnima|Amavasya|Ekadashi/.test(e));
    if (!main) continue;
    const [y, m, day] = d.date.split("-").map(Number);
    await at(`moon-${d.date}`, new Date(y, m - 1, day, 6, 30), main.split(" · ")[0] + " today",
      `${main}. See the moon calendar and today's guidance.`, "/moon");
  }
}

export function onNotificationOpen(handler: (route: string) => void) {
  if (!supported) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const route = response.notification.request.content.data?.route;
    if (typeof route === "string") handler(route);
  });
  return () => sub.remove();
}
