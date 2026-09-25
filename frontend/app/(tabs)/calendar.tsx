import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { GlassCard } from "@/src/components/GlassCard";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { ErrorState, Loading, Screen } from "@/src/components/Screen";
import { useTerms } from "@/src/hooks";
import { makeStyles, useTheme } from "@/src/theme";

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
    <Screen>
      <AppText variant="caption" style={{ color: colors.teal, letterSpacing: 1.3, fontSize: 9 }}>VEDIC TIMEKEEPING</AppText>
      <AppText variant="display">{t("panchang", "Daily Calendar")}</AppText>
      <AppText variant="body" muted style={{ marginTop: 5 }}>The quality and rhythm of each day, calculated for your location.</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 9, paddingTop: 22, paddingBottom: 6, paddingRight: 20 }}>
        {days.map((d) => {
          const sel = d.toDateString() === selected.toDateString();
          return (
            <MotionPressable key={d.toISOString()} onPress={() => setSelected(d)}
              style={[styles.dayPill, sel && { backgroundColor: colors.gold, borderColor: colors.gold }]}
              testID={`cal-day-${d.getDate()}`}>
              <AppText variant="caption" style={{ color: sel ? colors.onBrandPrimary : colors.muted }}>{WD[d.getDay()]}</AppText>
              <AppText variant="subtitle" style={{ color: sel ? colors.onBrandPrimary : colors.onSurface }}>{d.getDate()}</AppText>
            </MotionPressable>
          );
        })}
      </ScrollView>

      {isLoading ? <Loading /> : null}
      {isError ? <ErrorState onRetry={refetch} /> : null}

      {data ? (
        <View style={{ gap: 16, marginTop: 18 }}>
          <Animated.View entering={FadeInDown.duration(420)}>
          <GlassCard testID="cal-panchang" style={{ backgroundColor: "#17162F" }}>
            <View style={styles.calHeroTop}>
              <View>
                <AppText variant="caption" style={{ color: colors.coralSoft, letterSpacing: 1 }}>{data.weekday?.toUpperCase()} · {data.paksha?.toUpperCase()} PAKSHA</AppText>
                <AppText variant="hero" style={{ marginTop: 8 }}>{selected.getDate()}</AppText>
                <AppText variant="subtitle">{selected.toLocaleString("en", { month: "long" })}</AppText>
              </View>
              <View style={styles.dayOrb}><Icon name="sun" size={28} color={colors.gold} /></View>
            </View>
            <View style={styles.grid}>
              <Cell label={t("tithi", "Tithi")} value={data.tithi?.name} />
              <Cell label={t("nakshatra", "Nakshatra")} value={data.nakshatra?.name} />
              <Cell label={t("yoga", "Yoga")} value={data.yoga?.name} />
              <Cell label={t("karana", "Karana")} value={data.karana?.name} />
            </View>
          </GlassCard>
          </Animated.View>

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
    width: 54, height: 72, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 4,
    backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 16, columnGap: 16, marginTop: 14 },
  calHeroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.divider },
  dayOrb: { width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(226,185,131,0.10)", borderWidth: 1, borderColor: colors.glassBorder, alignItems: "center", justifyContent: "center" },
  sunRow: { flexDirection: "row", justifyContent: "space-around" },
  sunItem: { flexDirection: "row", alignItems: "center", gap: 8 },
}));
