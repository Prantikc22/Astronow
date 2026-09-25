import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { Chip } from "@/src/components/Chip";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { GlassCard } from "@/src/components/GlassCard";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { TextField } from "@/src/components/TextField";
import { useTerms } from "@/src/hooks";
import { getCustomerInfo, hasPurchasedProduct } from "@/src/services/purchases";
import { useAuth } from "@/src/store/auth";
import { makeStyles, useTheme } from "@/src/theme";

export default function CompatibilityScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ relation?: string }>();
  const { t } = useTerms();
  const { user, profile } = useAuth();

  const [name, setName] = useState("");
  const [relation, setRelation] = useState(params.relation || "love");
  const [day, setDay] = useState(""); const [month, setMonth] = useState(""); const [year, setYear] = useState("");
  const [timeKnown, setTimeKnown] = useState(false);
  const [birthTime, setBirthTime] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [place, setPlace] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const debounce = useRef<any>(null);

  useEffect(() => {
    if (placeQuery.length < 3 || place) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      setPlaceError(null);
      try { const r = await api.get(`/geo/search?q=${encodeURIComponent(placeQuery)}`); setResults(r.results || []); if (!(r.results || []).length) setPlaceError("No matching city found. Try another spelling."); }
      catch (e: any) { setResults([]); setPlaceError(e?.message || "Birthplace search is temporarily unavailable."); }
      finally { setSearching(false); }
    }, 400);
  }, [placeQuery, place]);

  const run = useMutation({
    mutationFn: () => {
      const dob = `${year}-${String(+month).padStart(2, "0")}-${String(+day).padStart(2, "0")}`;
      return api.post("/compatibility", {
        name, relation, dob, birth_time_known: timeKnown,
        birth_time: timeKnown ? birthTime : null,
        lat: place.lat, lon: place.lon, tz_name: place.tz_name,
      });
    },
  });

  const parsedDate = new Date(+year, +month - 1, +day);
  const timeParts = /^(\d{1,2}):(\d{2})$/.exec(birthTime.trim());
  const validTime = !!timeParts && +timeParts[1] < 24 && +timeParts[2] < 60;
  const ready = !!(name.trim() && day && month && year && place && +year > 1900 && parsedDate.getFullYear() === +year && parsedDate.getMonth() === +month - 1 && parsedDate.getDate() === +day && parsedDate <= new Date() && (!timeKnown || validTime));
  const res = run.data;
  const { data: customerInfo } = useQuery({ queryKey: ["customer-info", user?.id], queryFn: () => getCustomerInfo(user?.id), retry: false });
  const matchUnlocked = hasPurchasedProduct(customerInfo, "report_match");

  return (
    <View style={{ flex: 1 }}>
      <CosmicBackground>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <MotionPressable onPress={() => router.back()} hitSlop={12}><Icon name="chevron-left" size={26} color={colors.onSurface} /></MotionPressable>
          <View><AppText variant="title">{t("guna_milan", "Compatibility")}</AppText>
            <AppText variant="caption" muted>A balanced reading for two charts</AppText></View>
        </View>
        <KeyboardAwareScrollView bottomOffset={24} showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, paddingTop: 8 }}>
          {!res ? (
            <View style={{ gap: 14 }}>
              <View>
                <AppText variant="label" muted style={{ marginBottom: 9 }}>WHAT KIND OF CONNECTION?</AppText>
                <View style={styles.relationRow}>{["love", "marriage", "friendship", "business"].map((item) => <Chip key={item} label={item.charAt(0).toUpperCase() + item.slice(1)} selected={relation === item} onPress={() => setRelation(item)} />)}</View>
              </View>
              <TextField label={`${relation === "business" ? "Person's" : relation === "friendship" ? "Friend's" : "Partner's"} name`} value={name} onChangeText={setName} autoCapitalize="words" testID="compat-name" />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TextField label="Day" value={day} onChangeText={setDay} placeholder="DD" keyboardType="number-pad" testID="compat-day" containerStyle={{ flex: 1, minWidth: 0 }} style={{ textAlign: "center" }} />
                <TextField label="Month" value={month} onChangeText={setMonth} placeholder="MM" keyboardType="number-pad" testID="compat-month" containerStyle={{ flex: 1, minWidth: 0 }} style={{ textAlign: "center" }} />
                <TextField label="Year" value={year} onChangeText={setYear} placeholder="YYYY" keyboardType="number-pad" testID="compat-year" containerStyle={{ flex: 1, minWidth: 0 }} style={{ textAlign: "center" }} />
              </View>
              <MotionPressable onPress={() => setTimeKnown(!timeKnown)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 3 }} testID="compat-time-toggle">
                <Icon name={timeKnown ? "check-circle" : "circle"} size={21} color={timeKnown ? colors.gold : colors.muted} />
                <AppText variant="body">I know their birth time</AppText>
              </MotionPressable>
              {timeKnown ? <TextField label="Birth time (24-hour)" value={birthTime} onChangeText={setBirthTime} placeholder="09:30" keyboardType="numbers-and-punctuation" testID="compat-time" /> :
                <AppText variant="caption" muted>The score is approximate without a birth time; the Moon can change position during a day.</AppText>}
              <TextField label="Birthplace" value={placeQuery} onChangeText={(v) => { setPlaceQuery(v); setPlace(null); setPlaceError(null); }} placeholder="Search city…" autoCapitalize="words" testID="compat-place" />
              {searching ? <ActivityIndicator color={colors.gold} /> : null}
              {placeError ? <AppText variant="caption" style={{ color: colors.coralSoft }}>{placeError}</AppText> : null}
              {!place && results.map((r) => (
                <MotionPressable key={r.place_id} onPress={async () => { setSearching(true); try { const d = await api.get(`/geo/details?place_id=${r.place_id}`); setPlace(d); setPlaceQuery(r.description); setResults([]); } finally { setSearching(false); } }}
                  style={styles.placeRow} testID={`compat-place-${r.place_id}`}>
                  <Icon name="map-pin" size={16} color={colors.muted} /><AppText variant="body" style={{ flex: 1 }}>{r.description}</AppText>
                </MotionPressable>
              ))}
              {place ? <AppText variant="caption" muted style={{ marginLeft: 4 }}>✓ {place.formatted_address}</AppText> : null}
              <Button label="Check compatibility" icon="heart" onPress={() => run.mutate()} disabled={!ready} loading={run.isPending} style={{ marginTop: 8 }} testID="compat-submit" />
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              <View style={styles.reportHeading}>
                <View style={styles.reportSeal}><Icon name="heart" size={26} color={colors.gold} weight="duotone" /></View>
                <AppText variant="label" style={{ color: colors.coralSoft }}>ASTRONOW {relation.toUpperCase()} MATCH</AppText>
                <AppText variant="display" center style={{ marginTop: 5 }}>You & {name}</AppText>
                <AppText variant="body" muted center style={{ marginTop: 6 }}>A reflective compatibility reading built from both birth charts.</AppText>
              </View>
              <GlassCard testID="compat-result">
                <AppText variant="label" muted center>Vedic compatibility · Guna Milan</AppText>
                <AppText variant="hero" center style={{ color: colors.gold, marginTop: 8 }}>{res.guna_milan.total}<AppText variant="title" muted>/36</AppText></AppText>
                <AppText variant="subtitle" center style={{ textTransform: "capitalize", marginTop: 4 }}>{res.guna_milan.verdict.replace("_", " ")}</AppText>
                <AppText variant="caption" muted center style={{ marginTop: 4 }}>Partner Moon sign · {res.partner_moon_sign}</AppText>
                {!timeKnown || profile?.birth_time_known === false ? <AppText variant="caption" muted center style={{ marginTop: 6 }}>Approximate score · exact birth times improve precision</AppText> : null}
              </GlassCard>
              <GlassCard style={{ borderColor: colors.borderStrong }}>
                <AppText variant="label" style={{ color: colors.gold }}>YOUR MATCH AT A GLANCE</AppText>
                <AppText variant="title" style={{ marginTop: 8 }}>{matchHeadline(res.guna_milan.total)}</AppText>
                <AppText variant="body" muted style={{ marginTop: 8, lineHeight: 24 }}>{matchPreview(res.guna_milan.total, res.partner_moon_sign)}</AppText>
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
              {matchUnlocked ? (
                <View style={{ gap: 12 }} testID="match-full-report">
                  {matchSections(res).map(([title, copy], index) => <GlassCard key={title}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><View style={styles.sectionNumber}><AppText variant="label" style={{ color: colors.ink }}>{index + 1}</AppText></View><AppText variant="title" style={{ flex: 1 }}>{title}</AppText></View>
                    <AppText variant="body" muted style={{ marginTop: 10, lineHeight: 24 }}>{copy}</AppText>
                  </GlassCard>)}
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {res.overview ? <GlassCard testID="compat-overview"><AppText variant="label" muted>PLUS OVERVIEW</AppText><AppText variant="body" style={{ marginTop: 8, lineHeight: 24 }}>{res.overview}</AppText></GlassCard> : null}
                  <GlassCard style={{ borderColor: colors.gold }} testID="compat-locked">
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Icon name="lock" size={18} color={colors.gold} />
                      <AppText variant="subtitle" style={{ flex: 1 }}>Unlock your complete Match Report</AppText>
                    </View>
                    <AppText variant="caption" muted style={{ marginTop: 6 }}>Emotional rhythm, communication, shared direction, growth edges and practical next steps. One-time unlock for your saved birth profile.</AppText>
                    <Button label="Get full Match Report · ₹249" icon="arrow-right" onPress={() => router.push("/report-offer/match-report" as any)} style={{ marginTop: 14 }} testID="compat-upgrade" />
                  </GlassCard>
                </View>
              )}
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
  relationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  barTrack: { height: 6, borderRadius: 999, backgroundColor: colors.surfaceTertiary, marginTop: 6, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 999, backgroundColor: colors.gold },
  reportHeading: { alignItems: "center", paddingTop: 14, paddingBottom: 4 },
  reportSeal: { width: 64, height: 64, borderRadius: 24, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.glassBorder, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  sectionNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
}));

function matchHeadline(score: number) {
  if (score >= 28) return "A naturally supportive foundation";
  if (score >= 20) return "Real potential, strengthened by awareness";
  return "A bond that benefits from conscious effort";
}

function matchPreview(score: number, moonSign: string) {
  return `Your traditional score is ${score}/36. With your partner's Moon in ${moonSign}, the useful question is not whether a score guarantees an outcome, but how both of you can make emotional needs, expectations and repair more visible.`;
}

function matchSections(res: any): [string, string][] {
  const score = res.guna_milan.total;
  const top = [...res.guna_milan.kootas].sort((a: any, b: any) => (b.obtained / b.max) - (a.obtained / a.max))[0]?.name || "shared rhythm";
  const growth = [...res.guna_milan.kootas].sort((a: any, b: any) => (a.obtained / a.max) - (b.obtained / b.max))[0]?.name || "communication";
  return [
    ["Emotional rhythm", `A score of ${score}/36 suggests ${score >= 24 ? "a supportive emotional base" : "a relationship that rewards explicit reassurance"}. Your partner's ${res.partner_moon_sign} Moon adds its own pace and way of seeking safety.`],
    ["Natural strength", `${top} is one of the stronger signals in this match. Let that strength become something practical: a shared ritual, a reliable way to repair, or a decision process you both trust.`],
    ["The growth edge", `${growth} deserves the most conscious attention. A lower traditional sub-score is not a verdict; it is a prompt to replace assumption with direct, kind conversation.`],
    ["Shared direction", "Discuss what a good year looks like for each of you—in work, family, money and rest. Compatibility becomes durable when two private futures can be negotiated into one honest plan."],
    ["A 30-day practice", "Choose one weekly check-in with three questions: What felt supportive? What felt missed? What do we need next week? Small, repeatable repair builds more trust than dramatic promises."],
  ];
}
