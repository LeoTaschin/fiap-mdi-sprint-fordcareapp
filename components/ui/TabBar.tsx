import { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions, Animated } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';

type TabConfig = {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const TABS: TabConfig[] = [
  { name: 'home',        icon: 'home-outline'      },
  { name: 'manutencoes', icon: 'construct-outline'  },
  { name: 'agendamento', icon: 'calendar-outline'   },
  { name: 'perfil',      icon: 'person-outline'     },
];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const containerWidth = width * 0.95;

  const [tabWidth, setTabWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (tabWidth === 0) return;
    Animated.spring(indicatorX, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.8,
    }).start();
  }, [state.index, tabWidth]);

  function onContainerLayout(e: any) {
    const totalWidth = e.nativeEvent.layout.width;
    const computed = totalWidth / TABS.length;
    setTabWidth(computed);
    indicatorX.setValue(state.index * computed);
  }

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom || 16 }]}>
      <View
        style={[styles.container, { width: containerWidth }]}
        onLayout={onContainerLayout}
      >
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.indicator,
              {
                width: tabWidth - 8,
                transform: [{ translateX: indicatorX }],
              },
            ]}
          />
        )}

        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;

          const isActive = state.index === index;

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tab}
              onPress={() => navigation.navigate(route.name)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={isActive ? Colors.primary : Colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingTop: 8,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 40,
    paddingHorizontal: 4,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  indicator: {
    position: 'absolute',
    top: 8,
    left: 4,
    bottom: 8,
    borderRadius: 32,
    backgroundColor: Colors.surfaceMuted,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    zIndex: 1,
  },
});
