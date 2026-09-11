import { useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/src/components/AppText";
import { GlassCard } from "@/src/components/GlassCard";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { Screen } from "@/src/components/Screen";
import { useTerms } from "@/src/hooks";
import { makeStyles, radii, useTheme } from "@/src/theme";

export default function Explore() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTerms();

  const tools: { icon: FeatherName; label: string; sub: string; href: string; big?: boolean }[] = [
    { icon: "target", label: t("kundli", "Birth Chart"), sub: "Planets, houses & signs", href: "/chart", big: true },
    { icon: "trending-up", label: t("mahadasha", "Life Timeline"), sub: "Your life cycles", href: "/dasha" },
    { icon: "navigation", label: t("gochar", "Transits"), sub: "Current sky", href: "/transits" },
    { icon: "heart", label: t("guna_milan", "Compatibility"), sub: "Match two charts", href: "/compatibility" },
    { icon: "layers", label: "Tarot", sub: "Draw & reflect", href: "/tarot" },
    { icon: "hash", label: "Numerology", sub: "Your numbers", href: "/numerology" },
    { icon: "home", label: t("vastu", "Vastu"), sub: "Home analysis", href: "/vastu", big: true },
    { icon: "clock", label: t("muhurat", "Best Timing"), sub: "Auspicious windows", href: "/(tabs)/calendar" },
  ];

  return (
    <Screen title="Explore" subtitle="Your spiritual toolkit">
      <View style={styles.grid}>
        {tools.map((tool) => (
          <Pressable
            key={tool.label}
            onPress={() => router.push(tool.href as any)}
            style={[styles.cell, tool.big && styles.cellBig]}
            testID={`explore-${tool.label}`}
          >
            <GlassCard style={{ flex: 1 }}>
              <View style={styles.iconBox}>
                <Icon name={tool.icon} size={22} color={colors.gold} />
              </View>
              <AppText variant="subtitle" style={{ marginTop: 14 }}>{tool.label}</AppText>
              <AppText variant="caption" muted style={{ marginTop: 2 }}>{tool.sub}</AppText>
            </GlassCard>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  cell: { width: "47.8%" },
  cellBig: { width: "100%" },
  iconBox: {
    width: 46, height: 46, borderRadius: radii.md, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.glassBorder,
  },
}));
