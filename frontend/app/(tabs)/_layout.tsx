import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { colors } from '@/constants/theme';

function TabGlyph({ label, color }: { label: string; color: string }) {
  return (
    <Text style={{ color, fontSize: 16, fontWeight: '700' }}>{label}</Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerStyle: { backgroundColor: colors.onyx },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: '600' },
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Carteira',
          tabBarIcon: ({ color }) => <TabGlyph label="◎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="copilot"
        options={{
          title: 'Copiloto',
          tabBarIcon: ({ color }) => <TabGlyph label="♪" color={color} />,
        }}
      />
      <Tabs.Screen
        name="burn"
        options={{
          title: 'Burn',
          tabBarIcon: ({ color }) => <TabGlyph label="△" color={color} />,
        }}
      />
    </Tabs>
  );
}
