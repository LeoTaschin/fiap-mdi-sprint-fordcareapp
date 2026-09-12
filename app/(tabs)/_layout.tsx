import { Tabs } from 'expo-router';
import { TabBar } from '@/components/ui/TabBar';
import { useProactiveReminders } from '@/hooks/useProactiveReminders';

export default function TabLayout() {
  // Mantém os lembretes proativos em dia enquanto o usuário navega pelo app.
  useProactiveReminders();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="manutencoes" />
      <Tabs.Screen name="agendamento" />
      <Tabs.Screen name="perfil" />
    </Tabs>
  );
}
