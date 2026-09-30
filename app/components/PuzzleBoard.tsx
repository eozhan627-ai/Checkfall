import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Image,
    PanResponder,
    StyleSheet,
    Text,
    View,
} from "react-native";

const piecesImages = {
    wP: require("../../assets/images/pawn_white.png"),
    wR: require("../../assets/images/rook_white.png"),
    wN: require("../../assets/images/knight_white.png"),
    wB: require("../../assets/images/bishop_white.png"),
    wQ: require("../../assets/images/queen_white.png"),
    wK: require("../../assets/images/king_white.png"),

    bP: require("../../assets/images/pawn_black.png"),
    bR: require("../../assets/images/rook_black.png"),
    bN: require("../../assets/images/knight_black.png"),
    bB: require("../../assets/images/bishop_black.png"),
    bQ: require("../../assets/images/queen_black.png"),
    bK: require("../../assets/images/king_black.png"),
};

type PieceKey = keyof typeof piecesImages;

type Piece = {
    type: string;
    color: string;
} | null;

type Props = {
    board: Piece[][];
    selectedSquare: string | null;
    legalSquares: string[];
    onSquarePress: (square: string) => void;
    playerColor?: "w" | "b";
    // Neu – beide optional, der Puzzles-Screen funktioniert unverändert weiter
    lastMove?: { from: string; to: string } | null;
    checkSquare?: string | null;
    // Felder, die per Tipp mit einem Halo markiert werden
    hintSquares?: string[];
};

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

// Gleiche Farben wie das Review-/Spielbrett
const BOARD_COLORS = {
    light: "#e7d5b7",
    dark: "#b58863",
    lastTo: "#6bb6ff",
    lastFrom: "#4da3ff",
    selected: "#4da3ff",
    check: "#ff4d4d",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 32, 420);
const SQUARE_SIZE = BOARD_SIZE / 8;
const PIECE_SIZE = SQUARE_SIZE * 0.86;

// Halo als weicher Glow: viele übereinanderliegende Kreise ohne Rand.
// Jeder Kreis ist nur leicht transparent -> in der Mitte addiert es sich
// zu stark, nach außen wird es weicher und schwächer.
const HALO_LAYERS = 12;
const HALO_MAX = SQUARE_SIZE * 1.4;  // größer als das Feld, ragt in die Nachbarfelder
const HALO_MIN = SQUARE_SIZE * 0.25; // innerster Kreis
const HALO_COLOR = "rgba(20,200,120,0.09)";
const HALO_DIAMETERS = Array.from({ length: HALO_LAYERS }, (_, i) =>
    HALO_MAX - ((HALO_MAX - HALO_MIN) * i) / (HALO_LAYERS - 1)
);

const PIECE_SCALE: Record<string, number> = {
    wP: 1.35, wN: 1.55, wB: 1.7, wR: 1.65, wQ: 1.55, wK: 1.3,
    bP: 1.3, bN: 1.2, bB: 1.3, bR: 1.15, bQ: 1.25, bK: 1.15,
};
const PIECE_OFFSET_Y: Record<string, number> = {
    wB: -1.1, wR: -2, wQ: -2, wP: 1.2,
    bP: 2, bN: 2, bR: 2, bQ: 2, bB: 0.5,
};
const pieceTransform = (key: string) => [
    { scale: PIECE_SCALE[key] ?? 1 },
    { translateY: PIECE_OFFSET_Y[key] ?? 0 },
];

// Feld des Königs, der gerade im Schach steht (für die rote Markierung)
export function findCheckedKing(game: { inCheck: () => boolean; turn: () => string; board: () => Piece[][] }): string | null {
    if (!game.inCheck()) return null;
    const turn = game.turn();
    const b = game.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            if (p && p.type === "k" && p.color === turn) return files[c] + ranks[r];
        }
    }
    return null;
}

export default function PuzzleBoard({
    board,
    selectedSquare,
    legalSquares,
    onSquarePress,
    playerColor = "w",
    lastMove = null,
    checkSquare = null,
    hintSquares = [],
}: Props) {
    const rotate = playerColor === "b";

    // Halo pulsiert sanft, solange ein Tipp aktiv ist
    const pulse = useRef(new Animated.Value(0)).current;
    const hasHint = hintSquares.length > 0;
    useEffect(() => {
        if (!hasHint) {
            pulse.setValue(0);
            return;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [hasHint]);

    // =========================================================
    // DRAG & DROP
    // =========================================================

    const [drag, setDrag] = useState<{ from: string; pieceKey: PieceKey } | null>(null);
    const dragPos = useRef(new Animated.ValueXY()).current;

    // PanResponder wird nur einmal erstellt -> aktuelle Props über Ref lesen
    const latest = useRef<any>({});
    latest.current = { board, rotate, playerColor, onSquarePress };

    const gesture = useRef({
        startX: 0,
        startY: 0,
        startSquare: null as string | null,
        dragging: false,
    });

    // Touch-Koordinate (relativ zum Brett) -> Feld
    const cellAt = (x: number, y: number) => {
        const { board, rotate } = latest.current;

        const r = Math.floor(y / SQUARE_SIZE);
        const c = Math.floor(x / SQUARE_SIZE);
        if (r < 0 || r > 7 || c < 0 || c > 7) return null;

        const sourceRow = rotate ? 7 - r : r;
        const sourceCol = rotate ? 7 - c : c;

        return {
            square: files[sourceCol] + ranks[sourceRow],
            piece: board[sourceRow][sourceCol] as Piece,
        };
    };

    const resetDrag = () => {
        gesture.current.dragging = false;
        setDrag(null);
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,

            onPanResponderGrant: (e) => {
                const { locationX: x, locationY: y } = e.nativeEvent;
                const g = gesture.current;
                const { playerColor, onSquarePress } = latest.current;

                g.startX = x;
                g.startY = y;
                g.dragging = false;

                const cell = cellAt(x, y);
                g.startSquare = cell?.square ?? null;

                // Eigene Figur: auswählen + Drag starten
                if (cell?.piece && cell.piece.color === playerColor) {
                    g.dragging = true;
                    onSquarePress(cell.square);
                    dragPos.setValue({ x, y });
                    setDrag({
                        from: cell.square,
                        pieceKey: (cell.piece.color +
                            cell.piece.type.toUpperCase()) as PieceKey,
                    });
                }
            },

            onPanResponderMove: (_e, gs) => {
                const g = gesture.current;
                if (!g.dragging) return;
                dragPos.setValue({ x: g.startX + gs.dx, y: g.startY + gs.dy });
            },

            onPanResponderRelease: (_e, gs) => {
                const g = gesture.current;
                const { onSquarePress, playerColor } = latest.current;

                if (g.dragging) {
                    const target = cellAt(g.startX + gs.dx, g.startY + gs.dy);

                    // Zug nur auslösen, wenn auf ein anderes Feld ohne eigene Figur losgelassen wurde
                    if (
                        target &&
                        target.square !== g.startSquare &&
                        !(target.piece && target.piece.color === playerColor)
                    ) {
                        onSquarePress(target.square);
                    }
                } else if (g.startSquare) {
                    // normales Tippen (leeres Feld / Gegnerfigur als Ziel)
                    onSquarePress(g.startSquare);
                }

                resetDrag();
            },

            onPanResponderTerminate: resetDrag,
        })
    ).current;

    return (
        <View style={styles.board}>
            {Array.from({ length: 8 }, (_, r) =>
                Array.from({ length: 8 }, (_, c) => {
                    const sourceRow = rotate ? 7 - r : r;
                    const sourceCol = rotate ? 7 - c : c;

                    const piece = board[sourceRow][sourceCol];
                    const square = files[sourceCol] + ranks[sourceRow];

                    const isDark = (r + c) % 2 === 1;
                    const isSelected = selectedSquare === square;
                    const isLegal = legalSquares.includes(square);
                    const isCheckSq = checkSquare === square;
                    const isLastTo = lastMove?.to === square;
                    const isLastFrom = lastMove?.from === square;
                    const isHint = hintSquares.includes(square);

                    const pieceKey = piece
                        ? ((piece.color + piece.type.toUpperCase()) as PieceKey)
                        : null;

                    // Figur, die gerade gezogen wird, am Ursprung ausblenden
                    const hidden = drag?.from === square;

                    const bg = isCheckSq ? BOARD_COLORS.check
                        : isLastTo ? BOARD_COLORS.lastTo
                            : isLastFrom ? BOARD_COLORS.lastFrom
                                : isSelected ? BOARD_COLORS.selected
                                    : isDark ? BOARD_COLORS.dark : BOARD_COLORS.light;

                    return (
                        <View key={square} style={[styles.square, { backgroundColor: bg }, isHint && { zIndex: 2 }]}>
                            {/* Rang */}
                            {c === 0 && (
                                <Text
                                    style={[
                                        styles.coord,
                                        isDark ? styles.coordDark : styles.coordLight,
                                        { left: 2, top: 2 },
                                    ]}
                                >
                                    {ranks[sourceRow]}
                                </Text>
                            )}

                            {/* Linie */}
                            {r === 7 && (
                                <Text
                                    style={[
                                        styles.coord,
                                        isDark ? styles.coordDark : styles.coordLight,
                                        { right: 2, bottom: 2 },
                                    ]}
                                >
                                    {files[sourceCol]}
                                </Text>
                            )}

                            {/* Tipp-Halo: weicher Glow ohne Rand (liegt hinter der Figur) */}
                            {isHint && (
                                <Animated.View
                                    pointerEvents="none"
                                    style={[
                                        styles.haloWrap,
                                        { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                                    ]}
                                >
                                    {HALO_DIAMETERS.map((d, i) => (
                                        <View
                                            key={i}
                                            style={{
                                                position: "absolute",
                                                zIndex: 20,                                                left: (SQUARE_SIZE - d) / 2,
                                                top: (SQUARE_SIZE - d) / 2,
                                                width: d,
                                                height: d,
                                                borderRadius: d / 2,
                                                backgroundColor: HALO_COLOR,
                                            }}
                                        />
                                    ))}
                                </Animated.View>
                            )}

                            {/* Figur */}
                            {piece && pieceKey && !hidden && (
                                <Image
                                    source={piecesImages[pieceKey]}
                                    style={[
                                        styles.piece,
                                        { transform: pieceTransform(pieceKey) },
                                    ]}
                                />
                            )}

                            {/* Legale Züge: Punkt auf leerem Feld, Ring bei Schlagzug */}
                            {isLegal && <View style={piece ? styles.dotCapture : styles.dot} />}
                        </View>
                    );
                })
            )}

            {/* Unsichtbare Touch-Schicht über dem ganzen Brett */}
            <View
                style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
                {...panResponder.panHandlers}
            />
            {/* Figur, die am Finger klebt (etwas über dem Finger, damit man sie sieht) */}
            {drag && (
                <Animated.View
                    pointerEvents="none"
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: SQUARE_SIZE,
                        height: SQUARE_SIZE,
                        alignItems: "center",
                        justifyContent: "center",
                        transform: [
                            { translateX: Animated.subtract(dragPos.x, SQUARE_SIZE / 2) },
                            {
                                translateY: Animated.subtract(
                                    dragPos.y,
                                    SQUARE_SIZE / 2 + SQUARE_SIZE * 0.5
                                ),
                            },
                        ],
                    }}
                >
                    <Image
                        source={piecesImages[drag.pieceKey]}
                        style={[
                            styles.piece,
                            { transform: pieceTransform(drag.pieceKey) },
                        ]}
                    />
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    board: {
        alignSelf: "center",
        width: BOARD_SIZE,
        height: BOARD_SIZE,
        flexDirection: "row",
        flexWrap: "wrap",
        borderRadius: 8,
        overflow: "hidden",
    },

    square: {
        width: SQUARE_SIZE,
        height: SQUARE_SIZE,
        justifyContent: "center",
        alignItems: "center",
    },

    piece: {
        width: PIECE_SIZE,
        height: PIECE_SIZE,
        resizeMode: "contain",
    },

    dot: {
        position: "absolute",
        width: SQUARE_SIZE * 0.3,
        height: SQUARE_SIZE * 0.3,
        borderRadius: SQUARE_SIZE * 0.15,
        backgroundColor: "rgba(0,0,0,0.25)",
    },

    dotCapture: {
        position: "absolute",
        width: SQUARE_SIZE * 0.9,
        height: SQUARE_SIZE * 0.9,
        borderRadius: SQUARE_SIZE * 0.45,
        borderWidth: 3,
        borderColor: "rgba(0,0,0,0.25)",
    },

    // Container für den Glow (Kreise darin sind absolut positioniert)
    haloWrap: {
        position: "absolute",
        left: 0,
        top: 0,
        width: SQUARE_SIZE,
        height: SQUARE_SIZE,
    },

    coord: {
        position: "absolute",
        fontSize: 10,
        fontWeight: "700",
    },

    coordDark: {
        color: "#e5e7eb",
    },

    coordLight: {
        color: "#334155",
    },
});