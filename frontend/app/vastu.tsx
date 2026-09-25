import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { Chip } from "@/src/components/Chip";
import { CountUp } from "@/src/components/CountUp";
import { ScoreRing } from "@/src/components/ScoreRing";
import { GlassCard } from "@/src/components/GlassCard";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { Screen } from "@/src/components/Screen";
import { useTerms } from "@/src/hooks";
import { pop, rise } from "@/src/motion";
import { makeStyles, radii, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

const GRID = 6;
const CELL = 100 / GRID;
const ROOM_TYPES = [
  { id: "entrance", label: "Entrance", short: "En", color: "#6E5A2E" },
  { id: "living", label: "Living", short: "Lv", color: "#2B4C5E" },
  { id: "kitchen", label: "Kitchen", short: "Ki", color: "#7A3B2E" },
  { id: "master_bedroom", label: "Master Bed", short: "MB", color: "#584E82" },
  { id: "bedroom", label: "Bedroom", short: "Bd", color: "#3D5A72" },
  { id: "bathroom", label: "Bath", short: "Ba", color: "#625B9B" },
  { id: "toilet", label: "Toilet", short: "To", color: "#4A4A57" },
  { id: "pooja", label: "Pooja · prayer", short: "Pu", color: "#8C6A3B" },
  { id: "dining", label: "Dining", short: "Dn", color: "#5E4B2B" },
  { id: "study", label: "Study", short: "St", color: "#545FA0" },
  { id: "staircase", label: "Stairs", short: "Sr", color: "#57524A" },
];

export default function VastuScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTerms();

  const [selected, setSelected] = useState("living");
  const [cells, setCells] = useState<Record<number, string>>({});
  const [past, setPast] = useState<Record<number, string>[]>([]);
  const [future, setFuture] = useState<Record<number, string>[]>([]);
  const [north, setNorth] = useState(0);
  const [mode, setMode] = useState<"choose" | "draw" | "upload">("choose");
  const [detectedRooms, setDetectedRooms] = useState<any[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const analyze = useMutation({ mutationFn: ({ rooms, source = "draw" }: { rooms: any[]; source?: string }) => api.post("/vastu/analyze", { rooms, north_rotation: north, name: "My Home", source }) });
  const parsePlan = useMutation({
    mutationFn: (imageUrl: string) => api.post("/vastu/parse-floorplan", { image_url: imageUrl }),
    onSuccess: (data: any) => setDetectedRooms(data.rooms || []),
    onError: (error: any) => setUploadError(error?.message || "We could not read this plan automatically. You can draw it instead."),
  });

  const paint = (idx: number) => {
    haptics.selection();
    setCells((prev) => {
      setPast((items) => [...items.slice(-29), prev]);
      setFuture([]);
      const copy = { ...prev };
      if (copy[idx] === selected) delete copy[idx];
      else copy[idx] = selected;
      return copy;
    });
  };

  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;
    haptics.selection();
    setFuture((items) => [cells, ...items]);
    setCells(previous);
    setPast((items) => items.slice(0, -1));
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    haptics.selection();
    setPast((items) => [...items, cells]);
    setCells(next);
    setFuture((items) => items.slice(1));
  };

  const pickFloorPlan = async () => {
    setUploadError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.75 });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    parsePlan.mutate("data:" + (asset.mimeType || "image/jpeg") + ";base64," + asset.base64);
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
    <Screen title={t("vastu", "Vastu Home Report")} back subtitle="Direction meets the way you live">
      {!res && mode === "choose" ? (
        <View style={{ gap: 14, paddingTop: 8 }}>
          <Animated.View entering={pop(0)} style={{ alignItems: "center" }}><CompassMandala /></Animated.View>
          <Animated.View entering={rise(1)}>
            <AppText variant="display" center>Check your home&apos;s Vastu</AppText>
            <AppText variant="body" muted center style={{ marginTop: 6 }}>Vastu Shastra is India&apos;s traditional science of space and direction. Upload a floor plan or sketch it here, and get a room-by-room reading in a minute.</AppText>
          </Animated.View>
          <Animated.View entering={rise(2)}>
            <MotionPressable onPress={() => setMode("upload")} style={styles.modeCard} pressScale={0.98} haptic="medium" testID="vastu-mode-upload">
              <LinearGradient colors={["#B9E3E0", "#6FB3B4"]} style={styles.modeIcon}><Icon name="upload-cloud" size={22} color={colors.ink} weight="duotone" /></LinearGradient>
              <View style={{ flex: 1 }}><AppText variant="subtitle">Upload a floor plan</AppText><AppText variant="caption" muted>Photo, screenshot or builder&apos;s plan. AI finds the rooms; you confirm.</AppText></View>
              <Icon name="arrow-right" size={19} color={colors.goldSoft} />
            </MotionPressable>
          </Animated.View>
          <Animated.View entering={rise(3)}>
            <MotionPressable onPress={() => setMode("draw")} style={styles.modeCard} pressScale={0.98} haptic="medium" testID="vastu-mode-draw">
              <LinearGradient colors={["#F6B6CB", "#D0628F"]} style={styles.modeIcon}><Icon name="edit-3" size={22} color={colors.ink} weight="duotone" /></LinearGradient>
              <View style={{ flex: 1 }}><AppText variant="subtitle">Design it in the app</AppText><AppText variant="caption" muted>No plan? Paint rooms on a simple grid and set North.</AppText></View>
              <Icon name="arrow-right" size={19} color={colors.goldSoft} />
            </MotionPressable>
          </Animated.View>
          <Animated.View entering={rise(4)} style={styles.gets}>
            <AppText variant="label" style={{ color: colors.goldSoft, letterSpacing: 1.1 }}>YOUR VASTU REPORT INCLUDES</AppText>
            {([["target", "An overall home score out of 100"], ["compass", "A zone map of all eight directions and the centre"], ["home", "Room-by-room placement check"], ["bulb", "Simple remedies that need no renovation (Plus)"]] as [string, string][]).map(([icon, text]) => (
              <View key={text} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name={icon} size={16} color={colors.violet} weight="duotone" />
                <AppText variant="body" style={{ flex: 1 }}>{text}</AppText>
              </View>
            ))}
          </Animated.View>
          <View style={styles.privacy}><Icon name="shield" size={15} color={colors.violet} /><AppText variant="caption" muted style={{ flex: 1 }}>Floor plans stay private. AI suggestions are never final until you confirm them.</AppText></View>
        </View>
      ) : !res && mode === "upload" ? (
        <View style={{ gap: 16, paddingTop: 12 }}>
          {!detectedRooms.length ? (
            <>
              <View style={styles.uploadWell}>
                <View style={styles.uploadGlyph}><Icon name="upload-cloud" size={30} color={colors.teal} /></View>
                <AppText variant="title" center style={{ marginTop: 18 }}>Let’s read your plan</AppText>
                <AppText variant="body" muted center style={{ marginTop: 6 }}>Choose a clear, straight-on image with visible room labels. You’ll review every detected room next.</AppText>
                <Button label="Choose an image" icon="image" onPress={pickFloorPlan} loading={parsePlan.isPending} style={{ marginTop: 22 }} />
              </View>
              {uploadError ? <AppText variant="caption" center style={{ color: colors.coralSoft }}>{uploadError}</AppText> : null}
              <Button label="Draw instead" variant="secondary" icon="edit-3" onPress={() => setMode("draw")} />
            </>
          ) : (
            <>
              <AppText variant="caption" style={{ color: colors.teal, letterSpacing: 1.2 }}>CONFIRM DETECTION</AppText>
              <AppText variant="display">Does this look right?</AppText>
              <AppText variant="body" muted>Remove anything the scan got wrong. North orientation can be adjusted before analysis.</AppText>
              <View style={{ gap: 9 }}>
                {detectedRooms.map((room, index) => (
                  <View key={index} style={styles.detectedRow}>
                    <View style={styles.detectedIndex}><AppText variant="caption" style={{ color: colors.ink }}>{index + 1}</AppText></View>
                    <View style={{ flex: 1 }}><AppText variant="body">{room.name || room.room_type || "Room"}</AppText><AppText variant="caption" muted>{room.room_type || "other"}</AppText></View>
                    <MotionPressable onPress={() => setDetectedRooms((items) => items.filter((_, itemIndex) => itemIndex !== index))} hitSlop={10}><Icon name="x" size={18} color={colors.coralSoft} /></MotionPressable>
                  </View>
                ))}
              </View>
              <OrientationControl north={north} setNorth={setNorth} />
              <Button label="Analyze confirmed plan" icon="home" loading={analyze.isPending}
                onPress={() => analyze.mutate({ rooms: detectedRooms, source: "upload" })} />
            </>
          )}
        </View>
      ) : !res ? (
        <View style={{ gap: 16 }}>
          <AppText variant="label" muted style={{ marginLeft: 4 }}>SELECT A ROOM, THEN TAP THE GRID</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
            {ROOM_TYPES.map((r) => (
              <Chip key={r.id} label={r.label} selected={selected === r.id} onPress={() => setSelected(r.id)} testID={`vastu-type-${r.id}`} />
            ))}
          </ScrollView>

          <GlassCard>
            <View style={styles.editToolbar}>
              <MotionPressable onPress={undo} disabled={!past.length} style={{ opacity: past.length ? 1 : 0.35 }}><Icon name="corner-up-left" size={19} color={colors.onSurface} /></MotionPressable>
              <MotionPressable onPress={redo} disabled={!future.length} style={{ opacity: future.length ? 1 : 0.35 }}><Icon name="corner-up-right" size={19} color={colors.onSurface} /></MotionPressable>
              <View style={{ flex: 1 }} />
              <MotionPressable onPress={() => { setPast((items) => [...items, cells]); setCells({}); }} disabled={!painted}><AppText variant="caption" style={{ color: colors.coralSoft }}>Clear</AppText></MotionPressable>
            </View>
            <View style={styles.northRow}>
              <AppText variant="caption" muted>North orientation</AppText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <MotionPressable onPress={() => setNorth((north - 45 + 360) % 360)} testID="vastu-north-left"><Icon name="rotate-ccw" size={18} color={colors.gold} /></MotionPressable>
                <View style={styles.compass}><View style={{ transform: [{ rotate: `${north}deg` }] }}><Icon name="navigation" size={18} color={colors.gold} /></View></View>
                <AppText variant="caption" muted>{north}°</AppText>
                <MotionPressable onPress={() => setNorth((north + 45) % 360)} testID="vastu-north-right"><Icon name="rotate-cw" size={18} color={colors.gold} /></MotionPressable>
              </View>
            </View>
            <View>
              <DirectionLabels north={north} />
              <View style={styles.grid}>
              {Array.from({ length: GRID * GRID }).map((_, i) => {
                const type = cells[i];
                const meta = ROOM_TYPES.find((r) => r.id === type);
                return (
                  <MotionPressable key={i} onPress={() => paint(i)} style={[styles.cell, meta && { backgroundColor: meta.color, borderColor: colors.gold }]} testID={`vastu-cell-${i}`}>
                    {meta ? <AppText variant="caption" style={{ fontSize: 10 }}>{meta.short}</AppText> : null}
                  </MotionPressable>
                );
              })}
              <View pointerEvents="none" style={styles.zoneGuides}>
                <View style={[styles.zoneLineV, { left: "33.33%" }]} /><View style={[styles.zoneLineV, { left: "66.66%" }]} />
                <View style={[styles.zoneLineH, { top: "33.33%" }]} /><View style={[styles.zoneLineH, { top: "66.66%" }]} />
              </View>
              </View>
            </View>
            <AppText variant="caption" muted center style={{ marginTop: 10 }}>Faint lines mark the nine Vastu zones. Rotate North to match your home.</AppText>
          </GlassCard>

          <Button label={`Analyze my home${painted ? ` (${painted} cells)` : ""}`} icon="home"
            disabled={painted === 0} loading={analyze.isPending} onPress={() => analyze.mutate({ rooms: buildRooms() })} testID="vastu-analyze" />
        </View>
      ) : (
        <View style={{ gap: 16, paddingTop: 8 }}>
          <Animated.View entering={pop(0)} style={styles.scoreCard} testID="vastu-score">
            <AppText variant="label" muted center style={{ letterSpacing: 1.2 }}>HOME VASTU SCORE</AppText>
            <View style={{ alignItems: "center", marginTop: 14 }}>
              <ScoreRing size={150} stroke={10} value={(res.analysis.score || 0) / 100} delay={200} colors={["#B9E3E0", colors.gold]}>
                <CountUp value={res.analysis.score || 0} variant="hero" delay={250} />
                <AppText variant="caption" muted>out of 100</AppText>
              </ScoreRing>
            </View>
            <AppText variant="subtitle" center style={{ marginTop: 14 }}>{vastuVerdict(res.analysis.score || 0)}</AppText>
            <View style={styles.tally}>
              <Tally color="#6FCFA0" label="Well placed" count={res.analysis.findings.filter((f: any) => f.severity === "strong" || f.severity === "acceptable").length} />
              <Tally color={colors.gold} label="Neutral" count={res.analysis.findings.filter((f: any) => f.severity === "review").length} />
              <Tally color={colors.coralSoft} label="To review" count={res.analysis.findings.filter((f: any) => f.severity === "attention").length} />
            </View>
          </Animated.View>

          <Animated.View entering={rise(1)} style={styles.card}>
            <AppText variant="label" style={{ color: colors.goldSoft, letterSpacing: 1.1 }}>ZONE MAP</AppText>
            <AppText variant="caption" muted style={{ marginTop: 3, marginBottom: 12 }}>Where each room falls across the eight directions and the centre (Brahmasthan).</AppText>
            <ZoneMap findings={res.analysis.findings} />
          </Animated.View>

          <AppText variant="label" muted style={{ marginLeft: 4, letterSpacing: 1.1 }}>ROOM BY ROOM</AppText>
          {res.analysis.findings.map((f: any, i: number) => {
            const tone = SEVERITY[f.severity] || SEVERITY.review;
            return (
              <Animated.View key={i} entering={rise(i + 2, 50)} style={styles.finding} testID={`vastu-finding-${i}`}>
                <View style={[styles.zoneBadge, { borderColor: tone.color }]}><AppText variant="label" style={{ color: tone.color }}>{f.zone === "Center" ? "C" : f.zone}</AppText></View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <AppText variant="subtitle" style={{ flex: 1, fontSize: 16 }}>{f.room}</AppText>
                    <View style={[styles.statusPill, { backgroundColor: tone.color + "22" }]}><AppText variant="caption" style={{ color: tone.color, fontSize: 11 }}>{tone.label}</AppText></View>
                  </View>
                  <AppText variant="caption" muted style={{ marginTop: 3 }}>{ZONE_NAMES[f.zone] || f.zone} · {ZONE_MEANING[f.zone] || ""}</AppText>
                </View>
              </Animated.View>
            );
          })}
          {res.advice ? (
            <GlassCard testID="vastu-advice"><AppText variant="label" muted>GUIDANCE</AppText><AppText variant="body" style={{ marginTop: 8, lineHeight: 24 }}>{res.advice}</AppText></GlassCard>
          ) : !res.premium ? (
            <LinearGradient colors={["#4A1C45", "#2A1640"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.upsell}>
              <Icon name="bulb" size={24} color={colors.goldSoft} weight="duotone" />
              <AppText variant="title" style={{ marginTop: 10 }}>Get your remedies</AppText>
              <AppText variant="body" muted style={{ marginTop: 6 }}>AstroNow Plus turns each finding into simple fixes: placement, colour and use. No breaking walls.</AppText>
              <Button label="Unlock with Plus" iconRight="arrow-right" onPress={() => router.push("/paywall")} style={{ marginTop: 16 }} testID="vastu-upgrade" shine />
            </LinearGradient>
          ) : null}
          <Button label="Analyze another home" variant="secondary" icon="refresh-cw" onPress={() => { analyze.reset(); setMode("choose"); setCells({}); setDetectedRooms([]); }} testID="vastu-again" />
        </View>
      )}
    </Screen>
  );
}

const SEVERITY: Record<string, { color: string; label: string }> = {
  strong: { color: "#6FCFA0", label: "Ideal" },
  acceptable: { color: "#9CC6F2", label: "Works well" },
  review: { color: "#F2C879", label: "Neutral" },
  attention: { color: "#F0A0BD", label: "Review" },
};
const ZONE_NAMES: Record<string, string> = { N: "North", NE: "North-East", E: "East", SE: "South-East", S: "South", SW: "South-West", W: "West", NW: "North-West", Center: "Centre" };
const ZONE_MEANING: Record<string, string> = {
  N: "Kubera's zone of wealth and opportunity",
  NE: "Ishanya: water, clarity and prayer",
  E: "The rising sun: health and new starts",
  SE: "Agni, the fire zone: energy and cooking",
  S: "Yama's zone of stability and rest",
  SW: "Earth: stability, the head of the family",
  W: "Varuna: gains and fulfilment",
  NW: "Vayu, the air zone: movement and support",
  Center: "Brahmasthan: best kept open and light",
};
const GRID_ZONES = [["NW", "N", "NE"], ["W", "Center", "E"], ["SW", "S", "SE"]];

function vastuVerdict(score: number) {
  if (score >= 85) return "Beautifully aligned home";
  if (score >= 70) return "Well balanced, with a few tweaks";
  if (score >= 50) return "Balanced, some rooms worth reviewing";
  return "Several rooms could use simple remedies";
}

function Tally({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <AppText variant="title" style={{ color }}>{count}</AppText>
      <AppText variant="caption" muted>{label}</AppText>
    </View>
  );
}

function ZoneMap({ findings }: { findings: any[] }) {
  const styles = useStyles();
  return (
    <View style={styles.zoneMap}>
      {GRID_ZONES.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", flex: 1 }}>
          {row.map((zone, c) => {
            const here = findings.filter((f) => f.zone === zone);
            return (
              <Animated.View key={zone} entering={pop(r * 3 + c, 55)} style={[styles.zoneCell, zone === "Center" && { backgroundColor: "rgba(242,200,121,0.06)" }]}>
                <AppText variant="caption" muted style={{ fontSize: 10, letterSpacing: 0.8 }}>{zone === "Center" ? "CENTRE" : zone}</AppText>
                <View style={{ gap: 3, marginTop: 4, alignItems: "center" }}>
                  {here.slice(0, 3).map((f, i) => {
                    const tone = SEVERITY[f.severity] || SEVERITY.review;
                    return <View key={i} style={[styles.roomChip, { backgroundColor: tone.color + "26", borderColor: tone.color + "80" }]}><AppText variant="caption" numberOfLines={1} style={{ fontSize: 10, color: tone.color }}>{f.room}</AppText></View>;
                  })}
                  {here.length > 3 ? <AppText variant="caption" muted style={{ fontSize: 10 }}>+{here.length - 3}</AppText> : null}
                </View>
              </Animated.View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function DirectionLabels({ north }: { north: number }) {
  // Which compass direction sits at the top of the grid for a given North rotation.
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const at = (offset: number) => dirs[((Math.round(-north / 45) + offset) % 8 + 8) % 8];
  const label = (text: string, style: object) => (
    <View style={[{ position: "absolute", zIndex: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: "#1C1638" }, style]}>
      <AppText variant="caption" style={{ fontSize: 10, color: text === "N" ? "#F7DDA6" : "#AAA6BE" }}>{text}</AppText>
    </View>
  );
  return (
    <>
      {label(at(0), { top: -9, alignSelf: "center" })}
      {label(at(2), { right: -6, top: "47%" })}
      {label(at(4), { bottom: -9, alignSelf: "center" })}
      {label(at(6), { left: -6, top: "47%" })}
    </>
  );
}

function CompassMandala() {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 30000, easing: Easing.linear }), -1);
    return () => cancelAnimation(t);
  }, [t, reduced]);
  const outer = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value * 360}deg` }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ rotate: `${-t.value * 360}deg` }] }));
  const dirs = ["N", "E", "S", "W"];
  return (
    <View style={{ width: 170, height: 170, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(111,179,180,0.10)" }} />
      <Animated.View style={[{ position: "absolute", width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: "rgba(242,200,121,0.35)", borderStyle: "dashed" }, outer]} />
      <Animated.View style={[{ position: "absolute", width: 110, height: 110, borderWidth: 1, borderColor: "rgba(185,227,224,0.4)" }, inner]} />
      <Animated.View style={[{ position: "absolute", width: 110, height: 110, borderWidth: 1, borderColor: "rgba(185,227,224,0.25)", transform: [{ rotate: "45deg" }] }]} />
      {dirs.map((d, i) => (
        <View key={d} style={{ position: "absolute", transform: [{ rotate: `${i * 90}deg` }, { translateY: -68 }, { rotate: `${-i * 90}deg` }] }}>
          <AppText variant="label" style={{ color: d === "N" ? "#F7DDA6" : "#AAA6BE", fontSize: 12 }}>{d}</AppText>
        </View>
      ))}
      <LinearGradient colors={["#B9E3E0", "#6FB3B4"]} style={{ width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" }}>
        <Icon name="home" size={26} color="#171326" weight="duotone" />
      </LinearGradient>
    </View>
  );
}

function OrientationControl({ north, setNorth }: { north: number; setNorth: (value: number) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.northRow, { padding: 16, borderRadius: radii.lg, backgroundColor: colors.surfaceSecondary }]}>
      <View><AppText variant="label">Set North</AppText><AppText variant="caption" muted>Do not skip this step</AppText></View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <MotionPressable onPress={() => setNorth((north - 45 + 360) % 360)}><Icon name="rotate-ccw" size={18} color={colors.gold} /></MotionPressable>
        <View style={styles.compass}><View style={{ transform: [{ rotate: north + "deg" }] }}><Icon name="navigation" size={18} color={colors.gold} /></View></View>
        <AppText variant="caption" muted>{north}°</AppText>
        <MotionPressable onPress={() => setNorth((north + 45) % 360)}><Icon name="rotate-cw" size={18} color={colors.gold} /></MotionPressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  northRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  modeCard: { minHeight: 96, flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: radii.xl, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.glassBorder },
  gets: { gap: 12, padding: 18, borderRadius: radii.xl, backgroundColor: "rgba(21,20,43,0.92)", borderWidth: 1, borderColor: colors.border },
  scoreCard: { padding: 20, borderRadius: radii.xl, backgroundColor: "rgba(21,20,43,0.95)", borderWidth: 1, borderColor: colors.glassBorder },
  tally: { flexDirection: "row", marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.divider },
  card: { padding: 18, borderRadius: radii.xl, backgroundColor: "rgba(21,20,43,0.92)", borderWidth: 1, borderColor: colors.border },
  zoneMap: { aspectRatio: 1, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.glassBorder },
  zoneCell: { flex: 1, padding: 6, alignItems: "center", borderWidth: 0.5, borderColor: colors.border },
  roomChip: { maxWidth: 88, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  zoneBadge: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  upsell: { padding: 20, borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(242,200,121,0.3)" },
  zoneGuides: { position: "absolute", inset: 0 },
  zoneLineV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(242,200,121,0.35)" },
  zoneLineH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(242,200,121,0.35)" },
  modeIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  privacy: { flexDirection: "row", gap: 9, padding: 14, alignItems: "flex-start" },
  uploadWell: { minHeight: 330, padding: 24, borderRadius: radii.xl, borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong, backgroundColor: "rgba(21,20,43,0.84)", alignItems: "center", justifyContent: "center" },
  uploadGlyph: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(168,160,232,0.14)" },
  detectedRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  detectedIndex: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.gold },
  editToolbar: { flexDirection: "row", alignItems: "center", gap: 18, paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  compass: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.glassBorder },
  grid: { flexDirection: "row", flexWrap: "wrap", aspectRatio: 1, borderWidth: 1, borderColor: colors.gold, borderRadius: 8, overflow: "hidden" },
  cell: { width: `${100 / GRID}%`, height: `${100 / GRID}%`, borderWidth: 0.5, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  finding: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  dot: { width: 10, height: 10, borderRadius: 999 },
}));
