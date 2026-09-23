import React, { useRef, useState } from "react";
import {
    Animated,
    Image,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const toSquare = (r: number, c: number) => `${FILES[c]}${8 - r}`;

// Deine Scale/Offset-Werte, nur ausgelagert, damit Brett und Drag-Figur gleich aussehen
const PIECE_SCALE: Record<string, number> = {
    wp: 1.35, wn: 1.55, wb: 1.7, wr: 1.65, wq: 1.55, wk: 1.3,
    bp: 1.3, bn: 1.2, bb: 1.3, br: 1.15, bq: 1.25, bk: 1.15,
};
const PIECE_OFFSET_Y: Record<string, number> = {
    wb: -1.1, wr: -2, wq: -2, wp: 1.2,
    bp: 2, bn: 2, br: 2, bq: 2, bb: 0.5,
};
const pieceTransform = (key: string) => [
    { scale: PIECE_SCALE[key] ?? 1 },
    { translateY: PIECE_OFFSET_Y[key] ?? 0 },
];

export default function Board({
    board,
    selectedSquare,
    legalMoves,
    lastMove,
    checkSquare,
    onPressSquare,
    pieces,
    pieceToKey,
    myColor,
    mode,
    isCheck,
    isCheckmate,
    isStalemate,
    isDraw,
    onUndo,
    onRedo,
    onSave,
    onRestart,
}: any) {
    // =========================================================
    // DRAG & DROP
    // =========================================================

    const [boardSize, setBoardSize] = useState(0);
    const [drag, setDrag] = useState<{ from: string; pieceKey: string } | null>(null);
    const dragPos = useRef(new Animated.ValueXY()).current;

    // Der PanResponder wird nur einmal erstellt -> immer die aktuellen Props über ein Ref lesen
    const latest = useRef<any>({});
    latest.current = { board, myColor, onPressSquare, pieceToKey, boardSize };

    const gesture = useRef({
        startX: 0,
        startY: 0,
        startSquare: null as string | null,
        dragging: false,
    });

    // Touch-Koordinate (relativ zum Brett) -> Feld
    const cellAt = (x: number, y: number) => {
        const { board, myColor, boardSize } = latest.current;
        const sq = boardSize / 8;
        if (!sq) return null;

        const c = Math.floor(x / sq);
        const r = Math.floor(y / sq);
        if (r < 0 || r > 7 || c < 0 || c > 7) return null;

        const square =
            myColor === "w" ? toSquare(r, c) : toSquare(7 - r, 7 - c);

        return { square, piece: board[r][c] };
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
                const { myColor, pieceToKey, onPressSquare } = latest.current;

                g.startX = x;
                g.startY = y;
                g.dragging = false;

                const cell = cellAt(x, y);
                g.startSquare = cell?.square ?? null;

                // Eigene Figur: auswählen + Drag starten
                if (cell?.piece && cell.piece.color === myColor) {
                    g.dragging = true;
                    onPressSquare(cell.square);
                    dragPos.setValue({ x, y });
                    setDrag({
                        from: cell.square,
                        pieceKey: pieceToKey(cell.piece),
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
                const { onPressSquare, myColor } = latest.current;

                if (g.dragging) {
                    const target = cellAt(g.startX + gs.dx, g.startY + gs.dy);

                    // Zug nur auslösen, wenn auf ein anderes Feld ohne eigene Figur losgelassen wurde
                    if (
                        target &&
                        target.square !== g.startSquare &&
                        !(target.piece && target.piece.color === myColor)
                    ) {
                        onPressSquare(target.square);
                    }
                } else if (g.startSquare) {
                    // normales Tippen (leeres Feld / Gegnerfigur als Ziel)
                    onPressSquare(g.startSquare);
                }

                resetDrag();
            },

            onPanResponderTerminate: resetDrag,
        })
    ).current;

    const squareSize = boardSize / 8;

    return (
        <View style={styles.container}>
            {isCheck && (
                <Text style={{ color: "red", position: "absolute", top: 10 }}>
                    CHECK
                </Text>
            )}
            {isCheckmate && (
                <Text style={{ color: "red", position: "absolute", top: 30 }}>
                    CHECKMATE
                </Text>
            )}
            {isStalemate && (
                <Text style={{ color: "gray", position: "absolute", top: 30 }}>
                    STALEMATE
                </Text>
            )}
            {isDraw && (
                <Text style={{ color: "gray", position: "absolute", top: 30 }}>
                    DRAW
                </Text>
            )}

            <View
                style={styles.board}
                // -2 wegen borderWidth: 1 (links + rechts)
                onLayout={(e) => setBoardSize(e.nativeEvent.layout.width - 2)}
            >
                {board.map((row: any[], r: number) =>
                    row.map((piece, c) => {
                        const square =
                            myColor === "w"
                                ? toSquare(r, c)
                                : toSquare(7 - r, 7 - c);

                        const isSelected = selectedSquare === square;
                        const isLegal = legalMoves?.some((m: any) => m.to === square);
                        const isLastFrom = lastMove?.from === square;
                        const isLastTo = lastMove?.to === square;
                        const isCheckSq = checkSquare === square;
                        const pieceKey = pieceToKey(piece);
                        const isDark = (r + c) % 2 === 1;

                        // Figur, die gerade gezogen wird, am Ursprung ausblenden
                        const hidden = drag?.from === square;

                        return (
                            <View
                                key={square}
                                style={[
                                    styles.square,
                                    {
                                        backgroundColor: (() => {
                                            if (isCheckSq) return "#ff4d4d";
                                            if (isLastTo) return "#6bb6ff";
                                            if (isLastFrom) return "#4da3ff";
                                            if (isSelected) return "#4da3ff";
                                            return (r + c) % 2 === 0 ? "#e7d5b7" : "#b58863";
                                        })(),
                                    },
                                ]}
                            >
                                {pieceKey && !hidden && (
                                    <Image
                                        source={pieces[pieceKey]}
                                        style={[
                                            styles.piece,
                                            { transform: pieceTransform(pieceKey) },
                                        ]}
                                    />
                                )}
                                {isLegal && <View style={styles.dot} />}

                                {c === 0 && (
                                    <Text
                                        style={[
                                            styles.coordLabel,
                                            { top: 2, left: 2, color: isDark ? "#e5e7eb" : "#334155" },
                                        ]}
                                    >
                                        {myColor === "w" ? RANKS[r] : RANKS[7 - r]}
                                    </Text>
                                )}
                                {r === 7 && (
                                    <Text
                                        style={[
                                            styles.coordLabel,
                                            { bottom: 2, left: 2, color: isDark ? "#e5e7eb" : "#334155" },
                                        ]}
                                    >
                                        {myColor === "w" ? FILES[c] : FILES[7 - c]}
                                    </Text>
                                )}
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
                {drag && squareSize > 0 && (
                    <Animated.View
                        pointerEvents="none"
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: squareSize,
                            height: squareSize,
                            alignItems: "center",
                            justifyContent: "center",
                            transform: [
                                { translateX: Animated.subtract(dragPos.x, squareSize / 2) },
                                {
                                    translateY: Animated.subtract(
                                        dragPos.y,
                                        squareSize / 2 + squareSize * 0.5
                                    ),
                                },
                            ],
                        }}
                    >
                        <Image
                            source={pieces[drag.pieceKey]}
                            style={[
                                styles.piece,
                                { transform: pieceTransform(drag.pieceKey) },
                            ]}
                        />
                    </Animated.View>
                )}
            </View>

            {mode === "local" && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
                    <Pressable onPress={onUndo}>
                        <Text style={{ color: "white" }}>Undo </Text>
                    </Pressable>
                    <Pressable onPress={onRedo}>
                        <Text style={{ color: "white" }}>Redo </Text>
                    </Pressable>
                    <Pressable onPress={onSave}>
                        <Text style={{ color: "white" }}>Save </Text>
                    </Pressable>
                    <Pressable onPress={onRestart}>
                        <Text style={{ color: "white" }}>Restart </Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
    },
    board: {
        width: "92%",
        aspectRatio: 1,
        flexDirection: "row",
        flexWrap: "wrap",
        borderWidth: 1,
        borderColor: "#d4af37",
        borderRadius: 8,
        overflow: "hidden",
    },
    square: {
        width: "12.5%",
        height: "12.5%",
        justifyContent: "center",
        alignItems: "center",
    },
    piece: {
        width: "90%",
        height: "90%",
        resizeMode: "contain",
    },
    dot: {
        position: "absolute",
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "rgba(0,0,0,0.3)",
    },
    coordLabel: {
        position: "absolute",
        fontSize: 10,
        fontWeight: "600",
    },
});