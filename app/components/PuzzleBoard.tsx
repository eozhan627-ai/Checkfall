import React, { useRef, useState } from "react";
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
};

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 32, 420);
const SQUARE_SIZE = BOARD_SIZE / 8;
const PIECE_SIZE = SQUARE_SIZE * 0.86;

// Deine Scale/Offset-Werte, nur als Maps (gleiche Werte wie vorher)
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

export default function PuzzleBoard({
    board,
    selectedSquare,
    legalSquares,
    onSquarePress,
    playerColor = "w",
}: Props) {
    const rotate = playerColor === "b";

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

                    const pieceKey = piece
                        ? ((piece.color + piece.type.toUpperCase()) as PieceKey)
                        : null;

                    // Figur, die gerade gezogen wird, am Ursprung ausblenden
                    const hidden = drag?.from === square;

                    return (
                        <View
                            key={square}
                            style={[
                                styles.square,
                                {
                                    backgroundColor: isDark ? "#3B82C4" : "#EAF4FC",
                                },
                                isSelected ? styles.selected : null,
                            ]}
                        >
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

                            {/* Legal Move Punkt */}
                            {isLegal && <View style={styles.dot} />}
                        </View>
                    );
                })
            )}

            {/* Unsichtbare Touch-Schicht über dem ganzen Brett */}
            <View
                style={StyleSheet.absoluteFill}
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
    },

    square: {
        width: SQUARE_SIZE,
        height: SQUARE_SIZE,
        justifyContent: "center",
        alignItems: "center",
    },

    selected: {
        borderWidth: 2,
        borderColor: "#7c2525",
    },

    piece: {
        width: PIECE_SIZE,
        height: PIECE_SIZE,
        resizeMode: "contain",
    },

    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "rgba(0,0,0,0.4)",
        position: "absolute",
    },

    coord: {
        position: "absolute",
        fontSize: 10,
        fontWeight: "600",
    },

    coordDark: {
        color: "#e5e7eb",
    },

    coordLight: {
        color: "#334155",
    },
});