import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { ScrollView, View } from "react-native";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { Chip } from "@/src/components/Chip";
import { GlassCard } from "@/src/components/GlassCard";
import { Icon } from "@/src/components/Icon";
import { Screen } from "@/src/components/Screen";
import { makeStyles, radii, useTheme } from "@/src/theme";

const SPREADS = [
  { id: "one", label: "One Card" },
  { id: "three", label: "Three Card" },
  { id: "ppf", label: "Past · Present · Future" },
  { id: "love", label: "Love" },
  { id: "career", label: "Career" },
  { id: "decision", label: "Decision" },
];

export default function TarotScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [spread, setSpread] = useState("three");

  const draw = useMutation({ mutationFn: () => api.post("/tarot/draw", { spread, interpret: true }) });

  return (
    <Screen title="Tarot" back subtitle="Draw a card, find reflection">
      <AppText variant="label" muted style={{ marginLeft: 4, marginBottom: 8 }}>CHOOSE A SPREAD</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20, paddingBottom: 4 }}>
        {SPREADS.map((s) => (
          <Chip key={s.id} label={s.label} selected={spread === s.id} onPress={() => setSpread(s.id)} testID={`tarot-spread-${s.id}`} />
        ))}
      </ScrollView>

      <Button label={draw.isPending ? "Shuffling…" : "Draw cards"} icon="layers"
        onPress={() => draw.mutate()} loading={draw.isPending} style={{ marginTop: 20 }} testID="tarot-draw" />

      {draw.data ? (
        <View style={{ gap: 12, marginTop: 20 }}>
          {draw.data.cards.map((c: any, i: number) => (
            <GlassCard key={i} testID={`tarot-card-${i}`}>
              <AppText variant="caption" muted>{c.position}</AppText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                <View style={styles.cardIcon}>
                  <Icon name="star" size={18} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="subtitle" style={{ color: colors.gold }}>{c.name}</AppText>
                  <AppText variant="caption" muted style={{ textTransform: "capitalize" }}>{c.orientation} · {c.keywords}</AppText>
                </View>
              </View>
            </GlassCard>
          ))}
          {draw.data.interpretation ? (
            <GlassCard testID="tarot-interpretation">
              <AppText variant="label" muted>REFLECTION</AppText>
              <AppText variant="body" style={{ marginTop: 8, lineHeight: 24 }}>{draw.data.interpretation}</AppText>
            </GlassCard>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  cardIcon: { width: 42, height: 60, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.glassBorder },
}));
