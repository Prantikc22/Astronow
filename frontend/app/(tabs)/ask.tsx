import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import Animated, { cancelAnimation, Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError, streamChat } from "@/src/api/client";
import { AppText } from "@/src/components/AppText";
import { CosmicBackground } from "@/src/components/CosmicBackground";
import { Icon, type FeatherName } from "@/src/components/Icon";
import { MotionPressable } from "@/src/components/MotionPressable";
import { haptics } from "@/src/utils/haptics";
import { useAuth } from "@/src/store/auth";
import { fonts, makeStyles, radii, useTheme } from "@/src/theme";
import { useI18n } from "@/src/i18n";

type Msg = { role: "user" | "assistant"; content: string; failed?: boolean };
type Suggestion = { label: string; prompt: string; icon: FeatherName; color: string; interests: string[] };
const SUGGESTIONS: Suggestion[] = [
  { label: "Love", prompt: "What patterns are active in my relationships right now?", icon: "heart", color: "#E39A7D", interests: ["love", "relationship", "marriage"] },
  { label: "Career", prompt: "What does this period emphasize for my career?", icon: "briefcase", color: "#A8A0E8", interests: ["career", "work", "business"] },
  { label: "Money", prompt: "What should I understand about money and stability in this period?", icon: "trending-up", color: "#D6B26E", interests: ["money", "wealth", "finance"] },
  { label: "Family", prompt: "How can I support my family without losing my own balance?", icon: "users", color: "#D594AF", interests: ["family", "home", "parent"] },
  { label: "A decision", prompt: "Help me reflect on an important decision", icon: "git-branch", color: "#E2B983", interests: ["personal growth", "growth", "purpose"] },
  { label: "Today", prompt: "What should I pay attention to today?", icon: "sunrise", color: "#6B8FB5", interests: [] },
];

const TARA_IMAGE = require("../../assets/images/guides/tara.png");

export default function Ask() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; at?: string }>();
  const { profile, entitlement } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { data: usage } = useQuery({ queryKey: ["usage"], queryFn: () => api.get("/usage"), staleTime: 30 * 1000, retry: false });
  const { data: history } = useQuery({ queryKey: ["conversations"], queryFn: () => api.get("/conversations"), enabled: showHistory });
  const savedInterests = React.useMemo(
    () => Array.isArray(profile?.interests) ? profile.interests.map((item: unknown) => String(item).toLowerCase()) : [],
    [profile],
  );
  const suggestions = React.useMemo(() => {
    return SUGGESTIONS.map((item, index) => ({
      item,
      index,
      score: item.interests.some((keyword) => savedInterests.some((interest: string) => interest.includes(keyword))) ? 1 : 0,
    }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 4)
      .map(({ item }) => item);
  }, [savedInterests]);

  const scrollDown = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, []);

  const openConversation = async (id: string) => {
    const data = await api.get("/conversations/" + id + "/messages");
    setCid(id);
    setMessages((data.messages || []).map((item: any) => ({ role: item.role, content: item.content })));
    setShowHistory(false);
    scrollDown();
  };

  const newConversation = () => {
    setCid(null);
    setMessages([]);
    setShowHistory(false);
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    setMessages((current) => [...current, { role: "user", content }, { role: "assistant", content: "" }]);
    scrollDown();
    try {
      let conversationId = cid;
      if (!conversationId) {
        const created = await api.post("/conversations");
        conversationId = created.id;
        setCid(conversationId);
      }
      await streamChat(conversationId as string, content, (chunk) => {
        setMessages((current) => {
          const copy = [...current];
          const last = copy.length - 1;
          copy[last] = { role: "assistant", content: copy[last].content + chunk };
          return copy;
        });
        scrollDown();
      });
      haptics.soft();
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["usage"] });
    } catch (error: any) {
      if (error instanceof ApiError && (error.status === 402 || error.payload?.paywall)) {
        setMessages((current) => current.slice(0, -1));
        router.push("/paywall");
      } else {
        setMessages((current) => {
          const copy = [...current];
          const currentReply = copy[copy.length - 1].content;
          copy[copy.length - 1] = { role: "assistant", failed: true, content: currentReply
            ? currentReply + "\n\nThe connection paused before I finished. Please try again."
            : "I couldn't connect just now. Please try again in a moment." };
          return copy;
        });
      }
    } finally {
      setBusy(false);
      scrollDown();
    }
  };

  const handled = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (params.q && params.at && handled.current !== params.at) {
      handled.current = params.at;
      setCid(null);
      setMessages([]);
      setTimeout(() => send(String(params.q)), 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.at]);

  const empty = messages.length === 0;
  const lastReply = messages[messages.length - 1];
  const replies = messages.filter((m) => m.role === "assistant" && m.content && !m.failed).length;
  const showPlusCard = !entitlement.premium && replies >= 2 && !busy;
  const showFollowUps = !busy && lastReply?.role === "assistant" && !!lastReply.content && !lastReply.failed;

  return (
    <View style={{ flex: 1 }}>
      <CosmicBackground>
        <KeyboardAvoidingView behavior="translate-with-padding" style={{ flex: 1 }} keyboardVerticalOffset={0}>
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 11, flex: 1 }}>
              <View>
                <Image source={TARA_IMAGE} style={styles.headAvatar} contentFit="cover" />
                <View style={styles.onlineDot} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="title" style={{ fontSize: 21, lineHeight: 26 }}>Reading for {profile?.first_name || "you"}</AppText>
                <AppText variant="caption" style={{ color: busy ? colors.goldSoft : colors.muted }}>{busy ? "Tara is reading your chart…" : "Tara · 24x7 Astrologer · online"}</AppText>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}>
              {usage && !usage.premium ? (
                <MotionPressable onPress={() => router.push("/paywall")} style={styles.leftPill} testID="ask-credits" accessibilityLabel={`${usage.remaining} questions left`}>
                  <AppText variant="label" style={{ color: usage.remaining > 2 ? colors.goldSoft : colors.coral, fontSize: 12 }}>{usage.remaining} left</AppText>
                </MotionPressable>
              ) : null}
              <MotionPressable onPress={() => setShowHistory(!showHistory)} style={styles.headerButton} accessibilityLabel="Conversation history">
                <Icon name="clock" size={18} color={colors.onSurface} />
              </MotionPressable>
              <MotionPressable onPress={newConversation} style={styles.headerButton} accessibilityLabel="New conversation">
                <Icon name="edit-3" size={18} color={colors.gold} />
              </MotionPressable>
            </View>
          </View>

          {showHistory ? (
            <Animated.View entering={FadeIn.duration(220)} style={styles.historyPanel}>
              <View style={styles.historyHead}><AppText variant="subtitle">Recent conversations</AppText><AppText variant="caption" muted>{history?.conversations?.length || 0}</AppText></View>
              {(history?.conversations || []).map((item: any) => (
                <MotionPressable key={item.id} onPress={() => openConversation(item.id)} style={styles.historyRow}>
                  <View style={styles.historyIcon}><Icon name="message-circle" size={15} color={colors.teal} /></View>
                  <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>{item.title || "New conversation"}</AppText>
                  <Icon name="chevron-right" size={16} color={colors.muted} />
                </MotionPressable>
              ))}
              {!history?.conversations?.length ? <AppText variant="caption" muted style={{ paddingVertical: 16 }}>Your conversations will appear here.</AppText> : null}
            </Animated.View>
          ) : null}

          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {empty ? (
              <View style={styles.empty}>
                <Animated.View entering={FadeInDown.duration(480)} style={styles.guideHero}>
                  <Image source={TARA_IMAGE} style={styles.guideImage} contentFit="contain" transition={260} />
                  <View style={styles.guideCopy}>
                    <View style={styles.available}><View style={styles.availableDot} /><AppText variant="caption" style={{ color: colors.ivory }}>AVAILABLE 24x7</AppText></View>
                    <AppText variant="title" style={{ color: colors.ivory }}>Tara · 24x7 Astrologer</AppText>
                    <AppText variant="body" style={{ color: "#ECE8DA", marginTop: 4 }}>A little perspective can change the whole day.</AppText>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(90).duration(440)} style={{ marginTop: 20, alignSelf: "stretch" }}>
                  <AppText variant="title">Where shall we begin?</AppText>
                  <AppText variant="body" muted style={styles.intro}>Tara reads your chart and current sky, then helps you find a grounded next step.</AppText>
                  {savedInterests.length ? <AppText variant="caption" style={styles.personalized}>Chosen from the interests in your profile</AppText> : null}
                </Animated.View>
                <View style={styles.suggestions}>
                  {suggestions.map((item, index) => (
                    <Animated.View key={item.label} entering={FadeInDown.delay(130 + index * 45).duration(480)} style={styles.suggestionCell}>
                      <MotionPressable onPress={() => send(t(item.prompt))} style={styles.suggestion} testID={"ask-suggest-" + item.label}>
                        <View style={[styles.suggestionIcon, { backgroundColor: item.color + "20" }]}><Icon name={item.icon} size={17} color={item.color} /></View>
                        <AppText variant="subtitle">{item.label}</AppText>
                        <Icon name="arrow-up-right" size={15} color={item.color} />
                      </MotionPressable>
                    </Animated.View>
                  ))}
                </View>
                <View style={styles.grounded}><Icon name="check-circle" size={13} color={colors.teal} /><AppText variant="caption" muted>Rooted in your Vedic chart. Never a prediction of certainty.</AppText></View>
              </View>
            ) : (
              <View style={{ paddingTop: 10 }}>
                {messages.map((message, index) => (
                  <Animated.View entering={FadeInDown.duration(260)} key={index} style={[styles.bubbleRow, message.role === "user" ? styles.rowRight : styles.rowLeft]}>
                    {message.role === "assistant" ? <Image source={TARA_IMAGE} style={styles.aiAvatar} contentFit="cover" /> : null}
                    {message.role === "user" ? (
                      <LinearGradient colors={["#8A2A5E", "#5E1F48"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.userBubble]}>
                        <AppText variant="body" style={{ lineHeight: 24, color: colors.onSurface }}>{message.content}</AppText>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.bubble, styles.aiBubble]}>
                        {message.content === "" ? <ReadingIndicator /> : (
                          <AppText variant="body" style={{ lineHeight: 25, color: colors.onSurface }}>{message.content}</AppText>
                        )}
                      </View>
                    )}
                  </Animated.View>
                ))}
                {showPlusCard ? (
                  <Animated.View entering={FadeInDown.delay(300).duration(400)}>
                    <MotionPressable onPress={() => router.push("/paywall")} style={styles.plusCard} haptic="medium" testID="ask-plus-card" pressScale={0.98}>
                      <LinearGradient colors={["#4A1C45", "#2A1640"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.plusFill}>
                        <Icon name="crown" size={20} color={colors.goldSoft} weight="fill" />
                        <View style={{ flex: 1 }}>
                          <AppText variant="subtitle" style={{ fontSize: 15 }}>Keep the conversation going</AppText>
                          <AppText variant="caption" muted>40 questions a day with Tara on Plus</AppText>
                        </View>
                        <Icon name="arrow-right" size={17} color={colors.goldSoft} />
                      </LinearGradient>
                    </MotionPressable>
                  </Animated.View>
                ) : null}
                {showFollowUps ? (
                  <Animated.View entering={FadeInDown.delay(150).duration(360)} style={styles.followUps}>
                    {["Tell me more about this", "What should I do this week?", "When will this change?"].map((text) => (
                      <MotionPressable key={text} onPress={() => send(t(text))} style={styles.followUp} testID={"ask-followup-" + text}>
                        <Icon name="sparkle" size={13} color={colors.goldSoft} weight="fill" />
                        <AppText variant="caption" style={{ color: colors.onSurface }}>{text}</AppText>
                      </MotionPressable>
                    ))}
                  </Animated.View>
                ) : null}
              </View>
            )}
          </ScrollView>

          <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom - 6, 10) + 104 }]}>
            <View style={styles.composer}>
              <TextInput value={input} onChangeText={setInput} placeholder={t("Ask what is on your mind…")} placeholderTextColor={colors.muted}
                style={styles.input} multiline testID="ask-input" returnKeyType="send" blurOnSubmit={false}
                onSubmitEditing={() => send(input)} accessibilityLabel="Message Tara" />
              <MotionPressable onPress={() => send(input)} style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.5 }]}
                disabled={!input.trim() || busy} haptic="medium" testID="ask-send" accessibilityLabel="Send message">
                <Icon name="arrow-up" size={20} color={colors.ink} />
              </MotionPressable>
            </View>
            <AppText variant="caption" muted center style={{ fontSize: 9, marginTop: 7 }}>Guidance for reflection—not medical, legal or financial advice.</AppText>
          </View>
        </KeyboardAvoidingView>
      </CosmicBackground>
    </View>
  );
}

function ReadingIndicator() {
  const { colors } = useTheme();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.45 + pulse.value * 0.55,
    transform: [{ scale: 0.88 + pulse.value * 0.25 }, { rotate: `${pulse.value * 18}deg` }],
  }));
  return <View style={{ minWidth: 190, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }} accessibilityLabel="Tara is reading your chart and preparing a reply">
    <Animated.View style={[{ width: 31, height: 31, borderRadius: 16, backgroundColor: colors.gold + "38", alignItems: "center", justifyContent: "center" }, halo]}>
      <Icon name="star" size={18} color={colors.goldSoft} weight="duotone" />
    </Animated.View>
    <View style={{ flex: 1 }}>
      <AppText variant="caption" style={{ color: colors.goldSoft }}>Tara is reading your chart</AppText>
      <View style={{ flexDirection: "row", gap: 5, marginTop: 6 }}>{[0, 1, 2].map((i) => <ReadingDot key={i} index={i} />)}</View>
    </View>
  </View>;
}

function ReadingDot({ index }: { index: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(index * 180, withRepeat(withTiming(1, { duration: 580, easing: Easing.inOut(Easing.ease) }), -1, true));
    return () => cancelAnimation(progress);
  }, [index, progress]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + progress.value * 0.65, transform: [{ translateY: -3 * progress.value }, { scale: 0.75 + progress.value * 0.4 }] }));
  return <Animated.View style={[{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#9C789C" }, style]} />;
}

const useStyles = makeStyles((colors) => ({
  header: { paddingHorizontal: 20, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: colors.coralSoft, letterSpacing: 1.4, fontSize: 9 },
  headerButton: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(21,20,43,0.96)", borderWidth: 1, borderColor: colors.border },
  historyPanel: { position: "absolute", zIndex: 20, top: 104, left: 16, right: 16, maxHeight: 340, padding: 16, borderRadius: radii.xl, backgroundColor: "#11102A", borderWidth: 1, borderColor: colors.glassBorder },
  historyHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50, borderTopWidth: 1, borderTopColor: colors.divider },
  historyIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(168,160,232,0.14)", alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 20, paddingBottom: 18, paddingTop: 4 },
  empty: { alignItems: "center", paddingTop: 8 },
  guideHero: { alignSelf: "stretch", height: 354, borderRadius: radii.xl, overflow: "hidden", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center" },
  guideImage: { position: "absolute", top: 14, width: 216, height: 216, borderRadius: 108, borderWidth: 1, borderColor: colors.glassBorder },
  guideCopy: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 116, paddingHorizontal: 18, paddingVertical: 16, justifyContent: "center", backgroundColor: "rgba(11,11,26,0.94)", borderTopWidth: 1, borderTopColor: colors.divider },
  available: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
  availableDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.teal },
  intro: { marginTop: 7, maxWidth: 340 },
  personalized: { color: colors.gold, marginTop: 8, letterSpacing: 0.2 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 18, alignSelf: "stretch" },
  suggestionCell: { width: "48.5%" },
  suggestion: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 9, padding: 12, borderRadius: radii.lg, backgroundColor: "rgba(21,20,43,0.96)", borderWidth: 1, borderColor: colors.border },
  suggestionIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  grounded: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 18 },
  bubbleRow: { marginVertical: 9, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  aiAvatar: { width: 30, height: 30, borderRadius: 15, marginTop: 3, borderWidth: 1, borderColor: colors.gold },
  bubble: { maxWidth: "84%", padding: 15, borderRadius: radii.lg },
  userBubble: { borderBottomRightRadius: 5 },
  aiBubble: { backgroundColor: "rgba(33,31,59,0.95)", borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.border },
  headAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.coral },
  onlineDot: { position: "absolute", right: 0, bottom: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: "#5BD08A", borderWidth: 2, borderColor: "#0B0B1A" },
  leftPill: { paddingHorizontal: 10, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(242,200,121,0.1)", borderWidth: 1, borderColor: "rgba(242,200,121,0.3)" },
  plusCard: { marginTop: 12, marginLeft: 38, borderRadius: 14, overflow: "hidden" },
  plusFill: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(242,200,121,0.3)" },
  followUps: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6, marginLeft: 38 },
  followUp: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 10, backgroundColor: "rgba(33,31,59,0.9)", borderWidth: 1, borderColor: "rgba(242,200,121,0.25)" },
  composerWrap: { paddingHorizontal: 14, paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: "rgba(11,11,26,0.97)" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 9, padding: 6, paddingLeft: 12, borderRadius: 16, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  input: { flex: 1, maxHeight: 110, minHeight: 42, paddingVertical: 11, color: colors.onSurface, fontFamily: fonts.body, fontSize: 15 },
  sendBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
}));
