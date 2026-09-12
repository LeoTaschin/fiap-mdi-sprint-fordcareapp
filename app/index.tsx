import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '@/contexts/UserContext';
import { ONBOARDING_KEY } from '@/app/auth/onboarding';
import { Colors } from '@/constants/theme';

export default function Index() {
  const { initialized, user } = useUser();
  const [onboardingVisto, setOnboardingVisto] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => setOnboardingVisto(v === '1'))
      .catch(() => setOnboardingVisto(true)); // na dúvida, não bloqueia a entrada
  }, []);

  if (!initialized || onboardingVisto === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (user) return <Redirect href="/(tabs)/home" />;
  if (!onboardingVisto) return <Redirect href="/auth/onboarding" />;

  return <Redirect href="/auth/WelcomeScreen" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
