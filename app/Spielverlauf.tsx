import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
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

  const backgroundImage = require("../assets/images/background.png");

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
      const updated = history.filter(
        (item) => item.id !== id
      );

      setHistory(updated);

      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updated)
      );
    } catch (e) {
      console.log("Error deleting game", e);
    }
  }

  function confirmDelete(id: string) {
    Alert.alert(
      "Delete Game",
      "Are you sure you want to delete this game?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteGame(id),
        },
      ]
    );
  }

  function getResultInfo(
    result: GameHistoryItem["result"]
  ) {
    switch (result) {
      case "win":
        return {
          icon: "♛",
          label: "WIN",
          background: "rgba(70,200,120,0.12)",
          border: "rgba(70,200,120,0.25)",
          iconColor: "#55c98a",
        };

      case "loss":
        return {
          icon: "×",
          label: "LOSS",
          background: "rgba(255,70,70,0.10)",
          border: "rgba(255,70,70,0.25)",
          iconColor: "#ff6464",
        };

      case "draw":
        return {
          icon: "＝",
          label: "DRAW",
          background: "rgba(212,175,55,0.10)",
          border: "rgba(212,175,55,0.25)",
          iconColor: "#D4AF37",
        };

      case "aborted":
        return {
          icon: "↩",
          label: "ABORTED",
          background: "rgba(150,150,150,0.10)",
          border: "rgba(150,150,150,0.20)",
          iconColor: "#999",
        };
    }
  }

  function getModeInfo(
    mode: GameHistoryItem["mode"]
  ) {
    switch (mode) {
      case "bot":
        return {
          label: "BOT GAME",
          background: "rgba(90,120,255,0.045)",
          border: "rgba(90,120,255,0.08)",
        };

      case "online":
        return {
          label: "ONLINE GAME",
          background: "rgba(70,180,255,0.045)",
          border: "rgba(70,180,255,0.08)",
        };

      case "local":
        return {
          label: "LOCAL GAME",
          background: "rgba(212,175,55,0.045)",
          border: "rgba(212,175,55,0.08)",
        };
    }
  }

  function getResultLabel(
    result: GameHistoryItem["result"]
  ) {
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

  function getResultStyle(
    result: GameHistoryItem["result"]
  ) {
    switch (result) {
      case "win":
        return styles.resultWin;

      case "loss":
        return styles.resultLoss;

      case "draw":
        return styles.resultDraw;

      case "aborted":
        return styles.resultAborted;
    }
  }

  function renderItem({
    item,
  }: {
    item: GameHistoryItem;
  }) {
    const date = new Date(item.timestamp);

    const formatted =
      `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

    const resultInfo = getResultInfo(item.result);
    const modeInfo = getModeInfo(item.mode);

    return (
      <View
        style={[
          styles.gameCard,
          {
            backgroundColor: modeInfo.background,
            borderColor: modeInfo.border,
          },
        ]}
      >
        {/* RESULT ICON */}
        <View
          style={[
            styles.resultIcon,
            {
              backgroundColor: resultInfo.background,
              borderColor: resultInfo.border,
            },
          ]}
        >
          <Text
            style={[
              styles.resultIconText,
              {
                color: resultInfo.iconColor,
              },
            ]}
          >
            {resultInfo.icon}
          </Text>
        </View>

        {/* CONTENT */}
        <View style={styles.gameContent}>
          <Text style={styles.gameTitle}>
            {resultInfo.label}
          </Text>

          <Text style={styles.gameSubtitle}>
            {modeInfo.label}
          </Text>

          <View style={styles.metaRow}>
            <Text
              style={styles.date}
              numberOfLines={1}
            >
              {formatted}
            </Text>

            <View
              style={[
                styles.resultBadge,
                getResultStyle(item.result),
              ]}
            >
              <Text style={styles.resultText}>
                {getResultLabel(item.result)}
              </Text>
            </View>
          </View>
        </View>

        {/* DELETE */}
        <Pressable
          onPress={() => confirmDelete(item.id)}
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.deleteText}>
            ×
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ImageBackground
      source={backgroundImage}
      style={styles.background}
      resizeMode="cover"
    >
      {/* DARK OVERLAY */}
      <View style={styles.darkOverlay} />

      <View style={styles.screen}>

        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backText}>
              ‹
            </Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            GAME HISTORY
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* INTRO */}
        <View style={styles.intro}>
          <Text style={styles.title}>
            Your Games
          </Text>

          <Text style={styles.subtitle}>
            Your played games on this device
          </Text>
        </View>

        {/* LIST */}
        {history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>
                ♟
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              No games yet
            </Text>

            <Text style={styles.emptySubtitle}>
              Your played games will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  /* BACKGROUND */

  background: {
    flex: 1,
  },

  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.68)",
  },

  screen: {
    flex: 1,
    alignItems: "center",
  },

  /* HEADER */

  header: {
    width: "100%",
    height: 70,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    justifyContent: "center",
    alignItems: "center",
  },

  backText: {
    color: "#fff",
    fontSize: 34,
    lineHeight: 34,
    fontWeight: "300",
  },

  headerTitle: {
    color: "#D4AF37",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 3,
  },

  headerSpacer: {
    width: 42,
  },

  /* INTRO */

  intro: {
    width: "90%",
    maxWidth: 430,
    marginTop: 18,
    marginBottom: 22,
  },

  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
  },

  subtitle: {
    color: "#777",
    fontSize: 13,
    marginTop: 5,
  },

  /* LIST */

  listContent: {
    width: "100%",
    alignItems: "center",
    paddingBottom: 50,
  },

  /* GAME CARD */

  gameCard: {
    width: "92%",
    maxWidth: 430,
    minHeight: 94,

    borderRadius: 20,

    paddingHorizontal: 12,
    paddingVertical: 12,

    marginBottom: 12,

    flexDirection: "row",
    alignItems: "center",

    borderWidth: 1,
  },

  /* RESULT ICON */

  resultIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,

    justifyContent: "center",
    alignItems: "center",

    borderWidth: 1,

    marginRight: 12,
  },

  resultIconText: {
    fontSize: 24,
    fontWeight: "700",
  },

  /* CONTENT */

  gameContent: {
    flex: 1,
    minWidth: 0,
  },

  gameTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },

  gameSubtitle: {
    color: "#777",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 3,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    minWidth: 0,
  },

  date: {
    color: "#888",
    fontSize: 10,
    flexShrink: 1,
  },

  /* RESULT BADGE */

  resultBadge: {
    marginLeft: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
  },

  resultWin: {
    backgroundColor: "rgba(70,200,120,0.10)",
    borderColor: "rgba(70,200,120,0.25)",
  },

  resultLoss: {
    backgroundColor: "rgba(255,70,70,0.10)",
    borderColor: "rgba(255,70,70,0.25)",
  },

  resultDraw: {
    backgroundColor: "rgba(212,175,55,0.10)",
    borderColor: "rgba(212,175,55,0.25)",
  },

  resultAborted: {
    backgroundColor: "rgba(150,150,150,0.10)",
    borderColor: "rgba(150,150,150,0.20)",
  },

  resultText: {
    color: "#aaa",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  /* DELETE */

  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 12,

    backgroundColor: "rgba(255,255,255,0.045)",

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",

    justifyContent: "center",
    alignItems: "center",

    marginLeft: 7,
  },

  deleteText: {
    color: "#777",
    fontSize: 25,
    fontWeight: "300",
    lineHeight: 25,
  },

  /* EMPTY */

  emptyContainer: {
    width: "90%",
    maxWidth: 430,

    marginTop: 50,

    alignItems: "center",
  },

  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,

    backgroundColor: "rgba(212,175,55,0.10)",

    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.18)",

    justifyContent: "center",
    alignItems: "center",

    marginBottom: 16,
  },

  emptyIconText: {
    color: "#D4AF37",
    fontSize: 32,
  },

  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  emptySubtitle: {
    color: "#777",
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
  },

  /* PRESS */

  pressed: {
    opacity: 0.65,
    transform: [{ scale: 0.985 }],
  },
});