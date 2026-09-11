import React, { useState } from "react";
import { TextInput, TextInputProps, View } from "react-native";

import { AppText } from "@/src/components/AppText";
import { fonts, makeStyles, radii, useTheme } from "@/src/theme";

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
  ...rest
}: TextInputProps & { label?: string; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <AppText variant="label" muted style={{ marginLeft: 4 }}>
          {label}
        </AppText>
      ) : null}
      <TextInput
        testID={testID}
        value={value}
        editable={editable}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.focused]}
        {...rest}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.onSurface,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  focused: { borderColor: colors.gold },
}));
