import React from "react";
import { StyleProp, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { AppText } from "@/src/components/AppText";
import { fonts, makeStyles, radii, useTheme } from "@/src/theme";
import { useI18n } from "@/src/i18n";

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
  testID,
  editable = true,
  style: inputStyle,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { label?: string; testID?: string; containerStyle?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const focusProgress = useSharedValue(0);
  const frameMotion = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focusProgress.value, [0, 1], [colors.border, colors.gold]),
    shadowOpacity: focusProgress.value * 0.22,
    transform: [{ scale: 1 + focusProgress.value * 0.008 }],
  }), [colors.border, colors.gold]);
  const labelMotion = useAnimatedStyle(() => ({
    opacity: 0.72 + focusProgress.value * 0.28,
    transform: [{ translateX: focusProgress.value * 3 }],
  }));

  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <Animated.View style={labelMotion}>
          <AppText variant="label" muted style={{ marginLeft: 4 }}>
            {label}
          </AppText>
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.frame, frameMotion]}>
        <TextInput
          testID={testID}
          value={value}
          editable={editable}
          onChangeText={onChangeText}
          placeholder={placeholder ? t(placeholder) : undefined}
          placeholderTextColor={colors.muted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={(event) => {
            focusProgress.set(withTiming(1, { duration: 170 }));
            onFocus?.(event);
          }}
          onBlur={(event) => {
            focusProgress.set(withTiming(0, { duration: 190 }));
            onBlur?.(event);
          }}
          style={[styles.input, inputStyle]}
          {...rest}
        />
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  frame: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 1,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.onSurface,
    fontFamily: fonts.body,
    fontSize: 16,
  },
}));
