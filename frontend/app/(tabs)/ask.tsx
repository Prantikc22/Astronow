import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { Icon } from "@/src/components/Icon";
import { fonts, makeStyles, radii, useTheme } from "@/src/theme";

type Msg = { role: "user" | "assistant"; content: string };
const SUGGESTIONS = ["Love", "Career", "Marriage", "Money", "Today", "A decision", "My future"];

export default function Ask() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [cid, setCid] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const scrollDown = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, []);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content }, { role: "assistant", content: "" }]);
    scrollDown();
    try {
      let convId = cid;
      if (!convId) {
        const c = await api.post("/conversations");
        convId = c.id;
        setCid(convId);
      }
      const resp = await api.post(`/conversations/${convId}/message`, { content });
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: resp.reply };
        return copy;
      });
      scrollDown();
    } catch (e: any) {
      if (e instanceof ApiError && (e.status === 402 || e.payload?.paywall)) {
        setMessages((m) => m.slice(0, -1));
        router.push("/paywall");
      } else {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: "I couldn't respond just now. Your details are saved — please try again.",
          };
          return copy;
        });
      }
    } finally {
      setBusy(false);
      scrollDown();
    }
  };

  const empty = messages.length === 0;

  return (
    <View style={{ flex: 1 }}>
      <CosmicBackground>
        <KeyboardAvoidingView behavior="translate-with-padding" style={{ flex: 1 }} keyboardVerticalOffset={0}>
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <AppText variant="title">Ask</AppText>
            <AppText variant="caption" muted>Your guide, whenever you need clarity</AppText>
          </View>

          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {empty ? (
              <View style={styles.empty}>
                <View style={styles.orb}>
                  <Icon name="moon" size={30} color={colors.gold} />
                </View>
                <AppText variant="title" center style={{ marginTop: 20 }}>
                  What would you like{"\n"}clarity on?
                </AppText>
                <AppText variant="body" muted center style={{ marginTop: 8 }}>
                  Ask anything — your chart, timing, or a decision.
                </AppText>
                <View style={styles.suggestions}>
                  {SUGGESTIONS.map((s) => (
                    <Pressable key={s} onPress={() => send(`Tell me about ${s.toLowerCase()}`)}
                      style={styles.suggChip} testID={`ask-suggest-${s}`}>
                      <AppText variant="label">{s}</AppText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              messages.map((m, i) => (
                <View key={i} style={[styles.bubbleRow, m.role === "user" ? styles.rowRight : styles.rowLeft]}>
                  <View style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.aiBubble]}>
                    {m.content === "" ? (
                      <AppText variant="body" muted>…</AppText>
                    ) : (
                      <AppText variant="body" style={{ lineHeight: 23 }}>{m.content}</AppText>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={[styles.inputBar, { paddingBottom: 12 }]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask your guide…"
              placeholderTextColor={colors.muted}
              style={styles.input}
              multiline
              testID="ask-input"
            />
            <Pressable onPress={() => send(input)} style={styles.sendBtn} disabled={busy} testID="ask-send">
              <Icon name="arrow-up" size={20} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </CosmicBackground>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  empty: { alignItems: "center", paddingTop: 40 },
  orb: {
    width: 88, height: 88, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.glassBorder,
  },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 28 },
  suggChip: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: radii.pill,
    backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.glassBorder,
  },
  bubbleRow: { marginVertical: 6, flexDirection: "row" },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  bubble: { maxWidth: "86%", padding: 14, borderRadius: radii.lg },
  userBubble: { backgroundColor: colors.brandSecondary, borderTopRightRadius: 4 },
  aiBubble: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: 4 },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface,
  },
  input: {
    flex: 1, maxHeight: 120, minHeight: 48, backgroundColor: colors.surfaceTertiary,
    borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, color: colors.onSurface,
    fontFamily: fonts.body, fontSize: 16,
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: 999, backgroundColor: colors.gold,
    alignItems: "center", justifyContent: "center",
  },
}));
