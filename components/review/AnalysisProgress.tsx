import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { formatEval, ReviewMove, whiteShare } from "../../lib/analysis";
import { T } from "../ui/theme";
import EvalGraph from "./EvalGraph";
import ReviewBoard, { EvalBar } from "./ReviewBoard";
import { tr } from "../../lib/i18n";

export type ProgressMove = { ply: number; moveNumber: number; color: "w" | "b"; san: string };

export type LiveResult = ProgressMove & { evalCp: number; mate: boolean };

export type AnalysisProgressState = {
    done: number;
    total: number;
    queued: boolean;
    queuePosition: number;
    /** Moves the engines are looking at right now. */
    active: ProgressMove[];
    /** Evaluations that already arrived, newest first. */
    feed: LiveResult[];
    /** ply -> evaluation (White's view), for the graph that fills up live. */
    evals: Record<number, { evalCp: number; mate: boolean }>;
};

export const EMPTY_PROGRESS: AnalysisProgressState = {
    done: 0,
    total: 0,
    queued: false,
    queuePosition: 0,
    active: [],
    feed: [],
    evals: {},
};

type Props = {
    progress: AnalysisProgressState;
    /** Board (chess.js board()) for every position of the game; index 0 = start. */
    boards: any[][][];
    /** from/to of every move, to highlight what is being checked. */
    plies: { from: string; to: string }[];
    boardSize: number;
};

const label = (m: ProgressMove) => (m.ply < 0 ? tr("Start position") : `${m.moveNumber}${m.color === "w" ? "." : "…"} ${m.san}`);

const liveEval = (r: { evalCp: number; mate: boolean }) =>
    r.mate
        ? `${r.evalCp < 0 ? "−" : ""}M${Math.max(0, 10000 - Math.abs(r.evalCp))}`
        : formatEval({ evalCp: r.evalCp, mate: null, mateFor: null });

function PulsingDot({ color }: { color: string }) {
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 550, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    return (
        <Animated.View
            style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: color,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.25] }) }],
            }}
        />
    );
}

// Shown while the server analyses the game: progress bar, the moves the
// engine is checking right now, results as they come in and the evaluation
// graph filling up.
export default function AnalysisProgress({ progress, boards, plies, boardSize }: Props) {
    const { done, total, active, feed, evals, queued, queuePosition } = progress;
    const share = total > 0 ? Math.min(1, done / total) : 0;

    const animated = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animated, {
            toValue: share,
            duration: 350,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [share, animated]);

    // The board follows the move that is being checked (or was checked last).
    const focus = active[0] ?? feed[0] ?? null;
    const focusIndex = focus ? Math.max(0, Math.min(boards.length - 1, focus.ply + 1)) : 0;
    const board = boards[focusIndex] ?? boards[0];
    const lastMove = focus && focus.ply >= 0 ? plies[focus.ply] ?? null : null;
    const latest = feed[0] ?? null;

    // Moves evaluated so far, in game order, for the live graph.
    const graphMoves: Pick<ReviewMove, "evalCp" | "mate" | "mateFor" | "classification">[] = [];
    const totalPlies = Math.max(0, boards.length - 1);
    for (let ply = 0; ply < totalPlies; ply++) {
        const known = evals[ply];
        if (!known) break;
        graphMoves.push({
            evalCp: known.evalCp,
            mate: known.mate ? Math.max(0, 10000 - Math.abs(known.evalCp)) : null,
            mateFor: known.mate ? (known.evalCp > 0 ? "w" : "b") : null,
            classification: "good",
        });
    }

    const barShare = latest
        ? whiteShare({ evalCp: latest.evalCp, mate: latest.mate ? 1 : null, mateFor: latest.evalCp > 0 ? "w" : "b" })
        : 0.5;

    const width = boardSize + 28;

    return (
        <View style={{ width, alignItems: "center" }}>
            <Text style={styles.title}>{queued ? tr("Waiting for a free engine") : tr("Analyzing your game")}</Text>
            <Text style={styles.subtitle}>
                {queued
                    ? tr("You are number {0} in the queue. This usually takes less than a minute.", queuePosition)
                    : tr("Stockfish checks every position of the game.")}
            </Text>

            <View style={styles.boardRow}>
                <EvalBar share={barShare} height={boardSize} label={latest ? liveEval(latest) : undefined} />
                <View style={styles.boardFrame}>
                    {board && <ReviewBoard board={board} size={boardSize} lastMove={lastMove} showBadge={false} />}
                </View>
            </View>

            <View style={[styles.card, { width }]}>
                <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>
                        {total > 0 ? tr("{0} of {1} positions", done, total) : tr("Starting the engine…")}
                    </Text>
                    <Text style={styles.progressPercent}>{Math.round(share * 100)}%</Text>
                </View>

                <View style={styles.track}>
                    <Animated.View
                        style={[
                            styles.fill,
                            { width: animated.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
                        ]}
                    />
                </View>

                <Text style={styles.sectionLabel}>{tr("ENGINE IS CHECKING")}</Text>
                {active.length === 0 ? (
                    <Text style={styles.idle}>{done > 0 && done >= total ? tr("Putting the review together…") : tr("Getting ready…")}</Text>
                ) : (
                    active.map((move, index) => (
                        <View key={`${move.ply}-${index}`} style={styles.activeRow}>
                            <PulsingDot color={T.accent} />
                            <Text style={styles.activeMove}>{label(move)}</Text>
                            <Text style={styles.activeHint}>{tr("Engine")} {index + 1}</Text>
                        </View>
                    ))
                )}

                {feed.length > 0 && (
                    <>
                        <Text style={[styles.sectionLabel, { marginTop: 14 }]}>{tr("JUST EVALUATED")}</Text>
                        {feed.slice(0, 5).map((result, index) => (
                            <View key={`${result.ply}-${index}`} style={[styles.feedRow, { opacity: 1 - index * 0.16 }]}>
                                <Text style={styles.feedMove}>{label(result)}</Text>
                                <View style={[styles.evalChip, result.evalCp >= 0 ? styles.evalChipWhite : styles.evalChipBlack]}>
                                    <Text style={[styles.evalChipText, { color: result.evalCp >= 0 ? "#12151B" : "#F1F3F5" }]}>
                                        {liveEval(result)}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </>
                )}
            </View>

            {totalPlies > 0 && graphMoves.length > 0 && (
                <View style={[styles.card, { width }]}>
                    <Text style={[styles.sectionLabel, { marginTop: 0 }]}>{tr("EVALUATION SO FAR")}</Text>
                    <EvalGraph
                        moves={graphMoves}
                        currentIndex={graphMoves.length}
                        width={width - 32}
                        height={64}
                        totalPlies={totalPlies}
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    title: { color: T.text, fontSize: 21, fontWeight: "800", marginTop: 6 },
    subtitle: { color: T.textDim, fontSize: 13.5, textAlign: "center", marginTop: 6, marginBottom: 18, lineHeight: 19, paddingHorizontal: 12 },
    boardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    boardFrame: { borderRadius: 10, overflow: "hidden" },
    card: { marginTop: 14, backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 16 },
    progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 },
    progressLabel: { color: T.textDim, fontSize: 13, fontWeight: "600" },
    progressPercent: { color: T.text, fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
    track: { height: 10, borderRadius: 5, backgroundColor: "rgba(237,240,243,0.08)", overflow: "hidden" },
    fill: { height: "100%", borderRadius: 5, backgroundColor: T.accent },
    sectionLabel: { color: T.textFaint, fontSize: 10.5, fontWeight: "800", letterSpacing: 1, marginTop: 16, marginBottom: 8 },
    idle: { color: T.textDim, fontSize: 13.5 },
    activeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
    activeMove: { color: T.text, fontSize: 15, fontWeight: "700", flex: 1 },
    activeHint: { color: T.textFaint, fontSize: 11.5 },
    feedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
    feedMove: { color: T.textDim, fontSize: 13.5, fontWeight: "600" },
    evalChip: { minWidth: 46, paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6, alignItems: "center" },
    evalChipWhite: { backgroundColor: "#E9ECEF" },
    evalChipBlack: { backgroundColor: "#262B34", borderWidth: 1, borderColor: T.borderStrong },
    evalChipText: { fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
