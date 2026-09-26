import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, SlideInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { AppText } from "@/src/components/AppText";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

export const COUNTRIES = [
  { code: "91", iso: "IN", name: "India", flag: "🇮🇳" },
  { code: "1", iso: "US", name: "United States / Canada", flag: "🇺🇸" },
  { code: "44", iso: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "971", iso: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "65", iso: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "61", iso: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "977", iso: "NP", name: "Nepal", flag: "🇳🇵" },
  { code: "880", iso: "BD", name: "Bangladesh", flag: "🇧🇩" },
  { code: "94", iso: "LK", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "974", iso: "QA", name: "Qatar", flag: "🇶🇦" },
  { code: "966", iso: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "60", iso: "MY", name: "Malaysia", flag: "🇲🇾" },
];

/** Country code picker + mobile number field. */
export function PhoneInput({ country, onCountry, value, onChange, onSubmit, autoFocus }: {
  country: string; onCountry: (code: string) => void; value: string; onChange: (v: string) => void; onSubmit?: () => void; autoFocus?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = COUNTRIES.find((c) => c.code === country) || COUNTRIES[0];
  return (
    <View style={styles.row}>
      <MotionPressable onPress={() => setOpen(true)} style={styles.cc} accessibilityLabel={`Country code +${selected.code}`} testID="phone-country">
        <AppText style={{ fontSize: 18 }}>{selected.flag}</AppText>
        <AppText variant="subtitle" style={{ fontSize: 16 }}>{`+${selected.code}`}</AppText>
        <Icon name="chevron-down" size={14} color={colors.muted} />
      </MotionPressable>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^\d]/g, "").slice(0, 14))}
        placeholder={country === "91" ? "98765 43210" : "Mobile number"}
        placeholderTextColor={colors.muted}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        style={styles.input}
        testID="phone-number"
        accessibilityLabel="Mobile number"
      />
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Animated.View entering={FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(5,4,14,0.7)" }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        </Animated.View>
        <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
          <Animated.View entering={SlideInDown.duration(300)} style={styles.sheet}>
            <AppText variant="title" style={{ marginBottom: 10 }}>Country</AppText>
            <ScrollView style={{ maxHeight: 420 }}>
              {COUNTRIES.map((c) => (
                <MotionPressable key={c.code + c.iso} onPress={() => { onCountry(c.code); setOpen(false); }} style={[styles.option, c.code === country && styles.optionOn]} testID={`country-${c.iso}`}>
                  <AppText style={{ fontSize: 20 }}>{c.flag}</AppText>
                  <AppText variant="body" style={{ flex: 1 }}>{c.name}</AppText>
                  <AppText variant="label" muted>{`+${c.code}`}</AppText>
                </MotionPressable>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
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
  row: { flexDirection: "row", gap: 10 },
  cc: { flexDirection: "row", alignItems: "center", gap: 6, height: 54, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary },
  input: { flex: 1, minWidth: 0, height: 54, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary, color: colors.onSurface, fontFamily: fonts.medium, fontSize: 18, letterSpacing: 1 },
  sheet: { padding: 20, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: "#15132B", borderWidth: 1, borderColor: colors.borderStrong },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10 },
  optionOn: { backgroundColor: "rgba(242,200,121,0.1)" },
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  box: { flex: 1, height: 58, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  boxFilled: { borderColor: "rgba(242,200,121,0.5)" },
  digit: { fontFamily: fonts.displayStrong, fontSize: 24, color: colors.onSurface },
  hidden: { position: "absolute", opacity: 0, width: 1, height: 1 },
}));
