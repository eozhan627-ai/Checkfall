import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react"; // useRef ergänzt

import {
  Alert,
  FlatList,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getCurrentAccount, VipTier } from "../lib/account";
import {
  onAnalysisComplete,
  onAnalysisError,
  onAnalysisProgress,
  requestGameAnalysis,
} from "../lib/games";
import { getSocket } from "../lib/socket";

const STORAGE_KEY = "game_history";
type GameHistoryItem = {
  id: string;
  mode: "bot" | "local" | "online";
  date: string;
  result: "win" | "loss" | "draw" | "aborted";
  timestamp: number;
  remoteId?: string | null; // NEU
};
type AnalysisMove = { moveNumber: number; san: string; evalCp: number | null };

function summarizeAnalysis(moves: AnalysisMove[]) {
  let prevEval = 0;
  let worst: { moveNumber: number; san: string; swing: number; mover: "w" | "b" } | null = null;

  moves.forEach((m, i) => {
    if (m.evalCp === null) return;

    const mover: "w" | "b" = i % 2 === 0 ? "w" : "b";
    const diff = m.evalCp - prevEval;
    const badness = mover === "w" ? -diff : diff; // schlecht aus Sicht des Ziehenden

    if (!worst || badness > worst.swing) {
      worst = { moveNumber: m.moveNumber, san: m.san, swing: badness, mover };
    }

    prevEval = m.evalCp;
  });

  return worst;
}

export default function GameHistory() {
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [vipTier, setVipTier] = useState<VipTier>("none");

  type AnalysisState = {
    status: "idle" | "analyzing" | "done" | "error" | "not_vip";
    progress?: number;
    total?: number;
    summary?: { moveNumber: number; san: string; swing: number; mover: "w" | "b" } | null;
  };


  const [analysisByRemoteId, setAnalysisByRemoteId] = useState<Record<string, AnalysisState>>({});
  const backgroundImage = require("../assets/images/background.png");

  useEffect(() => {
    loadHistory();
  }, []);
  useEffect(() => {
    (async () => {
      const acc = await getCurrentAccount();
      setVipTier(acc?.vipTier ?? "none");
    })();
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const offProgress = onAnalysisProgress(socket, ({ gameId, progress, total }) => {
      setAnalysisByRemoteId((prev) => ({
        ...prev,
        [gameId]: { status: "analyzing", progress, total },
      }));
    });

    const offComplete = onAnalysisComplete(socket, ({ gameId, analysis }) => {
      const summary = summarizeAnalysis(analysis?.moves ?? []);
      setAnalysisByRemoteId((prev) => ({
        ...prev,
        [gameId]: { status: "done", summary },
      }));
    });

    const offError = onAnalysisError(socket, ({ gameId, error }) => {
      setAnalysisByRemoteId((prev) => ({
        ...prev,
        [gameId]: { status: error === "NOT_VIP" ? "not_vip" : "error" },
      }));
    });

    return () => {
      offProgress();
      offComplete();
      offError();
    };
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
  async function handleAnalyze(remoteId: string) {
    setAnalysisByRemoteId((prev) => ({
      ...prev,
      [remoteId]: { status: "analyzing", progress: 0, total: 0 },
    }));

    try {
      const socket = getSocket();
      await requestGameAnalysis(socket, remoteId);
      // Ergebnis kommt über die Listener oben (analysis_complete/analysis_progress)
    } catch (error: any) {
      const message = error?.message || "UNKNOWN_ERROR";
      setAnalysisByRemoteId((prev) => ({
        ...prev,
        [remoteId]: { status: message === "NOT_VIP" ? "not_vip" : "error" },
      }));
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
  function renderAnalysisSection(remoteId: string) {
    const state = analysisByRemoteId[remoteId];

    if (vipTier === "none" || state?.status === "not_vip") {
      return (
        <Pressable onPress={() => router.push("/vip")}>
          <Text style={styles.vipHintText}>Analyse nur für VIP · Mehr erfahren</Text>
        </Pressable>
      );
    }

    if (!state || state.status === "idle") {
      return (
        <Pressable
          onPress={() => handleAnalyze(remoteId)}
          style={({ pressed }) => [styles.analyzeButton, pressed && styles.pressed]}
        >
          <Text style={styles.analyzeButtonText}>Analysiere diese Partie</Text>
        </Pressable>
      );
    }

    if (state.status === "analyzing") {
      return (
        <Text style={styles.analyzingText}>
          Analysiere... {state.progress ?? 0}/{state.total || "?"}
        </Text>
      );
    }

    if (state.status === "error") {
      return <Text style={styles.errorText}>Analyse fehlgeschlagen</Text>;
    }

    if (state.status === "done") {
      if (!state.summary) {
        return <Text style={styles.doneText}>✓ Analysiert – keine Auffälligkeiten</Text>;
      }

      const { moveNumber, san, mover, swing } = state.summary;
      const sideLabel = mover === "w" ? "Weiß" : "Schwarz";
      const pawns = (swing / 100).toFixed(1);

      return (
        <Text style={styles.doneText}>
          ✓ Größter Fehler: Zug {moveNumber} {san} ({sideLabel}, {pawns} Bauerneinheiten)
        </Text>
      );
    }

    return null;
  }
  function renderItem({ item }: { item: GameHistoryItem }) {
    const date = new Date(item.timestamp);
    const formatted = `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    const resultInfo = getResultInfo(item.result);
    const modeInfo = getModeInfo(item.mode);
    const canReview = !!item.remoteId;

    return (
      <Pressable
        onPress={() => {
          if (!canReview) {
            Alert.alert("Nicht verfügbar", "Diese Partie kann nicht analysiert werden.");
            return;
          }
          router.push({ pathname: "/game/review", params: { gameId: item.remoteId! } });
        }}
        style={({ pressed }) => [
          styles.gameCard,
          { borderColor: modeInfo.border },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.accentBar, { backgroundColor: resultInfo.iconColor }]} />

        <View style={[styles.resultIcon, { backgroundColor: resultInfo.background, borderColor: resultInfo.border }]}>
          <Text style={[styles.resultIconText, { color: resultInfo.iconColor }]}>{resultInfo.icon}</Text>
        </View>

        <View style={styles.gameContent}>
          <View style={styles.titleRow}>
            <Text style={styles.gameTitle}>{resultInfo.label}</Text>
            <View style={[styles.modeBadge, { backgroundColor: modeInfo.background, borderColor: modeInfo.border }]}>
              <Text style={styles.modeBadgeText}>{modeInfo.label}</Text>
            </View>
          </View>

          <Text style={styles.date}>{formatted}</Text>

          {canReview ? (
            <Text style={styles.reviewHint}>Zum Review antippen ›</Text>
          ) : (
            <Text style={styles.noReviewHint}>Nicht analysierbar</Text>
          )}
        </View>

        <Pressable
          onPress={() => confirmDelete(item.id)}
          hitSlop={10}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        >
          <Text style={styles.deleteText}>×</Text>
        </Pressable>
      </Pressable>
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
    minHeight: 96,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    overflow: "hidden",
  },
  accentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  modeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  modeBadgeText: { color: "#ccc", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  reviewHint: { color: "#D4AF37", fontSize: 11, fontWeight: "600", marginTop: 6 },
  noReviewHint: { color: "#555", fontSize: 11, marginTop: 6 },

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
  analysisRow: {
    marginTop: 8,
  },

  analyzeButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(212,175,55,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
  },

  analyzeButtonText: {
    color: "#D4AF37",
    fontSize: 11,
    fontWeight: "700",
  },

  analyzingText: {
    color: "#888",
    fontSize: 11,
  },

  vipHintText: {
    color: "#D4AF37",
    fontSize: 11,
    fontWeight: "600",
  },

  errorText: {
    color: "#ff6464",
    fontSize: 11,
  },

  doneText: {
    color: "#8fd4a8",
    fontSize: 11,
    lineHeight: 15,
  },
});