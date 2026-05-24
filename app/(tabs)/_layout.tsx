import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{

        headerShown: false,

        tabBarStyle: {
          backgroundColor: "#0d0d0d",
          borderTopColor: "rgba(212, 175, 55, 0.25)",
          borderTopWidth: 1,

        },

        tabBarLabelStyle: {
          fontSize: 17,
          fontWeight: "600",
        },

        tabBarActiveTintColor: "#d4af37",
        tabBarInactiveTintColor: "#888",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'Home',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{

          title: 'Social',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: () => null,
        }}
      />

    </Tabs>
  );
}