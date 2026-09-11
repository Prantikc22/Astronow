import { useQuery } from "@tanstack/react-query";
import React from "react";
import { View } from "react-native";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { GlassCard } from "@/src/components/GlassCard";
import { ErrorState, Loading, Screen } from "@/src/components/Screen";
import { useTheme } from "@/src/theme";

const MEANING: Record<string, string> = {
  "1": "Leadership, independence and new beginnings.",
  "2": "Sensitivity, partnership and diplomacy.",
  "3": "Creativity, expression and joy.",
  "4": "Stability, discipline and hard work.",
  "5": "Freedom, change and adventure.",
  "6": "Responsibility, care and harmony.",
  "7": "Introspection, wisdom and spirituality.",
  "8": "Ambition, power and material mastery.",
  "9": "Compassion, completion and idealism.",
  "11": "Intuition, inspiration and higher purpose.",
  "22": "The master builder — big visions made real.",
  "33": "The master teacher — compassion and guidance.",
};

export default function NumerologyScreen() {
  const { colors } = useTheme();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["numerology"], queryFn: () => api.get("/numerology") });

  const items = data ? [
    { label: "Life Path", value: data.life_path },
    { label: "Birth Number", value: data.birth_number },
    { label: "Personal Year", value: data.personal_year },
    ...(data.name_number ? [{ label: "Name Number", value: data.name_number }] : []),
    ...(data.soul_urge ? [{ label: "Soul Urge", value: data.soul_urge }] : []),
  ] : [];

  return (
    <Screen title="Numerology" back subtitle="The numbers behind your name & birth">
      {isLoading ? <Loading /> : null}
      {isError ? <ErrorState onRetry={refetch} /> : null}
      {data ? (
        <View style={{ gap: 12 }}>
          {items.map((it) => (
            <GlassCard key={it.label} testID={`num-${it.label}`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <View style={{ width: 56, height: 56, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.glassBorder }}>
                  <AppText variant="title" style={{ color: colors.gold }}>{it.value}</AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="subtitle">{it.label}</AppText>
                  <AppText variant="caption" muted style={{ marginTop: 2 }}>{MEANING[String(it.value)] || "A meaningful influence in your life."}</AppText>
                </View>
              </View>
            </GlassCard>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
