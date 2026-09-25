import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { AppText } from "@/src/components/AppText";
import { Icon } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { useI18n } from "@/src/i18n";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const TOPICS = ["career timing", "marriage", "a business partner", "money this year", "my parent's health", "a job switch", "my love life", "buying property"];

/** Home composer with a typewriter placeholder; sends straight into a Tara conversation. */
export function AskBar() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState("");
  const [topic, setTopic] = useState(0);
  const ready = value.trim().length > 0;
  const send = useSharedValue(0);

  useEffect(() => {
    if (focused || value) return;
    const word = t(TOPICS[topic]);
    let i = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (!deleting) {
        i += 1;
        setTyped(word.slice(0, i));
        if (i >= word.length) { deleting = true; timer = setTimeout(step, 1500); return; }
        timer = setTimeout(step, 55);
      } else {
        i -= 1;
        setTyped(word.slice(0, i));
        if (i <= 0) { setTopic((n) => (n + 1) % TOPICS.length); return; }
        timer = setTimeout(step, 28);
      }
    };
    timer = setTimeout(step, 300);
    return () => clearTimeout(timer);
  }, [topic, focused, value, t]);

  useEffect(() => { send.value = withSpring(ready ? 1 : 0, { damping: 14, stiffness: 240 }); }, [ready, send]);
  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.9 + send.value * 0.1 }, { rotate: `${-45 + send.value * 45}deg` }],
    backgroundColor: send.value > 0.5 ? colors.gold : "rgba(23,19,38,0.08)",
  }));
  const frame = useSharedValue(0);
  useEffect(() => { frame.value = withTiming(focused ? 1 : 0, { duration: 200 }); }, [focused, frame]);
  const frameStyle = useAnimatedStyle(() => ({ shadowOpacity: 0.18 + frame.value * 0.25, transform: [{ scale: 1 + frame.value * 0.01 }] }));

  const submit = () => {
    const q = value.trim();
    if (!q) return;
    setValue("");
    router.push({ pathname: "/(tabs)/ask", params: { q, at: String(Date.now()) } });
  };

  return (
    <Animated.View style={[styles.bar, frameStyle]}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        {!value && !focused ? (
          <View pointerEvents="none" style={styles.placeholder}>
            <AppText style={styles.placeholderText} numberOfLines={1}>{t("Ask about")} {typed}<AppText style={[styles.placeholderText, { color: colors.coral }]}>|</AppText></AppText>
          </View>
        ) : null}
        <TextInput
          value={value}
          onChangeText={setValue}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={focused ? t("Type your question…") : ""}
          placeholderTextColor="#8A8499"
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={submit}
          testID="home-ask-input"
          accessibilityLabel="Ask Tara a question"
        />
      </View>
      <MotionPressable onPress={submit} disabled={!ready} haptic="medium" accessibilityLabel="Send question" testID="home-ask-send">
        <Animated.View style={[styles.send, sendStyle]}>
          <Icon name="send" size={19} color={ready ? colors.ink : "#8A8499"} weight="fill" />
        </Animated.View>
      </MotionPressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  bar: {
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.ivory,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 22,
    paddingRight: 7,
    shadowColor: colors.gold,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  placeholder: { position: "absolute", left: 0, right: 0 },
  placeholderText: { color: "#6E6680", fontSize: 16.5, fontFamily: fonts.body },
  input: { color: colors.ink, fontSize: 16.5, fontFamily: fonts.body, paddingVertical: 12 },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
}));
