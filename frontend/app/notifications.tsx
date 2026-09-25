import React, { useEffect, useState } from "react";
import { Linking, Platform, Switch, View } from "react-native";
import Animated from "react-native-reanimated";

import { AppText } from "@/src/components/AppText";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { Screen } from "@/src/components/Screen";
import { rise } from "@/src/motion";
import { enableNotifications, getPrefs, updatePrefs, type NotificationPrefs } from "@/src/services/notifications";
import { makeStyles, radii, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

const ROWS: { key: keyof NotificationPrefs; icon: FeatherName; title: string; detail: string }[] = [
  { key: "daily", icon: "sunrise", title: "Morning reading", detail: "7:00 am, with the day's lucky colour and number" },
  { key: "rahu", icon: "hourglass", title: "Rahu Kaal alert", detail: "10 minutes before today's cautious window" },
  { key: "streak", icon: "flame", title: "Streak reminder", detail: "8:00 pm, only on days you haven't opened AstroNow" },
  { key: "moon", icon: "moon", title: "Moon days", detail: "Purnima, Amavasya and Ekadashi mornings" },
];

export default function NotificationSettings() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => { getPrefs().then(({ enabled: on, ...p }) => { setEnabled(on); setPrefs(p); }); }, []);

  const turnOn = async () => {
    const ok = await enableNotifications();
    setEnabled(ok);
    setDenied(!ok);
    if (ok) haptics.success(); else haptics.warning();
  };

  const toggle = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    haptics.selection();
    await updatePrefs(next);
  };

  return (
    <Screen title="Notifications" subtitle="Gentle, useful, never spammy" back>
      {Platform.OS === "web" ? <AppText variant="body" muted style={{ marginTop: 8 }}>Notifications are available in the iOS and Android app.</AppText> : null}
      {!enabled ? (
        <Animated.View entering={rise(0)} style={styles.enable}>
          <Icon name="bell" size={26} color={colors.goldSoft} weight="duotone" />
          <AppText variant="title" style={{ marginTop: 10 }}>Turn on notifications</AppText>
          <AppText variant="body" muted style={{ marginTop: 4 }}>Your reading each morning and a heads-up before Rahu Kaal. You can fine-tune everything below.</AppText>
          <View style={{ marginTop: 14, alignItems: "flex-start" }}>
            <AppText variant="label" style={{ color: colors.goldSoft }} onPress={turnOn} testID="notif-enable">Allow notifications  →</AppText>
          </View>
          {denied ? (
            <AppText variant="caption" style={{ color: colors.coralSoft, marginTop: 10 }} onPress={() => Linking.openSettings()}>
              Notifications are off in your phone settings. Tap to open Settings.
            </AppText>
          ) : null}
        </Animated.View>
      ) : null}
      <View style={[styles.list, !enabled && { opacity: 0.5 }]}>
        {ROWS.map((row, i) => (
          <Animated.View key={row.key} entering={rise(i + 1)} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={styles.icon}><Icon name={row.icon} size={18} color={colors.goldSoft} weight="duotone" /></View>
            <View style={{ flex: 1 }}>
              <AppText variant="subtitle" style={{ fontSize: 15 }}>{row.title}</AppText>
              <AppText variant="caption" muted>{row.detail}</AppText>
            </View>
            <Switch value={!!prefs?.[row.key]} disabled={!enabled} onValueChange={(v) => toggle(row.key, v)}
              trackColor={{ true: colors.coral, false: colors.surfaceTertiary }} thumbColor={colors.ivory} testID={`notif-${row.key}`} />
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  enable: { marginTop: 6, padding: 20, borderRadius: radii.xl, backgroundColor: "rgba(242,200,121,0.07)", borderWidth: 1, borderColor: "rgba(242,200,121,0.25)" },
  list: { marginTop: 16, borderRadius: radii.lg, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(242,200,121,0.1)" },
}));
