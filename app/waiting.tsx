import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { getCurrentAccount } from "../lib/account";
import { getSocket } from "../lib/socket";

export default function WaitingScreen() {
  const router = useRouter();
  const [status, setStatus] = useState("Suche nach Gegner…");

  useEffect(() => {
    const socket = getSocket();

    let account: any = null;

    const startMatchmaking = async () => {
      account = await getCurrentAccount();

      if (!account) {
        console.log("❌ Kein Account gefunden");
        return;
      }

      console.log("🔎 Suche Gegner für:", account.name);

      socket.emit("find_match", {
        name: account.name,
        avatar: account.avatar,
      });
    };

    const onConnect = () => {
      console.log("🟢 SOCKET CONNECTED", socket.id);
      startMatchmaking();
    };

    const onGameStart = (data: {
      roomId: string;
      white: string;
      black: string;
      whiteName: string;
      blackName: string;
      whiteAvatar: string;
      blackAvatar: string;
    }) => {
      console.log("🎮 Game start received:", data);

      setStatus("Gegner gefunden! Starte Spiel…");

      setTimeout(() => {
        router.replace({
          pathname: "/game",
          params: data,
        });
      }, 500);
    };

    const onWaiting = () => {
      console.log("⏳ Warte auf Gegner");
      setStatus("Warte auf Gegner…");
    };

    if (socket.connected) {
      startMatchmaking();
    }

    socket.on("connect", onConnect);
    socket.on("game_start", onGameStart);
    socket.on("waiting", onWaiting);

    return () => {
      socket.off("connect", onConnect);
      socket.off("game_start", onGameStart);
      socket.off("waiting", onWaiting);
    };
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 20 }}>{status}</Text>
    </View>
  );
}