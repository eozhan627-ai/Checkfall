import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const STORAGE_KEY = "game_history";

type GameHistoryItem = {
  id: string;
  mode: "bot" | "local";
  date: string;
  result: "win" | "loss" | "draw" | "aborted";
  timestamp: number;
};

export default function GameHistory() {
  const [history, setHistory] = useState<GameHistoryItem[]>([]);

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
      console.log("Fehler beim Laden des Spielverlaufs", e);
    }
  }

  async function deleteGame(id: string) {
    try {
      const updated = history.filter(item => item.id !== id);
      setHistory(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.log("Fehler beim Löschen", e);
    }
  }

  function confirmDelete(id: string) {
    Alert.alert(
      "Spiel löschen",
      "Möchtest du dieses Spiel wirklich löschen?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: () => deleteGame(id),
        },
      ]
    );
  }

  function translateResult(result: GameHistoryItem["result"]) {
    switch (result) {
      case "win":
        return "Sieg";
      case "loss":
        return "Niederlage";
      case "draw":
        return "Remis";
      case "aborted":
        return "Abgebrochen";
    }
  }

  function renderItem({ item }: { item: GameHistoryItem }) {
    const date = new Date(item.timestamp); // aus gespeicherter Zeit
    const formatted = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

    return (
      <Pressable
        style={styles.item}
        onLongPress={() => confirmDelete(item.id)}
      >
        <Text style={styles.mode}>
          {item.mode === "bot" ? "🤖 Spiel gegen Bot" : "👥 Lokales Spiel"}
        </Text>

        <Text style={styles.meta}>
          {formatted} · {translateResult(item.result)}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spielverlauf</Text>
      <Text style={styles.subtitle}>
        Deine gespielten Spiele auf diesem Gerät
      </Text>

      {history.length === 0 ? (
        <Text style={styles.empty}>
          Noch keine Spiele gespielt.
        </Text>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f0f0f0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
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