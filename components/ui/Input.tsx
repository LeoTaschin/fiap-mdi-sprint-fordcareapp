import { forwardRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, ...props },
  ref
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
      <TextInput
        ref={ref}
        style={[styles.input, !!error && styles.inputError]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={Colors.textMuted}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.primary,
    marginBottom: 6,
  },
  labelFocused: {
    color: Colors.primaryLight,
  },
  input: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.primary,
  },
  inputError: {
    borderBottomColor: Colors.danger,
  },
  error: {
    marginTop: 4,
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.danger,
  },
});
