import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { View } from "react-native";

import { AppText } from "@/src/components/AppText";
import { BrandMark } from "@/src/components/BrandMark";
import { makeStyles, useTheme } from "@/src/theme";

/** A quiet sign-off at the end of a scroll: divider, mark, one line, one note. */
export function EditorialFooter({
  kicker = "ASTRONOW",
  title = "The stars offer a language. You still write the life.",
  note,
}: {
  kicker?: string;
  title?: string;
  note?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.rule}>
        <LinearGradient colors={["rgba(235,226,250,0)", "rgba(235,226,250,0.18)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
        <BrandMark size={26} />
        <LinearGradient colors={["rgba(235,226,250,0.18)", "rgba(235,226,250,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
      </View>
      <AppText variant="label" center style={{ color: colors.muted, letterSpacing: 1.4, fontSize: 10, marginTop: 12 }}>{kicker}</AppText>
      <AppText center style={styles.title}>{title.replace(/\n/g, " ")}</AppText>
      {note ? <AppText variant="caption" muted center style={styles.note}>{note}</AppText> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { marginTop: 28, paddingTop: 8, paddingBottom: 8, paddingHorizontal: 12, alignItems: "center" },
  rule: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "stretch" },
  line: { flex: 1, height: 1 },
  title: { marginTop: 6, fontFamily: "Fraunces-Medium", fontSize: 17, lineHeight: 24, color: colors.onSurface, maxWidth: 300 },
  note: { marginTop: 6, maxWidth: 300, lineHeight: 18 },
}));
