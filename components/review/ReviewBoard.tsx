import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polygon } from "react-native-svg";
import { Classification, CLASSIFICATION_META } from "../../lib/analysis";
import { pieces, pieceToKey } from "../game/pieces";
import { T } from "../ui/theme";
import { useBoardTheme } from "../../lib/shop";
import ClassificationBadge from "./ClassificationBadge";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

// The piece images have different proportions - these values make them look
// the same size on the board (same numbers as on the game board).
const PIECE_SCALE: Record<string, number> = {
    wp: 1.35, wn: 1.55, wb: 1.7, wr: 1.65, wq: 1.55, wk: 1.3,
    bp: 1.3, bn: 1.2, bb: 1.3, br: 1.15, bq: 1.25, bk: 1.15,
};
const PIECE_SHIFT: Record<string, number> = {
    wb: -1.1, wr: -2, wq: -2, wp: 1.2, bp: 2, bn: 2, br: 2, bq: 2, bb: 0.5,
};

type Props = {
    /** chess.js board(): 8 rows from rank 8 to rank 1. */
    board: any[][];
    size: number;
    flipped?: boolean;
    lastMove?: { from: string; to: string } | null;
    /** Label of the last move: tints its squares and puts a badge on the target square. */
    classification?: Classification | null;
    showBadge?: boolean;
    checkSquare?: string | null;
    /** Arrow for the engine's suggestion. */
    arrow?: { from: string; to: string } | null;
    selectedSquare?: string | null;
    legalTargets?: Set<string>;
    onSquarePress?: (square: string) => void;
};

function squareCenter(square: string, flipped: boolean, squareSize: number) {
    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1], 10);
    const col = flipped ? 7 - file : file;
    const row = flipped ? rank - 1 : 8 - rank;
    return { x: col * squareSize + squareSize / 2, y: row * squareSize + squareSize / 2 };
}

// Mixes a classification colour into a board square.
function tint(base: string, color: string) {
    return { backgroundColor: base, overlay: `${color}8C` };
}

export default function ReviewBoard({
    board,
    size,
    flipped = false,
    lastMove,
    classification,
    showBadge = true,
    checkSquare,
    arrow,
    selectedSquare,
    legalTargets,
    onSquarePress,
}: Props) {
    // Colours of the board design chosen in the shop.
    const boardTheme = useBoardTheme();

    const squareSize = size / 8;
    const moveColor = classification ? CLASSIFICATION_META[classification].color : "#F2C94C";

    const arrowGeometry = (() => {
        if (!arrow) return null;

        const from = squareCenter(arrow.from, flipped, squareSize);
        const to = squareCenter(arrow.to, flipped, squareSize);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 1) return null;

        const ux = dx / length;
        const uy = dy / length;
        const head = squareSize * 0.42;
        const baseX = to.x - ux * head;
        const baseY = to.y - uy * head;
        const half = squareSize * 0.22;

        return {
            line: { x1: from.x + ux * squareSize * 0.2, y1: from.y + uy * squareSize * 0.2, x2: baseX, y2: baseY },
            head: `${to.x},${to.y} ${baseX - uy * half},${baseY + ux * half} ${baseX + uy * half},${baseY - ux * half}`,
        };
    })();

    return (
        <View style={{ width: size, height: size }}>
            <View style={[styles.board, { width: size, height: size }]}>
                {Array.from({ length: 8 }).map((_, r) =>
                    Array.from({ length: 8 }).map((__, c) => {
                        const br = flipped ? 7 - r : r;
                        const bc = flipped ? 7 - c : c;
                        const piece = board[br]?.[bc];
                        const key = pieceToKey(piece);
                        const square = `${FILES[bc]}${8 - br}`;
                        const isDark = (br + bc) % 2 === 1;
                        const base = isDark ? boardTheme.dark : boardTheme.light;

                        const isLast = lastMove?.to === square || lastMove?.from === square;
                        const isTarget = lastMove?.to === square;
                        const isCheck = checkSquare === square;
                        const isSelected = selectedSquare === square;
                        const isLegal = legalTargets?.has(square);

                        const overlay = isCheck
                            ? "rgba(255,77,77,0.85)"
                            : isSelected
                                ? "rgba(77,163,255,0.75)"
                                : isLast
                                    ? tint(base, moveColor).overlay
                                    : null;

                        const labelColor = isDark ? "#F0E2CB" : "#8A6A48";

                        return (
                            <Pressable
                                key={square}
                                disabled={!onSquarePress}
                                onPress={() => onSquarePress?.(square)}
                                style={[styles.square, { width: squareSize, height: squareSize, backgroundColor: base }]}
                            >
                                {overlay && <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />}

                                {key && (
                                    <Image
                                        source={pieces[key]}
                                        style={{
                                            width: squareSize * 0.9,
                                            height: squareSize * 0.9,
                                            transform: [
                                                { scale: PIECE_SCALE[key] ?? 1 },
                                                { translateY: PIECE_SHIFT[key] ?? 0 },
                                            ],
                                        }}
                                        resizeMode="contain"
                                    />
                                )}

                                {isLegal && (
                                    <View
                                        style={
                                            key
                                                ? [styles.captureRing, { width: squareSize * 0.9, height: squareSize * 0.9, borderRadius: squareSize * 0.45 }]
                                                : [styles.dot, { width: squareSize * 0.3, height: squareSize * 0.3, borderRadius: squareSize * 0.15 }]
                                        }
                                    />
                                )}

                                {c === 0 && (
                                    <Text style={[styles.coord, { top: 1, left: 2, color: labelColor }]} allowFontScaling={false}>
                                        {8 - br}
                                    </Text>
                                )}
                                {r === 7 && (
                                    <Text style={[styles.coord, { bottom: 0, right: 2, color: labelColor }]} allowFontScaling={false}>
                                        {FILES[bc]}
                                    </Text>
                                )}

                                {isTarget && classification && showBadge && (
                                    <View style={styles.badge}>
                                        <ClassificationBadge classification={classification} size={Math.max(16, squareSize * 0.42)} outlined />
                                    </View>
                                )}
                            </Pressable>
                        );
                    })
                )}
            </View>

            {arrowGeometry && (
                <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Line {...arrowGeometry.line} stroke="rgba(111,191,115,0.9)" strokeWidth={squareSize * 0.2} strokeLinecap="round" />
                    <Polygon points={arrowGeometry.head} fill="rgba(111,191,115,0.95)" />
                </Svg>
            )}
        </View>
    );
}

type EvalBarProps = {
    /** White's share of the bar, 0-1. */
    share: number;
    height: number;
    flipped?: boolean;
    label?: string;
};

// Vertical evaluation bar next to the board.
export function EvalBar({ share, height, flipped = false, label }: EvalBarProps) {
    const clamped = Math.max(0.03, Math.min(0.97, share));
    const whiteOnTop = flipped;
    const whiteAhead = share >= 0.5;

    return (
        <View style={[styles.evalBar, { height }]}>
            <View
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: `${clamped * 100}%`,
                    backgroundColor: "#F1F3F5",
                    ...(whiteOnTop ? { top: 0 } : { bottom: 0 }),
                }}
            />
            <View style={styles.evalMid} />
            {label ? (
                <Text
                    style={[
                        styles.evalLabel,
                        { color: whiteAhead ? "#12151B" : "#F1F3F5" },
                        // The number sits inside the side that is ahead.
                        whiteAhead === whiteOnTop ? { top: 4 } : { bottom: 4 },
                    ]}
                    numberOfLines={1}
                    allowFontScaling={false}
                >
                    {label}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    board: { flexDirection: "row", flexWrap: "wrap", borderRadius: 8, overflow: "hidden" },
    square: { alignItems: "center", justifyContent: "center" },
    coord: { position: "absolute", fontSize: 8.5, fontWeight: "800" },
    dot: { position: "absolute", backgroundColor: "rgba(0,0,0,0.28)" },
    captureRing: { position: "absolute", borderWidth: 3, borderColor: "rgba(0,0,0,0.28)" },
    badge: { position: "absolute", top: 1, right: 1, zIndex: 5 },
    evalBar: { width: 20, borderRadius: 6, backgroundColor: "#262B34", overflow: "hidden" },
    evalMid: { position: "absolute", top: "50%", left: 0, right: 0, height: 1, backgroundColor: "rgba(128,134,144,0.7)" },
    evalLabel: { position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 8.5, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
