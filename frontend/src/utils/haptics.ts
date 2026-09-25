import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const quiet = (job: Promise<void>) => job.catch(() => {});
const enabled = Platform.OS === "ios" || Platform.OS === "android";
const later = (ms: number, fn: () => void) => setTimeout(fn, ms);

export const haptics = {
  selection: () => { if (enabled) quiet(Haptics.selectionAsync()); },
  light: () => { if (enabled) quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); },
  soft: () => { if (enabled) quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)); },
  medium: () => { if (enabled) quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)); },
  rigid: () => { if (enabled) quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)); },
  heavy: () => { if (enabled) quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)); },
  success: () => { if (enabled) quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)); },
  warning: () => { if (enabled) quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)); },
  error: () => { if (enabled) quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)); },
  /** A rising three-beat pattern for moments worth celebrating. */
  celebrate: () => {
    if (!enabled) return;
    quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
    later(90, () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)));
    later(200, () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)));
  },
  /** A soft double pulse for reveals (scores, cards turning over). */
  reveal: () => {
    if (!enabled) return;
    quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
    later(120, () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)));
  },
};

export type HapticName = keyof typeof haptics;
