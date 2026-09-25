import React, { useMemo, useState } from "react";
import { GestureResponderEvent, View } from "react-native";
import Animated, { FadeIn, ZoomIn, useSharedValue } from "react-native-reanimated";

import { AppText } from "@/src/components/AppText";
import { makeStyles, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

export type PlanRoom = { id: string; room_type: string; name: string; x: number; y: number; width: number; height: number };
export type RoomType = { id: string; label: string; short: string; color: string };

export const GRID = 12;
const CELL = 100 / GRID;
const snap = (v: number) => Math.max(0, Math.min(GRID, Math.round(v / CELL))) * CELL;
const floorCell = (v: number) => Math.max(0, Math.min(GRID - 1, Math.floor(v / CELL))) * CELL;

let seq = 0;
export const newRoomId = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

export function nameFor(type: RoomType, rooms: PlanRoom[], exceptId?: string) {
  const same = rooms.filter((r) => r.room_type === type.id && r.id !== exceptId).length;
  return same ? `${type.label} ${same + 1}` : type.label;
}

/**
 * Drag on empty space to draw a room (snapped to a 12×12 grid). Tap a room to
 * select it; drag a selected room to move it. North labels follow `north`.
 */
export function FloorPlanEditor({ rooms, types, activeType, north, selectedId, onSelect, onCommit }: {
  rooms: PlanRoom[]; types: RoomType[]; activeType: RoomType; north: number;
  selectedId: string | null; onSelect: (id: string | null) => void; onCommit: (rooms: PlanRoom[]) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [size, setSize] = useState(0);
  const [draft, setDraft] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [moving, setMoving] = useState<{ id: string; dx: number; dy: number } | null>(null);
  // Drag origin, read and written only from gesture callbacks.
  const start = useSharedValue<{ x: number; y: number; mode: "draw" | "move"; id?: string } | null>(null);
  const colorOf = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t])), [types]);

  const pct = (px: number) => (size ? (px / size) * 100 : 0);
  const hit = (x: number, y: number) => [...rooms].reverse().find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);

  const begin = (px: number, py: number) => {
    const x = pct(px), y = pct(py);
    const room = selectedId ? rooms.find((r) => r.id === selectedId) : undefined;
    if (room && x >= room.x && x <= room.x + room.width && y >= room.y && y <= room.y + room.height) {
      start.set({ x, y, mode: "move", id: room.id });
      haptics.soft();
    } else {
      start.set({ x: floorCell(x), y: floorCell(y), mode: "draw" });
      onSelect(null);
    }
  };
  const update = (px: number, py: number) => {
    const s = start.get(); if (!s) return;
    const x = pct(px), y = pct(py);
    if (s.mode === "move" && s.id) {
      setMoving({ id: s.id, dx: Math.round((x - s.x) / CELL) * CELL, dy: Math.round((y - s.y) / CELL) * CELL });
      return;
    }
    const x2 = Math.max(s.x + CELL, snap(Math.max(x, s.x) + CELL / 2));
    const y2 = Math.max(s.y + CELL, snap(Math.max(y, s.y) + CELL / 2));
    const x1 = x < s.x ? floorCell(x) : s.x;
    const y1 = y < s.y ? floorCell(y) : s.y;
    const next = { x: x1, y: y1, width: (x < s.x ? s.x + CELL : x2) - x1, height: (y < s.y ? s.y + CELL : y2) - y1 };
    setDraft((prev) => {
      if (prev && (prev.width !== next.width || prev.height !== next.height)) haptics.selection();
      return next;
    });
  };
  const end = () => {
    const s = start.get();
    start.set(null);
    if (s?.mode === "move" && s.id && moving) {
      const room = rooms.find((r) => r.id === s.id)!;
      const x = Math.max(0, Math.min(100 - room.width, room.x + moving.dx));
      const y = Math.max(0, Math.min(100 - room.height, room.y + moving.dy));
      setMoving(null);
      if (x !== room.x || y !== room.y) { onCommit(rooms.map((r) => (r.id === s.id ? { ...r, x, y } : r))); haptics.light(); }
      return;
    }
    setMoving(null);
    if (draft) {
      const room: PlanRoom = { id: newRoomId(), room_type: activeType.id, name: nameFor(activeType, rooms), ...draft };
      onCommit([...rooms, room]);
      onSelect(room.id);
      haptics.medium();
    }
    setDraft(null);
  };
  const tap = (px: number, py: number) => {
    const room = hit(pct(px), pct(py));
    if (room) { onSelect(room.id === selectedId ? null : room.id); haptics.selection(); return; }
    // A tap on empty floor drops a 2×2 room of the active type.
    const x = Math.min(100 - CELL * 2, floorCell(pct(px))), y = Math.min(100 - CELL * 2, floorCell(pct(py)));
    const created: PlanRoom = { id: newRoomId(), room_type: activeType.id, name: nameFor(activeType, rooms), x, y, width: CELL * 2, height: CELL * 2 };
    onCommit([...rooms, created]);
    onSelect(created.id);
    haptics.medium();
  };

  // Built-in responder system: identical on iOS, Android and web. Children are
  // pointerEvents="none" so locationX/Y are always relative to the canvas.
  const touch = useSharedValue({ x: 0, y: 0, t: 0, moved: false });
  const responder = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponderCapture: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      const { locationX, locationY } = e.nativeEvent;
      touch.set({ x: locationX, y: locationY, t: Date.now(), moved: false });
      begin(locationX, locationY);
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const { locationX, locationY } = e.nativeEvent;
      const t = touch.get();
      if (!t.moved && Math.hypot(locationX - t.x, locationY - t.y) < 6) return;
      if (!t.moved) touch.set({ ...t, moved: true });
      update(locationX, locationY);
    },
    onResponderRelease: () => {
      const t = touch.get();
      if (!t.moved && Date.now() - t.t < 350) { start.set(null); tap(t.x, t.y); return; }
      end();
    },
    onResponderTerminate: () => { start.set(null); setDraft(null); setMoving(null); },
  };

  return (
    <View>
      <DirectionLabels north={north} />
      <View style={styles.canvas} onLayout={(e) => setSize(e.nativeEvent.layout.width)} testID="vastu-canvas" {...responder}>
          {Array.from({ length: GRID - 1 }, (_, i) => (
            <React.Fragment key={i}>
              <View pointerEvents="none" style={[styles.gridV, { left: `${(i + 1) * CELL}%` }, (i + 1) % 4 === 0 && styles.zone]} />
              <View pointerEvents="none" style={[styles.gridH, { top: `${(i + 1) * CELL}%` }, (i + 1) % 4 === 0 && styles.zone]} />
            </React.Fragment>
          ))}
          {rooms.map((room) => {
            const t = colorOf[room.room_type] || types[0];
            const m = moving?.id === room.id ? moving : null;
            const selected = room.id === selectedId;
            const small = room.width < CELL * 2 || room.height < CELL * 2;
            return (
              <Animated.View key={room.id} pointerEvents="none" entering={ZoomIn.springify().damping(14)}
                style={[styles.room, {
                  left: `${room.x + (m?.dx || 0)}%`, top: `${room.y + (m?.dy || 0)}%`, width: `${room.width}%`, height: `${room.height}%`,
                  backgroundColor: t.color + (selected ? "F2" : "CC"), borderColor: selected ? colors.goldSoft : t.color,
                }, selected && styles.roomSelected, m && { opacity: 0.85 }]}>
                <AppText numberOfLines={2} center style={[styles.roomLabel, small && { fontSize: 9 }]}>{small ? t.short : room.name}</AppText>
              </Animated.View>
            );
          })}
          {draft ? (
            <Animated.View pointerEvents="none" entering={FadeIn.duration(100)} style={[styles.draft, { left: `${draft.x}%`, top: `${draft.y}%`, width: `${draft.width}%`, height: `${draft.height}%`, borderColor: activeType.color, backgroundColor: activeType.color + "55" }]}>
              <AppText style={styles.roomLabel}>{activeType.label}</AppText>
            </Animated.View>
          ) : null}
          {!rooms.length && !draft ? (
            <View pointerEvents="none" style={styles.empty}>
              <AppText variant="subtitle" center>Drag to draw a room</AppText>
              <AppText variant="caption" muted center style={{ marginTop: 4 }}>Or tap anywhere to drop one. Pick the room type above first.</AppText>
            </View>
          ) : null}
      </View>
    </View>
  );
}

export function DirectionLabels({ north }: { north: number }) {
  // Which compass direction sits at each edge of the plan for a given North rotation.
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const at = (offset: number) => dirs[((Math.round(-north / 45) + offset) % 8 + 8) % 8];
  const label = (text: string, style: object) => (
    <View pointerEvents="none" style={[{ position: "absolute", zIndex: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: "#1C1638", borderWidth: 1, borderColor: text === "N" ? "rgba(247,221,166,0.5)" : "rgba(235,226,250,0.14)" }, style]}>
      <AppText variant="caption" style={{ fontSize: 10, color: text === "N" ? "#F7DDA6" : "#AAA6BE" }}>{text}</AppText>
    </View>
  );
  return (
    <>
      {label(at(0), { top: -10, alignSelf: "center" })}
      {label(at(2), { right: -8, top: "47%" })}
      {label(at(4), { bottom: -10, alignSelf: "center" })}
      {label(at(6), { left: -8, top: "47%" })}
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  canvas: { aspectRatio: 1, borderRadius: 10, overflow: "hidden", backgroundColor: "#12102A", borderWidth: 1, borderColor: "rgba(242,200,121,0.45)" },
  gridV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(235,226,250,0.05)" },
  gridH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(235,226,250,0.05)" },
  zone: { backgroundColor: "rgba(242,200,121,0.28)" },
  room: { position: "absolute", borderWidth: 1.5, borderRadius: 4, alignItems: "center", justifyContent: "center", padding: 2 },
  roomSelected: { borderWidth: 2, shadowColor: colors.gold, shadowOpacity: 0.7, shadowRadius: 8, zIndex: 2 },
  roomLabel: { fontSize: 11, lineHeight: 13, color: "#FFF9EE", fontFamily: "NunitoSans-Bold" },
  draft: { position: "absolute", borderWidth: 1.5, borderStyle: "dashed", borderRadius: 4, alignItems: "center", justifyContent: "center" },
  empty: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", padding: 30 },
}));
