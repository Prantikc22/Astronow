import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { Chip } from "@/src/components/Chip";
import { GlassCard } from "@/src/components/GlassCard";
import { Icon } from "@/src/components/Icon";
import { Screen } from "@/src/components/Screen";
import { useTerms } from "@/src/hooks";
import { makeStyles, radii, useTheme } from "@/src/theme";

const GRID = 6;
const CELL = 100 / GRID;
const ROOM_TYPES = [
  { id: "entrance", label: "Entrance", short: "En", color: "#6E5A2E" },
  { id: "living", label: "Living", short: "Lv", color: "#2B4C5E" },
  { id: "kitchen", label: "Kitchen", short: "Ki", color: "#7A3B2E" },
  { id: "master_bedroom", label: "Master Bed", short: "MB", color: "#584E82" },
  { id: "bedroom", label: "Bedroom", short: "Bd", color: "#3D5A72" },
  { id: "bathroom", label: "Bath", short: "Ba", color: "#3D5A46" },
  { id: "toilet", label: "Toilet", short: "To", color: "#4A4A57" },
  { id: "pooja", label: "Pooja", short: "Pu", color: "#8C6A3B" },
  { id: "dining", label: "Dining", short: "Dn", color: "#5E4B2B" },
  { id: "study", label: "Study", short: "St", color: "#2E5E52" },
  { id: "staircase", label: "Stairs", short: "Sr", color: "#57524A" },
];

export default function VastuScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTerms();

  const [selected, setSelected] = useState("living");
  const [cells, setCells] = useState<Record<number, string>>({});
  const [north, setNorth] = useState(0);

  const analyze = useMutation({ mutationFn: (rooms: any[]) => api.post("/vastu/analyze", { rooms, north_rotation: north, name: "My Home" }) });

  const paint = (idx: number) => {
    setCells((prev) => {
      const copy = { ...prev };
      if (copy[idx] === selected) delete copy[idx];
      else copy[idx] = selected;
      return copy;
    });
  };

  const buildRooms = () => {
    const byType: Record<string, number[]> = {};
    Object.entries(cells).forEach(([idx, type]) => {
      (byType[type] ||= []).push(+idx);
    });
    return Object.entries(byType).map(([type, idxs]) => {
      const cols = idxs.map((i) => i % GRID);
      const rows = idxs.map((i) => Math.floor(i / GRID));
      const minC = Math.min(...cols), maxC = Math.max(...cols);
      const minR = Math.min(...rows), maxR = Math.max(...rows);
      return {
        room_type: type,
        name: ROOM_TYPES.find((r) => r.id === type)?.label || type,
        x: minC * CELL, y: minR * CELL,
        width: (maxC - minC + 1) * CELL, height: (maxR - minR + 1) * CELL,
      };
    });
  };

  const painted = Object.keys(cells).length;
  const res = analyze.data;

  return (
    <Screen title={t("vastu", "Home Analysis")} back subtitle="Draw your home, tap to place rooms">
      {!res ? (
        <View style={{ gap: 16 }}>
          <AppText variant="label" muted style={{ marginLeft: 4 }}>SELECT A ROOM, THEN TAP THE GRID</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
            {ROOM_TYPES.map((r) => (
              <Chip key={r.id} label={r.label} selected={selected === r.id} onPress={() => setSelected(r.id)} testID={`vastu-type-${r.id}`} />
            ))}
          </ScrollView>

          <GlassCard>
            <View style={styles.northRow}>
              <AppText variant="caption" muted>North orientation</AppText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Pressable onPress={() => setNorth((north - 45 + 360) % 360)} testID="vastu-north-left"><Icon name="rotate-ccw" size={18} color={colors.gold} /></Pressable>
                <View style={styles.compass}><View style={{ transform: [{ rotate: `${north}deg` }] }}><Icon name="navigation" size={18} color={colors.gold} /></View></View>
                <AppText variant="caption" muted>{north}°</AppText>
                <Pressable onPress={() => setNorth((north + 45) % 360)} testID="vastu-north-right"><Icon name="rotate-cw" size={18} color={colors.gold} /></Pressable>
              </View>
            </View>
            <View style={styles.grid}>
              {Array.from({ length: GRID * GRID }).map((_, i) => {
                const type = cells[i];
                const meta = ROOM_TYPES.find((r) => r.id === type);
                return (
                  <Pressable key={i} onPress={() => paint(i)} style={[styles.cell, meta && { backgroundColor: meta.color, borderColor: colors.gold }]} testID={`vastu-cell-${i}`}>
                    {meta ? <AppText variant="caption" style={{ fontSize: 10 }}>{meta.short}</AppText> : null}
                  </Pressable>
                );
              })}
            </View>
            <AppText variant="caption" muted center style={{ marginTop: 10 }}>Top of the grid points North (adjust above).</AppText>
          </GlassCard>

          <Button label={`Analyze my home${painted ? ` (${painted} cells)` : ""}`} icon="home"
            disabled={painted === 0} loading={analyze.isPending} onPress={() => analyze.mutate(buildRooms())} testID="vastu-analyze" />
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <GlassCard testID="vastu-score">
            <AppText variant="label" muted center>HOME VASTU SCORE</AppText>
            <AppText variant="hero" center style={{ color: colors.gold, marginTop: 6 }}>{res.analysis.score}<AppText variant="title" muted>/100</AppText></AppText>
          </GlassCard>
          {res.analysis.strong_areas?.length ? (
            <GlassCard>
              <AppText variant="label" style={{ color: colors.success }}>STRONG AREAS</AppText>
              <AppText variant="body" style={{ marginTop: 6 }}>{res.analysis.strong_areas.join(", ")}</AppText>
            </GlassCard>
          ) : null}
          {res.analysis.review_areas?.length ? (
            <GlassCard>
              <AppText variant="label" style={{ color: colors.warning }}>REVIEW</AppText>
              <AppText variant="body" style={{ marginTop: 6 }}>{res.analysis.review_areas.join(", ")}</AppText>
            </GlassCard>
          ) : null}
          <AppText variant="label" muted style={{ marginLeft: 4 }}>ROOM BY ROOM</AppText>
          {res.analysis.findings.map((f: any, i: number) => (
            <View key={i} style={styles.finding} testID={`vastu-finding-${i}`}>
              <View style={[styles.dot, { backgroundColor: f.severity === "strong" ? colors.success : f.severity === "attention" ? colors.error : colors.warning }]} />
              <View style={{ flex: 1 }}>
                <AppText variant="body">{f.room} · {f.zone}</AppText>
                <AppText variant="caption" muted style={{ textTransform: "capitalize" }}>{f.status} placement</AppText>
              </View>
            </View>
          ))}
          {res.advice ? (
            <GlassCard testID="vastu-advice"><AppText variant="label" muted>GUIDANCE</AppText><AppText variant="body" style={{ marginTop: 8, lineHeight: 24 }}>{res.advice}</AppText></GlassCard>
          ) : !res.premium ? (
            <GlassCard style={{ borderColor: colors.gold }}>
              <AppText variant="subtitle">Unlock personalized remedies</AppText>
              <AppText variant="caption" muted style={{ marginTop: 6 }}>Premium turns these findings into practical, no-renovation improvements.</AppText>
              <Button label="Go Premium" icon="star" onPress={() => router.push("/paywall")} style={{ marginTop: 14 }} testID="vastu-upgrade" />
            </GlassCard>
          ) : null}
          <Button label="Draw another home" variant="secondary" icon="refresh-cw" onPress={() => analyze.reset()} testID="vastu-again" />
        </View>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  northRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  compass: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.glassBorder },
  grid: { flexDirection: "row", flexWrap: "wrap", aspectRatio: 1, borderWidth: 1, borderColor: colors.gold, borderRadius: 8, overflow: "hidden" },
  cell: { width: `${100 / GRID}%`, height: `${100 / GRID}%`, borderWidth: 0.5, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  finding: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  dot: { width: 10, height: 10, borderRadius: 999 },
}));
