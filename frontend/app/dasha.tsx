import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { GlassCard } from "@/src/components/GlassCard";
import { ErrorState, Loading, Screen } from "@/src/components/Screen";
import { useTerms } from "@/src/hooks";
import { makeStyles, radii, useTheme } from "@/src/theme";

export default function DashaScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTerms();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["dasha"], queryFn: () => api.get("/dasha") });

  const currentLord = data?.current_mahadasha?.lord;

  return (
    <Screen title={t("mahadasha", "Life Timeline")} back subtitle="Your Vimshottari life cycles">
      {isLoading ? <Loading /> : null}
      {isError ? <ErrorState onRetry={refetch} /> : null}
      {data ? (
        <View style={{ gap: 12 }}>
          {data.current_mahadasha ? (
            <GlassCard style={{ borderColor: colors.gold }} testID="dasha-current">
              <AppText variant="label" muted>CURRENT MAJOR PERIOD</AppText>
              <AppText variant="display" style={{ color: colors.gold, marginTop: 4 }}>
                {data.current_mahadasha.lord}
              </AppText>
              <AppText variant="caption" muted>
                {data.current_mahadasha.start_year}–{data.current_mahadasha.end_year}
                {data.current_antardasha ? `  ·  Sub-period: ${data.current_antardasha.lord}` : ""}
              </AppText>
              <Button label={`Ask about my ${data.current_mahadasha.lord} period`} variant="secondary"
                icon="message-circle" style={{ marginTop: 14 }}
                onPress={() => router.push("/(tabs)/ask")} testID="dasha-ask" />
            </GlassCard>
          ) : null}

          <AppText variant="label" muted style={{ marginLeft: 4, marginTop: 8 }}>ALL PERIODS</AppText>
          <View style={styles.timeline}>
            {data.mahadashas.map((m: any, i: number) => {
              const active = m.lord === currentLord;
              return (
                <View key={i} style={styles.tlRow}>
                  <View style={styles.tlLine}>
                    <View style={[styles.tlDot, active && { backgroundColor: colors.gold, borderColor: colors.gold }]} />
                    {i < data.mahadashas.length - 1 ? <View style={styles.tlBar} /> : null}
                  </View>
                  <View style={[styles.tlCard, active && { borderColor: colors.gold }]}>
                    <AppText variant="subtitle" style={active ? { color: colors.gold } : undefined}>{m.lord}</AppText>
                    <AppText variant="caption" muted>{m.start_year} – {m.end_year} · {m.years} years</AppText>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  timeline: { marginTop: 4 },
  tlRow: { flexDirection: "row", gap: 14 },
  tlLine: { alignItems: "center", width: 20 },
  tlDot: { width: 14, height: 14, borderRadius: 999, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, marginTop: 6 },
  tlBar: { flex: 1, width: 2, backgroundColor: colors.divider, marginVertical: 2 },
  tlCard: { flex: 1, marginBottom: 12, padding: 14, borderRadius: radii.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
}));
