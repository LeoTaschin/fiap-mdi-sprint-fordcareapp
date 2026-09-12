import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

type ToastType = 'success' | 'error';

type Props = {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide: () => void;
};

export function Toast({ message, type = 'success', visible, onHide }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => onHide());
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, styles[type], { opacity }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: 12,
    padding: Spacing.md,
    zIndex: 999,
  },
  success: { backgroundColor: Colors.success },
  error: { backgroundColor: Colors.danger },
  text: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.surface,
    textAlign: 'center',
  },
});
