import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import { Animated, ScrollView, View } from "react-native";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { Chip } from "@/src/components/Chip";
import { Icon } from "@/src/components/Icon";
import { Screen } from "@/src/components/Screen";
import { makeStyles, radii, useTheme } from "@/src/theme";

const SPREADS = [
  { id: "one", label: "One Card" }, { id: "three", label: "Three Card" },
  { id: "ppf", label: "Past · Present · Future" }, { id: "love", label: "Love" },
  { id: "career", label: "Career" }, { id: "decision", label: "Decision" },
];
const CARD_TONES = ["#24204B", "#352A3B", "#20233F"];

function CardBack({ index }: { index: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.cardBack, { transform: [{ rotate: `${(index - 1) * 8}deg` }, { translateY: index === 1 ? -10 : 5 }] }]}>
      <View style={styles.cardFrame}>
        <View style={styles.cardOrbit}>
          <View style={styles.cardSun} />
          <View style={[styles.cardPlanet, { top: 5, left: 34 }]} />
          <View style={[styles.cardPlanet, { bottom: 11, right: 9, backgroundColor: colors.teal }]} />
        </View>
        <AppText variant="caption" style={styles.cardMark}>AN</AppText>
      </View>
    </View>
  );
}

export default function TarotScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [spread, setSpread] = useState("three");
  const [reveal] = useState(() => new Animated.Value(0));
  const draw = useMutation({
    mutationFn: () => api.post("/tarot/draw", { spread, interpret: true }),
    onSuccess: () => {
      reveal.setValue(0);
      Animated.spring(reveal, { toValue: 1, damping: 15, stiffness: 110, useNativeDriver: true }).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
  });
  useEffect(() => () => reveal.stopAnimation(), [reveal]);

  return (
    <Screen title="Tarot" back subtitle="A quiet mirror for the moment" contentStyle={{ paddingHorizontal: 0 }}>
      <View style={styles.hero}>
        <View style={styles.decks}>{[0, 1, 2].map((index) => <CardBack key={index} index={index} />)}</View>
        <AppText variant="display" center style={styles.heroTitle}>What wants to be seen?</AppText>
        <AppText variant="body" muted center style={styles.heroCopy}>
          Settle on one question. Choose a spread, then let the cards offer a new angle—not a fixed outcome.
        </AppText>
      </View>
      <View style={styles.content}>
        <AppText variant="label" muted style={{ marginLeft: 4, marginBottom: 10 }}>CHOOSE A SPREAD</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20, paddingBottom: 4 }}>
          {SPREADS.map((item) => <Chip key={item.id} label={item.label} selected={spread === item.id} onPress={() => setSpread(item.id)} testID={`tarot-spread-${item.id}`} />)}
        </ScrollView>
        <Button label={draw.isPending ? "Shuffling…" : draw.data ? "Draw again" : "Draw the cards"} icon="layers"
          onPress={() => draw.mutate()} loading={draw.isPending} style={{ marginTop: 20 }} testID="tarot-draw" />
        {draw.data ? (
          <Animated.View style={{ gap: 12, marginTop: 22, opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
            <AppText variant="label" muted>YOUR READING</AppText>
            {draw.data.cards.map((card: any, index: number) => (
              <View key={`${card.name}-${index}`} style={[styles.revealedCard, { backgroundColor: CARD_TONES[index % CARD_TONES.length] }]} testID={`tarot-card-${index}`}>
                <View style={styles.number}><AppText variant="caption" style={{ color: colors.ink }}>{String(index + 1).padStart(2, "0")}</AppText></View>
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" style={{ color: colors.goldSoft, textTransform: "uppercase" }}>{card.position}</AppText>
                  <AppText variant="title" style={{ marginTop: 6 }}>{card.name}</AppText>
                  <AppText variant="body" muted style={{ marginTop: 6, textTransform: "capitalize" }}>{card.orientation} · {card.keywords}</AppText>
                </View>
                <Icon name="star" size={18} color={colors.gold} />
              </View>
            ))}
            {draw.data.interpretation ? (
              <View style={styles.reflection} testID="tarot-interpretation">
                <View style={styles.reflectionIcon}><Icon name="compass" size={20} color={colors.coral} /></View>
                <AppText variant="label" style={{ color: colors.coral }}>REFLECTION</AppText>
                <AppText variant="body" style={{ color: colors.ink, marginTop: 10, lineHeight: 25 }}>{draw.data.interpretation}</AppText>
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  hero: { marginHorizontal: 20, borderRadius: radii.xl, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.glassBorder, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 26, overflow: "hidden" },
  decks: { height: 154, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  cardBack: { width: 88, height: 138, borderRadius: 14, backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.gold, marginHorizontal: -18, padding: 6, shadowColor: colors.ink, shadowOpacity: 0.7, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  cardFrame: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: "rgba(226,185,131,0.38)", alignItems: "center", justifyContent: "center" },
  cardOrbit: { width: 54, height: 54, borderRadius: 99, borderWidth: 1, borderColor: colors.gold, alignItems: "center", justifyContent: "center" },
  cardSun: { width: 16, height: 16, borderRadius: 99, backgroundColor: colors.coralSoft },
  cardPlanet: { position: "absolute", width: 6, height: 6, borderRadius: 99, backgroundColor: colors.gold },
  cardMark: { position: "absolute", bottom: 10, color: colors.gold, letterSpacing: 2 },
  heroTitle: { marginTop: 10, fontSize: 32, color: colors.ivory },
  heroCopy: { marginTop: 8, lineHeight: 21 },
  content: { paddingHorizontal: 20, paddingTop: 24 },
  revealedCard: { minHeight: 132, padding: 20, borderRadius: radii.lg, flexDirection: "row", alignItems: "flex-start", gap: 14, borderWidth: 1, borderColor: colors.glassBorder },
  number: { width: 30, height: 30, borderRadius: 99, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  reflection: { backgroundColor: colors.ivory, padding: 22, borderRadius: radii.xl, marginTop: 4 },
  reflectionIcon: { width: 42, height: 42, borderRadius: 99, backgroundColor: "rgba(197,110,88,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 18 },
}));
