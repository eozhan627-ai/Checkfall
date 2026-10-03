import { Ionicons } from "@expo/vector-icons";
import { Chess } from "chess.js";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Segmented from "../../components/play/Segmented";
import PuzzleBoard, { findCheckedKing } from "../../components/PuzzleBoard";
import { T } from "../../components/ui/theme";
import { getCurrentAccount } from "../../lib/account";
import { tr } from "../../lib/i18n";
import { usePositionSound } from "../../lib/sounds";
import { saveOpeningResult } from "../../lib/openingProgress";
import { getOpening, OPENINGS, ownMoveCount, starsFor } from "../../lib/openings";

type Mode = "learn" | "practice";

const REPLY_DELAY_MS = 550;

function buzz(kind: "right" | "wrong") {
    if (Platform.OS === "web") return;

    if (kind === "right") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}

// Opening trainer: play the line move by move.
//   Learn     - the next move is shown, you repeat it on the board.
//   Practice  - you play the line from memory; mistakes and hints cost stars.
export default function OpeningScreen() {
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();
    const opening = getOpening(id);

    const [allowed, setAllowed] = useState<boolean | null>(null);
    const [mode, setMode] = useState<Mode>("learn");
    const [ply, setPly] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [legalSquares, setLegalSquares] = useState<string[]>([]);
    const [mistakes, setMistakes] = useState(0);
    const [hints, setHints] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const shake = useRef(new Animated.Value(0)).current;

    // The opening trainer belongs to VIP - also when the screen is opened directly.
    useEffect(() => {
        let alive = true;

        getCurrentAccount().then((account) => {
            if (!alive) return;

            const vip = !!account?.vipTier && account.vipTier !== "none";
            setAllowed(vip);
            if (!vip) router.replace("/learn/openings" as any);
        });

        return () => {
            alive = false;
        };
    }, []);

    // Every position of the line, with the move that leads to the next one.
    const line = useMemo(() => {
        if (!opening) return [];

        const game = new Chess();
        const steps = [{ fen: game.fen(), move: null as null | { from: string; to: string; san: string } }];

        for (const san of opening.moves) {
            const move = game.move(san);
            steps.push({ fen: game.fen(), move: { from: move.from, to: move.to, san: move.san } });
        }

        return steps;
    }, [opening]);

    const total = opening?.moves.length ?? 0;
    const finished = ply >= total;
    const game = useMemo(() => new Chess(line[Math.min(ply, total)]?.fen), [line, ply, total]);
    usePositionSound(game);
    const next = !finished ? line[ply + 1]?.move ?? null : null;
    const ownTurn = !!opening && !finished && game.turn() === opening.side;

    // The other side answers on its own.
    useEffect(() => {
        if (!opening || finished || ownTurn) return;

        const timer = setTimeout(() => setPly((p) => p + 1), REPLY_DELAY_MS);
        return () => clearTimeout(timer);
    }, [opening, finished, ownTurn, ply]);

    // Practice mode: remember the best result.
    useEffect(() => {
        if (opening && finished && mode === "practice") {
            saveOpeningResult(opening.id, starsFor(mistakes, hints));
        }
    }, [opening, finished, mode, mistakes, hints]);

    function restart(nextMode: Mode = mode) {
        setMode(nextMode);
        setPly(0);
        setSelected(null);
        setLegalSquares([]);
        setMistakes(0);
        setHints(0);
        setShowHint(false);
        setMessage(null);
    }

    function runShake() {
        Animated.sequence(
            [10, -10, 8, -8, 0].map((value) =>
                Animated.timing(shake, { toValue: value, duration: 50, useNativeDriver: true })
            )
        ).start();
    }

    function onSquarePress(square: string) {
        if (!ownTurn || !next) return;

        const piece = game.get(square as any);

        if (piece && piece.color === game.turn()) {
            setSelected(square);
            setLegalSquares(game.moves({ square: square as any, verbose: true }).map((m) => m.to));
            return;
        }

        if (!selected || !legalSquares.includes(square)) return;

        if (selected !== next.from || square !== next.to) {
            setMistakes((m) => m + 1);
            setSelected(null);
            setLegalSquares([]);
            setMessage(tr("That is not the move of this opening. Try again."));
            buzz("wrong");
            runShake();
            return;
        }

        buzz("right");
        setSelected(null);
        setLegalSquares([]);
        setShowHint(false);
        setMessage(null);
        setPly((p) => p + 1);
    }

    function hint() {
        if (!ownTurn || showHint) return;

        setHints((h) => h + 1);
        setShowHint(true);
    }

    if (!opening) {
        return (
            <View style={[styles.container, styles.center]}>
                <Text style={styles.empty}>{tr("This opening does not exist.")}</Text>
                <Pressable onPress={() => router.back()} style={styles.primary}>
                    <Text style={styles.primaryText}>{tr("Back")}</Text>
                </Pressable>
            </View>
        );
    }

    if (!allowed) return <View style={styles.container} />;

    const ownTotal = ownMoveCount(opening);
    const ownDone = opening.moves.slice(0, ply).filter((_, index) => (index % 2 === 0) === (opening.side === "w")).length;
    const lastMove = ply > 0 ? line[ply]?.move ?? null : null;
    const stars = starsFor(mistakes, hints);

    // In learn mode the move is always shown; in practice mode only after a hint.
    const reveal = ownTurn && !!next && (mode === "learn" || showHint);

    const instruction = finished
        ? null
        : !ownTurn
            ? tr("Your opponent is moving…")
            : reveal && next
                ? tr("Play {0}", next.san)
                : tr("Your move - what does the opening play here?");

    const index = OPENINGS.findIndex((o) => o.id === opening.id);
    const following = OPENINGS[(index + 1) % OPENINGS.length];

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: insets.top + 12,
                    paddingBottom: insets.bottom + 32,
                }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.headerRow}>
                    <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10} accessibilityLabel={tr("Back")}>
                        <Ionicons name="chevron-back" size={20} color={T.text} />
                    </Pressable>

                    <View style={{ flex: 1 }}>
                        <Text style={styles.title} numberOfLines={1}>
                            {tr(opening.name)}
                        </Text>
                        <Text style={styles.subtitle}>
                            {opening.eco} · {opening.side === "w" ? tr("You play White") : tr("You play Black")}
                        </Text>
                    </View>
                </View>

                <Segmented
                    value={mode}
                    onChange={(value) => restart(value)}
                    options={[
                        { value: "learn", label: tr("Learn"), hint: tr("Moves are shown") },
                        { value: "practice", label: tr("Practice"), hint: tr("From memory") },
                    ]}
                />

                {/* progress */}
                <View style={styles.progressRow}>
                    <View style={styles.track}>
                        <View style={[styles.fill, { width: `${total > 0 ? (Math.min(ply, total) / total) * 100 : 0}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                        {Math.min(ownDone, ownTotal)}/{ownTotal}
                    </Text>
                </View>

                <Animated.View style={[styles.boardWrap, { transform: [{ translateX: shake }] }]}>
                    <PuzzleBoard
                        board={game.board()}
                        selectedSquare={selected}
                        legalSquares={legalSquares}
                        onSquarePress={onSquarePress}
                        playerColor={opening.side}
                        lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
                        checkSquare={findCheckedKing(game)}
                        hintSquares={reveal && next ? [next.from, next.to] : []}
                    />
                </Animated.View>

                {!finished ? (
                    <>
                        <View style={styles.instruction}>
                            <Text style={styles.instructionText}>{instruction}</Text>
                            {message && <Text style={styles.message}>{message}</Text>}
                        </View>

                        <View style={styles.actions}>
                            {mode === "practice" && (
                                <Pressable
                                    onPress={hint}
                                    disabled={!ownTurn || showHint}
                                    style={({ pressed }) => [styles.chip, (!ownTurn || showHint) && styles.disabled, pressed && styles.pressed]}
                                >
                                    <Ionicons name="bulb-outline" size={15} color={T.text} />
                                    <Text style={styles.chipText}>{tr("Show the move")}</Text>
                                </Pressable>
                            )}
                            <Pressable onPress={() => restart()} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                                <Ionicons name="refresh" size={15} color={T.text} />
                                <Text style={styles.chipText}>{tr("Start again")}</Text>
                            </Pressable>
                        </View>
                    </>
                ) : (
                    <View style={styles.done}>
                        {mode === "practice" ? (
                            <>
                                <Text style={styles.doneStars}>
                                    {"★".repeat(stars)}
                                    <Text style={styles.doneStarsOff}>{"★".repeat(3 - stars)}</Text>
                                </Text>
                                <Text style={styles.doneTitle}>
                                    {stars === 3 ? tr("Perfect - you know this opening") : tr("Line completed")}
                                </Text>
                                <Text style={styles.doneText}>{tr("Mistakes: {0} · Hints: {1}", mistakes, hints)}</Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.doneTitle}>{tr("That is the main line")}</Text>
                                <Text style={styles.doneText}>{tr("Now play it from memory.")}</Text>
                            </>
                        )}

                        <Pressable
                            onPress={() => restart("practice")}
                            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
                        >
                            <Text style={styles.primaryText}>
                                {mode === "learn" ? tr("Practice from memory") : tr("Practice again")}
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={() => router.replace({ pathname: "/learn/opening", params: { id: following.id } } as any)}
                            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                        >
                            <Text style={styles.secondaryText}>
                                {tr("Next opening")}: {tr(following.name)}
                            </Text>
                        </Pressable>
                    </View>
                )}

                {/* moves played so far */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>{tr("MOVES")}</Text>
                    <View style={styles.moves}>
                        {opening.moves.map((san, moveIndex) => {
                            const played = moveIndex < ply;
                            // Practice mode keeps the coming moves hidden.
                            const visible = played || mode === "learn";

                            return (
                                <View key={moveIndex} style={styles.moveItem}>
                                    {moveIndex % 2 === 0 && <Text style={styles.moveNumber}>{moveIndex / 2 + 1}.</Text>}
                                    <Text style={[styles.move, played && styles.movePlayed, moveIndex === ply - 1 && styles.moveCurrent]}>
                                        {visible ? san : "…"}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* what the opening is about */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>{tr("THE IDEA")}</Text>
                    <Text style={styles.summary}>{tr(opening.summary)}</Text>

                    {opening.ideas.map((idea, ideaIndex) => (
                        <View key={ideaIndex} style={styles.idea}>
                            <View style={styles.ideaNumber}>
                                <Text style={styles.ideaNumberText}>{ideaIndex + 1}</Text>
                            </View>
                            <Text style={styles.ideaText}>{tr(idea)}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0F1115" },
    center: { alignItems: "center", justifyContent: "center", padding: 24 },
    empty: { color: T.textDim, fontSize: 15, marginBottom: 16 },
    pressed: { opacity: 0.75 },
    disabled: { opacity: 0.4 },

    headerRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
    back: {
        width: 40,
        height: 40,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: T.border,
    },
    title: { color: "#F5F7F9", fontSize: 21, fontWeight: "700", letterSpacing: -0.4 },
    subtitle: { color: T.textDim, fontSize: 12.5, marginTop: 2 },

    progressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, marginBottom: 12 },
    track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(237,240,243,0.1)", overflow: "hidden" },
    fill: { height: 6, borderRadius: 3, backgroundColor: "#5B8DB8" },
    progressText: { color: T.textDim, fontSize: 12.5, fontWeight: "700", fontVariant: ["tabular-nums"] },

    boardWrap: { alignItems: "center" },

    instruction: {
        marginTop: 14,
        borderRadius: 16,
        paddingVertical: 13,
        paddingHorizontal: 16,
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: "rgba(91, 141, 184, 0.3)",
    },
    instructionText: { color: T.text, fontSize: 15.5, fontWeight: "700", textAlign: "center" },
    message: { color: "#E8B93E", fontSize: 13, textAlign: "center", marginTop: 6 },

    actions: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 12 },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 13,
        backgroundColor: "rgba(237,240,243,0.06)",
        borderWidth: 1,
        borderColor: T.border,
    },
    chipText: { color: T.text, fontSize: 13.5, fontWeight: "700" },

    done: {
        marginTop: 14,
        borderRadius: 20,
        padding: 18,
        alignItems: "center",
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: "rgba(111,191,115,0.35)",
    },
    doneStars: { color: "#F5B942", fontSize: 32, letterSpacing: 4, marginBottom: 6 },
    doneStarsOff: { color: "rgba(237,240,243,0.18)" },
    doneTitle: { color: "#F5F7F9", fontSize: 18, fontWeight: "700", textAlign: "center" },
    doneText: { color: T.textDim, fontSize: 13.5, marginTop: 4, textAlign: "center" },
    primary: {
        alignSelf: "stretch",
        marginTop: 16,
        paddingVertical: 14,
        borderRadius: 15,
        alignItems: "center",
        backgroundColor: "#5B8DB8",
    },
    primaryText: { color: "#FFFFFF", fontSize: 15.5, fontWeight: "800" },
    secondary: {
        alignSelf: "stretch",
        marginTop: 10,
        paddingVertical: 13,
        borderRadius: 15,
        alignItems: "center",
        backgroundColor: "rgba(237,240,243,0.06)",
        borderWidth: 1,
        borderColor: T.border,
    },
    secondaryText: { color: T.text, fontSize: 14.5, fontWeight: "700" },

    card: {
        marginTop: 14,
        borderRadius: 18,
        padding: 16,
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: "rgba(237, 240, 243, 0.08)",
    },
    cardLabel: { color: T.textFaint, fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginBottom: 10 },
    moves: { flexDirection: "row", flexWrap: "wrap", rowGap: 6 },
    moveItem: { flexDirection: "row", alignItems: "center" },
    moveNumber: { color: T.textFaint, fontSize: 13, marginRight: 4, fontVariant: ["tabular-nums"] },
    move: { color: T.textFaint, fontSize: 14, fontWeight: "600", marginRight: 9 },
    movePlayed: { color: T.text },
    moveCurrent: { color: "#7FB3DC" },

    summary: { color: T.text, fontSize: 14.5, lineHeight: 21, marginBottom: 12 },
    idea: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 8 },
    ideaNumber: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(91,141,184,0.2)",
        marginTop: 1,
    },
    ideaNumberText: { color: "#A9C6E0", fontSize: 11, fontWeight: "800" },
    ideaText: { color: T.textDim, fontSize: 14, lineHeight: 20, flex: 1 },
});
