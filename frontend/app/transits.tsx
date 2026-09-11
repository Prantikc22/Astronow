import { useQuery } from "@tanstack/react-query";
import React from "react";
import { View } from "react-native";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { GlassCard } from "@/src/components/GlassCard";
import { Icon } from "@/src/components/Icon";
import { ErrorState, Loading, Screen } from "@/src/components/Screen";
import { useTerms } from "@/src/hooks";
import { makeStyles, useTheme } from "@/src/theme";

export default function TransitsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useTerms();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["transits"], queryFn: () => api.get("/transits") });

  return (
    <Screen title={t("gochar", "Transits")} back subtitle="Where the planets are now">
      {isLoading ? <Loading /> : null}
      {isError ? <ErrorState onRetry={refetch} /> : null}
      {data ? (
        <View style={{ gap: 12 }}>
          <GlassCard testID="transit-moon">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Icon name="moon" size={24} color={colors.gold} />
              <View>
                <AppText variant="subtitle">{data.moon_today.phase}</AppText>
                <AppText variant="caption" muted>{data.moon_today.sign} · {data.moon_today.nakshatra}</AppText>
              </View>
            </View>
          </GlassCard>
          <AppText variant="caption" muted style={{ marginLeft: 4 }}>
            House positions counted from your {data.reference === "lagna" ? "Ascendant" : "Moon sign"}.
          </AppText>
          {data.transits.map((tr: any) => (
            <View key={tr.planet} style={styles.row} testID={`transit-${tr.planet}`}>
              <View style={styles.badge}><AppText variant="label" style={{ color: colors.gold }}>{tr.planet.slice(0, 2)}</AppText></View>
              <View style={{ flex: 1 }}>
                <AppText variant="body">{tr.planet}{tr.retrograde ? " ℞" : ""}</AppText>
                <AppText variant="caption" muted>{tr.sign} · {tr.nakshatra}</AppText>
              </View>
              <View style={styles.housePill}>
                <AppText variant="caption" style={{ color: colors.onSurface }}>House {tr.house_from_moon}</AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  badge: { width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary },
  housePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceTertiary },
}));
