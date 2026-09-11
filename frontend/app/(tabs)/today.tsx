import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { GlassCard } from "@/src/components/GlassCard";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { ErrorState, Loading, Screen } from "@/src/components/Screen";
import { useAuth } from "@/src/store/auth";
import { makeStyles, radii, useTheme } from "@/src/theme";

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function Today() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { profile } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["today"],
    queryFn: () => api.get("/today"),
  });

  const now = new Date();
  const dateLabel = `${DAY[now.getDay()]} · ${MONTH[now.getMonth()]} ${now.getDate()}`;

  return (
    <Screen>
      <View style={{ paddingTop: 4 }}>
        <AppText variant="caption" muted>{dateLabel}</AppText>
        <AppText variant="display" style={{ marginTop: 2 }}>
          {data?.greeting || "Welcome"}
          {data?.name ? `,\n${data.name}` : profile?.first_name ? `,\n${profile.first_name}` : ""}
        </AppText>
      </View>

      {isLoading ? <Loading /> : null}
      {isError ? <ErrorState onRetry={refetch} /> : null}

      {data ? (
        <View style={{ gap: 16, marginTop: 20 }}>
          {/* Moon + energy hero */}
          <GlassCard testID="today-hero" style={{ overflow: "hidden" }}>
            <View style={styles.moonRow}>
              <View style={styles.moonOrb}>
                <Icon name="moon" size={26} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="label" muted>MOON TODAY</AppText>
                <AppText variant="subtitle">{data.moon_today?.phase}</AppText>
                <AppText variant="caption" muted>
                  in {data.moon_today?.sign} · {data.moon_today?.nakshatra}
                </AppText>
              </View>
            </View>
            <View style={styles.meterRow}>
              {data.energy && Object.entries<any>(data.energy).map(([k, v]) => (
                <View key={k} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                  <View style={{ flexDirection: "row", gap: 3 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <View key={i} style={[styles.pip, i <= v.value && { backgroundColor: colors.gold }]} />
                    ))}
                  </View>
                  <AppText variant="caption" style={{ textTransform: "capitalize" }}>{k}</AppText>
                  <AppText variant="caption" muted style={{ fontSize: 10 }}>{v.label}</AppText>
                </View>
              ))}
            </View>
          </GlassCard>

          {/* Insight */}
          <GlassCard testID="today-insight">
            <View style={styles.cardHead}>
              <Icon name="feather" size={16} color={colors.gold} />
              <AppText variant="label" muted>WHAT STANDS OUT TODAY</AppText>
            </View>
            <AppText variant="body" style={{ marginTop: 10, lineHeight: 24 }}>{data.insight}</AppText>
            <Button label="Ask about today" variant="secondary" icon="message-circle"
              onPress={() => router.push("/(tabs)/ask")} style={{ marginTop: 16 }} testID="today-ask" />
          </GlassCard>

          {/* Current period + timing */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <GlassCard style={{ flex: 1 }} testID="today-period">
              <AppText variant="label" muted>CURRENT PERIOD</AppText>
              <AppText variant="title" style={{ color: colors.gold, marginTop: 6 }}>
                {data.current_period?.mahadasha || "—"}
              </AppText>
              <AppText variant="caption" muted>Major Life Period</AppText>
              {data.current_period?.antardasha ? (
                <AppText variant="caption" muted style={{ marginTop: 4 }}>
                  Sub-period: {data.current_period.antardasha}
                </AppText>
              ) : null}
            </GlassCard>
            <GlassCard style={{ flex: 1 }} testID="today-timing">
              <AppText variant="label" muted>AUSPICIOUS TIME</AppText>
              {data.panchang?.abhijit_muhurat ? (
                <>
                  <AppText variant="subtitle" style={{ marginTop: 6 }}>
                    {data.panchang.abhijit_muhurat.start}
                  </AppText>
                  <AppText variant="caption" muted>to {data.panchang.abhijit_muhurat.end}</AppText>
                  <AppText variant="caption" muted style={{ marginTop: 4 }}>Abhijit Muhurat</AppText>
                </>
              ) : (
                <AppText variant="caption" muted style={{ marginTop: 6 }}>Add birth time for precise timing</AppText>
              )}
            </GlassCard>
          </View>

          {/* Panchang summary */}
          {data.panchang ? (
            <GlassCard testID="today-panchang">
              <View style={styles.cardHead}>
                <Icon name="calendar" size={16} color={colors.gold} />
                <AppText variant="label" muted>TODAY'S PANCHANG</AppText>
              </View>
              <View style={styles.pRow}>
                <PItem label="Tithi" value={data.panchang.tithi?.name} />
                <PItem label="Nakshatra" value={data.panchang.nakshatra?.name} />
              </View>
              <View style={styles.pRow}>
                <PItem label="Yoga" value={data.panchang.yoga?.name} />
                <PItem label="Sunrise" value={data.panchang.sunrise} />
              </View>
              {data.panchang.rahu_kalam ? (
                <View style={styles.rahu}>
                  <Icon name="alert-circle" size={14} color={colors.warning} />
                  <AppText variant="caption" muted>
                    Rahu Kalam: {data.panchang.rahu_kalam.start} – {data.panchang.rahu_kalam.end}
                  </AppText>
                </View>
              ) : null}
            </GlassCard>
          ) : null}

          {/* Daily tarot */}
          {data.daily_tarot?.cards?.[0] ? (
            <GlassCard testID="today-tarot">
              <View style={styles.cardHead}>
                <Icon name="layers" size={16} color={colors.gold} />
                <AppText variant="label" muted>DAILY TAROT</AppText>
              </View>
              <AppText variant="subtitle" style={{ marginTop: 8, color: colors.gold }}>
                {data.daily_tarot.cards[0].name}
              </AppText>
              <AppText variant="caption" muted style={{ marginTop: 2 }}>
                {data.daily_tarot.cards[0].orientation} · {data.daily_tarot.cards[0].keywords}
              </AppText>
            </GlassCard>
          ) : null}

          <QuickLinks />
        </View>
      ) : null}
    </Screen>
  );
}

function PItem({ label, value }: { label: string; value?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <AppText variant="caption" muted>{label}</AppText>
      <AppText variant="body">{value || "—"}</AppText>
    </View>
  );
}

function QuickLinks() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const links: { icon: FeatherName; label: string; href: string }[] = [
    { icon: "target", label: "Chart", href: "/chart" },
    { icon: "trending-up", label: "Timeline", href: "/dasha" },
    { icon: "heart", label: "Love", href: "/(tabs)/ask" },
    { icon: "home", label: "Vastu", href: "/vastu" },
  ];
  return (
    <View>
      <AppText variant="label" muted style={{ marginBottom: 10, marginLeft: 4 }}>EXPLORE YOUR CHART</AppText>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {links.map((l) => (
          <View key={l.label} style={{ flex: 1 }}>
            <Button label="" onPress={() => router.push(l.href as any)} variant="secondary" full
              icon={l.icon} style={{ height: 56 }} testID={`quick-${l.label}`} />
            <AppText variant="caption" muted center style={{ marginTop: 6 }}>{l.label}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  moonRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  moonOrb: {
    width: 56, height: 56, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.glassBorder,
  },
  meterRow: { flexDirection: "row", marginTop: 20, gap: 8 },
  pip: { width: 7, height: 7, borderRadius: 999, backgroundColor: colors.surfaceTertiary },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  pRow: { flexDirection: "row", marginTop: 12, gap: 12 },
  rahu: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
}));
