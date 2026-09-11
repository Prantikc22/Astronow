import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, View } from "react-native";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { GlassCard } from "@/src/components/GlassCard";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { Screen } from "@/src/components/Screen";
import { useAuth } from "@/src/store/auth";
import { makeStyles, radii, useTheme } from "@/src/theme";

const TERM_LABELS: Record<string, string> = { simple: "Simple English", traditional: "Traditional", both: "Both" };
const TERM_CYCLE = ["simple", "traditional", "both"];

export default function You() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, profile, entitlement, logout, refresh } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const cycleTerm = async () => {
    const cur = profile?.terminology_mode || "both";
    const next = TERM_CYCLE[(TERM_CYCLE.indexOf(cur) + 1) % 3];
    await api.patch("/profile", { terminology_mode: next });
    await refresh();
    qc.invalidateQueries({ queryKey: ["terms"] });
  };

  const restore = async () => {
    await api.get("/entitlement").catch(() => {});
    await refresh();
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await api.del("/account");
      await logout();
      router.replace("/auth");
    } finally {
      setBusy(false);
    }
  };

  const rows: { icon: FeatherName; label: string; value?: string; onPress?: () => void; danger?: boolean }[] = [
    { icon: "book-open", label: "Astrology terminology", value: TERM_LABELS[profile?.terminology_mode || "both"], onPress: cycleTerm },
    { icon: "globe", label: "Language", value: "English" },
    { icon: "bell", label: "Notifications", value: "Manage" },
    { icon: "refresh-cw", label: "Restore purchases", onPress: restore },
    { icon: "shield", label: "Privacy & data controls" },
    { icon: "file-text", label: "Terms & disclaimers" },
  ];

  return (
    <Screen title="You" subtitle={user?.email || ""}>
      <GlassCard testID="you-profile" style={{ marginTop: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={styles.avatar}>
            <AppText variant="title" style={{ color: colors.gold }}>
              {(profile?.first_name || "?").charAt(0).toUpperCase()}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="subtitle">{profile?.first_name || "Traveller"}</AppText>
            <AppText variant="caption" muted>{profile?.birthplace || "Birth details saved"}</AppText>
          </View>
          <Pressable onPress={() => router.push("/chart")} testID="you-viewchart">
            <Icon name="target" size={22} color={colors.gold} />
          </Pressable>
        </View>
      </GlassCard>

      {/* Subscription */}
      <Pressable onPress={() => !entitlement.premium && router.push("/paywall")} testID="you-subscription">
        <GlassCard style={[styles.subCard, entitlement.premium && { borderColor: colors.gold }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Icon name={entitlement.premium ? "award" : "star"} size={24} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <AppText variant="subtitle">
                {entitlement.premium ? "Cosmic Clarity Premium" : "Unlock Premium"}
              </AppText>
              <AppText variant="caption" muted>
                {entitlement.premium
                  ? `Active · ${entitlement.tier.replace("_", " ")}`
                  : "Ongoing guidance, full chart, Vastu & more"}
              </AppText>
            </View>
            {!entitlement.premium ? <Icon name="chevron-right" size={20} color={colors.muted} /> : null}
          </View>
        </GlassCard>
      </Pressable>

      <View style={styles.rows}>
        {rows.map((r, i) => (
          <Pressable key={r.label} onPress={r.onPress} style={[styles.row, i > 0 && styles.rowBorder]} testID={`you-row-${i}`}>
            <Icon name={r.icon} size={18} color={colors.muted} />
            <AppText variant="body" style={{ flex: 1 }}>{r.label}</AppText>
            {r.value ? <AppText variant="caption" style={{ color: colors.gold }}>{r.value}</AppText> : null}
            <Icon name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button label="Sign out" variant="secondary" icon="log-out"
          onPress={async () => { await logout(); router.replace("/auth"); }} testID="you-logout" />
        {confirmDelete ? (
          <Button label="Tap again to permanently delete" variant="ghost" loading={busy}
            onPress={doDelete} testID="you-delete-confirm" style={{ borderWidth: 1, borderColor: colors.error }} />
        ) : (
          <Pressable onPress={() => setConfirmDelete(true)} style={{ alignItems: "center", paddingVertical: 12 }} testID="you-delete">
            <AppText variant="caption" muted>Delete my account</AppText>
          </Pressable>
        )}
      </View>

      <AppText variant="caption" muted center style={{ marginTop: 20 }}>
        Cosmic Clarity offers astrology for reflection and self-understanding. It is not a
        substitute for professional medical, legal, or financial advice.
      </AppText>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  avatar: {
    width: 56, height: 56, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.glassBorder,
  },
  subCard: { marginTop: 16, borderColor: colors.glassBorder },
  rows: { marginTop: 20, backgroundColor: colors.surfaceSecondary, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
}));
