import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Kein weißer Übergang beim Tab-Wechsel
        animation: "none",
        // Dunkler Hintergrund des Navigators
        sceneStyle: {
          backgroundColor: "#080808",
        },
        tabBarStyle: {
          backgroundColor: "#0d0d0d",
          borderTopColor: "rgba(212, 175, 55, 0.25)",
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 80,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#d4af37",
        tabBarInactiveTintColor: "#777",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Start",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="home"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: "Lernen",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="school"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: "Social",
       
          href: "/social",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="people"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Mehr",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="menu"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}