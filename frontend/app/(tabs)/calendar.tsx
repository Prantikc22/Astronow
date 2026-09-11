import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { GlassCard } from "@/src/components/GlassCard";
import { Icon } from "@/src/components/Icon";
import { ErrorState, Loading, Screen } from "@/src/components/Screen";
import { useTerms } from "@/src/hooks";
import { makeStyles, radii, useTheme } from "@/src/theme";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useTerms();
  const [selected, setSelected] = useState(new Date());

  const days = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 21 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - 3 + i);
      return d;
    });
  }, []);

  const dayStr = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}`;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["panchang", dayStr],
    queryFn: () => api.get(`/panchang?day=${dayStr}`),
  });

  return (
    <Screen title={t("panchang", "Daily Calendar")} subtitle="Vedic timing for any day">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 20 }}>
        {days.map((d) => {
          const sel = d.toDateString() === selected.toDateString();
          return (
            <Pressable key={d.toISOString()} onPress={() => setSelected(d)}
              style={[styles.dayPill, sel && { backgroundColor: colors.gold, borderColor: colors.gold }]}
              testID={`cal-day-${d.getDate()}`}>
              <AppText variant="caption" style={{ color: sel ? colors.onBrandPrimary : colors.muted }}>{WD[d.getDay()]}</AppText>
              <AppText variant="subtitle" style={{ color: sel ? colors.onBrandPrimary : colors.onSurface }}>{d.getDate()}</AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? <Loading /> : null}
      {isError ? <ErrorState onRetry={refetch} /> : null}

      {data ? (
        <View style={{ gap: 16, marginTop: 16 }}>
          <GlassCard testID="cal-panchang">
            <AppText variant="label" muted>{data.weekday} · {data.paksha} Paksha</AppText>
            <View style={styles.grid}>
              <Cell label={t("tithi", "Tithi")} value={data.tithi?.name} />
              <Cell label={t("nakshatra", "Nakshatra")} value={data.nakshatra?.name} />
              <Cell label={t("yoga", "Yoga")} value={data.yoga?.name} />
              <Cell label={t("karana", "Karana")} value={data.karana?.name} />
            </View>
          </GlassCard>

          {data.sunrise ? (
            <GlassCard>
              <View style={styles.sunRow}>
                <View style={styles.sunItem}><Icon name="sunrise" size={18} color={colors.gold} />
                  <AppText variant="body">{data.sunrise}</AppText></View>
                <View style={styles.sunItem}><Icon name="sunset" size={18} color={colors.gold} />
                  <AppText variant="body">{data.sunset}</AppText></View>
              </View>
            </GlassCard>
          ) : null}

          {data.rahu_kalam ? (
            <GlassCard>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="alert-circle" size={16} color={colors.warning} />
                <AppText variant="label" muted>INAUSPICIOUS · RAHU KALAM</AppText>
              </View>
              <AppText variant="subtitle" style={{ marginTop: 8 }}>{data.rahu_kalam.start} – {data.rahu_kalam.end}</AppText>
              <AppText variant="caption" muted style={{ marginTop: 4 }}>Best to avoid starting new ventures in this window.</AppText>
            </GlassCard>
          ) : null}

          {data.abhijit_muhurat ? (
            <GlassCard>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="star" size={16} color={colors.gold} />
                <AppText variant="label" muted>AUSPICIOUS · ABHIJIT MUHURAT</AppText>
              </View>
              <AppText variant="subtitle" style={{ marginTop: 8 }}>{data.abhijit_muhurat.start} – {data.abhijit_muhurat.end}</AppText>
              <AppText variant="caption" muted style={{ marginTop: 4 }}>A generally favourable window during midday.</AppText>
            </GlassCard>
          ) : (
            <GlassCard>
              <AppText variant="caption" muted>Add your birthplace for sunrise-based timings like Rahu Kalam and Abhijit Muhurat.</AppText>
            </GlassCard>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function Cell({ label, value }: { label: string; value?: string }) {
  return (
    <View style={{ width: "47%" }}>
      <AppText variant="caption" muted>{label}</AppText>
      <AppText variant="subtitle" style={{ marginTop: 2 }}>{value || "—"}</AppText>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  dayPill: {
    width: 56, height: 68, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", gap: 4,
    backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 16, columnGap: 16, marginTop: 14 },
  sunRow: { flexDirection: "row", justifyContent: "space-around" },
  sunItem: { flexDirection: "row", alignItems: "center", gap: 8 },
}));
