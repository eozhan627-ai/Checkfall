import AsyncStorage from "@react-native-async-storage/async-storage";
import { Chess } from "chess.js";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    ImageBackground,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Board from "./components/Board";

const pieces: Record<string, any> = {
    wp: require("../../assets/images/pawn_white.png"),
    wr: require("../../assets/images/rook_white.png"),
    wn: require("../../assets/images/knight_white.png"),
    wb: require("../../assets/images/bishop_white.png"),
    wq: require("../../assets/images/queen_white.png"),
    wk: require("../../assets/images/king_white.png"),

    bp: require("../../assets/images/pawn_black.png"),
    br: require("../../assets/images/rook_black.png"),
    bn: require("../../assets/images/knight_black.png"),
    bb: require("../../assets/images/bishop_black.png"),
    bq: require("../../assets/images/queen_black.png"),
    bk: require("../../assets/images/king_black.png"),
};

const pieceToKey = (piece: any) => {
    if (!piece) return null;
    return `${piece.color}${piece.type}`;
};

type MoveData = {
    from: string;
    to: string;
    promotion?: string;
};

type SavedGameData = {
    fen: string;
    history: MoveData[];
    bottomColor?: "w" | "b";
    mode?: "local";
    timestamp?: number;
};

export default function LocalGame() {
    const params = useLocalSearchParams();

    const savedData: SavedGameData | null = params.savedData
        ? JSON.parse(params.savedData as string)
        : null;

    // =========================================================
    // GAME
    // =========================================================

    const [game, setGame] = useState<Chess>(() => new Chess());

    // =========================================================
    // BOARD STATE
    // =========================================================

    const [selectedSquare, setSelectedSquare] =
        useState<string | null>(null);

    const [legalMoves, setLegalMoves] =
        useState<any[]>([]);

    const [lastMove, setLastMove] =
        useState<{
            from: string;
            to: string;
        } | null>(null);

    const [checkmateSquare, setCheckmateSquare] =
        useState<string | null>(null);

    // =========================================================
    // MOVE HISTORY
    // =========================================================

    const [moveHistory, setMoveHistory] =
        useState<string[]>([]);

    const moveStack =
        useRef<MoveData[]>([]);

    const [moveIndex, setMoveIndex] =
        useState(0);

    // =========================================================
    // GAME FINISHED
    // =========================================================

    const gameFinished =
        useRef(false);

    // =========================================================
    // MOVE BAR
    // =========================================================

    const scrollRef =
        useRef<ScrollView>(null);

    // =========================================================
    // BACKGROUND
    // =========================================================

    const backgroundImage =
        require("../../assets/images/onlinebackground.png");

    // =========================================================
    // BOARD / PERSPECTIVE
    // =========================================================

    /*
     * Im Local Game dreht sich das Brett nach jedem Zug.
     *
     * Weiß am Zug  -> Weiß unten
     * Schwarz am Zug -> Schwarz unten
     *
     * Board bekommt deshalb ein bereits entsprechend
     * ausgerichtetes board + myColor.
     */

    const currentColor: "w" | "b" =
        game.turn();

    const myColor: "w" | "b" =
        currentColor;

    const rawBoard =
        game.board();

    const board =
        myColor === "w"
            ? rawBoard
            : [...rawBoard]
                .reverse()
                .map((row) => [...row].reverse());

    // =========================================================
    // KING SQUARE
    // =========================================================

    const getKingSquare = (
        currentGame: Chess,
        color: "w" | "b"
    ) => {
        const currentBoard =
            currentGame.board();

        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece =
                    currentBoard[rank][file];

                if (
                    piece &&
                    piece.type === "k" &&
                    piece.color === color
                ) {
                    return (
                        String.fromCharCode(97 + file) +
                        (8 - rank)
                    );
                }
            }
        }

        return null;
    };

    // =========================================================
    // GAME HISTORY
    // =========================================================

    const saveGameToHistory = async (
        mode: "local",
        result:
            | "win"
            | "loss"
            | "draw"
            | "aborted",
        timestamp?: number
    ) => {
        try {
            const key = "game_history";

            const stored =
                await AsyncStorage.getItem(key);

            const history =
                stored
                    ? JSON.parse(stored)
                    : [];

            const time =
                timestamp ?? Date.now();

            history.unshift({
                id: Date.now().toString(),
                mode,
                result,
                timestamp: time,
                date:
                    new Date(time).toLocaleString(),
            });

            await AsyncStorage.setItem(
                key,
                JSON.stringify(history)
            );
        } catch (error) {
            console.log(
                "Fehler beim Speichern des Spielverlaufs:",
                error
            );
        }
    };

    // =========================================================
    // CHECK GAME END
    // =========================================================

    const checkGameEndLocal = (
        currentGame: Chess
    ) => {
        if (gameFinished.current) {
            return true;
        }

        // -------------------------
        // CHECKMATE
        // -------------------------

        if (currentGame.isCheckmate()) {
            gameFinished.current = true;

            const loser =
                currentGame.turn();

            const winner =
                loser === "w"
                    ? "b"
                    : "w";

            const kingSquare =
                getKingSquare(
                    currentGame,
                    loser
                );

            setCheckmateSquare(
                kingSquare
            );

            /*
             * Local ist kein "Human vs Bot".
             * Für die lokale Statistik bleibt Weiß
             * weiterhin die Referenz für win/loss.
             */

            const result =
                winner === "w"
                    ? "win"
                    : "loss";

            saveGameToHistory(
                "local",
                result
            );

            setTimeout(() => {
                Alert.alert(
                    "Checkmate",
                    winner === "w"
                        ? "White has won"
                        : "Black has won"
                );
            }, 800);

            return true;
        }

        // -------------------------
        // STALEMATE
        // -------------------------

        if (currentGame.isStalemate()) {
            gameFinished.current = true;

            saveGameToHistory(
                "local",
                "draw"
            );

            setTimeout(() => {
                Alert.alert(
                    "Stalemate",
                    "No legal moves left – Draw"
                );
            }, 800);

            return true;
        }

        // -------------------------
        // THREEFOLD
        // -------------------------

        if (
            currentGame.isThreefoldRepetition()
        ) {
            gameFinished.current = true;

            saveGameToHistory(
                "local",
                "draw"
            );

            setTimeout(() => {
                Alert.alert(
                    "Remis",
                    "Triple repetition – Draw"
                );
            }, 800);

            return true;
        }

        // -------------------------
        // INSUFFICIENT MATERIAL
        // -------------------------

        if (
            currentGame.isInsufficientMaterial()
        ) {
            gameFinished.current = true;

            saveGameToHistory(
                "local",
                "draw"
            );

            setTimeout(() => {
                Alert.alert(
                    "Remis",
                    "Insufficient material for checkmate"
                );
            }, 800);

            return true;
        }

        // -------------------------
        // GENERAL DRAW
        // -------------------------

        if (currentGame.isDraw()) {
            gameFinished.current = true;

            saveGameToHistory(
                "local",
                "draw"
            );

            setTimeout(() => {
                Alert.alert(
                    "Remis",
                    "50-Züge-Regel oder allgemeines Remis"
                );
            }, 800);

            return true;
        }

        return false;
    };

    // =========================================================
    // LOAD SAVED GAME
    // =========================================================

    useEffect(() => {
        if (!savedData) {
            return;
        }

        try {
            const loadedGame =
                new Chess(
                    savedData.fen
                );

            const history =
                savedData.history ?? [];

            setGame(
                loadedGame
            );

            setMoveHistory(
                loadedGame.history()
            );

            moveStack.current =
                history.map(
                    (move: any) => ({
                        from: move.from,
                        to: move.to,
                        promotion:
                            move.promotion,
                    })
                );

            setMoveIndex(
                moveStack.current.length
            );

            const verboseHistory =
                loadedGame.history({
                    verbose: true,
                });

            if (
                verboseHistory.length > 0
            ) {
                const last =
                    verboseHistory[
                        verboseHistory.length - 1
                    ];

                setLastMove({
                    from: last.from,
                    to: last.to,
                });
            } else {
                setLastMove(null);
            }

            setSelectedSquare(null);
            setLegalMoves([]);
            setCheckmateSquare(null);

            gameFinished.current =
                false;
        } catch (error) {
            console.log(
                "Fehler beim Laden des Spiels:",
                error
            );
        }
    }, []);

    // =========================================================
    // AUTO SCROLL MOVE HISTORY
    // =========================================================

    useEffect(() => {
        scrollRef.current?.scrollToEnd({
            animated: true,
        });
    }, [moveHistory]);

    // =========================================================
    // RESET
    // =========================================================

    const resetGame = () => {
        const freshGame =
            new Chess();

        setGame(
            freshGame
        );

        setSelectedSquare(null);
        setLegalMoves([]);
        setMoveHistory([]);
        setLastMove(null);
        setCheckmateSquare(null);

        moveStack.current = [];

        setMoveIndex(0);

        gameFinished.current =
            false;
    };

    // =========================================================
    // RESTART
    // =========================================================

    const restartGame = () => {
        Alert.alert(
            "Restart game?",
            "Your progress will be lost.",
            [
                {
                    text: "No",
                    style: "cancel",
                },
                {
                    text: "Yes",
                    onPress: async () => {
                        if (
                            moveHistory.length > 0
                        ) {
                            await saveGameToHistory(
                                "local",
                                "aborted"
                            );
                        }

                        resetGame();
                    },
                },
            ]
        );
    };

    // =========================================================
    // SAVE
    // =========================================================

    const saveGame = async () => {
        try {
            const timestamp =
                Date.now();

            const key =
                `@saved_game_${timestamp}`;

            await AsyncStorage.setItem(
                key,
                JSON.stringify({
                    fen: game.fen(),

                    history:
                        game.history({
                            verbose: true,
                        }),

                    bottomColor:
                        currentColor,

                    mode: "local",

                    timestamp,
                })
            );

            await saveGameToHistory(
                "local",
                "aborted",
                timestamp
            );

            Alert.alert(
                "Game saved",
                "You can continue it under „Saved Games“."
            );
        } catch (error) {
            console.log(
                "SaveGame Error:",
                error
            );

            Alert.alert(
                "Error",
                "The game could not be saved."
            );
        }
    };

    // =========================================================
    // UNDO
    // =========================================================

    const undoMove = () => {
        if (moveIndex <= 0) {
            return;
        }

        const newIndex =
            moveIndex - 1;

        const newGame =
            new Chess();

        try {
            for (
                let i = 0;
                i < newIndex;
                i++
            ) {
                newGame.move(
                    moveStack.current[i]
                );
            }
        } catch (error) {
            console.log(
                "Undo Error:",
                error
            );

            return;
        }

        setGame(
            newGame
        );

        setMoveIndex(
            newIndex
        );

        setMoveHistory(
            newGame.history()
        );

        if (newIndex > 0) {
            const last =
                moveStack.current[
                    newIndex - 1
                ];

            setLastMove({
                from: last.from,
                to: last.to,
            });
        } else {
            setLastMove(null);
        }

        setSelectedSquare(null);
        setLegalMoves([]);
        setCheckmateSquare(null);

        gameFinished.current =
            false;
    };

    // =========================================================
    // REDO
    // =========================================================

    const redoMove = () => {
        if (
            moveIndex >=
            moveStack.current.length
        ) {
            return;
        }

        const newIndex =
            moveIndex + 1;

        const newGame =
            new Chess();

        try {
            for (
                let i = 0;
                i < newIndex;
                i++
            ) {
                newGame.move(
                    moveStack.current[i]
                );
            }
        } catch (error) {
            console.log(
                "Redo Error:",
                error
            );

            return;
        }

        setGame(
            newGame
        );

        setMoveIndex(
            newIndex
        );

        setMoveHistory(
            newGame.history()
        );

        const last =
            moveStack.current[
                newIndex - 1
            ];

        setLastMove({
            from: last.from,
            to: last.to,
        });

        setSelectedSquare(null);
        setLegalMoves([]);
        setCheckmateSquare(null);

        gameFinished.current =
            false;

        checkGameEndLocal(
            newGame
        );
    };

    // =========================================================
    // MAKE MOVE
    // =========================================================

    const makeMove = (
        from: string,
        to: string,
        promotion?: "q" | "r" | "b" | "n"
    ) => {
        if (
            gameFinished.current
        ) {
            return;
        }

        const newGame =
            new Chess(
                game.fen()
            );

        let move;

        try {
            move =
                newGame.move({
                    from: from as any,
                    to: to as any,

                    ...(promotion
                        ? { promotion }
                        : {}),
                });
        } catch (error) {
            console.log(
                "Move Error:",
                error
            );

            return;
        }

        if (!move) {
            return;
        }

        // =====================================================
        // NACH UNDO/REDO ZUKUNFT ABSCHNEIDEN
        // =====================================================

        const newStack =
            moveStack.current.slice(
                0,
                moveIndex
            );

        newStack.push({
            from: move.from,
            to: move.to,
            promotion:
                move.promotion,
        });

        moveStack.current =
            newStack;

        setMoveIndex(
            newStack.length
        );

        setGame(
            newGame
        );

        setMoveHistory(
            newGame.history()
        );

        setLastMove({
            from: move.from,
            to: move.to,
        });

        setSelectedSquare(null);
        setLegalMoves([]);

        checkGameEndLocal(
            newGame
        );
    };

    // =========================================================
    // PROMOTION
    // =========================================================

    const showPromotion = (
        from: string,
        to: string
    ) => {
        Alert.alert(
            "Promote pawn",
            "Choose a piece:",
            [
                {
                    text: "Queen",
                    onPress: () =>
                        makeMove(
                            from,
                            to,
                            "q"
                        ),
                },
                {
                    text: "Rook",
                    onPress: () =>
                        makeMove(
                            from,
                            to,
                            "r"
                        ),
                },
                {
                    text: "Bishop",
                    onPress: () =>
                        makeMove(
                            from,
                            to,
                            "b"
                        ),
                },
                {
                    text: "Knight",
                    onPress: () =>
                        makeMove(
                            from,
                            to,
                            "n"
                        ),
                },
            ]
        );
    };

    // =========================================================
    // SQUARE PRESS
    // =========================================================

    const onPressSquare = (
        square: string
    ) => {
        if (
            gameFinished.current
        ) {
            return;
        }

        /*
         * WICHTIG:
         *
         * Kein humanColor mehr.
         *
         * Local Game:
         * Weiß darf ziehen, wenn Weiß am Zug ist.
         * Schwarz darf ziehen, wenn Schwarz am Zug ist.
         */

        const piece =
            game.get(
                square as any
            );

        // =====================================================
        // KEINE FIGUR AUSGEWÄHLT
        // =====================================================

        if (!selectedSquare) {
            if (!piece) {
                return;
            }

            // Nur die Farbe, die gerade am Zug ist.
            if (
                piece.color !== game.turn()
            ) {
                return;
            }

            const moves =
                game.moves({
                    square:
                        square as any,

                    verbose: true,
                });

            if (
                moves.length === 0
            ) {
                return;
            }

            setSelectedSquare(
                square
            );

            setLegalMoves(
                moves
            );

            return;
        }

        // =====================================================
        // EIGENE FIGUR ANKLICKEN
        // =====================================================

        if (
            piece &&
            piece.color === game.turn()
        ) {
            const moves =
                game.moves({
                    square:
                        square as any,

                    verbose: true,
                });

            if (
                moves.length === 0
            ) {
                setSelectedSquare(
                    null
                );

                setLegalMoves(
                    []
                );

                return;
            }

            setSelectedSquare(
                square
            );

            setLegalMoves(
                moves
            );

            return;
        }

        // =====================================================
        // LEGAL MOVE
        // =====================================================

        const legalMove =
            legalMoves.find(
                (move) =>
                    move.to === square
            );

        if (!legalMove) {
            setSelectedSquare(
                null
            );

            setLegalMoves(
                []
            );

            return;
        }

        // =====================================================
        // PROMOTION
        // =====================================================

        if (
            legalMove.piece === "p" &&
            (
                square[1] === "8" ||
                square[1] === "1"
            )
        ) {
            showPromotion(
                selectedSquare,
                square
            );

            return;
        }

        // =====================================================
        // NORMAL MOVE
        // =====================================================

        makeMove(
            selectedSquare,
            square
        );
    };

    // =========================================================
    // CHECK STATUS
    // =========================================================

    const isCheck =
        game.isCheck();

    const isCheckmate =
        game.isCheckmate();

    const isStalemate =
        game.isStalemate();

    const isDraw =
        game.isDraw();

    let checkSquare:
        string | null = null;

    if (isCheck) {
        checkSquare =
            getKingSquare(
                game,
                game.turn()
            );
    }

    // =========================================================
    // MOVE ROWS
    // =========================================================

    const moveRows =
        moveHistory.reduce(
            (
                rows: any[],
                move,
                index
            ) => {
                if (
                    index % 2 === 0
                ) {
                    rows.push({
                        moveNumber:
                            index / 2 + 1,

                        white: move,

                        black: "",
                    });
                } else {
                    rows[
                        rows.length - 1
                    ].black = move;
                }

                return rows;
            },
            []
        );

    // =========================================================
    // UI
    // =========================================================

    return (
        <ImageBackground
            source={
                backgroundImage
            }
            style={
                styles.background
            }
            resizeMode="cover"
        >
            <SafeAreaView
                style={
                    styles.safeArea
                }
                edges={[
                    "top",
                    "left",
                    "right",
                ]}
            >
                <View
                    style={
                        styles.container
                    }
                >

                    {/* ========================================= */}
                    {/* HEADER */}
                    {/* ========================================= */}

                    <View
                        style={
                            styles.header
                        }
                    >
                        <Pressable
                            onPress={() =>
                                router.back()
                            }
                            style={
                                styles.backButton
                            }
                        >
                            <Text
                                style={
                                    styles.backText
                                }
                            >
                                ‹
                            </Text>
                        </Pressable>

                        <Text
                            style={
                                styles.headerTitle
                            }
                        >
                            LOCAL GAME
                        </Text>

                        {/* Symmetrie rechts */}
                        <View
                            style={
                                styles.headerSpacer
                            }
                        />
                    </View>

                    {/* ========================================= */}
                    {/* MOVE HISTORY */}
                    {/* ========================================= */}

                    <View
                        style={
                            styles.moveHistoryWrapper
                        }
                    >
                        <ScrollView
                            ref={
                                scrollRef
                            }
                            horizontal
                            showsHorizontalScrollIndicator={
                                false
                            }
                            contentContainerStyle={
                                styles.moveHistoryContent
                            }
                        >
                            {moveRows.map(
                                (
                                    row,
                                    index
                                ) => (
                                    <Text
                                        key={
                                            index
                                        }
                                        style={
                                            styles.moveChip
                                        }
                                    >
                                        {
                                            row.moveNumber
                                        }
                                        .{" "}
                                        {
                                            row.white
                                        }{" "}
                                        {
                                            row.black
                                        }
                                    </Text>
                                )
                            )}
                        </ScrollView>
                    </View>

                    {/* ========================================= */}
                    {/* COMMON BOARD COMPONENT */}
                    {/* ========================================= */}

                    <Board
                        board={
                            board
                        }

                        selectedSquare={
                            selectedSquare
                        }

                        legalMoves={
                            legalMoves
                        }

                        lastMove={
                            lastMove
                        }

                        checkSquare={
                            checkSquare
                        }

                        onPressSquare={
                            onPressSquare
                        }

                        pieces={
                            pieces
                        }

                        pieceToKey={
                            pieceToKey
                        }

                        myColor={
                            myColor
                        }

                        mode="local"

                        isCheck={
                            isCheck
                        }

                        isCheckmate={
                            isCheckmate
                        }

                        isStalemate={
                            isStalemate
                        }

                        isDraw={
                            isDraw
                        }

                        onUndo={
                            undoMove
                        }

                        onRedo={
                            redoMove
                        }

                        onSave={
                            saveGame
                        }

                        onRestart={
                            restartGame
                        }
                    />

                    {/* ========================================= */}
                    {/* LOCAL GAME INFO */}
                    {/* ========================================= */}

                    <View
                        style={
                            styles.turnContainer
                        }
                    >
                        <Text
                            style={
                                styles.turnLabel
                            }
                        >
                            AM ZUG
                        </Text>

                        <Text
                            style={
                                styles.turnText
                            }
                        >
                            {currentColor === "w"
                                ? "WEISS"
                                : "SCHWARZ"}
                        </Text>
                    </View>

                    {/* ========================================= */}
                    {/* ACTION BUTTONS */}
                    {/* ========================================= */}

                    <View
                        style={
                            styles.actionsRow
                        }
                    >
                        <Pressable
                            onPress={
                                undoMove
                            }
                            style={
                                styles.actionButton
                            }
                        >
                            <Text
                                style={
                                    styles.actionText
                                }
                            >
                                Undo
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={
                                redoMove
                            }
                            style={
                                styles.actionButton
                            }
                        >
                            <Text
                                style={
                                    styles.actionText
                                }
                            >
                                Redo
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={
                                saveGame
                            }
                            style={
                                styles.actionButton
                            }
                        >
                            <Text
                                style={
                                    styles.actionText
                                }
                            >
                                Save
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={
                                restartGame
                            }
                            style={
                                styles.actionButton
                            }
                        >
                            <Text
                                style={
                                    styles.actionText
                                }
                            >
                                Restart
                            </Text>
                        </Pressable>
                    </View>

                </View>
            </SafeAreaView>
        </ImageBackground>
    );
}

// =============================================================
// STYLES
// =============================================================

const styles = StyleSheet.create({
    background: {
        flex: 1,
    },

    safeArea: {
        flex: 1,
        backgroundColor:
            "transparent",
    },

    container: {
        flex: 1,
        width: "100%",
        alignItems: "center",
        paddingTop: 0,
    },

    // =========================================================
    // HEADER
    // =========================================================

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

        backgroundColor:
            "rgba(255,255,255,0.07)",

        justifyContent: "center",
        alignItems: "center",
    },

    backText: {
        color: "#fff",
        fontSize: 34,
        lineHeight: 34,
        fontWeight: "300",
    },

    headerTitle: {
        color: "#D4AF37",
        fontSize: 13,
        fontWeight: "800",
        letterSpacing: 3,
    },

    headerSpacer: {
        width: 42,
        height: 42,
    },

    // =========================================================
    // MOVE HISTORY
    // =========================================================

    moveHistoryWrapper: {
        width: "92%",
        height: 40,
        marginBottom: 4,
    },

    moveHistoryContent: {
        alignItems: "center",
        paddingHorizontal: 4,
    },

    moveChip: {
        marginRight: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,

        backgroundColor:
            "#f6f6f6",

        color: "#111827",
        fontSize: 13,
    },

    // =========================================================
    // TURN
    // =========================================================

    turnContainer: {
        alignItems: "center",
        marginTop: 10,
    },

    turnLabel: {
        color: "#777",
        fontSize: 9,
        fontWeight: "800",
        letterSpacing: 2,
    },

    turnText: {
        color: "#D4AF37",
        fontSize: 13,
        fontWeight: "800",
        letterSpacing: 2,
        marginTop: 2,
    },

    // =========================================================
    // ACTIONS
    // =========================================================

    actionsRow: {
        width: "92%",
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 12,
    },

    actionButton: {
        minWidth: 70,
        height: 38,

        paddingHorizontal: 10,

        borderRadius: 12,

        backgroundColor:
            "rgba(255,255,255,0.07)",

        borderWidth: 1,
        borderColor:
            "rgba(255,255,255,0.08)",

        justifyContent: "center",
        alignItems: "center",
    },

    actionText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "600",
    },
});