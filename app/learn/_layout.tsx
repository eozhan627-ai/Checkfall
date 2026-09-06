import { Stack } from "expo-router";

export default function LearnLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,

        // Verhindert helle/weiße Flächen beim Screen-Wechsel
        contentStyle: {
          backgroundColor: "#080808",
        },

        // Keine seitliche Swipe-Animation,
        // dadurch kein sichtbarer Hintergrund-Streifen
        animation: "fade",
      }}
    />
  );
}