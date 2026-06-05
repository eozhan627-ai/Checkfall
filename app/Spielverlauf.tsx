import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const STORAGE_KEY = "game_history";

type GameHistoryItem = {
  id: string;
  mode: "bot" | "local" | "online";
  date: string;
  result: "win" | "loss" | "draw" | "aborted";
  timestamp: number;
};

export default function GameHistory() {
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const backgroundImage = require("../assets/images/background.png"); // Hintergrundbild

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setHistory(JSON.parse(data));
      }
    } catch (e) {
      console.log("Error loading game history", e);
    }
  }

  async function deleteGame(id: string) {
    try {
      const updated = history.filter(item => item.id !== id);
      setHistory(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.log("Error deleting game", e);
    }
  }

  function confirmDelete(id: string) {
    Alert.alert(
      "Delete Game",
      "Are you sure you want to delete this game?",
      [
        { text: "Cancel ", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteGame(id),
        },
      ]
    );
  }

  function translateResult(result: GameHistoryItem["result"]) {
    switch (result) {
      case "win":
        return "Win";
      case "loss":
        return "Loss";
      case "draw":
        return "Draw";
      case "aborted":
        return "Aborted";
    }
  }
  function renderItem({ item }: { item: GameHistoryItem }) {
    const date = new Date(item.timestamp);

    const formatted =
      `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",

          backgroundColor: "rgba(255,255,255,0.08)",

          borderRadius: 14,
          padding: 16,
          marginBottom: 12,
        }}
      >
        {/* LINKER TEIL */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: "#fff",
            }}
          >
            {item.mode === "bot"
              ? "🤖 Bot-game"
              : item.mode === "online"
                ? "🌍 Online-game"
                : "👥 Local-game"}
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: "#d4d4d4",
              marginTop: 4,
            }}
          >
            {formatted} · {translateResult(item.result)}
          </Text>
        </View>

        {/* PAPIERKORB */}
        <Pressable
          onPress={() => confirmDelete(item.id)}
          style={{
            marginLeft: 12,
            padding: 8,
          }}
        >
          <Text style={{ fontSize: 22 }}>
            🗑️
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ImageBackground source={backgroundImage} style={{ flex: 1 }}>
      <View style={styles.container}>
        <Text style={styles.title}>Game History</Text>
        <Text style={styles.subtitle}>
          Your played games on this device
        </Text>

        {history.length === 0 ? (
          <Text style={styles.empty}>
            No games played yet.
          </Text>
        ) : (
          <FlatList
            data={history}
            keyExtractor={item => item.id}
            renderItem={renderItem}
          />
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,

  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
    marginTop: 12,
    color: "#fff",
  },
  subtitle: {
    fontSize: 14,
    color: "#fff",
    marginBottom: 16,
  },
  item: {
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  mode: {
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  empty: {
    textAlign: "center",
    marginTop: 40,
    color: "#666",
    fontSize: 14,
  },
});