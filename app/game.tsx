// app/game.tsx
import { Chess } from "chess.js";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Dimensions,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    answerDraw,
    offerDraw,
    onDrawOffer,
    onGameOver,
    resignGame,
} from "../lib/gameSocket";
import { getSocket } from "../lib/socket";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const BOARD_SIZE = Dimensions.get("window").width - 32;
const SQUARE_SIZE = BOARD_SIZE / 8;

const pieces: Record<string, any> = {
    wp: require("../assets/images/pawn_white.png"),
    wr: require("../assets/images/rook_white.png"),
    wn: require("../assets/images/knight_white.png"),
    wb: require("../assets/images/bishop_white.png"),
    wq: require("../assets/images/queen_white.png"),
    wk: require("../assets/images/king_white.png"),
    bp: require("../assets/images/pawn_black.png"),
    br: require("../assets/images/rook_black.png"),
    bn: require("../assets/images/knight_black.png"),
    bb: require("../assets/images/bishop_black.png"),
    bq: require("../assets/images/queen_black.png"),
    bk: require("../assets/images/king_black.png"),
};

const toSquare = (row: number, col: number) => `${FILES[col]}${8 - row}`;

const pieceToKey = (piece: any) => {
    if (!piece) return null;
    return `${piece.color}${piece.type}`;
};

export default function GameScreen() {
    const router = useRouter();
    const { roomId, white, black } = useLocalSearchParams();
    const socket = getSocket();

    const [game, setGame] = useState(new Chess());
    const [selected, setSelected] = useState<string | null>(null);
    const [legalMoves, setLegalMoves] = useState<any[]>([]);
    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [gameEnded, setGameEnded] = useState(false);
    const [endMessage, setEndMessage] = useState<string | null>(null);

    const scrollRef = useRef<ScrollView>(null);

    if (!socket.id) return null;

    const myColor =
        socket.id === white ? "w" :
            socket.id === black ? "b" :
                null;

    if (!myColor) {
        return (
            <View style={styles.center}>
                <Text>Du bist kein Spieler</Text>
            </View>
        );
    }

    const displayBoard = myColor === "w" ? game.board() : [...game.board()].reverse();

    // =============================
    // Gegnerzug
    // =============================
    useEffect(() => {
        const handleOpponentMove = ({ from, to }: any) => {
            setGame(prev => {
                const newGame = new Chess(prev.fen());
                const move = newGame.move({ from, to });
                if (!move) return prev;

                setMoveHistory(h => [...h, move.san]);
                setLastMove({ from: move.from, to: move.to });
                checkGameState(newGame);
                return newGame;
            });
        };

        socket.on("opponent_move", handleOpponentMove);

        return () => {
            socket.off("opponent_move", handleOpponentMove);
        };
    }, [socket]);

    // =============================
    // Remis bekommen
    // =============================

    useEffect(() => {
        const unsub = onDrawOffer(() => {
            Alert.alert(
                "Remis angeboten",
                "Dein Gegner möchte Remis.",
                [
                    { text: "Ablehnen", onPress: () => answerDraw(roomId as string, false) },
                    { text: "Annehmen", onPress: () => answerDraw(roomId as string, true) },
                ]
            );
        });

        return unsub;
    }, [roomId]);

    // Spiel vorbei
    useEffect(() => {
        const unsub = onGameOver((data) => {
            setGameEnded(true);

            if (data.type === "resign") {
                const winner = data.winner === socket.id ? "Du hast gewonnen " : "Gegner gewinnt ";
                setEndMessage(winner);
            }

            if (data.type === "draw") {
                setEndMessage("Remis - Unentschieden  ");
            }
        });

        return unsub;
    }, [socket]);

    useEffect(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
    }, [moveHistory]);

    const checkGameState = (g: Chess) => {
        if (g.isCheckmate()) {
            const winner = g.turn() === "w" ? "Schwarz" : "Weiß";
            Alert.alert("Schachmatt", `${winner} gewinnt`);
        }
        if (g.isStalemate()) Alert.alert("Patt");
        if (g.isDraw()) Alert.alert("Remis");
    };

    // =============================
    // UI
    // =============================
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
            <View style={styles.wrapper}>
                {gameEnded && endMessage && (
                    <View style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.8)",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 10,
                    }}>
                        <Text style={{ color: "#fff", fontSize: 22, marginBottom: 20, textAlign: "center" }}>
                            {endMessage}
                        </Text>
                        <Pressable
                            onPress={() => router.replace("/")}
                            style={{
                                paddingHorizontal: 20,
                                paddingVertical: 10,
                                backgroundColor: "#2d7ea4",
                                borderRadius: 8,
                            }}
                        >
                            <Text style={{ color: "#fff", fontSize: 16 }}>Zurück zur Lobby </Text>
                        </Pressable>
                    </View>
                )}
                <View style={{ width: BOARD_SIZE }}>

                    {/* Zugleiste */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.moveBar}
                        contentContainerStyle={styles.moveBarContent}
                        ref={scrollRef}
                    >
                        {moveHistory.reduce((rows: any[], move, index) => {
                            if (index % 2 === 0) {
                                rows.push({ moveNumber: index / 2 + 1, white: move, black: "" });
                            } else {
                                rows[rows.length - 1].black = move;
                            }
                            return rows;
                        }, []).map((row, index) => (
                            <Text key={index} style={styles.moveChip}>
                                {row.moveNumber}. {row.white} {row.black}
                            </Text>
                        ))}
                    </ScrollView>


                    {/* BOARD */}
                    <View style={styles.board}>
                        {displayBoard.map((row, displayRow) => {
                            const realRow = myColor === "w" ? displayRow : 7 - displayRow;

                            return row.map((piece, col) => {
                                const square = toSquare(realRow, col);
                                const isDark = (realRow + col) % 2 === 1;

                                const legal = legalMoves.find(m => m.to === square);
                                const isCapture = !!legal?.captured;

                                const isLastFrom = lastMove?.from === square;
                                const isLastTo = lastMove?.to === square;
                                const pieceKey = pieceToKey(piece);

                                return (
                                    <Pressable
                                        key={square}
                                        disabled={gameEnded}
                                        onPress={() => {
                                            if (game.turn() !== myColor) return;

                                            if (piece && !legal) {
                                                setSelected(square);
                                                setLegalMoves(game.moves({ square: square as any, verbose: true }));
                                                return;
                                            }

                                            if (selected && legal) {
                                                const newGame = new Chess(game.fen());
                                                const move = newGame.move({ from: selected, to: square });
                                                if (!move) return;

                                                setGame(newGame);
                                                setMoveHistory(h => [...h, move.san]);
                                                setLastMove({ from: move.from, to: move.to });
                                                setSelected(null);
                                                setLegalMoves([]);

                                                checkGameState(newGame);

                                                socket.emit("player_move", {
                                                    roomId,
                                                    move: { from: move.from, to: move.to },
                                                });
                                            }
                                        }}
                                        style={[
                                            styles.square,
                                            {
                                                backgroundColor: isLastTo || isLastFrom
                                                    ? "#2d7ea4"
                                                    : isDark ? "#334155" : "#e5e7eb",
                                                borderWidth: selected === square ? 2 : 0,
                                                borderColor: "#ac442c",
                                            },
                                        ]}
                                    >
                                        {pieceKey && (
                                            <Image source={pieces[pieceKey]} style={styles.piece} />
                                        )}

                                        {legal && !isCapture && <View style={styles.moveDot} />}
                                        {legal && isCapture && <View style={styles.captureRing} />}
                                    </Pressable>
                                );
                            });
                        })}
                    </View>

                    {/* Bottom */}
                    <View style={styles.bottomBar}>
                        <Pressable
                            disabled={gameEnded}
                            onPress={() =>
                                Alert.alert(
                                    "Aufgeben?",
                                    "Möchtest du wirklich aufgeben?",
                                    [
                                        { text: "Nein", style: "cancel" },
                                        { text: "Ja", onPress: () => resignGame(roomId as string) },
                                    ]
                                )
                            }
                        >
                            <Text style={styles.bottomBtn}>Aufgeben </Text>
                        </Pressable>

                        <Pressable
                            disabled={gameEnded}
                            onPress={() => {
                                offerDraw(roomId as string);
                                Alert.alert("Remis angeboten");
                            }}
                        >
                            <Text style={styles.bottomBtn}>Remis </Text>
                        </Pressable>


                    </View>

                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1, justifyContent: "center", alignItems: "center" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    board: {
        width: BOARD_SIZE,
        height: BOARD_SIZE,
        flexDirection: "row",
        flexWrap: "wrap",
        alignSelf: "center",
    },
    square: {
        width: SQUARE_SIZE,
        height: SQUARE_SIZE,
        justifyContent: "center",
        alignItems: "center",
    },
    piece: {
        width: SQUARE_SIZE * 0.9,
        height: SQUARE_SIZE * 0.9,
        resizeMode: "contain",
    },
    moveDot: {
        position: "absolute",
        width: SQUARE_SIZE * 0.25,
        height: SQUARE_SIZE * 0.25,
        borderRadius: 100,
        backgroundColor: "rgba(0,0,0,0.3)",
    },
    captureRing: {
        position: "absolute",
        width: SQUARE_SIZE * 0.9,
        height: SQUARE_SIZE * 0.9,
        borderRadius: 100,
        borderWidth: 3,
        borderColor: "rgba(0,0,0,0.35)",
    },
    moveBar: { maxHeight: 40, marginBottom: 12 },
    moveBarContent: { paddingHorizontal: 12, alignItems: "center" },
    moveChip: {
        marginRight: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: "#f6f6f6",
        fontSize: 13,
    },
    bottomBar: {
        marginTop: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: "#fff",
    },
    bottomBtn: { color: "#f6f6f6" },

});