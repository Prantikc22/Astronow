import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { Button } from "@/src/components/Button";
import { Chip } from "@/src/components/Chip";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { READING_LANGUAGES } from "@/src/content/languages";
import { TextField } from "@/src/components/TextField";
import { useAuth } from "@/src/store/auth";
import { makeStyles, radii, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

const INTERESTS = ["Love", "Marriage", "Career", "Money", "Family",
  "Personal growth", "Health & wellbeing", "Spirituality", "Home", "Important decisions"];
const TERMS = [
  { id: "simple", title: "Plain language", sub: "Birth chart, birth star, major life period" },
  { id: "traditional", title: "Traditional", sub: "Kundli, Nakshatra, Mahadasha" },
  { id: "both", title: "Both", sub: "Birth Chart · Kundli" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Onboarding() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isCorrection = mode === "correction";
  const { refresh, profile } = useAuth();
  const savedDate = isCorrection ? String(profile?.dob || "").slice(0, 10).split("-") : [];
  const savedTime = isCorrection ? String(profile?.birth_time || "").slice(0, 5).split(":") : [];
  const savedHour = savedTime.length === 2 ? +savedTime[0] : 0;

  const [step, setStep] = useState(isCorrection ? 1 : 0);
  const [firstName, setFirstName] = useState(isCorrection ? profile?.first_name || "" : "");
  const [day, setDay] = useState(savedDate.length === 3 ? String(+savedDate[2]) : "");
  const [month, setMonth] = useState(savedDate.length === 3 ? String(+savedDate[1]) : "");
  const [year, setYear] = useState(savedDate.length === 3 ? savedDate[0] : "");
  const [timeKnown, setTimeKnown] = useState(isCorrection ? profile?.birth_time_known !== false : true);
  const [hour, setHour] = useState(savedTime.length === 2 ? String(savedHour % 12 || 12) : "");
  const [minute, setMinute] = useState(savedTime.length === 2 ? savedTime[1] : "");
  const [ampm, setAmpm] = useState<"AM" | "PM">(savedHour >= 12 ? "PM" : "AM");
  const [placeQuery, setPlaceQuery] = useState(isCorrection ? profile?.birthplace || "" : "");
  const [results, setResults] = useState<{ place_id: string; description: string }[]>([]);
  const [place, setPlace] = useState<any>(isCorrection && profile?.lat != null && profile?.lon != null ? { formatted_address: profile.birthplace, description: profile.birthplace, lat: profile.lat, lon: profile.lon, tz_name: profile.tz_name } : null);
  const [searching, setSearching] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [terminology, setTerminology] = useState("both");
  const [readingLanguage, setReadingLanguage] = useState(profile?.language || "en");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<any>(null);

  useEffect(() => {
    if (step !== 3 || placeQuery.length < 3 || place) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      setPlaceError(null);
      try {
        const r = await api.get(`/geo/search?q=${encodeURIComponent(placeQuery)}`);
        setResults(r.results || []);
        if (!(r.results || []).length) setPlaceError("No matching city found. Try a nearby city or a different spelling.");
      } catch (e: any) {
        setResults([]);
        setPlaceError(e?.message || "Birthplace search is temporarily unavailable.");
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [placeQuery, step, place]);

  const selectPlace = async (pid: string, desc: string) => {
    setSearching(true);
    try {
      const d = await api.get(`/geo/details?place_id=${pid}`);
      setPlace({ ...d, description: desc });
      setPlaceQuery(desc);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const toggleInterest = (i: string) =>
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  const canContinue = () => {
    if (step === 0) return firstName.trim().length > 0;
    if (step === 1) {
      const parsed = new Date(+year, +month - 1, +day);
      return !!(day && month && year && +year > 1900 && parsed.getFullYear() === +year && parsed.getMonth() === +month - 1 && parsed.getDate() === +day && parsed <= new Date());
    }
    if (step === 2) return !timeKnown || !!(hour && minute && +hour >= 1 && +hour <= 12 && +minute >= 0 && +minute <= 59);
    if (step === 3) return !!place;
    if (step === 4) return interests.length > 0;
    return true;
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      let h = hour ? parseInt(hour, 10) % 12 : 12;
      if (ampm === "PM") h += 12;
      const dob = `${year}-${String(+month).padStart(2, "0")}-${String(+day).padStart(2, "0")}`;
      const birth_time = timeKnown ? `${String(h).padStart(2, "0")}:${String(+minute).padStart(2, "0")}` : null;
      const payload = {
        first_name: firstName.trim(),
        dob,
        birth_time,
        birth_time_known: timeKnown,
        birthplace: place.formatted_address || place.description,
        lat: place.lat,
        lon: place.lon,
        tz_name: place.tz_name,
        interests,
        terminology_mode: terminology,
        language: readingLanguage,
      };
      if (isCorrection) await api.patch("/birth-profile", payload);
      else await api.post("/onboarding", payload);
      await refresh();
      queryClient.invalidateQueries();
      router.replace(isCorrection ? "/(tabs)/you" : "/(tabs)/today");
    } catch (e: any) {
      setError(e?.message || "We couldn't generate your chart. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    haptics.light();
    if (isCorrection && step === 3) submit();
    else if (step < 5) setStep(step + 1);
    else submit();
  };

  return (
    <View style={{ flex: 1 }}>
      <CosmicBackground>
        <View style={{ flex: 1, paddingTop: insets.top + 16 }}>
          <View style={styles.progressRow}>
            {step > (isCorrection ? 1 : 0) ? (
              <MotionPressable onPress={() => setStep(step - 1)} hitSlop={12} testID="onboarding-back">
                <Icon name="chevron-left" size={24} color={colors.muted} />
              </MotionPressable>
            ) : <View style={{ width: 24 }} />}
            <View style={styles.dots}>
              {[0, 1, 2, 3, 4, 5].map((i) => <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />)}
            </View>
            <View style={{ width: 24 }} />
          </View>

          <KeyboardAwareScrollView
            bottomOffset={120}
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View key={step} entering={FadeIn.duration(320)} exiting={FadeOut.duration(120)}>
              {step === 0 && (
                <StepShell step="01" icon="feather" title="Let’s begin with you" subtitle="Your name makes every reading feel personal.">
                  <TextField label="First name" value={firstName} onChangeText={setFirstName}
                    placeholder="Maya" autoCapitalize="words" testID="onb-firstname" />
                </StepShell>
              )}
              {step === 1 && (
                <StepShell step="02" icon="calendar" title="Your date of birth"
                  subtitle="Your birth chart is calculated from the exact positions of the planets on this day.">
                  {isCorrection ? <View style={styles.lockNotice}><Icon name="shield" size={18} color={colors.gold} /><AppText variant="caption" style={{ flex: 1 }}>This is your one included correction. Saving new birth details will permanently use it and regenerate every report.</AppText></View> : null}
                  <View style={styles.dobRow}>
                    <TextField label="Day" value={day} onChangeText={setDay} placeholder="DD"
                      keyboardType="number-pad" testID="onb-day" containerStyle={{ flex: 1, minWidth: 0 }} style={{ textAlign: "center" }} />
                    <TextField label="Month" value={month} onChangeText={setMonth} placeholder="MM"
                      keyboardType="number-pad" testID="onb-month" containerStyle={{ flex: 1, minWidth: 0 }} style={{ textAlign: "center" }} />
                    <TextField label="Year" value={year} onChangeText={setYear} placeholder="YYYY"
                      keyboardType="number-pad" testID="onb-year" containerStyle={{ flex: 1, minWidth: 0 }} style={{ textAlign: "center" }} />
                  </View>
                  {month && +month >= 1 && +month <= 12 ? (
                    <AppText variant="caption" muted style={{ marginTop: 10, marginLeft: 4 }}>
                      {day || "?"} {MONTHS[+month - 1]} {year || "?"}
                    </AppText>
                  ) : null}
                </StepShell>
              )}
              {step === 2 && (
                <StepShell step="03" icon="clock" title="The moment you arrived"
                  subtitle="An exact time lets us calculate your Ascendant and houses precisely. Even a close estimate helps.">
                  {timeKnown ? (
                    <View style={{ gap: 12 }}>
                      <View style={styles.dobRow}>
                        <TextField label="Hour" value={hour} onChangeText={setHour} placeholder="HH"
                          keyboardType="number-pad" testID="onb-hour" containerStyle={{ flex: 1, minWidth: 0 }} style={{ textAlign: "center" }} />
                        <TextField label="Minute" value={minute} onChangeText={setMinute} placeholder="MM"
                          keyboardType="number-pad" testID="onb-minute" containerStyle={{ flex: 1, minWidth: 0 }} style={{ textAlign: "center" }} />
                        <View style={{ flex: 1, gap: 6 }}>
                          <AppText variant="label" muted style={{ marginLeft: 4 }}>Period</AppText>
                          <View style={styles.ampm}>
                            {(["AM", "PM"] as const).map((p) => (
                              <MotionPressable key={p} onPress={() => setAmpm(p)} testID={`onb-${p}`}
                                style={[styles.ampmBtn, ampm === p && { backgroundColor: colors.gold }]}>
                                <AppText variant="label" style={{ color: ampm === p ? colors.onBrandPrimary : colors.onSurface }}>{p}</AppText>
                              </MotionPressable>
                            ))}
                          </View>
                        </View>
                      </View>
                    </View>
                  ) : null}
                  <MotionPressable onPress={() => setTimeKnown(!timeKnown)} style={styles.checkRow} testID="onb-time-unknown">
                    <View style={[styles.check, !timeKnown && { backgroundColor: colors.gold, borderColor: colors.gold }]}>
                      {!timeKnown ? <Icon name="check" size={14} color={colors.onBrandPrimary} /> : null}
                    </View>
                    <AppText variant="body">I don&apos;t know my birth time</AppText>
                  </MotionPressable>
                  {!timeKnown ? (
                    <AppText variant="caption" muted style={{ marginTop: 8 }}>
                      That&apos;s okay—we&apos;ll use planetary signs and skip time-sensitive features like your Ascendant and houses.
                    </AppText>
                  ) : null}
                </StepShell>
              )}
              {step === 3 && (
                <StepShell step="04" icon="map-pin" title="Your place in the world"
                  subtitle="We resolve your city to precise coordinates and timezone.">
                  <TextField label="Birthplace" value={placeQuery}
                    onChangeText={(t) => { setPlaceQuery(t); setPlace(null); setPlaceError(null); }}
                    placeholder="Search city..." autoCapitalize="words" testID="onb-place" />
                  {searching ? <ActivityIndicator color={colors.gold} style={{ marginTop: 12 }} /> : null}
                  {placeError ? <AppText variant="caption" style={{ color: colors.coralSoft, marginTop: 10 }}>{placeError}</AppText> : null}
                  {results.map((r) => (
                    <MotionPressable key={r.place_id} onPress={() => selectPlace(r.place_id, r.description)}
                      style={styles.placeRow} testID={`onb-place-${r.place_id}`}>
                      <Icon name="map-pin" size={16} color={colors.muted} />
                      <AppText variant="body" style={{ flex: 1 }}>{r.description}</AppText>
                    </MotionPressable>
                  ))}
                  {place ? (
                    <View style={styles.placeConfirm}>
                      <Icon name="check-circle" size={16} color={colors.gold} />
                      <AppText variant="caption" muted style={{ flex: 1 }}>
                        {place.formatted_address}  ·  {place.tz_name}
                      </AppText>
                    </View>
                  ) : null}
                </StepShell>
              )}
              {step === 4 && (
                <StepShell step="05" icon="heart" title="What calls you here?"
                  subtitle="Choose the areas you'd like guidance on. You can change these anytime.">
                  <View style={styles.wrap}>
                    {INTERESTS.map((i) => (
                      <Chip key={i} label={i} selected={interests.includes(i)}
                        onPress={() => toggleInterest(i)} testID={`onb-interest-${i}`} />
                    ))}
                  </View>
                </StepShell>
              )}
              {step === 5 && (
                <StepShell step="06" icon="book-open" title="Choose your astrology language"
                  subtitle="This is a presentation choice — the calculations are always Vedic.">
                  <View style={{ gap: 12 }}>
                    {TERMS.map((t) => (
                      <MotionPressable key={t.id} onPress={() => setTerminology(t.id)} testID={`onb-term-${t.id}`}
                        style={[styles.termCard, terminology === t.id && { borderColor: colors.gold }]}>
                        <View style={{ flex: 1 }}>
                          <AppText variant="subtitle">{t.title}</AppText>
                          <AppText variant="caption" muted style={{ marginTop: 2 }}>{t.sub}</AppText>
                        </View>
                        <View style={[styles.radio, terminology === t.id && { borderColor: colors.gold }]}>
                          {terminology === t.id ? <View style={styles.radioDot} /> : null}
                        </View>
                      </MotionPressable>
                    ))}
                  </View>
                  <AppText variant="subtitle" style={{ marginTop: 25 }}>Tara’s reading language</AppText>
                  <AppText variant="caption" muted style={{ marginTop: 4, marginBottom: 12 }}>Her AI replies use your choice. App menus remain in English.</AppText>
                  <View style={styles.wrap}>
                    {READING_LANGUAGES.map((item) => <Chip key={item.code} label={item.native} selected={readingLanguage === item.code}
                      onPress={() => setReadingLanguage(item.code)} testID={`onb-language-${item.code}`} />)}
                  </View>
                </StepShell>
              )}
              {error ? <AppText variant="caption" style={{ color: colors.gold, marginTop: 16 }}>{error}</AppText> : null}
            </Animated.View>
          </KeyboardAwareScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Button
              label={isCorrection && step === 3 ? "Save one-time correction" : step === 5 ? "Reveal my chart" : "Continue"}
              icon={isCorrection && step === 3 ? "lock" : step === 5 ? "star" : "arrow-right"}
              onPress={next}
              disabled={!canContinue()}
              loading={submitting}
              testID="onboarding-continue"
            />
          </View>
        </View>
      </CosmicBackground>
    </View>
  );
}

function StepShell({ step, icon, title, subtitle, children }: any) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.glassBorder }}>
          <Icon name={icon} size={19} color={colors.gold} />
        </View>
        <AppText variant="caption" style={{ color: colors.coralSoft, letterSpacing: 1.3 }}>CHART MAKING · {step}</AppText>
      </View>
      <AppText variant="title">{title}</AppText>
      <AppText variant="body" muted style={{ marginTop: 8, marginBottom: 24 }}>{subtitle}</AppText>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 18, height: 3, borderRadius: 999, backgroundColor: colors.surfaceTertiary },
  dotActive: { backgroundColor: colors.gold },
  dobRow: { flexDirection: "row", gap: 12 },
  ampm: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  ampmBtn: { flex: 1, paddingVertical: 13, alignItems: "center" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20 },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  placeConfirm: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, padding: 12, borderRadius: radii.md, backgroundColor: colors.surfaceTertiary },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  termCard: { flexDirection: "row", alignItems: "center", padding: 18, borderRadius: radii.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  radio: { width: 22, height: 22, borderRadius: 999, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: colors.gold },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  lockNotice: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 18, padding: 14, borderRadius: radii.md, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.glassBorder },
}));
