import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { GlassCard } from "@/src/components/GlassCard";
import { Icon } from "@/src/components/Icon";
import { TextField } from "@/src/components/TextField";
import { useTerms } from "@/src/hooks";
import { makeStyles, radii, useTheme } from "@/src/theme";

export default function CompatibilityScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTerms();

  const [name, setName] = useState("");
  const [day, setDay] = useState(""); const [month, setMonth] = useState(""); const [year, setYear] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [place, setPlace] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<any>(null);

  useEffect(() => {
    if (placeQuery.length < 3 || place) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try { const r = await api.get(`/geo/search?q=${encodeURIComponent(placeQuery)}`); setResults(r.results || []); }
      finally { setSearching(false); }
    }, 400);
  }, [placeQuery, place]);

  const run = useMutation({
    mutationFn: () => {
      const dob = `${year}-${String(+month).padStart(2, "0")}-${String(+day).padStart(2, "0")}`;
      return api.post("/compatibility", {
        name, relation: "partner", dob, birth_time_known: false,
        lat: place.lat, lon: place.lon, tz_name: place.tz_name,
      });
    },
  });

  const ready = name && day && month && year && place;
  const res = run.data;

  return (
    <View style={{ flex: 1 }}>
      <CosmicBackground>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Icon name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
          <View><AppText variant="title">{t("guna_milan", "Compatibility")}</AppText>
            <AppText variant="caption" muted>Match your chart with another</AppText></View>
        </View>
        <KeyboardAwareScrollView bottomOffset={24} showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, paddingTop: 8 }}>
          {!res ? (
            <View style={{ gap: 14 }}>
              <TextField label="Partner's name" value={name} onChangeText={setName} autoCapitalize="words" testID="compat-name" />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TextField label="Day" value={day} onChangeText={setDay} placeholder="DD" keyboardType="number-pad" testID="compat-day" style={{ textAlign: "center" }} />
                <TextField label="Month" value={month} onChangeText={setMonth} placeholder="MM" keyboardType="number-pad" testID="compat-month" style={{ textAlign: "center" }} />
                <TextField label="Year" value={year} onChangeText={setYear} placeholder="YYYY" keyboardType="number-pad" testID="compat-year" style={{ textAlign: "center" }} />
              </View>
              <TextField label="Birthplace" value={placeQuery} onChangeText={(v) => { setPlaceQuery(v); setPlace(null); }} placeholder="Search city…" autoCapitalize="words" testID="compat-place" />
              {searching ? <ActivityIndicator color={colors.gold} /> : null}
              {!place && results.map((r) => (
                <Pressable key={r.place_id} onPress={async () => { setSearching(true); try { const d = await api.get(`/geo/details?place_id=${r.place_id}`); setPlace(d); setPlaceQuery(r.description); setResults([]); } finally { setSearching(false); } }}
                  style={styles.placeRow} testID={`compat-place-${r.place_id}`}>
                  <Icon name="map-pin" size={16} color={colors.muted} /><AppText variant="body" style={{ flex: 1 }}>{r.description}</AppText>
                </Pressable>
              ))}
              {place ? <AppText variant="caption" muted style={{ marginLeft: 4 }}>✓ {place.formatted_address}</AppText> : null}
              <Button label="Check compatibility" icon="heart" onPress={() => run.mutate()} disabled={!ready} loading={run.isPending} style={{ marginTop: 8 }} testID="compat-submit" />
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              <GlassCard testID="compat-result">
                <AppText variant="label" muted center>GUNA MILAN</AppText>
                <AppText variant="hero" center style={{ color: colors.gold, marginTop: 8 }}>{res.guna_milan.total}<AppText variant="title" muted>/36</AppText></AppText>
                <AppText variant="subtitle" center style={{ textTransform: "capitalize", marginTop: 4 }}>{res.guna_milan.verdict.replace("_", " ")}</AppText>
                <AppText variant="caption" muted center style={{ marginTop: 4 }}>Partner Moon sign · {res.partner_moon_sign}</AppText>
              </GlassCard>
              <GlassCard>
                {res.guna_milan.kootas.map((k: any) => (
                  <View key={k.name} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <AppText variant="body">{k.name}</AppText>
                      <AppText variant="caption" muted>{k.obtained}/{k.max}</AppText>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(k.obtained / k.max) * 100}%` }]} />
                    </View>
                  </View>
                ))}
              </GlassCard>
              {res.overview ? (
                <GlassCard testID="compat-overview">
                  <AppText variant="label" muted>OVERVIEW</AppText>
                  <AppText variant="body" style={{ marginTop: 8, lineHeight: 24 }}>{res.overview}</AppText>
                </GlassCard>
              ) : res.locked ? (
                <GlassCard style={{ borderColor: colors.gold }} testID="compat-locked">
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Icon name="lock" size={18} color={colors.gold} />
                    <AppText variant="subtitle" style={{ flex: 1 }}>Unlock the full analysis</AppText>
                  </View>
                  <AppText variant="caption" muted style={{ marginTop: 6 }}>Emotional compatibility, communication and long-term guidance are part of Premium.</AppText>
                  <Button label="Go Premium" icon="star" onPress={() => router.push("/paywall")} style={{ marginTop: 14 }} testID="compat-upgrade" />
                </GlassCard>
              ) : null}
              <Button label="Check another" variant="secondary" icon="refresh-cw" onPress={() => run.reset()} testID="compat-again" />
            </View>
          )}
        </KeyboardAwareScrollView>
      </CosmicBackground>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingBottom: 12 },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  barTrack: { height: 6, borderRadius: 999, backgroundColor: colors.surfaceTertiary, marginTop: 6, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 999, backgroundColor: colors.gold },
}));
