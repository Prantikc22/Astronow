import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import Animated from "react-native-reanimated";

import { api, ApiError } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { Screen } from "@/src/components/Screen";
import { TextField } from "@/src/components/TextField";
import { rise } from "@/src/motion";
import { useActiveProfile } from "@/src/store/active-profile";
import { makeStyles, radii, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

const RELATIONS = ["Mother", "Father", "Partner", "Child", "Sibling", "Friend", "Other"];

export default function AddFamilyMember() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { setActive, refetch } = useActiveProfile();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<string | null>(null);
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [timeKnown, setTimeKnown] = useState(true);
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");
  const [placeQuery, setPlaceQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [place, setPlace] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (placeQuery.length < 3 || place) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.get(`/geo/search?q=${encodeURIComponent(placeQuery)}`);
        setResults(r.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [placeQuery, place]);

  const selectPlace = async (pid: string, desc: string) => {
    setSearching(true);
    try {
      const d = await api.get(`/geo/details?place_id=${pid}`);
      setPlace({ ...d, description: desc });
      setPlaceQuery(desc);
      setResults([]);
      haptics.selection();
    } finally {
      setSearching(false);
    }
  };

  const parsed = new Date(+year, +month - 1, +day);
  const dateOk = !!(day && month && year && +year > 1900 && parsed.getFullYear() === +year && parsed.getMonth() === +month - 1 && parsed.getDate() === +day && parsed <= new Date());
  const timeOk = !timeKnown || !!(hour && minute && +hour >= 1 && +hour <= 12 && +minute >= 0 && +minute <= 59);
  const ready = name.trim().length > 0 && dateOk && timeOk && !!place;

  const save = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const h = (+hour % 12) + (ampm === "PM" ? 12 : 0);
      const member = await api.post("/family", {
        name: name.trim(), relation,
        dob: `${year}-${String(+month).padStart(2, "0")}-${String(+day).padStart(2, "0")}`,
        birth_time: timeKnown ? `${String(h).padStart(2, "0")}:${String(+minute).padStart(2, "0")}` : null,
        birth_time_known: timeKnown, birthplace: place.formatted_address || place.description,
        lat: place.lat, lon: place.lon, tz_name: place.tz_name,
      });
      haptics.success();
      await qc.invalidateQueries({ queryKey: ["family"] });
      refetch();
      setActive(member.id);
      router.back();
    } catch (e: any) {
      if (e instanceof ApiError && (e.status === 402 || e.payload?.paywall)) {
        router.replace("/paywall");
        return;
      }
      setError(e?.message || "We couldn't save this profile. Please try again.");
      haptics.error();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Add a family member" subtitle="See their day, their chart and your match" back>
      <View style={{ gap: 18, paddingTop: 8 }}>
        <Animated.View entering={rise(0)}>
          <TextField label="Name" value={name} onChangeText={setName} placeholder="Their first name" autoCapitalize="words" testID="family-name" />
        </Animated.View>

        <Animated.View entering={rise(1)}>
          <AppText variant="label" muted style={{ marginLeft: 4, marginBottom: 8 }}>Relation</AppText>
          <View style={styles.chips}>
            {RELATIONS.map((r) => (
              <MotionPressable key={r} onPress={() => setRelation(relation === r ? null : r)} style={[styles.chip, relation === r && styles.chipOn]} testID={`family-rel-${r}`}>
                <AppText variant="caption" style={{ color: relation === r ? colors.ink : colors.onSurface }}>{r}</AppText>
              </MotionPressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={rise(2)}>
          <AppText variant="label" muted style={{ marginLeft: 4, marginBottom: 6 }}>Date of birth</AppText>
          <View style={styles.row}>
            <TextField value={day} onChangeText={setDay} placeholder="DD" keyboardType="number-pad" maxLength={2} containerStyle={{ flex: 1 }} style={{ textAlign: "center" }} testID="family-day" />
            <TextField value={month} onChangeText={setMonth} placeholder="MM" keyboardType="number-pad" maxLength={2} containerStyle={{ flex: 1 }} style={{ textAlign: "center" }} testID="family-month" />
            <TextField value={year} onChangeText={setYear} placeholder="YYYY" keyboardType="number-pad" maxLength={4} containerStyle={{ flex: 1.4 }} style={{ textAlign: "center" }} testID="family-year" />
          </View>
        </Animated.View>

        <Animated.View entering={rise(3)}>
          <AppText variant="label" muted style={{ marginLeft: 4, marginBottom: 6 }}>Time of birth</AppText>
          {timeKnown ? (
            <View style={styles.row}>
              <TextField value={hour} onChangeText={setHour} placeholder="HH" keyboardType="number-pad" maxLength={2} containerStyle={{ flex: 1 }} style={{ textAlign: "center" }} testID="family-hour" />
              <TextField value={minute} onChangeText={setMinute} placeholder="MM" keyboardType="number-pad" maxLength={2} containerStyle={{ flex: 1 }} style={{ textAlign: "center" }} testID="family-minute" />
              <View style={styles.ampm}>
                {(["AM", "PM"] as const).map((p) => (
                  <MotionPressable key={p} onPress={() => setAmpm(p)} style={[styles.ampmBtn, ampm === p && { backgroundColor: colors.gold }]}>
                    <AppText variant="label" style={{ color: ampm === p ? colors.ink : colors.onSurface }}>{p}</AppText>
                  </MotionPressable>
                ))}
              </View>
            </View>
          ) : null}
          <MotionPressable onPress={() => setTimeKnown(!timeKnown)} style={styles.checkRow} testID="family-time-unknown">
            <View style={[styles.check, !timeKnown && { backgroundColor: colors.gold, borderColor: colors.gold }]}>
              {!timeKnown ? <Icon name="check" size={13} color={colors.ink} /> : null}
            </View>
            <AppText variant="caption" style={{ color: colors.onSurface }}>Birth time unknown</AppText>
          </MotionPressable>
        </Animated.View>

        <Animated.View entering={rise(4)}>
          <TextField label="Birthplace" value={placeQuery} onChangeText={(t) => { setPlaceQuery(t); setPlace(null); }} placeholder="Search city…" autoCapitalize="words" testID="family-place" />
          {searching ? <ActivityIndicator color={colors.gold} style={{ marginTop: 10 }} /> : null}
          {results.map((r) => (
            <MotionPressable key={r.place_id} onPress={() => selectPlace(r.place_id, r.description)} style={styles.placeRow} testID={`family-place-${r.place_id}`}>
              <Icon name="map-pin" size={15} color={colors.muted} />
              <AppText variant="body" style={{ flex: 1 }}>{r.description}</AppText>
            </MotionPressable>
          ))}
          {place ? (
            <View style={styles.placeOk}>
              <Icon name="check-circle" size={15} color={colors.goldSoft} />
              <AppText variant="caption" muted style={{ flex: 1 }}>{place.formatted_address} · {place.tz_name}</AppText>
            </View>
          ) : null}
        </Animated.View>

        {error ? <AppText variant="caption" style={{ color: colors.coralSoft }}>{error}</AppText> : null}
        <Button label="Save and view their day" iconRight="arrow-right" onPress={save} disabled={!ready} loading={busy} shine={ready} testID="family-save" />
        <AppText variant="caption" muted center>Their details stay private to your account. Remove them anytime from Profile.</AppText>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 13, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(28,27,52,0.9)" },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  row: { flexDirection: "row", gap: 10 },
  ampm: { flex: 1.2, flexDirection: "row", borderRadius: radii.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  ampmBtn: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, paddingVertical: 4 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.divider },
  placeOk: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, padding: 11, borderRadius: 10, backgroundColor: "rgba(242,200,121,0.08)" },
}));
