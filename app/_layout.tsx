import { Stack } from "expo-router";

export default function Layout() {
  return <Stack screenOptions={{
    contentStyle: { backgroundColor: ' lime' },
    headerShown: false
  }} />;
}