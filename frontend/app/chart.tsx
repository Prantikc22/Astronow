import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { GlassCard } from "@/src/components/GlassCard";
import { Icon } from "@/src/components/Icon";
import { NorthChart } from "@/src/components/NorthChart";
import { MotionPressable } from "@/src/components/MotionPressable";
import { ErrorState, Loading, Screen } from "@/src/components/Screen";
import { useTerms } from "@/src/hooks";
import { makeStyles, radii, useTheme } from "@/src/theme";

export default function ChartScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTerms();
  const [open, setOpen] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["chart"], queryFn: () => api.get("/chart") });
  const chart = data?.chart;

  return (
    <Screen title={t("kundli", "Birth Chart")} back subtitle="Your Vedic natal blueprint">
      {isLoading ? <Loading /> : null}
      {isError ? <ErrorState onRetry={refetch} message="Complete onboarding to generate your chart." /> : null}
      {chart ? (
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Summary label={t("lagna", "Ascendant")} value={chart.lagna?.sign || "—"} />
            <Summary label="Moon" value={chart.moon_sign} />
            <Summary label="Sun" value={chart.sun_sign} />
          </View>

          <GlassCard testID="chart-diagram">
            <NorthChart houses={chart.houses} />
            {!chart.birth_time_known ? (
              <AppText variant="caption" muted center style={{ marginTop: 8 }}>
                Birth time unknown — houses and Ascendant are approximate.
              </AppText>
            ) : null}
          </GlassCard>

          {chart.moon_nakshatra ? (
            <GlassCard>
              <AppText variant="label" muted>{t("nakshatra", "Birth Star")}</AppText>
              <AppText variant="subtitle" style={{ marginTop: 4 }}>
                {chart.moon_nakshatra} · Pada {chart.moon_pada}
              </AppText>
            </GlassCard>
          ) : null}

          <AppText variant="label" muted style={{ marginLeft: 4, marginTop: 4 }}>PLANETS</AppText>
          <View style={styles.list}>
            {chart.planets.map((p: any, i: number) => (
              <View key={p.name}>
                <MotionPressable onPress={() => setOpen(open === p.name ? null : p.name)}
                  style={[styles.row, i > 0 && styles.rowBorder]} testID={`planet-${p.name}`}>
                  <View style={styles.planetBadge}>
                    <AppText variant="label" style={{ color: colors.gold }}>{p.name.slice(0, 2)}</AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="body">{p.name}{p.retrograde ? " ℞" : ""}</AppText>
                    <AppText variant="caption" muted>
                      {p.sign} {p.degree_dms}{p.house ? ` · House ${p.house}` : ""}
                    </AppText>
                  </View>
                  <Icon name={open === p.name ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
                </MotionPressable>
                {open === p.name ? (
                  <View style={styles.detail}>
                    <AppText variant="caption" muted>Nakshatra: {p.nakshatra} (lord {p.nakshatra_lord})</AppText>
                    <MotionPressable onPress={() => router.push("/(tabs)/ask")} style={styles.askLink} testID={`planet-ask-${p.name}`}>
                      <Icon name="message-circle" size={14} color={colors.gold} />
                      <AppText variant="caption" style={{ color: colors.gold }}>Ask about {p.name}</AppText>
                    </MotionPressable>
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          {chart.yogas?.length ? (
            <View>
              <AppText variant="label" muted style={{ marginLeft: 4, marginBottom: 8 }}>YOGAS</AppText>
              <View style={styles.wrap}>
                {chart.yogas.map((y: any) => (
                  <View key={y.id} style={styles.tag}><AppText variant="caption">{y.name}</AppText></View>
                ))}
              </View>
            </View>
          ) : null}
          {chart.doshas?.length ? (
            <View>
              <AppText variant="label" muted style={{ marginLeft: 4, marginBottom: 8 }}>NOTABLE</AppText>
              <View style={styles.wrap}>
                {chart.doshas.map((d: any) => (
                  <View key={d.id} style={[styles.tag, { borderColor: colors.warning }]}>
                    <AppText variant="caption">{d.name}</AppText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function Summary({ label, value }: { label: string; value?: string }) {
  const { colors } = useTheme();
  return (
    <GlassCard style={{ flex: 1 }}>
      <AppText variant="caption" muted numberOfLines={1}>{label}</AppText>
      <AppText variant="subtitle" style={{ marginTop: 4, color: colors.gold }} numberOfLines={1}>{value || "—"}</AppText>
    </GlassCard>
  );
}

const useStyles = makeStyles((colors) => ({
  list: { backgroundColor: colors.surfaceSecondary, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  planetBadge: { width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary },
  detail: { paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  askLink: { flexDirection: "row", alignItems: "center", gap: 6 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.glassBorder },
}));
