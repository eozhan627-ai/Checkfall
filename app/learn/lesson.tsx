import { router, useLocalSearchParams } from "expo-router";
import { Chess } from "chess.js";
import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getLessonContent } from "../../lib/lessonContent";
import PuzzleBoard from "../components/PuzzleBoard";

export default function LessonScreen() {
    const { title, mistake_type } = useLocalSearchParams<{
        id: string;
        title: string;
        explanation: string;
        mistake_type: string;
    }>();

    const coachImage = require("../../assets/images/coach.png");
    const content = getLessonContent(mistake_type);
    const exercise = content.exercises[0];

    // =============================
    // ÜBUNG (wiederverwendete Logik aus PuzzlesScreen)
    // =============================

    const [exerciseStarted, setExerciseStarted] = useState(false);
    const [game, setGame] = useState<Chess | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [legalMoves, setLegalMoves] = useState<string[]>([]);
    const [moveIndex, setMoveIndex] = useState(0);
    const [feedback, setFeedback] = useState<string | null>(null);

    function startExercise() {
        if (!exercise) return;

        setGame(new Chess(exercise.fen));
        setSelected(null);
        setLegalMoves([]);
        setMoveIndex(0);
        setFeedback(null);
        setExerciseStarted(true);
    }

    function onSquarePress(square: string) {
        if (!game || !exercise) return;

        const piece = game.get(square as any);

        // Eigene Figur auswählen
        if (piece && piece.color === game.turn()) {
            setSelected(square);
            setLegalMoves(
                game.moves({ square: square as any, verbose: true }).map((m) => m.to)
            );
            setFeedback(null);
            return;
        }

        if (!selected) return;

        const legal = game
            .moves({ square: selected as any, verbose: true })
            .some((m) => m.to === square);

        if (!legal) return;

        const expectedMove = exercise.moves[moveIndex];
        if (!expectedMove) return;

        const expectedFrom = expectedMove.slice(0, 2);
        const expectedTo = expectedMove.slice(2, 4);

        if (selected !== expectedFrom || square !== expectedTo) {
            setFeedback("❌ Nicht der richtige Zug — versuch's nochmal");
            setSelected(null);
            setLegalMoves([]);
            return;
        }

        const newGame = new Chess(game.fen());
        newGame.move({ from: selected, to: square });

        let nextMoveIndex = moveIndex + 1;

        // Falls es in der Zugfolge eine automatische Gegenantwort gibt
        if (nextMoveIndex < exercise.moves.length) {
            const enemyMove = exercise.moves[nextMoveIndex];
            newGame.move({
                from: enemyMove.slice(0, 2),
                to: enemyMove.slice(2, 4),
            });
            nextMoveIndex++;
        }

        setGame(newGame);
        setMoveIndex(nextMoveIndex);
        setSelected(null);
        setLegalMoves([]);

        if (nextMoveIndex >= exercise.moves.length) {
            setFeedback("🎉 Richtig gelöst!");
            return;
        }

        setFeedback("✅ Richtig");
    }

    const playerColor = game ? game.turn() : "w";

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.iconButton}>
                    <Text style={styles.backText}>‹</Text>
                </Pressable>
                <Text style={styles.title}>{title || content.title}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Coach mit Sprechblase, die zu ihm zeigt */}
                <View style={styles.coachRow}>
                    <View style={styles.bubble}>
                        <Text style={styles.bubbleText}>{content.coachMessage}</Text>
                        <View style={styles.bubbleTail} />
                    </View>
                    <Image source={coachImage} style={styles.coachImage} resizeMode="contain" />
                </View>

                <View style={styles.card}>
                    <Text style={styles.label}>
                        {mistake_type?.replace(/_/g, " ")}
                    </Text>
                    <Text style={styles.explanation}>{content.explanation}</Text>

                    {content.tip ? (
                        <View style={styles.tipBox}>
                            <Text style={styles.tipLabel}>💡 Tipp</Text>
                            <Text style={styles.tipText}>{content.tip}</Text>
                        </View>
                    ) : null}
                </View>

                {!exerciseStarted ? (
                    <Pressable
                        style={[styles.solveButton, !exercise && styles.solveButtonDisabled]}
                        onPress={startExercise}
                        disabled={!exercise}
                    >
                        <Text style={styles.solveButtonText}>
                            {exercise ? "Übung starten" : "Noch keine Übung verfügbar"}
                        </Text>
                    </Pressable>
                ) : (
                    <View style={styles.exerciseSection}>
                        <PuzzleBoard
                            board={game!.board()}
                            selectedSquare={selected}
                            legalSquares={legalMoves}
                            onSquarePress={onSquarePress}
                            playerColor={playerColor as "w" | "b"}
                        />

                        {feedback && (
                            <Text style={styles.feedbackText}>{feedback}</Text>
                        )}

                        <Pressable style={styles.restartButton} onPress={startExercise}>
                            <Text style={styles.restartButtonText}>🔁 Nochmal üben</Text>
                        </Pressable>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0F1115" },
    header: {
        marginTop: 50,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: "rgba(23,26,32,0.92)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 14,
    },
    backText: { color: "#ECEDEE", fontSize: 26, fontWeight: "300" },
    title: { fontSize: 22, fontWeight: "800", color: "#fff", flexShrink: 1 },
    content: { padding: 20, paddingBottom: 40 },

    coachRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "flex-end",
        marginBottom: 24,
    },
    coachImage: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginLeft: 10,
        borderWidth: 2,
        borderColor: "#7C9473",
    },
    bubble: {
        maxWidth: "72%",
        backgroundColor: "rgba(124,148,115,0.18)",
        borderColor: "#7C9473",
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        position: "relative",
    },
    bubbleText: {
        color: "#ECEDEE",
        fontSize: 14,
        lineHeight: 20,
    },
    bubbleTail: {
        position: "absolute",
        right: -8,
        bottom: 14,
        width: 0,
        height: 0,
        borderTopWidth: 8,
        borderBottomWidth: 8,
        borderLeftWidth: 10,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        borderLeftColor: "#7C9473",
    },

    card: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },
    label: {
        fontSize: 13,
        fontWeight: "700",
        color: "rgba(255,255,255,0.55)",
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginBottom: 10,
    },
    explanation: { fontSize: 16, color: "#ECEDEE", lineHeight: 24 },

    tipBox: {
        marginTop: 16,
        backgroundColor: "rgba(124,148,115,0.12)",
        borderRadius: 12,
        padding: 12,
    },
    tipLabel: { fontSize: 13, fontWeight: "700", color: "#7C9473", marginBottom: 4 },
    tipText: { fontSize: 14, color: "#ECEDEE", lineHeight: 20 },

    solveButton: {
        marginTop: 24,
        backgroundColor: "#7C9473",
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
    },
    solveButtonDisabled: {
        opacity: 0.4,
    },
    solveButtonText: { color: "#0F1115", fontWeight: "800", fontSize: 16 },

    exerciseSection: {
        marginTop: 24,
        alignItems: "center",
    },
    feedbackText: {
        color: "#ECEDEE",
        fontWeight: "700",
        fontSize: 14,
        marginTop: 14,
        textAlign: "center",
    },
    restartButton: {
        marginTop: 16,
        backgroundColor: "rgba(124,148,115,0.15)",
        borderWidth: 1,
        borderColor: "#7C9473",
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 18,
    },
    restartButtonText: {
        color: "#7C9473",
        fontWeight: "700",
        fontSize: 13,
    },
});