import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { GlassCard } from "@/src/components/GlassCard";
import { EditorialFooter } from "@/src/components/EditorialFooter";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { READING_LANGUAGES, readingLanguageName } from "@/src/content/languages";
import { Screen } from "@/src/components/Screen";
import { Shine } from "@/src/components/Shine";
import { pop, rise } from "@/src/motion";
import { useVisitStreak } from "@/src/store/streak";
import { useAuth } from "@/src/store/auth";
import { hasActiveEntitlement, restorePurchases as restoreStorePurchases } from "@/src/services/purchases";
import { makeStyles, radii, useTheme } from "@/src/theme";

const TERM_LABELS: Record<string, string> = { simple: "Plain language", traditional: "Traditional", both: "Both" };
const TERM_OPTIONS = [
  { id: "simple", title: "Plain language", detail: "Birth chart, birth star, major life period" },
  { id: "traditional", title: "Traditional terms", detail: "Kundli, Nakshatra, Mahadasha" },
  { id: "both", title: "Both", detail: "Birth chart · Kundli" },
];

function Stat({ icon, color, value, label }: { icon: FeatherName; color: string; value: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={18} color={color} weight="fill" />
      <AppText variant="subtitle" numberOfLines={1} style={{ marginTop: 6, fontSize: 16 }}>{value}</AppText>
      <AppText variant="caption" muted>{label}</AppText>
    </View>
  );
}

export default function You() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, profile, entitlement, logout, refresh, setProfileLocal } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [picker, setPicker] = useState<"terms" | "language" | null>(null);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const { data: chart } = useQuery({ queryKey: ["chart"], queryFn: () => api.get("/chart"), retry: false, staleTime: 60 * 60 * 1000 });
  const streak = useVisitStreak();
  const { data: birthProfile } = useQuery({ queryKey: ["birth-profile", user?.id], queryFn: () => api.get("/birth-profile"), retry: false });

  const savePreference = async (value: string) => {
    if (!picker || preferenceBusy) return;
    const preference = picker;
    const previousProfile = profile;
    setPreferenceBusy(true);
    setPreferenceError(null);
    setProfileLocal({ ...profile, [preference === "terms" ? "terminology_mode" : "language"]: value });
    setPicker(null);
    try {
      const updated = await api.patch("/profile", preference === "terms" ? { terminology_mode: value } : { language: value });
      setProfileLocal(updated);
      if (preference === "terms") qc.invalidateQueries({ queryKey: ["terms"] });
      else qc.invalidateQueries({ queryKey: ["today"] });
    } catch {
      setProfileLocal(previousProfile);
      setPreferenceError("Could not save this preference. Please try again.");
      setPicker(preference);
    } finally {
      setPreferenceBusy(false);
    }
  };

  const restore = async () => {
    try {
      setPurchaseMessage(null);
      const info = await restoreStorePurchases(user?.id);
      if (hasActiveEntitlement(info)) {
        await api.post("/entitlement/sync", { rc_customer_id: user?.id });
        setPurchaseMessage("Your membership has been restored.");
      } else {
        setPurchaseMessage("No active membership was found for this store account.");
      }
      await refresh();
    } catch {
      setPurchaseMessage("Store purchases are not available in this preview build.");
    }
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
    { icon: "lock", label: "Birth details", value: birthProfile?.changes_remaining > 0 ? "1 correction left" : "Locked", onPress: birthProfile?.changes_remaining > 0 ? () => router.push("/onboarding?mode=correction" as any) : undefined },
    { icon: "book-open", label: "Astrology terminology", value: TERM_LABELS[profile?.terminology_mode || "both"], onPress: () => setPicker("terms") },
    { icon: "globe", label: "Reading language", value: readingLanguageName(profile?.language), onPress: () => setPicker("language") },
    { icon: "refresh-cw", label: "Restore purchases", onPress: restore },
  ];

  return (
    <Screen>
      <Animated.View entering={rise(0)}>
        <AppText variant="label" style={{ color: colors.coralSoft, letterSpacing: 1.3 }}>PROFILE</AppText>
        <AppText variant="display" style={{ marginTop: 4 }}>Your space</AppText>
      </Animated.View>

      <Animated.View entering={rise(1)}>
        <LinearGradient colors={["#2B1840", "#1D1838", "#15122E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero} testID="you-profile">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <LinearGradient colors={[colors.goldSoft, colors.coral]} style={styles.avatarRing}>
              <View style={styles.avatar}><AppText variant="title" style={{ color: colors.goldSoft }}>{(profile?.first_name || "?").charAt(0).toUpperCase()}</AppText></View>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <AppText variant="title">{profile?.first_name || "Traveller"}</AppText>
              <AppText variant="caption" muted numberOfLines={1}>{user?.email || "Your private space"}</AppText>
              {profile?.birthplace ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}><Icon name="map-pin" size={12} color={colors.muted} /><AppText variant="caption" muted numberOfLines={1}>{profile.birthplace}</AppText></View> : null}
            </View>
          </View>
          <View style={styles.signs}>
            {([["moon", "Moon", chart?.chart?.moon_sign], ["sun", "Sun", chart?.chart?.sun_sign], ["arrow-up", "Rising", chart?.chart?.lagna?.sign]] as [string, string, string | undefined][]).map(([icon, label, sign], i) => (
              <Animated.View key={label} entering={pop(i + 2)} style={styles.sign}>
                <Icon name={icon} size={16} color={colors.goldSoft} weight="duotone" />
                <View>
                  <AppText variant="caption" muted style={{ fontSize: 10, lineHeight: 12 }}>{label}</AppText>
                  <AppText variant="label" style={{ fontSize: 13 }}>{sign || "—"}</AppText>
                </View>
              </Animated.View>
            ))}
          </View>
          <MotionPressable onPress={() => router.push("/chart")} style={styles.chartBtn} testID="you-viewchart" haptic="light">
            <Icon name="target" size={16} color={colors.onSurface} />
            <AppText variant="label" style={{ fontSize: 14 }}>View my birth chart (Kundli)</AppText>
            <Icon name="arrow-right" size={15} color={colors.onSurface} />
          </MotionPressable>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={rise(2)} style={styles.stats}>
        <Stat icon="flame" color="#F29B38" value={streak ? String(streak.days) : "—"} label={streak?.days === 1 ? "day streak" : "day streak"} />
        <Stat icon="crown" color={colors.goldSoft} value={entitlement.premium ? "Plus" : "Free"} label="plan" />
        <Stat icon="hourglass" color={colors.violet} value={chart?.chart?.moon_nakshatra || "—"} label="birth star" />
      </Animated.View>

      <Animated.View entering={rise(3)}>
        <MotionPressable onPress={() => !entitlement.premium && router.push("/paywall")} testID="you-subscription" pressScale={0.985} haptic={entitlement.premium ? "none" : "medium"}>
          <LinearGradient colors={entitlement.premium ? ["#3A2A12", "#211C3F"] : ["#4A1C45", "#2A1640"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.plan}>
            <LinearGradient colors={[colors.goldSoft, colors.gold]} style={styles.planIcon}><Icon name="crown" size={20} color={colors.ink} weight="fill" /></LinearGradient>
            <View style={{ flex: 1 }}>
              <AppText variant="subtitle">{entitlement.premium ? "AstroNow Plus" : "Upgrade to AstroNow Plus"}</AppText>
              <AppText variant="caption" muted>{entitlement.premium ? `Active · ${entitlement.tier.replace("_", " ")}` : "All reports, 40 questions a day, every tool"}</AppText>
            </View>
            {!entitlement.premium ? <Icon name="arrow-right" size={18} color={colors.goldSoft} /> : <Icon name="check-circle" size={20} color={colors.goldSoft} weight="fill" />}
            {!entitlement.premium ? <Shine every={3400} opacity={0.18} /> : null}
          </LinearGradient>
        </MotionPressable>
      </Animated.View>

      <View style={styles.rows}>
        {rows.map((r, i) => (
          <MotionPressable key={r.label} onPress={r.onPress} style={[styles.row, i > 0 && styles.rowBorder]} testID={`you-row-${i}`}>
            <Icon name={r.icon} size={18} color={colors.muted} />
            <AppText variant="body" style={{ flex: 1 }}>{r.label}</AppText>
            {r.value ? <AppText variant="caption" style={{ color: colors.gold }}>{r.value}</AppText> : null}
            <Icon name="chevron-right" size={18} color={colors.muted} />
          </MotionPressable>
        ))}
      </View>
      <AppText variant="caption" muted style={{ marginTop: 9, paddingHorizontal: 4 }}>Reports stay tied to this birth chart. One correction is included; after that, support verification is required.</AppText>
      {purchaseMessage ? <AppText variant="caption" style={{ color: colors.teal, marginTop: 10 }}>{purchaseMessage}</AppText> : null}

      <GlassCard style={{ marginTop: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Icon name="shield" size={20} color={colors.teal} />
          <AppText variant="subtitle">Your story stays yours</AppText>
        </View>
        <AppText variant="caption" muted style={{ marginTop: 8, lineHeight: 19 }}>
          Your saved details are scoped to your account. Tara sends relevant chart facts and questions to our AI provider for responses. You can delete your account below.
        </AppText>
      </GlassCard>

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button label="Sign out" variant="secondary" icon="log-out"
          onPress={async () => { await logout(); router.replace("/auth"); }} testID="you-logout" />
        {confirmDelete ? (
          <Button label="Tap again to permanently delete" variant="ghost" loading={busy}
            onPress={doDelete} testID="you-delete-confirm" style={{ borderWidth: 1, borderColor: colors.error }} />
        ) : (
          <MotionPressable onPress={() => setConfirmDelete(true)} style={{ alignItems: "center", paddingVertical: 12 }} testID="you-delete" haptic="warning">
            <AppText variant="caption" muted>Delete my account</AppText>
          </MotionPressable>
        )}
      </View>

      <AppText variant="caption" muted center style={{ marginTop: 20 }}>
        AstroNow offers astrology for reflection and self-understanding. It is not a
        substitute for professional medical, legal, or financial advice.
      </AppText>
      <EditorialFooter kicker="NO FLUFF. CLEAR GUIDANCE." title={"Your chart is personal.\nYour choices stay yours."} note="Made with care in India, for curious minds everywhere." />
      <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)} accessibilityLabel="Close preferences" />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <AppText variant="title">{picker === "terms" ? "Astrology terminology" : "Reading language"}</AppText>
                <AppText variant="caption" muted style={{ marginTop: 5 }}>
                  {picker === "terms" ? "Choose how Tara explains Vedic terms." : "App menus, readings and Tara’s replies switch to this language."}
                </AppText>
              </View>
              <MotionPressable onPress={() => setPicker(null)} style={styles.closeButton} accessibilityLabel="Close preferences"><Icon name="x" size={20} color={colors.onSurface} /></MotionPressable>
            </View>
            <ScrollView style={{ maxHeight: 450 }} showsVerticalScrollIndicator={false}>
              {(picker === "terms" ? TERM_OPTIONS.map((item) => ({ id: item.id, title: item.title, detail: item.detail }))
                : READING_LANGUAGES.map((item) => ({ id: item.code, title: item.name, detail: item.native }))).map((option) => {
                const selected = picker === "terms" ? (profile?.terminology_mode || "both") === option.id : (profile?.language || "en") === option.id;
                return <MotionPressable key={option.id} onPress={() => savePreference(option.id)} disabled={preferenceBusy}
                  style={[styles.option, selected && styles.optionSelected]} accessibilityLabel={`Select ${option.title}`}>
                  <View style={{ flex: 1 }}><AppText variant="subtitle">{option.title}</AppText><AppText variant="caption" muted style={{ marginTop: 3 }}>{option.detail}</AppText></View>
                  <Icon name={selected ? "check-circle" : "circle"} size={20} color={selected ? colors.gold : colors.muted} />
                </MotionPressable>;
              })}
            </ScrollView>
            {preferenceError ? <AppText variant="caption" style={{ color: colors.coralSoft, marginTop: 10 }}>{preferenceError}</AppText> : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  hero: { marginTop: 18, padding: 18, borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(217,121,162,0.28)" },
  avatarRing: { width: 66, height: 66, borderRadius: 33, padding: 2.5 },
  avatar: { flex: 1, borderRadius: 31, alignItems: "center", justifyContent: "center", backgroundColor: "#1C1638" },
  signs: { flexDirection: "row", gap: 8, marginTop: 16 },
  sign: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 16, backgroundColor: "rgba(11,11,26,0.45)", borderWidth: 1, borderColor: colors.border },
  chartBtn: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: "rgba(240,160,189,0.5)" },
  stats: { flexDirection: "row", gap: 10, marginTop: 12 },
  stat: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: radii.lg, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.border },
  plan: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 13, padding: 16, borderRadius: radii.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.glassBorder },
  planIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  rows: { marginTop: 20, backgroundColor: colors.surfaceSecondary, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.7)" },
  modalSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 38, borderWidth: 1, borderColor: colors.borderStrong },
  modalHandle: { width: 48, height: 4, borderRadius: 2, backgroundColor: colors.muted, opacity: 0.45, alignSelf: "center", marginBottom: 18 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 15 },
  closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  option: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  optionSelected: { borderColor: colors.gold, backgroundColor: colors.gold + "12" },
}));
