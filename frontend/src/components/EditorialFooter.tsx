import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { View } from "react-native";

import { AppText } from "@/src/components/AppText";
import { BrandMark } from "@/src/components/BrandMark";
import { makeStyles, radii, useTheme } from "@/src/theme";

export function EditorialFooter({
  kicker = "ASTRONOW",
  title = "The stars offer a language.\nYou still write the life.",
  note = "Specific guidance. Clear choices. No fear.",
}: {
  kicker?: string;
  title?: string;
  note?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <LinearGradient colors={["rgba(44,36,83,0.16)", "rgba(90,45,66,0.34)", "rgba(11,11,26,0)"]} style={styles.wrap}>
      <View style={styles.mark}><BrandMark size={48} /></View>
      <AppText variant="label" style={{ color: colors.gold, letterSpacing: 1.8 }}>{kicker}</AppText>
      <AppText variant="hero" style={styles.title}>{title}</AppText>
      <AppText variant="body" muted style={styles.note}>{note}</AppText>
    </LinearGradient>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    minHeight: 240,
    marginTop: 40,
    paddingHorizontal: 22,
    paddingVertical: 30,
    borderRadius: radii.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    justifyContent: "flex-end",
  },
  mark: {
    width: 62,
    height: 62,
    marginBottom: "auto",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  title: { marginTop: 10, fontSize: 30, lineHeight: 35, maxWidth: 320 },
  note: { marginTop: 12 },
}));
