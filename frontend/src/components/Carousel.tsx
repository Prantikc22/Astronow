import React, { useEffect, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";

import { haptics } from "@/src/utils/haptics";

function Dot({ index, x, width }: { index: number; x: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const p = interpolate(x.value / width, [index - 1, index, index + 1], [0, 1, 0], Extrapolation.CLAMP);
    return { width: 7 + p * 17, opacity: 0.35 + p * 0.65 };
  });
  return <Animated.View style={[{ height: 7, borderRadius: 4, backgroundColor: "#F0A0BD" }, style]} />;
}

function Slide({ index, x, width, children }: { index: number; x: SharedValue<number>; width: number; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const p = interpolate(x.value / width, [index - 1, index, index + 1], [1, 0, 1], Extrapolation.CLAMP);
    return { transform: [{ scale: 1 - p * 0.06 }], opacity: 1 - p * 0.35 };
  });
  return <Animated.View style={[{ width, paddingHorizontal: 20 }, style]}>{children}</Animated.View>;
}

/** Full-bleed paged carousel with auto-advance, parallax scale and morphing dots. */
export function Carousel({ children, interval = 5200 }: { children: React.ReactNode[]; interval?: number }) {
  const { width } = useWindowDimensions();
  const ref = useRef<Animated.ScrollView>(null);
  const x = useSharedValue(0);
  const [page, setPage] = useState(0);
  const [held, setHeld] = useState(false);
  const count = children.length;
  const onScroll = useAnimatedScrollHandler((e) => { x.value = e.contentOffset.x; });

  useEffect(() => {
    if (held || count < 2) return;
    const timer = setTimeout(() => {
      const next = (page + 1) % count;
      ref.current?.scrollTo({ x: next * width, animated: true });
    }, interval);
    return () => clearTimeout(timer);
  }, [page, held, count, width, interval]);

  return (
    <View style={{ marginHorizontal: -20 }}>
      <Animated.ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => setHeld(true)}
        onScrollEndDrag={() => setHeld(false)}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / width);
          if (next !== page) { setPage(next); if (held) haptics.selection(); }
        }}
      >
        {children.map((child, i) => <Slide key={i} index={i} x={x} width={width}>{child}</Slide>)}
      </Animated.ScrollView>
      {count > 1 ? (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 }}>
          {children.map((_, i) => <Dot key={i} index={i} x={x} width={width} />)}
        </View>
      ) : null}
    </View>
  );
}
