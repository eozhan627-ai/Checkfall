import { Chess } from "chess.js";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getLessonContent } from "../../lib/lessonContent";
import { lessonProgressKey, saveLessonResults } from "../../lib/lessonProgress";
import { getPersonalExercises } from "../../lib/personalLessons";
import PuzzleBoard from "../../components/PuzzleBoard";
import { tr } from "../../lib/i18n";
import { reportTaskEvent } from "../../lib/dailyTasks";
import { usePositionSound } from "../../lib/sounds";

const ACCENT = "#7C9473";
const GOLD = "#F5B942";

const WRONG_LINES = [
    "Close – take another careful look.",
    "Not quite. What is your opponent attacking?",
    "Almost! Remember the checklist.",
    "Ouch, that was not it. Try again!",
];
const RIGHT_LINES = [
    "Nicely played! 🔥",
    "Exactly! You spotted it. 👀",
    "Correct! Your coach is proud. 😎",
    "Perfectly spotted! ⚡",
];
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

function buzz(kind: "select" | "wrong" | "right") {
    try {
        if (kind === "select") Haptics.selectionAsync();
        else if (kind === "wrong") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
        // Haptik ist nur Bonus
    }
}

function Stars({ count, max = 3, size = 26 }: { count: number; max?: number; size?: number }) {
    return (
        <View style={{ flexDirection: "row" }}>
            {Array.from({ length: max }).map((_, i) => (
                <Text
                    key={i}
                    style={{ fontSize: size, color: i < count ? GOLD : "rgba(255,255,255,0.18)", marginHorizontal: 2 }}
                >
                    ★
                </Text>
            ))}
        </View>
    );
}

type Phase = "playing" | "solved" | "finished";

export default function LessonScreen() {
    const { id, title, mistake_type } = useLocalSearchParams<{
        id: string;
        title: string;
        explanation: string;
        mistake_type: string;
    }>();

    const coachImage = require("../../assets/images/coach.png");
    const content = getLessonContent(mistake_type);
    // Positions from the user's own games come first, then the standard ones.
    const ownExercises = useMemo(() => getPersonalExercises(id), [id]);
    const exercises = useMemo(
        () => [...ownExercises, ...content.exercises],
        [ownExercises, content]
    );
    const maxStars = exercises.length * 3;

    const [index, setIndex] = useState(0);
    const [game, setGame] = useState<Chess | null>(null);
    usePositionSound(game);
    const [playerColor, setPlayerColor] = useState<"w" | "b">("w");
    const [selected, setSelected] = useState<string | null>(null);
    const [legalMoves, setLegalMoves] = useState<string[]>([]);
    const [moveIndex, setMoveIndex] = useState(0);
    const [wrong, setWrong] = useState(0);
    const [hintLevel, setHintLevel] = useState(0);
    const [phase, setPhase] = useState<Phase>("playing");
    const [solvedStars, setSolvedStars] = useState(0);
    const [results, setResults] = useState<number[]>([]);
    const [coachText, setCoachText] = useState(content.coachMessage);

    const shake = useRef(new Animated.Value(0)).current;
    const pop = useRef(new Animated.Value(0)).current;

    const exercise = exercises[index];

    useEffect(() => {
        loadExercise(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function runPop() {
        pop.setValue(0);
        Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    }

    function runShake() {
        Animated.sequence(
            [10, -10, 8, -8, 0].map((v) =>
                Animated.timing(shake, { toValue: v, duration: 50, useNativeDriver: true })
            )
        ).start();
    }

    function loadExercise(i: number) {
        const ex = exercises[i];
        if (!ex) return;
        const g = new Chess(ex.fen);
        setIndex(i);
        setGame(g);
        setPlayerColor(g.turn());
        setSelected(null);
        setLegalMoves([]);
        setMoveIndex(0);
        setWrong(0);
        setHintLevel(0);
        setSolvedStars(0);
        setPhase("playing");
        setCoachText(
            ex.intro
                ? tr("Exercise {0} of {1}. {2}", i + 1, exercises.length, ex.intro)
                : tr("Exercise {0} of {1} – you play {2}. Find the best move!", i + 1, exercises.length, g.turn() === "w" ? "White" : "Black")
        );
    }

    /** Stellung zurücksetzen, Fehler und Tipps bleiben gezählt */
    function resetPosition() {
        if (!exercise) return;
        setGame(new Chess(exercise.fen));
        setSelected(null);
        setLegalMoves([]);
        setMoveIndex(0);
    }

    function restartAll() {
        setResults([]);
        loadExercise(0);
    }

    function showHint() {
        if (!game || !exercise || phase !== "playing") return;
        const expected = exercise.moves[moveIndex];
        if (!expected) return;

        if (hintLevel === 0) {
            setHintLevel(1);
            setCoachText("💡 " + exercise.hint);
            return;
        }
        setHintLevel(2);
        const from = expected.slice(0, 2);
        setSelected(from);
        setLegalMoves(game.moves({ square: from as any, verbose: true }).map((m) => m.to));
        setCoachText(tr("👆 This is the piece you need to move!"));
    }

    function onSquarePress(square: string) {
        if (!game || !exercise || phase !== "playing") return;

        const piece = game.get(square as any);

        if (piece && piece.color === game.turn()) {
            setSelected(square);
            setLegalMoves(game.moves({ square: square as any, verbose: true }).map((m) => m.to));
            buzz("select");
            return;
        }

        if (!selected) return;

        const legal = game.moves({ square: selected as any, verbose: true }).some((m) => m.to === square);
        if (!legal) return;

        const expectedMove = exercise.moves[moveIndex];
        if (!expectedMove) return;

        if (selected !== expectedMove.slice(0, 2) || square !== expectedMove.slice(2, 4)) {
            const w = wrong + 1;
            setWrong(w);
            setSelected(null);
            setLegalMoves([]);
            setCoachText("❌ " + pick(WRONG_LINES) + (w >= 2 && hintLevel === 0 ? tr(" Need a hint? Tap 💡") : ""));
            buzz("wrong");
            runShake();
            return;
        }

        const newGame = new Chess(game.fen());
        // The fifth character of a coordinate move is the promotion piece.
        newGame.move({ from: selected, to: square, promotion: expectedMove[4] || undefined });

        let nextMoveIndex = moveIndex + 1;

        // automatische Gegenantwort
        if (nextMoveIndex < exercise.moves.length) {
            const enemy = exercise.moves[nextMoveIndex];
            newGame.move({ from: enemy.slice(0, 2), to: enemy.slice(2, 4), promotion: enemy[4] || undefined });
            nextMoveIndex++;
        }

        setGame(newGame);
        setMoveIndex(nextMoveIndex);
        setSelected(null);
        setLegalMoves([]);

        if (nextMoveIndex >= exercise.moves.length) {
            const stars = Math.max(1, 3 - (wrong + hintLevel));
            setSolvedStars(stars);
            setResults((r) => [...r, stars]);
            setPhase("solved");
            setCoachText(pick(RIGHT_LINES));
            buzz("right");
            runPop();
            return;
        }

        setCoachText(tr("✅ Correct – keep going!"));
        buzz("right");
    }

    function next() {
        if (index + 1 < exercises.length) {
            loadExercise(index + 1);
            return;
        }
        const total = results.reduce((a, b) => a + b, 0);
        const ownCount = ownExercises.length;

        const standard = results.slice(ownCount).reduce((a, b) => a + b, 0);

        saveLessonResults([
            // The standard exercises count towards the tutorial ...
            { key: lessonProgressKey(mistake_type), stars: standard, maxStars: content.exercises.length * 3 },
            // ... and a lesson with positions from the user's games is counted on its own.
            ...(ownCount > 0
                ? [{ key: lessonProgressKey(mistake_type, true), stars: total, maxStars }]
                : []),
        ]);
        reportTaskEvent("lesson_done");
        setPhase("finished");
        runPop();
    }

    // =============================
    // Leerer Zustand
    // =============================
    if (!exercises.length) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.iconButton}>
                        <Text style={styles.backText}>‹</Text>
                    </Pressable>
                    <Text style={styles.title}>{title || content.title}</Text>
                </View>
                <Text style={styles.emptyText}>{tr("There are no exercises for this lesson yet.")}</Text>
            </View>
        );
    }

    // =============================
    // Ergebnis
    // =============================
    if (phase === "finished") {
        const total = results.reduce((a, b) => a + b, 0);
        const ratio = total / maxStars;
        const msg =
            ratio === 1
                ? tr("Perfect! No mistakes, no help – masterful! 🏆")
                : ratio >= 0.66
                ? tr("Strong! You have almost got it. 💪")
                : tr("Good start – one more round and you have got it! 🔁");

        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.iconButton}>
                        <Text style={styles.backText}>‹</Text>
                    </Pressable>
                    <Text style={styles.title}>{tr("Done!")}</Text>
                </View>

                <ScrollView contentContainerStyle={[styles.content, { alignItems: "center" }]}>
                    <Animated.View
                        style={{
                            alignItems: "center",
                            opacity: pop,
                            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
                        }}
                    >
                        <Image source={coachImage} style={styles.coachBig} resizeMode="contain" />
                        <Stars count={Math.round(ratio * 3)} size={44} />
                        <Text style={styles.resultBig}>
                            {total} / {maxStars} {tr("stars")}
                        </Text>
                    </Animated.View>

                    <Text style={styles.resultMsg}>{msg}</Text>

                    <View style={styles.resultList}>
                        {results.map((s, i) => (
                            <View key={i} style={styles.resultRow}>
                                <Text style={styles.resultLabel}>{tr("Exercise")} {i + 1}</Text>
                                <Stars count={s} size={18} />
                            </View>
                        ))}
                    </View>

                    <Pressable style={styles.solveButton} onPress={restartAll}>
                        <Text style={styles.solveButtonText}>{tr("🔁 Play again")}</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
                        <Text style={styles.secondaryButtonText}>{tr("Finish")}</Text>
                    </Pressable>
                </ScrollView>
            </View>
        );
    }

    // =============================
    // Spielen
    // =============================
    const hintLabel = hintLevel === 0 ? tr("💡 Hint") : tr("👆 Show piece");

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.iconButton}>
                    <Text style={styles.backText}>‹</Text>
                </Pressable>
                <Text style={styles.title}>{title || content.title}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Fortschrittspunkte */}
                <View style={styles.dotsRow}>
                    {exercises.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                i < results.length && styles.dotDone,
                                i === index && phase === "playing" && styles.dotActive,
                            ]}
                        />
                    ))}
                </View>

                {/* Coach */}
                <View style={styles.coachRow}>
                    <View style={styles.bubble}>
                        <Text style={styles.bubbleText}>{coachText}</Text>
                        <View style={styles.bubbleTail} />
                    </View>
                    <Image source={coachImage} style={styles.coachImage} resizeMode="contain" />
                </View>

                {exercise.fromOwnGame && (
                    <View style={styles.ownTag}>
                        <Text style={styles.ownTagText}>{tr("♟ FROM YOUR GAME")}</Text>
                    </View>
                )}

                {/* Brett */}
                <Animated.View style={[styles.boardWrap, { transform: [{ translateX: shake }] }]}>
                    {game && (
                        <PuzzleBoard
                            board={game.board()}
                            selectedSquare={selected}
                            legalSquares={legalMoves}
                            onSquarePress={onSquarePress}
                            playerColor={playerColor}
                        />
                    )}
                </Animated.View>

                {phase === "playing" ? (
                    <View style={styles.actionRow}>
                        <Pressable style={styles.chipButton} onPress={showHint}>
                            <Text style={styles.chipButtonText}>{hintLabel}</Text>
                        </Pressable>
                        <Pressable style={styles.chipButton} onPress={resetPosition}>
                            <Text style={styles.chipButtonText}>{tr("🔁 Restart")}</Text>
                        </Pressable>
                    </View>
                ) : (
                    <Animated.View
                        style={[
                            styles.solvedCard,
                            {
                                opacity: pop,
                                transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                            },
                        ]}
                    >
                        <Stars count={solvedStars} size={34} />
                        <Text style={styles.whyLabel}>{tr("Why?")}</Text>
                        <Text style={styles.whyText}>{exercise.why}</Text>
                        <Pressable style={styles.solveButton} onPress={next}>
                            <Text style={styles.solveButtonText}>
                                {index + 1 < exercises.length ? tr("Next exercise ›") : tr("See result 🏁")}
                            </Text>
                        </Pressable>
                    </Animated.View>
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
    emptyText: { color: "#A9AEB7", textAlign: "center", marginTop: 60, fontSize: 15 },

    dotsRow: { flexDirection: "row", justifyContent: "center", marginBottom: 16 },
    dot: {
        width: 28,
        height: 8,
        borderRadius: 4,
        marginHorizontal: 4,
        backgroundColor: "rgba(255,255,255,0.14)",
    },
    dotDone: { backgroundColor: ACCENT },
    ownTag: {
        alignSelf: "flex-start",
        backgroundColor: "rgba(245,185,66,0.14)",
        borderColor: "rgba(245,185,66,0.45)",
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: 10,
    },
    ownTagText: { color: GOLD, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
    dotActive: { backgroundColor: "rgba(124,148,115,0.45)", borderWidth: 1, borderColor: ACCENT },

    coachRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "flex-end",
        marginBottom: 20,
    },
    coachImage: {
        width: 64,
        height: 64,
        borderRadius: 32,
        marginLeft: 10,
        borderWidth: 2,
        borderColor: ACCENT,
    },
    coachBig: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: ACCENT,
        marginBottom: 18,
    },
    bubble: {
        flex: 1,
        backgroundColor: "rgba(124,148,115,0.18)",
        borderColor: ACCENT,
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginRight: 8,
    },
    bubbleText: { color: "#ECEDEE", fontSize: 14, lineHeight: 20 },
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
        borderLeftColor: ACCENT,
    },

    boardWrap: { alignItems: "center" },

    actionRow: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
    chipButton: {
        backgroundColor: "rgba(124,148,115,0.15)",
        borderWidth: 1,
        borderColor: ACCENT,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginHorizontal: 6,
    },
    chipButtonText: { color: ACCENT, fontWeight: "700", fontSize: 13 },

    solvedCard: {
        marginTop: 18,
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: "rgba(245,185,66,0.4)",
    },
    whyLabel: {
        marginTop: 10,
        fontSize: 12,
        fontWeight: "700",
        color: "rgba(255,255,255,0.55)",
        textTransform: "uppercase",
        letterSpacing: 0.6,
    },
    whyText: { marginTop: 6, fontSize: 15, color: "#ECEDEE", lineHeight: 22, textAlign: "center" },

    solveButton: {
        marginTop: 18,
        alignSelf: "stretch",
        backgroundColor: ACCENT,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
    },
    solveButtonText: { color: "#0F1115", fontWeight: "800", fontSize: 16 },
    secondaryButton: {
        marginTop: 10,
        alignSelf: "stretch",
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
    },
    secondaryButtonText: { color: "#ECEDEE", fontWeight: "700", fontSize: 15 },

    resultBig: { marginTop: 10, fontSize: 26, fontWeight: "800", color: "#fff" },
    resultMsg: { marginTop: 14, fontSize: 15, color: "#ECEDEE", textAlign: "center", lineHeight: 22 },
    resultList: {
        alignSelf: "stretch",
        marginTop: 22,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: 14,
    },
    resultRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 6,
    },
    resultLabel: { color: "#A9AEB7", fontSize: 14 },
});