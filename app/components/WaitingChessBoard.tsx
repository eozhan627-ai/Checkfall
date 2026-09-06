import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Image,
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

type Piece = keyof typeof piecesImages;

type BoardState = (Piece | null)[][];

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

const createInitialBoard = (): BoardState => [
    ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
    ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
    ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"],
];

const moves = [
    ["e2", "e4"],
    ["e7", "e5"],
    ["g1", "f3"],
    ["b8", "c6"],
    ["f1", "b5"],
    ["g8", "f6"],
    ["d2", "d3"],
    ["f8", "c5"],
    ["c2", "c3"],
    ["d7", "d6"],
    ["b1", "c3"],
    ["c8", "g4"],
    ["h2", "h3"],
    ["g4", "h5"],
];

function squareToPosition(square: string) {
    const col = files.indexOf(square[0]);
    const row = 8 - Number(square[1]);

    return { row, col };
}

export default function WaitingChessBoard() {
    const [board, setBoard] = useState<BoardState>(
        createInitialBoard()
    );

    const moveIndex = useRef(0);

    const animatedX = useRef(new Animated.Value(0)).current;
    const animatedY = useRef(new Animated.Value(0)).current;
    const animatedOpacity = useRef(new Animated.Value(0)).current;

    const [movingPiece, setMovingPiece] = useState<{
        piece: Piece;
        from: string;
        to: string;
    } | null>(null);

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;

        const playMove = () => {
            const move = moves[moveIndex.current];

            if (!move) {
                moveIndex.current = 0;
                setBoard(createInitialBoard());

                timeout = setTimeout(playMove, 900);
                return;
            }

            const from = squareToPosition(move[0]);
            const to = squareToPosition(move[1]);

            setBoard((currentBoard) => {
                const nextBoard = currentBoard.map((row) => [...row]);

                const piece = nextBoard[from.row][from.col];

                if (!piece) {
                    return currentBoard;
                }

                setMovingPiece({
                    piece,
                    from: move[0],
                    to: move[1],
                });

                nextBoard[from.row][from.col] = null;
                nextBoard[to.row][to.col] = piece;

                return nextBoard;
            });

            const cellSize = 37.5;

            animatedX.setValue(
                from.col * cellSize
            );

            animatedY.setValue(
                from.row * cellSize
            );

            animatedOpacity.setValue(1);

            Animated.parallel([
                Animated.timing(animatedX, {
                    toValue: to.col * cellSize,
                    duration: 550,
                    useNativeDriver: true,
                }),

                Animated.timing(animatedY, {
                    toValue: to.row * cellSize,
                    duration: 550,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                animatedOpacity.setValue(0);
                setMovingPiece(null);

                moveIndex.current++;

                timeout = setTimeout(playMove, 650);
            });
        };

        timeout = setTimeout(playMove, 1000);

        return () => {
            clearTimeout(timeout);
            animatedX.stopAnimation();
            animatedY.stopAnimation();
            animatedOpacity.stopAnimation();
        };
    }, []);

    return (
        <View style={styles.wrapper}>

            <View style={styles.board}>

                {board.map((row, r) =>
                    row.map((piece, c) => {

                        const isDark = (r + c) % 2 === 1;

                        const isMoving =
                            movingPiece?.to ===
                            files[c] + (8 - r);

                        return (
                            <View
                                key={`${r}-${c}`}
                                style={[
                                    styles.square,
                                    {
                                        backgroundColor: isDark
                                            ? "#b58863"
                                            : "#e7d5b7",
                                    },
                                ]}
                            >
                                {piece && !isMoving && (
                                    <Image
                                        source={piecesImages[piece]}
                                        style={styles.piece}
                                    />
                                )}
                            </View>
                        );
                    })
                )}

                {movingPiece && (
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.movingPiece,
                            {
                                opacity: animatedOpacity,
                                transform: [
                                    { translateX: animatedX },
                                    { translateY: animatedY },
                                ],
                            },
                        ]}
                    >
                        <Image
                            source={
                                piecesImages[movingPiece.piece]
                            }
                            style={styles.piece}
                        />
                    </Animated.View>
                )}

            </View>

            <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />

                <Text style={styles.liveText}>
                    Partie läuft
                </Text>
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        alignItems: "center",
        marginTop: 28,
    },

    board: {
        width: 300,
        height: 300,

        flexDirection: "row",
        flexWrap: "wrap",

        borderWidth: 2,
        borderColor: "#d4af37",

        borderRadius: 8,
        overflow: "hidden",

        position: "relative",

        elevation: 8,

        shadowOpacity: 0.25,
        shadowRadius: 12,

        shadowOffset: {
            width: 0,
            height: 6,
        },
    },

    square: {
        width: "12.5%",
        height: "12.5%",

        alignItems: "center",
        justifyContent: "center",
    },

    piece: {
        width: "88%",
        height: "88%",
        resizeMode: "contain",
    },

    movingPiece: {
        position: "absolute",

        width: 37.5,
        height: 37.5,

        alignItems: "center",
        justifyContent: "center",

        zIndex: 10,
    },

    liveIndicator: {
        flexDirection: "row",
        alignItems: "center",

        marginTop: 12,
    },

    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 4,

        backgroundColor: "#22c55e",

        marginRight: 7,
    },

    liveText: {
        color: "#94a3b8",
        fontSize: 12,
        fontWeight: "600",
    },
});