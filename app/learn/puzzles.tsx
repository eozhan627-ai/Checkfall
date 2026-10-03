import { Chess } from "chess.js";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import ImageBackground from "../../components/ui/ImageBackground";

import puzzles from "../../assets/puzzle.json";
import { getSolvedPuzzleIds, markPuzzleSolved } from "../../lib/puzzleStats";
import PuzzleBoard, { findCheckedKing } from "../../components/PuzzleBoard";
import LimitGate from "../../components/LimitGate";
import { Allowance, consume, getAllowance, grantAdBonus } from "../../lib/dailyLimits";
import { tr } from "../../lib/i18n";
import { reportTaskEvent } from "../../lib/dailyTasks";
import { usePositionSound } from "../../lib/sounds";

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
};

const SETUP_DELAY = 700; // Pause, bevor der Gegner den ersten Zug spielt
const ENEMY_DELAY = 500; // Pause vor jeder Gegnerantwort

const REWARD: Record<number, { title: string; sub: string }> = {
    3: { get title() { return tr("Perfect!"); }, get sub() { return tr("No mistakes and no hint. "); } },
    2: { get title() { return tr("Nicely solved!"); }, get sub() { return tr("Just a small detour."); } },
    1: { get title() { return tr("Done!"); }, get sub() { return tr("You learn from mistakes – the pattern will stick."); } },
};

const haptic = (kind: "success" | "error" | "light") => {
    try {
        if (kind === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        else if (kind === "error") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    } catch { /* Haptik ist optional */ }
};

// Spielt einen Zug im UCI-Format (z.B. "e2e4" oder "g7g8q") auf einer Kopie der Stellung.
// Gibt null zurück, statt abzustürzen, falls ein Zug nicht passt.
function applyUci(from: Chess, uci: string): Chess | null {
    try {
        const next = new Chess(from.fen());
        next.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? "q" });
        return next;
    } catch {
        return null;
    }
}

// =====================================================================
// Ein einzelnes Puzzle
// =====================================================================

type RunnerProps = {
    puzzle: Puzzle;
    combo: number;
    solvedCount: number;
    total: number;
    onSolved: (perfect: boolean) => void;
    onNext: () => void;
    /** Free puzzles left today; null = unlimited. */
    freeLeft: number | null;
};

function PuzzleRunner({ puzzle, combo, solvedCount, total, onSolved, onNext, freeLeft }: RunnerProps) {
    // Lichess-Format: moves[0] ist der Zug des Gegners, danach beginnt das eigentliche Puzzle.
    // Im FEN ist also der GEGNER am Zug, der Spieler ist die andere Farbe.
    const setupMove = puzzle.moves[0];
    const solution = useMemo(() => puzzle.moves.slice(1), [puzzle.moves]);
    const playerColor = useMemo(
        () => (new Chess(puzzle.fen).turn() === "w" ? "b" : "w") as "w" | "b",
        [puzzle.fen]
    );
    const playerTotal = Math.ceil(solution.length / 2);

    const setupSquares = useMemo(
        () => ({ from: setupMove.slice(0, 2), to: setupMove.slice(2, 4) }),
        [setupMove]
    );
    // Stellung nach dem Gegnerzug = echte Ausgangsstellung des Puzzles
    const startGame = useMemo(
        () => applyUci(new Chess(puzzle.fen), setupMove) ?? new Chess(puzzle.fen),
        [puzzle.fen, setupMove]
    );

    const [game, setGame] = useState(() => new Chess(puzzle.fen));
    usePositionSound(game);
    const [selected, setSelected] = useState<string | null>(null);
    const [legalMoves, setLegalMoves] = useState<string[]>([]);
    const [moveIndex, setMoveIndex] = useState(0); // Index des nächsten erwarteten Spielerzugs in `solution`
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [hintStep, setHintStep] = useState<0 | 1 | 2>(0);
    const [hintVisible, setHintVisible] = useState(false);
    const [busy, setBusy] = useState(true); // am Anfang zieht erst der Gegner
    const [solved, setSolved] = useState(false);
    const [result, setResult] = useState<Result | null>(null);

    const mistakes = useRef(0);
    const hints = useRef(0);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const scrollRef = useRef<ScrollView>(null);

    const cardAnim = useRef(new Animated.Value(0)).current;
    const starAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

    function later(fn: () => void, ms: number) {
        timers.current.push(setTimeout(fn, ms));
    }

    // Gegner spielt den ersten Zug, dann ist der Spieler dran
    useEffect(() => {
        later(() => {
            setGame(startGame);
            setLastMove(setupSquares);
            setBusy(false);
        }, SETUP_DELAY);
        return () => {
            timers.current.forEach(clearTimeout);
            timers.current = [];
        };
    }, []);

    // Belohnungs-Animation, sobald das Ergebnis da ist
    useEffect(() => {
        if (!result) return;
        cardAnim.setValue(0);
        starAnims.forEach((a) => a.setValue(0));
        Animated.parallel([
            Animated.spring(cardAnim, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
            Animated.stagger(
                180,
                starAnims.map((a, i) =>
                    i < result.stars
                        ? Animated.spring(a, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true })
                        : Animated.timing(a, { toValue: 1, duration: 0, useNativeDriver: true })
                )
            ),
        ]).start();
        const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
        return () => clearTimeout(t);
    }, [result]);

    const colorName = playerColor === "w" ? tr("White") : tr("Black");
    const playerDone = solved ? playerTotal : Math.min(Math.floor(moveIndex / 2), playerTotal);
    const checkSquare = findCheckedKing(game);

    function clearSelection() {
        setSelected(null);
        setLegalMoves([]);
    }

    function finish() {
        setSolved(true);
        setHintVisible(false);
        setHintStep(0);
        setFeedback(tr("🎉 Solved!"));
        haptic("success");

        const penalty = mistakes.current + hints.current;
        const stars = penalty === 0 ? 3 : penalty <= 2 ? 2 : 1;

        onSolved(penalty === 0);
        // Kurz warten, damit man den letzten Zug noch sieht
        later(() => setResult({ stars, mistakes: mistakes.current, hints: hints.current }), 400);
    }

    function onSquarePress(square: string) {
        // Nach dem Lösen oder während der Gegner zieht ist das Brett gesperrt
        if (solved || busy) return;

        // Sobald man das Brett berührt, verschwindet der Tipp-Halo
        setHintVisible(false);

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

        const expected = solution[moveIndex];
        if (!expected) return;

        const from = expected.slice(0, 2);
        const to = expected.slice(2, 4);

        // Falscher Zug
        if (selected !== from || square !== to) {
            mistakes.current += 1;
            setFeedback(tr("❌ Wrong move – try again."));
            haptic("error");
            clearSelection();
            return;
        }

        // Richtiger Spielerzug
        const afterPlayer = applyUci(game, expected);
        if (!afterPlayer) return;

        setGame(afterPlayer);
        setLastMove({ from, to });
        clearSelection();
        setHintStep(0);
        haptic("light");

        const next = moveIndex + 1;

        // Letzter Zug der Lösung -> Puzzle geschafft
        if (next >= solution.length) {
            setMoveIndex(next);
            finish();
            return;
        }

        // Sonst antwortet der Gegner automatisch
        setBusy(true);
        setFeedback(tr("✅ Correct – keep going!"));
        later(() => {
            const enemy = solution[next];
            const afterEnemy = applyUci(afterPlayer, enemy);
            if (afterEnemy) {
                setGame(afterEnemy);
                setLastMove({ from: enemy.slice(0, 2), to: enemy.slice(2, 4) });
            }
            setMoveIndex(next + 1);
            setBusy(false);

            if (next + 1 >= solution.length) finish();
        }, ENEMY_DELAY);
    }

    // Tipp 1: Halo um die Figur, Tipp 2: zusätzlich um das Zielfeld.
    // Wurde der Halo nur weggetippt, zeigt der Button denselben Tipp nochmal, ohne ihn erneut zu zählen.
    function onHint() {
        if (solved || busy) return;
        const move = solution[moveIndex];
        if (!move) return;

        // Halo sichtbar -> nächste Stufe (Ziel dazu). Halo weggetippt -> gleiche Stufe nochmal zeigen.
        const target: 1 | 2 = hintVisible ? 2 : hintStep === 2 ? 2 : 1;

        if (target > hintStep) {
            hints.current += 1;
            setHintStep(target);
        }
        setHintVisible(true);
        setFeedback(target === 1 ? tr("💡 This is the piece to move.") : tr("💡 And this is where it goes."));
    }

    // Stellung zurücksetzen (Fehlversuche und Tipps bleiben in der Wertung)
    function onRestart() {
        if (solved || busy) return;
        setGame(startGame);
        setMoveIndex(0);
        setLastMove(setupSquares);
        setHintStep(0);
        setHintVisible(false);
        setFeedback(null);
        clearSelection();
    }

    const hintMove = hintVisible && hintStep > 0 && !solved && !busy ? solution[moveIndex] : undefined;
    const hintSquares = hintMove
        ? hintStep === 1
            ? [hintMove.slice(0, 2)]
            : [hintMove.slice(0, 2), hintMove.slice(2, 4)]
        : [];

    let turnLabel = `${colorName} to move`;
    if (solved) turnLabel = "Solved";
    else if (busy) turnLabel = "Opponent is moving …";

    const pct = total > 0 ? Math.round((solvedCount / total) * 100) : 0;

    return (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
            <View style={styles.header}>
                <View style={styles.headerSide} />
                <Text style={styles.headerTitle}>{tr("Puzzles")}</Text>
                <View style={styles.headerSide}>
                    {combo >= 2 && <Text style={styles.streakChip}>🔥 {combo}</Text>}
                </View>
            </View>

            <Text style={styles.subtitle}>
                {tr("Rating:")} {puzzle.rating} · {solvedCount} {tr("of")} {total} {tr("solved")}
            </Text>

            {freeLeft !== null && !solved && (
                <Text style={styles.freeLeft}>
                    {freeLeft === 1 ? tr("Last free puzzle for today") : tr("{0} free puzzles left today", freeLeft)}
                </Text>
            )}

            <View style={styles.turnPill}>
                <View
                    style={[
                        styles.turnDot,
                        { backgroundColor: playerColor === "w" ? "#ECEDEE" : "#20242B", borderColor: "#868C94" },
                    ]}
                />
                <Text style={styles.turnText}>{turnLabel}</Text>
            </View>

            {/* Abstand zwischen Info-Zeile und Brett – bei Bedarf an dein Hintergrundbild anpassen */}
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

            {feedback && !result && <Text style={styles.feedback}>{feedback}</Text>}

            {!solved && (
                <View style={styles.controls}>
                    <Pressable onPress={onRestart} style={[styles.iconBtn, busy && styles.iconBtnOff]}>
                        <Text style={styles.icon}>↺</Text>
                    </Pressable>

                    <Pressable onPress={onHint} style={[styles.iconBtn, busy && styles.iconBtnOff]}>
                        <Text style={styles.icon}>💡</Text>
                    </Pressable>
                </View>
            )}

            {/* Belohnung: erscheint erst nach dem Lösen, "Weiter" gibt es nur hier */}
            {solved && result && (
                <Animated.View
                    style={[
                        styles.rewardCard,
                        {
                            opacity: cardAnim,
                            transform: [
                                { translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
                                { scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                            ],
                        },
                    ]}
                >
                    <View style={styles.starRow}>
                        {starAnims.map((a, i) => (
                            <Animated.Text
                                key={i}
                                style={[styles.star, i >= result.stars && styles.starOff, { transform: [{ scale: a }] }]}
                            >
                                ⭐
                            </Animated.Text>
                        ))}
                    </View>

                    <Text style={styles.rewardTitle}>{REWARD[result.stars].title}</Text>
                    <Text style={styles.rewardSub}>{REWARD[result.stars].sub}</Text>
                    <Text style={styles.rewardStats}>
                        {tr("Mistakes: {0} · Hints: {1}", result.mistakes, result.hints)}
                    </Text>

                    {result.mistakes + result.hints === 0 && combo >= 2 && (
                        <View style={styles.comboChip}>
                            <Text style={styles.comboChipText}>🔥 {combo} {tr("in a row without mistakes")}</Text>
                        </View>
                    )}

                    <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%` as `${number}%` }]} />
                    </View>
                    <Text style={styles.barLabel}>
                        {solvedCount} {tr("of")} {total} {tr("puzzles solved")}
                    </Text>

                    <Pressable onPress={onNext} style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.85 }]}>
                        <Text style={styles.nextBtnText}>{tr("Next puzzle ›")}</Text>
                    </Pressable>
                </Animated.View>
            )}
        </ScrollView>
    );
}

// =====================================================================
// Screen: wählt das Puzzle mit dem niedrigsten Rating, das noch nicht gelöst ist
// =====================================================================

export default function PuzzlesScreen() {
    const sortedPuzzles = useMemo(
        () => [...(puzzles as Puzzle[])].sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0)),
        []
    );

    const [solvedIds, setSolvedIds] = useState<string[] | null>(null); // null = lädt noch
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [combo, setCombo] = useState(0); // Puzzles ohne Fehler in Folge (nur in dieser Sitzung)

    // Daily limit without VIP (4 puzzles; an ad adds 4 more).
    const [allowance, setAllowance] = useState<Allowance | null>(null);
    const [gateOpen, setGateOpen] = useState(false);
    // True while the limit blocks the next puzzle.
    const [locked, setLocked] = useState(false);

    useEffect(() => {
        let alive = true;
        getAllowance("puzzle").then((a) => {
            if (!alive) return;
            setAllowance(a);
            if (!a.unlimited && a.left <= 0) {
                setLocked(true);
                setGateOpen(true);
            }
        });
        return () => {
            alive = false;
        };
    }, []);

    // Beim Start: gespeicherten Stand laden und mit dem ersten ungelösten Puzzle beginnen
    useEffect(() => {
        let alive = true;
        getSolvedPuzzleIds().then((ids) => {
            if (!alive) return;
            setSolvedIds(ids);
            setCurrentId(sortedPuzzles.find((p) => !ids.includes(p.id))?.id ?? null);
        });
        return () => {
            alive = false;
        };
    }, [sortedPuzzles]);

    const puzzle = useMemo(
        () => sortedPuzzles.find((p) => p.id === currentId) ?? null,
        [sortedPuzzles, currentId]
    );

    const solvedCount = useMemo(
        () => (solvedIds ? sortedPuzzles.filter((p) => solvedIds.includes(p.id)).length : 0),
        [solvedIds, sortedPuzzles]
    );

    function handleSolved(perfect: boolean) {
        if (!puzzle) return;
        const id = puzzle.id;
        setCombo((c) => (perfect ? c + 1 : 0));
        setSolvedIds((prev) => (prev && !prev.includes(id) ? [...prev, id] : prev));
        markPuzzleSolved(id).catch(() => { });
        reportTaskEvent("puzzle_solved");
        consume("puzzle").then(setAllowance).catch(() => { });
    }

    function showNext() {
        const next = sortedPuzzles.find((p) => !(solvedIds ?? []).includes(p.id));
        setCurrentId(next?.id ?? null);
    }

    function goNext() {
        if (allowance && !allowance.unlimited && allowance.left <= 0) {
            setLocked(true);
            setGateOpen(true);
            return;
        }
        showNext();
    }

    // An ad was watched: more puzzles for today.
    async function handleRewarded() {
        setAllowance(await grantAdBonus("puzzle"));
        setLocked(false);
        showNext();
    }

    let content;
    if (solvedIds === null) {
        content = (
            <View style={styles.center}>
                <Text style={styles.centerText}>{tr("Loading puzzles …")}</Text>
            </View>
        );
    } else if (locked && puzzle) {
        content = (
            <View style={styles.center}>
                <Text style={styles.centerEmoji}>⏳</Text>
                <Text style={styles.centerTitle}>{tr("That's it for today")}</Text>
                <Text style={styles.centerText}>
                    {tr("Four puzzles a day are free. The Daily Puzzle is always free.")}
                </Text>
                <Pressable onPress={() => setGateOpen(true)} style={({ pressed }) => [styles.nextBtn, { maxWidth: 300 }, pressed && { opacity: 0.85 }]}>
                    <Text style={styles.nextBtnText}>{tr("Unlock more puzzles")}</Text>
                </Pressable>
            </View>
        );
    } else if (!puzzle) {
        content = (
            <View style={styles.center}>
                <Text style={styles.centerEmoji}>🏆</Text>
                <Text style={styles.centerTitle}>{tr("All puzzles completed!")}</Text>
                <Text style={styles.centerText}>{tr("You solved all")} {sortedPuzzles.length} {tr("puzzles.")}</Text>
            </View>
        );
    } else {
        content = (
            <PuzzleRunner
                key={puzzle.id}
                puzzle={puzzle}
                combo={combo}
                solvedCount={solvedCount}
                total={sortedPuzzles.length}
                onSolved={handleSolved}
                onNext={goNext}
                freeLeft={allowance && !allowance.unlimited ? allowance.left : null}
            />
        );
    }

    return (
        <ImageBackground
            source={require("../../assets/images/background.jpg")}
            style={styles.container}
            resizeMode="cover"
        >
            {content}

            <LimitGate
                visible={gateOpen}
                kind="puzzle"
                onClose={() => setGateOpen(false)}
                onRewarded={handleRewarded}
            />
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { padding: 16, paddingBottom: 40 },

    header: {
        width: "100%",
        height: 70,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    headerSide: { width: 42, alignItems: "flex-end", justifyContent: "center" },
    headerTitle: { color: "#F5EFE6", fontSize: 16, fontWeight: "600" },
    streakChip: { color: "#E0914D", fontSize: 14, fontWeight: "800" },

    subtitle: { fontSize: 14, color: "#fff", marginBottom: 10 },

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

    boardSpacer: { height: 16 },

    progress: { marginTop: 10, textAlign: "center", color: "#fff" },
    feedback: { marginTop: 8, textAlign: "center", color: "#fff", fontWeight: "600" },

    controls: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 12,
        gap: 24,
    },
    iconBtn: { padding: 10, borderRadius: 8, backgroundColor: "transparent" },
    iconBtnOff: { opacity: 0.35 },
    icon: { fontSize: 22, color: "#fff" },

    rewardCard: {
        marginTop: 16,
        backgroundColor: "#171A20",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        paddingVertical: 22,
        paddingHorizontal: 20,
        alignItems: "center",
    },
    starRow: { flexDirection: "row", gap: 10 },
    star: { fontSize: 34 },
    starOff: { opacity: 0.25 },
    rewardTitle: { color: "#ECEDEE", fontSize: 21, fontWeight: "800", marginTop: 10 },
    rewardSub: { color: "#868C94", fontSize: 14, textAlign: "center", lineHeight: 20, marginTop: 6 },
    rewardStats: { color: "#868C94", fontSize: 13, marginTop: 8 },
    comboChip: {
        marginTop: 12,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: "rgba(224,145,77,0.15)",
        borderWidth: 1,
        borderColor: "rgba(224,145,77,0.4)",
    },
    comboChipText: { color: "#E0914D", fontSize: 13, fontWeight: "700" },

    barTrack: {
        width: "100%",
        height: 8,
        borderRadius: 4,
        backgroundColor: "#1D2129",
        marginTop: 18,
        overflow: "hidden",
    },
    barFill: { height: "100%", backgroundColor: "#7C9473", borderRadius: 4 },
    barLabel: { color: "#868C94", fontSize: 12, marginTop: 6 },

    nextBtn: {
        width: "100%",
        marginTop: 18,
        backgroundColor: "#7C9473",
        paddingVertical: 13,
        borderRadius: 14,
        alignItems: "center",
    },
    nextBtnText: { color: "#12151B", fontSize: 15, fontWeight: "800" },

    freeLeft: { color: "#E8B93E", fontSize: 12.5, fontWeight: "600", marginBottom: 8 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    centerEmoji: { fontSize: 44 },
    centerTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 10 },
    centerText: { color: "#ccc", fontSize: 14, textAlign: "center", marginTop: 8 },
});