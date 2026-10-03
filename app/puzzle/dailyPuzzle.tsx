import { Chess } from "chess.js";
// npx expo install expo-haptics @react-native-async-storage/async-storage
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ImageBackground from "../../components/ui/ImageBackground";
import { getDailyPuzzle } from "../../lib/dailyPuzzle";
import { activeStreak, awardDailyPuzzle, getRewards, levelFromXp, solvedToday, type AwardResult } from "../../lib/puzzleRewards";
import PuzzleBoard, { findCheckedKing } from "../../components/PuzzleBoard";
import PuzzleSolvedModal from "../../components/PuzzleSolvedModal";
import { tr } from "../../lib/i18n";
import { reportTaskEvent } from "../../lib/dailyTasks";
import { usePositionSound } from "../../lib/sounds";

// Bitte an deine Routen anpassen:
const HOME_ROUTE = "/";
const PUZZLES_ROUTE = "/learn/puzzles";

type Puzzle = {
    id: string;
    fen: string;
    moves: string[];
    rating?: number;
};

type Result = {
    stars: number;
    mistakes: number;
    hints: number;
    award: AwardResult | null;
};

const ENEMY_DELAY = 500;

const haptic = (kind: "success" | "error" | "light") => {
    try {
        if (kind === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        else if (kind === "error") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    } catch { /* Haptik ist optional */ }
};

export default function DailyPuzzle() {
    const router = useRouter();
    const [puzzle] = useState<Puzzle>(() => getDailyPuzzle());
    const solutionMoves = puzzle.moves;

    // Farbe des Spielers steht fest (wer im Startdiagramm am Zug ist)
    const playerColor = useMemo(() => new Chess(puzzle.fen).turn() as "w" | "b", [puzzle.fen]);
    // Gesamtzahl der Spielerzüge (Gegnerzüge zählen nicht mit)
    const playerTotal = Math.ceil(solutionMoves.length / 2);

    const [game, setGame] = useState(() => new Chess(puzzle.fen));
    usePositionSound(game);
    const [selected, setSelected] = useState<string | null>(null);
    const [legalMoves, setLegalMoves] = useState<string[]>([]);
    const [moveIndex, setMoveIndex] = useState(0); // Index des nächsten erwarteten Spielerzugs
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [hintStep, setHintStep] = useState<0 | 1 | 2>(0);
    const [busy, setBusy] = useState(false); // Gegner zieht gerade
    const [solved, setSolved] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [streak, setStreak] = useState(0);
    const [showAlready, setShowAlready] = useState(false);

    const mistakes = useRef(0);
    const hints = useRef(0);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

    const backgroundImage = require("../../assets/images/background.jpg");

    useEffect(() => {
        getRewards().then((r) => {
            setStreak(activeStreak(r));
            if (solvedToday(r)) setShowAlready(true);
        });
        return () => timers.current.forEach(clearTimeout);
    }, []);

    const later = (fn: () => void, ms: number) => {
        timers.current.push(setTimeout(fn, ms));
    };

    const colorName = playerColor === "w" ? tr("White") : tr("Black");
    const playerDone = solved ? playerTotal : Math.min(Math.floor(moveIndex / 2), playerTotal);
    const checkSquare = findCheckedKing(game);

    function clearSelection() {
        setSelected(null);
        setLegalMoves([]);
    }

    async function finish() {
        setSolved(true);
        setHintStep(0);
        setFeedback(tr("🎉 Puzzle solved!"));
        haptic("success");

        const penalty = mistakes.current + hints.current;
        const stars = penalty === 0 ? 3 : penalty <= 2 ? 2 : 1;

        let award: AwardResult | null = null;
        try {
            award = await awardDailyPuzzle(stars, puzzle.rating ?? 1000);
            setStreak(activeStreak(award.rewards));
        } catch { /* Belohnung ist optional */ }

        // Daily tasks: counts once a day, like the reward above.
        if (award && !award.alreadySolvedToday) {
            reportTaskEvent("daily_puzzle");
            reportTaskEvent("puzzle_solved");
        }

        setResult({ stars, mistakes: mistakes.current, hints: hints.current, award });
        later(() => setShowModal(true), 500);
    }

    function onSquarePress(square: string) {
        // Nach dem Lösen oder während der Gegner zieht ist das Brett gesperrt
        if (solved || busy) return;

        const piece = game.get(square as any);

        // Eigene Figur auswählen
        if (piece && piece.color === playerColor) {
            setSelected(square);
            setLegalMoves(game.moves({ square: square as any, verbose: true }).map((m) => m.to));
            setFeedback(null);
            return;
        }

        if (!selected) return;

        const isLegal = game.moves({ square: selected as any, verbose: true }).some((m) => m.to === square);
        if (!isLegal) return;

        const expected = solutionMoves[moveIndex];
        if (!expected) return;

        const from = expected.slice(0, 2);
        const to = expected.slice(2, 4);
        const promotion = expected[4] ?? "q";

        // Falscher Zug
        if (selected !== from || square !== to) {
            mistakes.current += 1;
            setFeedback(tr("❌ Wrong move – try again."));
            haptic("error");
            clearSelection();
            return;
        }

        // Richtiger Spielerzug
        const afterPlayer = new Chess(game.fen());
        afterPlayer.move({ from, to, promotion });
        setGame(afterPlayer);
        setLastMove({ from, to });
        clearSelection();
        setHintStep(0);
        haptic("light");

        const next = moveIndex + 1;

        // War das der letzte Zug der Lösung? Dann ist das Puzzle geschafft.
        if (next >= solutionMoves.length) {
            setMoveIndex(next);
            finish();
            return;
        }

        // Sonst antwortet der Gegner automatisch (kurz verzögert, damit man den eigenen Zug sieht)
        setBusy(true);
        setFeedback(tr("✅ Correct – keep going!"));
        later(() => {
            const enemy = solutionMoves[next];
            const afterEnemy = new Chess(afterPlayer.fen());
            afterEnemy.move({ from: enemy.slice(0, 2), to: enemy.slice(2, 4), promotion: enemy[4] ?? "q" });
            setGame(afterEnemy);
            setLastMove({ from: enemy.slice(0, 2), to: enemy.slice(2, 4) });
            setMoveIndex(next + 1);
            setBusy(false);

            if (next + 1 >= solutionMoves.length) finish();
        }, ENEMY_DELAY);
    }

    function onHint() {
        if (solved || busy) return;
        const move = solutionMoves[moveIndex];
        if (!move) return;

        // Tipp 1: Halo um die Figur, Tipp 2: zusätzlich Halo um das Zielfeld
        const step = hintStep === 0 ? 1 : 2;
        if (step > hintStep) {
            hints.current += 1;
            setHintStep(step);
        }
        setFeedback(step === 1 ? tr("💡 This is the piece to move.") : tr("💡 And this is where it goes."));
    }

    // Stellung zurücksetzen (Fehlversuche und Tipps bleiben in der Wertung)
    function onRestart() {
        if (solved || busy) return;
        setGame(new Chess(puzzle.fen));
        setMoveIndex(0);
        setLastMove(null);
        setHintStep(0);
        setFeedback(null);
        clearSelection();
    }

    // Felder für den Tipp-Halo: erst die Figur, beim zweiten Tipp auch das Ziel
    const hintMove = hintStep > 0 && !solved && !busy ? solutionMoves[moveIndex] : undefined;
    const hintSquares = hintMove
        ? hintStep === 1
            ? [hintMove.slice(0, 2)]
            : [hintMove.slice(0, 2), hintMove.slice(2, 4)]
        : [];

    // Erst Pop-ups schließen, dann navigieren. Direkt aus einem offenen Modal
    // heraus zu navigieren wird (vor allem auf iOS) oft verschluckt.
    function goTo(route: string) {
        setShowModal(false);
        setShowAlready(false);
        later(() => router.replace(route as any), 350);
    }

    const level = result?.award ? levelFromXp(result.award.rewards.xp).level : 1;

    let turnLabel = `${colorName} to move`;
    if (solved) turnLabel = "Solved";
    else if (busy) turnLabel = "Opponent is moving …";

    return (
        <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Text style={styles.backText}>‹</Text>
                    </Pressable>

                    <Text style={styles.headerTitle}>{tr("Daily Puzzle")}</Text>

                    <View style={styles.streakSlot}>
                        {streak > 0 && <Text style={styles.streakChip}>🔥 {streak}</Text>}
                    </View>
                </View>

                <Text style={styles.subtitle}>{tr("Rating:")} {puzzle.rating}</Text>

                <View style={styles.turnPill}>
                    <View
                        style={[
                            styles.turnDot,
                            { backgroundColor: playerColor === "w" ? "#ECEDEE" : "#20242B", borderColor: playerColor === "w" ? "#868C94" : "#868C94" },
                        ]}
                    />
                    <Text style={styles.turnText}>{turnLabel}</Text>
                </View>

                <View style={styles.boardSpacer} />

                <PuzzleBoard
                    board={game.board()}
                    selectedSquare={selected}
                    legalSquares={legalMoves}
                    onSquarePress={onSquarePress}
                    playerColor={playerColor}
                    lastMove={lastMove}
                    checkSquare={checkSquare}
                    hintSquares={hintSquares}
                />

                <Text style={styles.progress}>
                    {solved ? tr("All {0} moves found", playerTotal) : tr("Move {0} of {1}", Math.min(playerDone + 1, playerTotal), playerTotal)}
                </Text>

                {feedback && <Text style={styles.feedback}>{feedback}</Text>}

                <View style={styles.controls}>
                    <Pressable onPress={onRestart} style={[styles.iconBtn, (solved || busy) && styles.iconBtnOff]}>
                        <Text style={styles.icon}>↺</Text>
                    </Pressable>

                    <Pressable onPress={onHint} style={[styles.iconBtn, (solved || busy) && styles.iconBtnOff]}>
                        <Text style={styles.icon}>💡</Text>
                    </Pressable>

                    {solved && (
                        <Pressable onPress={() => setShowModal(true)} style={styles.iconBtn}>
                            <Text style={styles.icon}>🏆</Text>
                        </Pressable>
                    )}
                </View>
            </ScrollView>

            {result && (
                <PuzzleSolvedModal
                    visible={showModal}
                    stars={result.stars}
                    mistakes={result.mistakes}
                    hints={result.hints}
                    xpGain={result.award?.xpGain ?? 0}
                    xpTotal={result.award?.rewards.xp ?? 0}
                    level={level}
                    streak={result.award ? activeStreak(result.award.rewards) : 0}
                    alreadySolvedToday={result.award?.alreadySolvedToday ?? true}
                    leveledUp={result.award?.leveledUp ?? false}
                    onClose={() => setShowModal(false)}
                    onHome={() => goTo(HOME_ROUTE)}
                    onMore={() => goTo(PUZZLES_ROUTE)}
                />
            )}

            <AlreadySolvedModal
                visible={showAlready}
                streak={streak}
                onClose={() => setShowAlready(false)}
                onMore={() => goTo(PUZZLES_ROUTE)}
            />
        </ImageBackground>
    );
}

// Pop-up beim erneuten Öffnen, wenn das heutige Puzzle schon gelöst wurde
function AlreadySolvedModal({
    visible,
    streak,
    onClose,
    onMore,
}: {
    visible: boolean;
    streak: number;
    onClose: () => void;
    onMore: () => void;
}) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={styles.popBackdrop} onPress={onClose}>
                {/* Tipp auf die Karte selbst schließt nicht */}
                <Pressable onPress={() => { }} style={styles.popCard}>
                    <Text style={styles.popEmoji}>✅</Text>
                    <Text style={styles.popTitle}>{tr("Already solved!")}</Text>
                    <Text style={styles.popText}>
                        {tr("You have already solved today's puzzle. A new one is waiting for you tomorrow.")}
                    </Text>
                    {streak > 0 && (
                        <View style={styles.popStreak}>
                            <Text style={styles.popStreakText}>🔥 {streak} {streak === 1 ? "day" : "days"} {tr("in a row")}</Text>
                        </View>
                    )}
                    <Pressable onPress={onMore} style={({ pressed }) => [styles.popPrimary, pressed && { opacity: 0.85 }]}>
                        <Text style={styles.popPrimaryText}>{tr("More puzzles")}</Text>
                    </Pressable>
                    <Pressable onPress={onClose} style={({ pressed }) => [styles.popSecondary, pressed && { opacity: 0.7 }]}>
                        <Text style={styles.popSecondaryText}>{tr("Practice again")}</Text>
                    </Pressable>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { padding: 16 },
    subtitle: { fontSize: 14, color: "#fff", marginBottom: 10 },
    progress: { marginTop: 10, textAlign: "center", color: "#fff" },
    feedback: { marginTop: 8, textAlign: "center", color: "#fff", fontWeight: "600" },
    controls: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 12,
        gap: 24,
    },
    iconBtn: {
        padding: 10,
        borderRadius: 8,
        backgroundColor: "transparent",
    },
    iconBtnOff: { opacity: 0.35 },
    icon: { fontSize: 22, color: "#fff" },

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
        backgroundColor: "#201B16",
        borderWidth: 1,
        borderColor: "rgba(245,237,226,0.09)",
        justifyContent: "center",
        alignItems: "center",
    },
    backText: { color: "#F8F4EE", fontSize: 34, lineHeight: 34, fontWeight: "300" },
    headerTitle: { color: "#F5EFE6", fontSize: 16, fontWeight: "600" },
    streakSlot: { width: 42, alignItems: "flex-end", justifyContent: "center" },
    streakChip: { color: "#E0914D", fontSize: 14, fontWeight: "800" },

    turnPill: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: "rgba(23,26,32,0.85)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    turnDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
    turnText: { color: "#ECEDEE", fontSize: 13.5, fontWeight: "700" },

    // Abstand zwischen Info-Zeile und Brett – wie vorher (dein Hintergrundbild), bei Bedarf anpassen
    boardSpacer: { height: 70 },

    popBackdrop: { flex: 1, backgroundColor: "rgba(6,8,11,0.78)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
    popCard: {
        width: "100%",
        maxWidth: 340,
        backgroundColor: "#171A20",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        paddingVertical: 26,
        paddingHorizontal: 22,
        alignItems: "center",
    },
    popEmoji: { fontSize: 38 },
    popTitle: { color: "#ECEDEE", fontSize: 21, fontWeight: "800", marginTop: 10 },
    popText: { color: "#868C94", fontSize: 14, textAlign: "center", lineHeight: 20, marginTop: 8 },
    popStreak: { marginTop: 14, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(224,145,77,0.15)", borderWidth: 1, borderColor: "rgba(224,145,77,0.4)" },
    popStreakText: { color: "#E0914D", fontSize: 13, fontWeight: "700" },
    popPrimary: { width: "100%", marginTop: 20, backgroundColor: "#7C9473", paddingVertical: 13, borderRadius: 14, alignItems: "center" },
    popPrimaryText: { color: "#12151B", fontSize: 15, fontWeight: "800" },
    popSecondary: { width: "100%", marginTop: 10, paddingVertical: 12, borderRadius: 14, alignItems: "center", backgroundColor: "#1D2129", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
    popSecondaryText: { color: "#ECEDEE", fontSize: 14.5, fontWeight: "600" },
});