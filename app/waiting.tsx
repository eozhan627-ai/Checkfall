//import { useRouter } from "expo-router";
//import { useEffect } from "react";
//import { ActivityIndicator, Text, View } from "react-native";
//import { socket } from "../lib/socket";

//export default function WaitingScreen() {
//const router = useRouter();

//useEffect(() => {
//if (socket.connected) {
//socket.emit("find_game");
//} else {
//  socket.on("connect", () => socket.emit("find_game"));
//}

//const startGame = (data: any) => {
//console.log("🎮 start_game received", data);
//router.push(`/game?roomId=${data.roomId}&white=${data.white}&black=${data.black}`);
//};


//  socket.on("game_start", startGame);
//return () => {
//socket.off("game_start ", startGame);
//};
//}, []);

//return (
//<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
// <ActivityIndicator size="large" />
//<Text>Searching for opponent…  </Text>
//</View>
//);
//}
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function ComingSoonPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coming Soon 🚀</Text>
      <Text style={styles.subtitle}>
        Diese Funktion wird bald verfügbar sein.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 10 },
  subtitle: { fontSize: 16, color: "#555", textAlign: "center", paddingHorizontal: 20 },
});