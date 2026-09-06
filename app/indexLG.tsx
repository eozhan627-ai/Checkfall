import { Chess } from "chess.js";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ImageBackground,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import Board from "./game/components/Board";
import { pieces } from "./game/constants/pieces";

type Move = {
    from: string;
    to: string;
};

export default function IndexLG() {
    const params = useLocalSearchParams();

    const [game, setGame] = useState(() => new Chess());

    const [selectedSquare, setSelectedSquare] =
        useState<string | null>(null);

    const [legalMoves, setLegalMoves] =
        useState<{ to: string }[]>([]);

    const [lastMove, setLastMove] =
        useState<Move | null>(null);

    const [moveHistory, setMoveHistory] =
        useState<string[]>([]);

    const [endState, setEndState] = useState<null | {
        type: "win" | "draw";
        winner?: "Weiß" | "Schwarz";
        loser?: "Weiß" | "Schwarz";
        reason: "checkmate" | "draw";
    }>(null);

    // Wichtig:
    // Perspektive des gespeicherten Spiels
    const [bottomColor, setBottomColor] =
        useState<"w" | "b">("w");

    const backgroundImage =
        require("./../assets/images/onlinebackground.png");

    /*
    ============================================================
    SAVED GAME LADEN
    ============================================================
    */

    useEffect(() => {
        if (!params.savedData) return;

        try {
            const saved = JSON.parse(
                params.savedData as string
            );

            console.log("Loading saved game:", saved);

            // Gespeichertes FEN laden
            const loadedGame = new Chess(saved.fen);

            setGame(loadedGame);

            // Gespeicherte Züge laden
            if (saved.history) {
                setMoveHistory(
                    saved.history.map((move: any) =>
                        typeof move === "string"
                            ? move
                            : move.san
                    )
                );
            }

            // Gespeicherte Perspektive laden
            if (
                saved.bottomColor === "w" ||
                saved.bottomColor === "b"
            ) {
                setBottomColor(saved.bottomColor);
            }

            /*
             * Letzten Zug wiederherstellen.
             * Dadurch bleibt das letzte Feld markiert.
             */
            if (
                saved.history &&
                saved.history.length > 0
            ) {
                const last =
                    saved.history[saved.history.length - 1];

                if (last?.from && last?.to) {
                    setLastMove({
                        from: last.from,
                        to: last.to,
                    });
                }
            }
        } catch (error) {
            console.log(
                "Error loading saved game:",
                error
            );
        }
    }, [params.savedData]);

    /*
    ============================================================
    BOARD
    ============================================================
    */

    const rawBoard = game.board();

    const board = useMemo(() => {
        if (bottomColor === "w") {
            return rawBoard;
        }

        return [...rawBoard]
            .reverse()
            .map(row => [...row].reverse());
    }, [rawBoard, bottomColor]);

    /*
    ============================================================
    GAME STATUS
    ============================================================
    */

    const isCheck = game.inCheck();
    const isCheckmate = game.isCheckmate();
    const isStalemate = game.isStalemate();
    const isDraw = game.isDraw();

    function findKingSquare(color: "w" | "b") {
        const files = [
            "a",
            "b",
            "c",
            "d",
            "e",
            "f",
            "g",
            "h",
        ];

        const currentBoard = game.board();

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = currentBoard[r][c];

                if (
                    piece &&
                    piece.type === "k" &&
                    piece.color === color
                ) {
                    return files[c] + (8 - r);
                }
            }
        }

        return null;
    }

    const checkSquare = game.inCheck()
        ? findKingSquare(game.turn())
        : null;

    /*
    ============================================================
    MOVE
    ============================================================
    */

    function onSquarePress(square: string) {
        const piece = game.get(square as any);

        // Eigene Figur auswählen
        if (
            piece &&
            piece.color === game.turn()
        ) {
            setSelectedSquare(square);

            const moves = game.moves({
                square: square as any,
                verbose: true,
            });

            setLegalMoves(
                moves.map(move => ({
                    to: move.to,
                }))
            );

            return;
        }

        if (!selectedSquare) return;

        const isLegal = legalMoves.some(
            move => move.to === square
        );

        if (!isLegal) return;

        const newGame = new Chess(
            game.fen()
        );

        const move = newGame.move({
            from: selectedSquare as any,
            to: square as any,
        });

        if (!move) return;

        setGame(newGame);

        setMoveHistory(
            newGame.history()
        );

        setLastMove({
            from: move.from,
            to: move.to,
        });

        setSelectedSquare(null);
        setLegalMoves([]);

        // Perspektive bleibt gleich!
        // Das gespeicherte Spiel soll nicht nach jedem Zug
        // automatisch die Seite wechseln.

        checkGameState(newGame);
    }

    /*
    ============================================================
    GAME END
    ============================================================
    */

    function checkGameState(g: Chess) {
        if (g.isCheckmate()) {
            const winner =
                g.turn() === "w"
                    ? "Schwarz"
                    : "Weiß";

            const loser =
                g.turn() === "w"
                    ? "Weiß"
                    : "Schwarz";

            setEndState({
                type: "win",
                winner,
                loser,
                reason: "checkmate",
            });

            return;
        }

        if (
            g.isStalemate() ||
            g.isDraw()
        ) {
            setEndState({
                type: "draw",
                reason: "draw",
            });
        }
    }

    /*
    ============================================================
    RESET
    ============================================================
    */

    function resetGame() {
        setGame(new Chess());
        setSelectedSquare(null);
        setLegalMoves([]);
        setLastMove(null);
        setMoveHistory([]);
        setEndState(null);
        setBottomColor("w");
    }

    /*
    ============================================================
    RENDER
    ============================================================
    */

    return (
        <ImageBackground
            source={backgroundImage}
            style={styles.container}
        >
            <View style={styles.center}>

                {/* ZUGLEISTE */}

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.moveBar}
                    contentContainerStyle={
                        styles.moveBarContent
                    }
                >
                    {moveHistory
                        .reduce(
                            (
                                rows: any[],
                                move,
                                index
                            ) => {
                                if (index % 2 === 0) {
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
                        )
                        .map(
                            (
                                row: any,
                                index: number
                            ) => (
                                <Text
                                    key={index}
                                    style={
                                        styles.moveChip
                                    }
                                >
                                    {row.moveNumber}.{" "}
                                    {row.white}{" "}
                                    {row.black}
                                </Text>
                            )
                        )}
                </ScrollView>

                {/* ENDSCREEN */}

                {endState && (
                    <Modal
                        transparent
                        animationType="fade"
                    >
                        <View
                            style={
                                styles.overlay
                            }
                        >
                            <View
                                style={
                                    styles.endCard
                                }
                            >
                                {endState.type ===
                                    "win" && (
                                        <>
                                            <Text
                                                style={
                                                    styles.winTitle
                                                }
                                            >
                                                Schachmatt
                                            </Text>

                                            <Text
                                                style={
                                                    styles.subText
                                                }
                                            >
                                                {
                                                    endState.winner
                                                }{" "}
                                                gewinnt!
                                            </Text>

                                            <Text
                                                style={
                                                    styles.subText
                                                }
                                            >
                                                {
                                                    endState.loser
                                                }{" "}
                                                wurde
                                                schachmatt
                                                gesetzt.
                                            </Text>
                                        </>
                                    )}

                                {endState.type ===
                                    "draw" && (
                                        <>
                                            <Text
                                                style={
                                                    styles.drawTitle
                                                }
                                            >
                                                🤝 Remis
                                            </Text>

                                            <Text
                                                style={
                                                    styles.subText
                                                }
                                            >
                                                Die Partie
                                                endet
                                                unentschieden.
                                            </Text>
                                        </>
                                    )}

                                <Pressable
                                    style={
                                        styles.primaryBtn
                                    }
                                    onPress={
                                        resetGame
                                    }
                                >
                                    <Text
                                        style={
                                            styles.btnText
                                        }
                                    >
                                        Neue Partie
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </Modal>
                )}

                {/* SCHACHBRETT */}

                <Board
                    board={board}
                    selectedSquare={
                        selectedSquare
                    }
                    legalMoves={legalMoves}
                    lastMove={lastMove}
                    checkSquare={checkSquare}
                    onPressSquare={
                        onSquarePress
                    }
                    pieces={pieces}
                    pieceToKey={(p: any) =>
                        p
                            ? `${p.color}${p.type}`
                            : null
                    }
                    myColor={bottomColor}
                    mode="local"
                    isCheck={isCheck}
                    isCheckmate={
                        isCheckmate
                    }
                    isStalemate={
                        isStalemate
                    }
                    isDraw={isDraw}
                    onUndo={() => { }}
                    onRedo={() => { }}
                    onSave={() => { }}
                    onRestart={resetGame}
                />

                <Text
                    style={{
                        color: "white",
                        marginTop: 10,
                    }}
                >
                    Moves:{" "}
                    {game
                        .history()
                        .join(" ")}
                </Text>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    center: {
        flex: 1,
        justifyContent: "flex-start",
        alignItems: "center",
        padding: 20,
    },

    moveBar: {
        height: 40,
        marginBottom: 12,
    },

    moveBarContent: {
        paddingHorizontal: 12,
        alignItems: "center",
    },

    moveChip: {
        marginRight: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: "#f6f6f6",
        color: "#111827",
        fontSize: 13,
    },

    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.65)",
        justifyContent: "center",
        alignItems: "center",
    },

    endCard: {
        width: "85%",
        maxWidth: 380,
        backgroundColor: "#111",
        borderRadius: 20,
        padding: 22,
        borderWidth: 1,
        borderColor: "#D4AF37",
        alignItems: "center",
    },

    winTitle: {
        fontSize: 34,
        fontWeight: "900",
        color: "#FFD700",
        marginBottom: 8,
    },

    drawTitle: {
        fontSize: 34,
        fontWeight: "900",
        color: "#aaa",
        marginBottom: 8,
    },

    subText: {
        color: "#ccc",
        marginBottom: 18,
        textAlign: "center",
    },

    primaryBtn: {
        backgroundColor: "#D4AF37",
        padding: 12,
        borderRadius: 12,
        alignItems: "center",
    },

    btnText: {
        color: "#fff",
        fontWeight: "600",
    },
});