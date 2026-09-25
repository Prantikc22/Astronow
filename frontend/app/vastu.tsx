import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { Easing, FadeInDown, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { CountUp } from "@/src/components/CountUp";
import { FloorPlanEditor, GRID, nameFor, newRoomId, type PlanRoom, type RoomType } from "@/src/components/FloorPlanEditor";
import { ScoreRing } from "@/src/components/ScoreRing";
import { GlassCard } from "@/src/components/GlassCard";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { Screen } from "@/src/components/Screen";
import { useTerms } from "@/src/hooks";
import { pop, rise } from "@/src/motion";
import { makeStyles, radii, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

const ROOM_TYPES: RoomType[] = [
  { id: "entrance", label: "Entrance", short: "En", color: "#9A7B3A" },
  { id: "living", label: "Living", short: "Lv", color: "#2F6273" },
  { id: "kitchen", label: "Kitchen", short: "Ki", color: "#A24B38" },
  { id: "master_bedroom", label: "Master bed", short: "MB", color: "#6A5CA8" },
  { id: "bedroom", label: "Bedroom", short: "Bd", color: "#446C8C" },
  { id: "bathroom", label: "Bath", short: "Ba", color: "#5F7FA0" },
  { id: "toilet", label: "Toilet", short: "To", color: "#5B5B6B" },
  { id: "pooja", label: "Pooja · prayer", short: "Pu", color: "#B08A3E" },
  { id: "dining", label: "Dining", short: "Dn", color: "#7A5E35" },
  { id: "study", label: "Study", short: "St", color: "#5563B0" },
  { id: "staircase", label: "Stairs", short: "Sr", color: "#6B655B" },
  { id: "balcony", label: "Balcony", short: "Bl", color: "#3F7F6A" },
];
const T = (id: string) => ROOM_TYPES.find((t) => t.id === id)!;
const C = 100 / GRID;
const room = (type: string, name: string, x: number, y: number, w: number, h: number): PlanRoom =>
  ({ id: newRoomId(), room_type: type, name, x: x * C, y: y * C, width: w * C, height: h * C });
// Common Indian apartment layouts (BHK = bedrooms, hall, kitchen), drawn North-up.
const TEMPLATES: { id: string; label: string; sub: string; make: () => PlanRoom[] }[] = [
  { id: "1bhk", label: "1BHK", sub: "1-bed apartment", make: () => [
    room("entrance", "Entrance", 5, 0, 2, 2), room("living", "Living", 0, 2, 7, 5), room("kitchen", "Kitchen", 8, 8, 4, 4),
    room("master_bedroom", "Master bed", 0, 8, 6, 4), room("toilet", "Toilet", 7, 0, 3, 2), room("balcony", "Balcony", 8, 2, 4, 3)] },
  { id: "2bhk", label: "2BHK", sub: "2-bed apartment", make: () => [
    room("entrance", "Entrance", 5, 0, 2, 2), room("pooja", "Pooja · prayer", 10, 0, 2, 2), room("living", "Living", 0, 2, 7, 4),
    room("kitchen", "Kitchen", 9, 8, 3, 4), room("master_bedroom", "Master bed", 0, 8, 5, 4), room("bedroom", "Bedroom", 0, 0, 5, 2),
    room("toilet", "Toilet", 5, 10, 3, 2), room("dining", "Dining", 8, 3, 4, 4)] },
  { id: "3bhk", label: "3BHK", sub: "3-bed home", make: () => [
    room("entrance", "Entrance", 6, 0, 2, 2), room("pooja", "Pooja · prayer", 10, 0, 2, 2), room("living", "Living", 3, 2, 6, 4),
    room("kitchen", "Kitchen", 9, 8, 3, 4), room("master_bedroom", "Master bed", 0, 8, 5, 4), room("bedroom", "Bedroom", 0, 2, 3, 4),
    room("bedroom", "Bedroom 2", 0, 0, 5, 2), room("study", "Study", 9, 3, 3, 4), room("toilet", "Toilet", 5, 10, 3, 2), room("dining", "Dining", 5, 7, 4, 3)] },
];

export default function VastuScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTerms();

  const [selected, setSelected] = useState("living");
  const [rooms, setRooms] = useState<PlanRoom[]>([]);
  const [past, setPast] = useState<PlanRoom[][]>([]);
  const [future, setFuture] = useState<PlanRoom[][]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
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

  const commit = (next: PlanRoom[]) => {
    setPast((items) => [...items.slice(-39), rooms]);
    setFuture([]);
    setRooms(next);
  };

  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;
    haptics.selection();
    setFuture((items) => [rooms, ...items]);
    setRooms(previous);
    setPast((items) => items.slice(0, -1));
    setSelectedRoom(null);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    haptics.selection();
    setPast((items) => [...items, rooms]);
    setRooms(next);
    setFuture((items) => items.slice(1));
  };

  const chooseType = (id: string) => {
    setSelected(id);
    // With a room selected, the chip retypes that room instead of arming a new one.
    if (selectedRoom) {
      commit(rooms.map((r) => (r.id === selectedRoom ? { ...r, room_type: id, name: nameFor(T(id), rooms, r.id) } : r)));
    }
  };

  const deleteSelected = () => {
    if (!selectedRoom) return;
    commit(rooms.filter((r) => r.id !== selectedRoom));
    setSelectedRoom(null);
    haptics.warning();
  };

  const openOnCanvas = (list: any[]) => {
    const known = new Set(ROOM_TYPES.map((t) => t.id));
    commit(list.map((r: any) => ({
      id: newRoomId(), room_type: known.has(r.room_type) ? r.room_type : "living", name: r.name || r.room_type || "Room",
      x: Number(r.x) || 0, y: Number(r.y) || 0, width: Math.max(C, Number(r.width) || C * 2), height: Math.max(C, Number(r.height) || C * 2),
    })));
    setMode("draw");
  };

  const buildRooms = () => rooms.map(({ id: _id, ...r }) => r);

  const pickFloorPlan = async () => {
    setUploadError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.75 });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    parsePlan.mutate("data:" + (asset.mimeType || "image/jpeg") + ";base64," + asset.base64);
  };



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
              <View style={{ flex: 1 }}><AppText variant="subtitle">Upload a floor plan</AppText><AppText variant="caption" muted>Photo, screenshot or builder&apos;s plan. We detect the rooms; you confirm.</AppText></View>
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
          <View style={styles.privacy}><Icon name="shield" size={15} color={colors.violet} /><AppText variant="caption" muted style={{ flex: 1 }}>Floor plans stay private. Detected rooms are never final until you confirm them.</AppText></View>
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
              <Button label="Analyse confirmed plan" iconRight="arrow-right" loading={analyze.isPending}
                onPress={() => analyze.mutate({ rooms: detectedRooms, source: "upload" })} />
              <Button label="Fix it on the plan editor" variant="secondary" icon="edit-3" onPress={() => openOnCanvas(detectedRooms)} testID="vastu-open-canvas" />
            </>
          )}
        </View>
      ) : !res ? (
        <View style={{ gap: 14 }}>
          {!rooms.length ? (
            <Animated.View entering={rise(0)}>
              <AppText variant="label" style={{ color: colors.goldSoft, letterSpacing: 1.1 }}>START FROM A LAYOUT</AppText>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                {TEMPLATES.map((tpl) => (
                  <MotionPressable key={tpl.id} onPress={() => { commit(tpl.make()); haptics.medium(); }} style={styles.template} testID={`vastu-template-${tpl.id}`}>
                    <AppText variant="subtitle">{tpl.label}</AppText>
                    <AppText variant="caption" muted>{tpl.sub}</AppText>
                  </MotionPressable>
                ))}
              </View>
            </Animated.View>
          ) : null}

          <View>
            <AppText variant="label" muted style={{ marginLeft: 2, marginBottom: 8, letterSpacing: 1 }}>{selectedRoom ? "CHANGE THIS ROOM TO" : "ROOM TO DRAW"}</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 7, paddingHorizontal: 20 }}>
              {ROOM_TYPES.map((r) => {
                const on = selectedRoom ? rooms.find((x) => x.id === selectedRoom)?.room_type === r.id : selected === r.id;
                return (
                  <MotionPressable key={r.id} onPress={() => chooseType(r.id)} style={[styles.typeChip, on && { borderColor: r.color, backgroundColor: r.color + "40" }]} testID={`vastu-type-${r.id}`}>
                    <View style={[styles.swatch, { backgroundColor: r.color }]} />
                    <AppText variant="caption" style={{ color: on ? colors.onSurface : colors.muted }}>{r.label}</AppText>
                  </MotionPressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.editorCard}>
            <View style={styles.editToolbar}>
              <MotionPressable onPress={undo} disabled={!past.length} style={[styles.toolBtn, { opacity: past.length ? 1 : 0.35 }]} accessibilityLabel="Undo"><Icon name="corner-up-left" size={18} color={colors.onSurface} /></MotionPressable>
              <MotionPressable onPress={redo} disabled={!future.length} style={[styles.toolBtn, { opacity: future.length ? 1 : 0.35 }]} accessibilityLabel="Redo"><Icon name="corner-up-right" size={18} color={colors.onSurface} /></MotionPressable>
              <View style={{ flex: 1 }} />
              <MotionPressable onPress={() => setNorth((north - 45 + 360) % 360)} style={styles.toolBtn} testID="vastu-north-left" accessibilityLabel="Rotate North left"><Icon name="rotate-ccw" size={17} color={colors.goldSoft} /></MotionPressable>
              <View style={styles.compass}><View style={{ transform: [{ rotate: `${north}deg` }] }}><Icon name="navigation" size={16} color={colors.goldSoft} weight="fill" /></View></View>
              <MotionPressable onPress={() => setNorth((north + 45) % 360)} style={styles.toolBtn} testID="vastu-north-right" accessibilityLabel="Rotate North right"><Icon name="rotate-cw" size={17} color={colors.goldSoft} /></MotionPressable>
            </View>
            <View style={{ paddingHorizontal: 8, paddingVertical: 10 }}>
              <FloorPlanEditor rooms={rooms} types={ROOM_TYPES} activeType={T(selected)} north={north}
                selectedId={selectedRoom} onSelect={setSelectedRoom} onCommit={commit} />
            </View>
            {selectedRoom ? (
              <Animated.View entering={FadeInDown.duration(200)} style={styles.selBar}>
                <Icon name="hand-heart" size={15} color={colors.goldSoft} />
                <AppText variant="caption" style={{ flex: 1, color: colors.onSurface }}>Drag to move · pick a type above to change it</AppText>
                <MotionPressable onPress={deleteSelected} style={styles.deleteBtn} haptic="none" testID="vastu-delete-room"><Icon name="x" size={14} color={colors.coralSoft} /><AppText variant="caption" style={{ color: colors.coralSoft }}>Remove</AppText></MotionPressable>
              </Animated.View>
            ) : (
              <AppText variant="caption" muted center style={{ paddingBottom: 12 }}>Gold lines mark the nine Vastu zones · North {north}°</AppText>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {rooms.length ? <Button label="Clear" variant="ghost" full={false} onPress={() => { commit([]); setSelectedRoom(null); }} haptic="warning" testID="vastu-clear" /> : null}
            <Button label={rooms.length ? `Analyse ${rooms.length} room${rooms.length === 1 ? "" : "s"}` : "Draw a room to begin"} iconRight="arrow-right"
              disabled={!rooms.length} loading={analyze.isPending} onPress={() => analyze.mutate({ rooms: buildRooms() })} testID="vastu-analyze" full={false} style={{ flex: 1 }} shine={rooms.length > 2} />
          </View>
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
          <Button label="Analyze another home" variant="secondary" icon="refresh-cw" onPress={() => { analyze.reset(); setMode("choose"); setRooms([]); setPast([]); setFuture([]); setSelectedRoom(null); setDetectedRooms([]); }} testID="vastu-again" />
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
  editToolbar: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  compass: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.glassBorder },
  grid: { flexDirection: "row", flexWrap: "wrap", aspectRatio: 1, borderWidth: 1, borderColor: colors.gold, borderRadius: 8, overflow: "hidden" },
  template: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(28,27,52,0.95)", borderWidth: 1, borderColor: colors.glassBorder },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 7, height: 36, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(28,27,52,0.9)" },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  editorCard: { borderRadius: radii.xl, backgroundColor: "rgba(21,20,43,0.95)", borderWidth: 1, borderColor: colors.border, overflow: "visible" },
  toolBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  selBar: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginBottom: 12, padding: 10, borderRadius: 10, backgroundColor: "rgba(242,200,121,0.08)", borderWidth: 1, borderColor: "rgba(242,200,121,0.25)" },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, height: 30, borderRadius: 8, backgroundColor: "rgba(240,160,189,0.12)" },
  finding: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  dot: { width: 10, height: 10, borderRadius: 999 },
}));
