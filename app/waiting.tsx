import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { getSocket } from "../lib/socket";

export default function WaitingScreen() {
  const router = useRouter();
  const [status, setStatus] = useState("Suche nach Gegner… ");

  useEffect(() => {
    const socket = getSocket();

    // Wenn Socket schon verbunden ist, direkt emitten
    if (socket.connected) {
      console.log("🟢 SOCKET ALREADY CONNECTED", socket.id);
      socket.emit("find_match");
    }

    // Listener für connect
    const onConnect = () => {
      console.log("🟢 SOCKET CONNECTED", socket.id);
      socket.emit("find_match");
    };
    socket.on("connect", onConnect);

    // Listener für game_start
    const onGameStart = (data: { roomId: string; white: string; black: string }) => {
      console.log("🎮 Game start received", data);
      setStatus("Gegner gefunden! Starte Spiel…  ");
      setTimeout(() => {
        router.push({ pathname: "/game", params: data });
      }, 500);
    };
    socket.on("game_start", onGameStart);

    // Cleanup
    return () => {
      socket.off("connect", onConnect);
      socket.off("game_start", onGameStart);
    };
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
      <Text>{status}</Text>
    </View>
  );
}