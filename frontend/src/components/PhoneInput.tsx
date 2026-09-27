import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, SlideInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/src/components/AppText";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { COUNTRIES, POPULAR, countryByIso, flagOf } from "@/src/content/countries";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

/** One field: country (flag + code) and the number, with a searchable picker for every country. */
export function PhoneInput({ country, onCountry, value, onChange, onSubmit, autoFocus, split }: {
  /** ISO country code, e.g. "IN". */
  country: string; onCountry: (iso: string) => void; value: string; onChange: (v: string) => void; onSubmit?: () => void; autoFocus?: boolean;
  /** Large separate country and number pills, for the full-screen sign-in step. */
  split?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const selected = countryByIso(country);
  const picker = <CountryPicker visible={open} selected={selected.iso} onClose={() => setOpen(false)} onSelect={(iso) => { onCountry(iso); setOpen(false); }} />;
  if (split) {
    return (
      <View style={{ flexDirection: "row", gap: 10 }}>
        <MotionPressable onPress={() => setOpen(true)} style={styles.ccPill} accessibilityLabel={`Country: ${selected.name}, +${selected.code}`} testID="phone-country">
          <AppText style={{ fontSize: 22 }}>{flagOf(selected.iso)}</AppText>
          <AppText style={styles.bigText}>{`+${selected.code}`}</AppText>
          <Icon name="chevron-down" size={13} color={colors.muted} />
        </MotionPressable>
        <View style={[styles.numPill, focused && styles.numPillOn]}>
          <TextInput
            value={value}
            onChangeText={(t) => onChange(t.replace(/[^\d]/g, "").slice(0, 14))}
            placeholder={selected.iso === "IN" ? "98765 43210" : "Mobile number"}
            placeholderTextColor="rgba(170,166,190,0.6)"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus={autoFocus}
            selectionColor={colors.gold}
            style={[styles.input, styles.bigText, { paddingHorizontal: 18 }]}
            testID="phone-number"
            accessibilityLabel="Mobile number"
          />
        </View>
        {picker}
      </View>
    );
  }
  return (
    <View style={[styles.field, focused && { borderColor: "rgba(242,200,121,0.55)" }]}>
      <MotionPressable onPress={() => setOpen(true)} style={styles.cc} accessibilityLabel={`Country: ${selected.name}, +${selected.code}`} testID="phone-country">
        <AppText style={{ fontSize: 18 }}>{flagOf(selected.iso)}</AppText>
        <AppText variant="subtitle" style={{ fontSize: 16 }}>{`+${selected.code}`}</AppText>
        <Icon name="chevron-down" size={13} color={colors.muted} />
      </MotionPressable>
      <View style={styles.divider} />
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^\d]/g, "").slice(0, 14))}
        placeholder={selected.iso === "IN" ? "98765 43210" : "Mobile number"}
        placeholderTextColor={colors.muted}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        style={styles.input}
        testID="phone-number"
        accessibilityLabel="Mobile number"
      />
      {picker}
    </View>
  );
}

function CountryPicker({ visible, selected, onClose, onSelect }: { visible: boolean; selected: string; onClose: () => void; onSelect: (iso: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (q) {
      return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.startsWith(q) || c.iso.toLowerCase() === q)
        .map((c) => ({ type: "country" as const, c }));
    }
    const popular = POPULAR.map((iso) => COUNTRIES.find((c) => c.iso === iso)!).filter(Boolean);
    return [
      { type: "header" as const, label: "Popular" }, ...popular.map((c) => ({ type: "country" as const, c })),
      { type: "header" as const, label: "All countries" }, ...COUNTRIES.map((c) => ({ type: "country" as const, c })),
    ];
  }, [query]);
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(5,4,14,0.7)" }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <Animated.View entering={SlideInDown.duration(300)} style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.search}>
            <Icon name="search" size={16} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search country or code" placeholderTextColor={colors.muted}
              style={styles.searchInput} autoCorrect={false} testID="country-search" />
            {query ? <MotionPressable onPress={() => setQuery("")} hitSlop={8}><Icon name="x" size={15} color={colors.muted} /></MotionPressable> : null}
          </View>
          <FlatList
            data={rows}
            keyExtractor={(row, i) => (row.type === "header" ? `h-${row.label}` : `${row.c.iso}-${i}`)}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            style={{ maxHeight: 460 }}
            renderItem={({ item }) => item.type === "header" ? (
              <AppText variant="label" muted style={styles.sectionLabel}>{item.label.toUpperCase()}</AppText>
            ) : (
              <MotionPressable onPress={() => onSelect(item.c.iso)} style={[styles.option, item.c.iso === selected && styles.optionOn]} testID={`country-${item.c.iso}`}>
                <AppText style={{ fontSize: 20 }}>{flagOf(item.c.iso)}</AppText>
                <AppText variant="body" style={{ flex: 1 }}>{item.c.name}</AppText>
                <AppText variant="label" muted>{`+${item.c.code}`}</AppText>
                {item.c.iso === selected ? <Icon name="check" size={15} color={colors.goldSoft} /> : null}
              </MotionPressable>
            )}
            ListEmptyComponent={<AppText variant="caption" muted center style={{ padding: 20 }}>No matching country</AppText>}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Six boxes backed by one hidden input, so paste and SMS autofill both work. */
export function OtpInput({ length = 6, value, onChange, onComplete, error }: {
  length?: number; value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; error?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const ref = useRef<TextInput>(null);
  const shake = useSharedValue(0);
  useEffect(() => {
    if (error) {
      haptics.error();
      shake.set(withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withTiming(-5, { duration: 50 }), withTiming(0, { duration: 60 })));
    }
  }, [error, shake]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));
  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="Verification code">
      <Animated.View style={[styles.otpRow, shakeStyle]}>
        {Array.from({ length }, (_, i) => {
          const char = value[i];
          const active = i === value.length;
          return (
            <View key={i} style={[styles.box, active && { borderColor: colors.goldSoft }, error && { borderColor: colors.coral }, !!char && styles.boxFilled]}>
              <AppText style={styles.digit}>{char || ""}</AppText>
            </View>
          );
        })}
      </Animated.View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => {
          const next = t.replace(/\D/g, "").slice(0, length);
          if (next.length > value.length) haptics.selection();
          onChange(next);
          if (next.length === length) onComplete?.(next);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        maxLength={length}
        style={styles.hidden}
        testID="otp-input"
      />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  field: { flexDirection: "row", alignItems: "center", height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(235,226,250,0.05)" },
  cc: { flexDirection: "row", alignItems: "center", gap: 6, height: "100%", paddingLeft: 14, paddingRight: 10 },
  ccPill: { flexDirection: "row", alignItems: "center", gap: 7, height: 60, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: "rgba(235,226,250,0.05)" },
  numPill: { flex: 1, height: 60, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "rgba(235,226,250,0.05)" },
  numPillOn: { borderColor: colors.gold, backgroundColor: "rgba(242,200,121,0.06)" },
  bigText: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: 1, color: colors.onSurface },
  divider: { width: 1, height: 24, backgroundColor: colors.border },
  input: { flex: 1, minWidth: 0, height: "100%", paddingHorizontal: 14, color: colors.onSurface, fontFamily: fonts.medium, fontSize: 17, letterSpacing: 0.8 },
  sheet: { paddingHorizontal: 16, paddingTop: 10, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: "#15132B", borderWidth: 1, borderColor: colors.borderStrong },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(235,226,250,0.3)", marginBottom: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "rgba(235,226,250,0.06)", marginBottom: 6 },
  searchInput: { flex: 1, minWidth: 0, height: "100%", color: colors.onSurface, fontFamily: fonts.body, fontSize: 15 },
  sectionLabel: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 4, letterSpacing: 1 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10 },
  optionOn: { backgroundColor: "rgba(242,200,121,0.1)" },
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  box: { flex: 1, height: 64, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  boxFilled: { borderColor: "rgba(242,200,121,0.5)" },
  digit: { fontFamily: fonts.displayStrong, fontSize: 24, color: colors.onSurface },
  hidden: { position: "absolute", opacity: 0, width: 1, height: 1 },
}));
