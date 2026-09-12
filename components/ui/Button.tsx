import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Colors, FontFamily } from '@/constants/theme';

type Variant = 'primary' | 'outline' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, style }: Props) {
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], (disabled || loading) && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFF' : Colors.primary} />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label` as const]]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  outline: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: { opacity: 0.45 },
  label: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 16,
  },
  primaryLabel: { color: Colors.surface },
  outlineLabel: { color: Colors.primary },
  ghostLabel: { color: Colors.primary },
});
