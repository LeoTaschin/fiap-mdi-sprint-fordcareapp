import { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

const SCREEN_HEIGHT = Dimensions.get('window').height;

export function BottomSheet({ visible, onClose, title, children }: Props) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.inactive,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
});
