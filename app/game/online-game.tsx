import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Chess } from "chess.js";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Dimensions,
    Image,
    ImageBackground,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    calculateElo,
    getCurrentAccount,
    updateAccount,
} from "../../lib/account";
import {
    onDrawOffer,
    onGameOver
} from "../../lib/gameSocket";
import { getSocket } from "../../lib/socket";
import Board from "./components/Board";
import { useChessInput } from "./hooks/useChessInput";
// board.tsx currently exports a component without declared props types
// cast to any to avoid TSX prop type error when passing props
const BoardAny: any = Board;


const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const BOARD_SIZE = Math.min(
    Dimensions.get("window").width * 0.9,
    520
);
const SQUARE_SIZE = BOARD_SIZE / 8;

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

const toSquare = (row: number, col: number) => `${FILES[col]}${8 - row}`;
const pieceToKey = (piece: any) => (piece ? `${piece.color}${piece.type}` : null);

export default function GameScreen() {
    const router = useRouter();
    const exitGame = (reason: string) => {
        if (gameEnded || isLeaving.current) return;

        isLeaving.current = true;
        setShowLeaveModal(false);

        socket?.emit("resign_game", { roomId });

        finishOnlineGame("loss", "resign");
    };
    const endGame = (
        reason: "resign" | "back" | "draw" | "disconnect" | "checkmate"
    ) => {
        if (gameEnded || isLeaving.current) return;

        setGameEnded(true);
        setShowLeaveModal(false);

        if (reason === "resign") {

        }


    };
    const [showVictory, setShowVictory] = useState(false);
    const [showDefeat, setShowDefeat] = useState(false);
    const [endState, setEndState] =
        useState<null | {
            type: "win" | "loss" | "draw";
            reason:
            | "checkmate"
            | "timeout"
            | "resign"
            | "disconnect"
            | "draw";
        }>(null);
    const [promotionMove, setPromotionMove] = useState<{
        from: string;
        to: string;
    } | null>(null);

    const [showPromotion, setShowPromotion] = useState(false);
    const navigation = useNavigation();
    const [socket, setSocket] = useState<ReturnType<typeof getSocket> | null>(null);
    const [game, setGame] = useState(new Chess());
    const isLeaving = useRef(false);
    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [gameEnded, setGameEnded] = useState(false);
    const eloProcessed = useRef(false);
    // Lese alle Parameter direkt hier
    const rawParams = useLocalSearchParams();
    const roomId = Array.isArray(rawParams.roomId) ? rawParams.roomId[0] : rawParams.roomId;
    const white = Array.isArray(rawParams.white) ? rawParams.white[0] : rawParams.white;
    const black = Array.isArray(rawParams.black) ? rawParams.black[0] : rawParams.black;
    const whiteName = Array.isArray(rawParams.whiteName) ? rawParams.whiteName[0] : rawParams.whiteName;
    const blackName = Array.isArray(rawParams.blackName) ? rawParams.blackName[0] : rawParams.blackName;
    const whiteAvatar = Array.isArray(rawParams.whiteAvatar) ? rawParams.whiteAvatar[0] : rawParams.whiteAvatar;
    const blackAvatar = Array.isArray(rawParams.blackAvatar) ? rawParams.blackAvatar[0] : rawParams.blackAvatar;
    const whiteRating = Number(
        Array.isArray(rawParams.whiteRating)
            ? rawParams.whiteRating[0]
            : rawParams.whiteRating
    ) || 1000;

    const blackRating = Number(
        Array.isArray(rawParams.blackRating)
            ? rawParams.blackRating[0]
            : rawParams.blackRating
    ) || 1000;

    const userId = Array.isArray(rawParams.userId) ? rawParams.userId[0] : rawParams.userId;
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [myColor, setMyColor] = useState<"w" | "b" | null>(null);
    const [myName, setMyName] = useState<string>("");
    const [myAvatar, setMyAvatar] = useState<string>("");
    const [opponentName, setOpponentName] = useState<string>("");
    const [opponentAvatar, setOpponentAvatar] = useState<string>("");
    const myRating =
        myColor === "w"
            ? whiteRating
            : blackRating;

    const opponentRating =
        myColor === "w"
            ? blackRating
            : whiteRating;
    const getAvatar = (avatar?: string, forceRefresh = false) => {
        if (avatar && avatar.length > 0) {
            return { uri: forceRefresh ? `${avatar}?t=${Date.now()}` : avatar };
        }
        return require("../../assets/images/platzhalter2.png");
    };
    const [whiteTime, setWhiteTime] = useState(300000);
    const [blackTime, setBlackTime] = useState(300000);
    const [activeColor, setActiveColor] = useState<"w" | "b">("w");

    const scrollRef = useRef<ScrollView>(null);
    const backgroundImage = require("../../assets/images/onlinebackground.png");
    // =============================
    // Prüfe Spielzustand
    // =============================
    const checkGameState = (g: Chess) => {
        if (g.isCheckmate()) {
            const result =
                g.turn() === myColor
                    ? "loss"
                    : "win";

            finishOnlineGame(
                result,
                "checkmate"
            );

            return;
        }

        if (g.isStalemate() || g.isDraw()) {
            finishOnlineGame(
                "draw",
                "draw"
            );

            return;
        }
    };
    const input = useChessInput({
        game,
        setGame,
        socket,
        roomId,
        myColor,
        setPromotionMove,
        setShowPromotion,
        setMoveHistory,
        setLastMove,
        checkGameEnd: checkGameState,
    });
    const finishOnlineGame = async (
        result: "win" | "loss" | "draw",
        reason:
            | "checkmate"
            | "timeout"
            | "resign"
            | "disconnect"
            | "draw"
    ) => {
        // Elo darf nur einmal pro Partie berechnet werden
        if (eloProcessed.current) return;

        if (!myColor) return;

        eloProcessed.current = true;

        try {
            const acc = await getCurrentAccount();

            if (!acc) {
                console.log("Keine aktuelle Account gefunden.");
                return;
            }

            const currentRating = acc.rating ?? 1000;

            const newRating = calculateElo(
                currentRating,
                opponentRating,
                result
            );

            console.log("=== ELO UPDATE ===");
            console.log("Alte Elo:", currentRating);
            console.log("Gegner Elo:", opponentRating);
            console.log("Ergebnis:", result);
            console.log("Neue Elo:", newRating);

            await updateAccount(acc.id, {
                rating: newRating,
            });

            await saveGameToHistory("online", result);

            setGameEnded(true);

            setEndState({
                type: result,
                reason,
            });
        } catch (error) {
            console.log("ELO UPDATE ERROR:", error);
        }
    };
    // =============================
    // Socket initialisieren
    // =============================
    useEffect(() => {
        const s = getSocket();

        setSocket(s);

        const onConnect = async () => {
            const acc = await getCurrentAccount(); // die neuesten Account-Daten
            if (!acc) return;
            console.log("Socket ID:", s.id);
            console.log("White:", white);
            console.log("Black:", black);

            const color = s.id === white ? "w" : s.id === black ? "b" : null;
            console.log("Socket", s.id);
            console.log("White Socket:", white);
            console.log("Black Socket:", black);
            if (!color) {
                console.log("NO COLOR -> BUG STATE");
                return;
            }

            setMyColor(color);
            console.log("=== COLOR DEBUG ===");
            console.log("socket.id:", s.id);
            console.log("white:", white);
            console.log("black:", black);
            console.log("myColor:", color);
            if (color === "w") {
                setMyName(whiteName);
                setMyAvatar(whiteAvatar || "");
                setOpponentName(blackName);
                setOpponentAvatar(blackAvatar || "");
            } else {
                setMyName(blackName);
                setMyAvatar(blackAvatar || "");
                setOpponentName(whiteName);
                setOpponentAvatar(whiteAvatar || "");
            }
            console.log("ICH:", color === "w" ? whiteAvatar : blackAvatar);
            console.log("GEGNER:", color === "w" ? blackAvatar : whiteAvatar);
        };

        if (s.connected) onConnect();
        else s.on("connect", onConnect);

        return () => {
            s.off("connect", onConnect);
        };
    },
        [white, black, whiteName, blackName, whiteAvatar, blackAvatar]);
    useEffect(() => {
        if (!socket || !myColor) return;

        const handleGameOver = (data: any) => {
            if (eloProcessed.current) return;

            const result =
                data.type === "draw"
                    ? "draw"
                    : data.winner === socket.id
                        ? "win"
                        : "loss";

            console.log("=== GAME OVER ===");
            console.log("Socket:", socket.id);
            console.log("My Color:", myColor);
            console.log("Winner:", data.winner);
            console.log("Result:", result);

            finishOnlineGame(result, data.type);
        };

        socket.on("game_over", handleGameOver);

        return () => {
            socket.off("game_over", handleGameOver);
        };
    }, [socket, myColor]);
    const displayBoard =
        myColor === "w"
            ? game.board()
            : [...game.board()]
                .reverse()
                .map(row => [...row].reverse());

    useEffect(() => {
        const unsubscribe = navigation.addListener("beforeRemove", (e) => {
            if (gameEnded || isLeaving.current) return;
            // verhindert sofortiges Verlassen
            e.preventDefault();
            setShowLeaveModal(true);
        });

        return unsubscribe;
    }, [navigation, gameEnded, isLeaving]);
    const handlePromotion = (
        piece: "q" | "r" | "b" | "n"
    ) => {
        if (!promotionMove) return;

        const newGame = new Chess(game.fen());

        const move = newGame.move({
            from: promotionMove.from,
            to: promotionMove.to,
            promotion: piece,
        });

        if (!move) {
            setPromotionMove(null);
            setShowPromotion(false);
            return;
        }

        // Spielbrett aktualisieren
        setGame(newGame);

        // 🔥 Zug in Zugleiste
        setMoveHistory(prev => [...prev, move.san]);

        // 🔥 letzten Zug markieren
        setLastMove({
            from: move.from,
            to: move.to,
        });

        console.log("SENDING PROMOTION:", {
            from: move.from,
            to: move.to,
            promotion: piece,
        });

        // 🔥 Promotion an Server senden
        socket?.emit("player_move", {
            roomId,
            move: {
                from: move.from,
                to: move.to,
                promotion: piece,
            },
        });

        setPromotionMove(null);
        setShowPromotion(false);

        checkGameState(newGame);
    };
    // =============================
    // Gegnerzug Listener
    // =============================
    useEffect(() => {
        if (!socket) return;

        const handleOpponentMove = (data: any) => {
            console.log(
                "LOCAL FEN",
                game.fen()
            );

            console.log(
                "SERVER MOVE",
                data
            );
            const from =
                data?.from ?? (typeof data === "string" ? data.slice(0, 2) : null);

            const to =
                data?.to ?? (typeof data === "string" ? data.slice(2, 4) : null);

            const promotion = data?.promotion ?? null;

            if (!from || !to) {
                console.log("Bad move payload:", data);
                return;
            }
            setGame(prev => {
                const newGame = new Chess(prev.fen());

                const move = { from, to, promotion };

                const result = newGame.move(move);

                if (!result) {
                    console.log("IGNORED INVALID MOVE:", move);
                    return prev;
                }

                setMoveHistory(h => [...h, result.san]);
                setLastMove({ from, to });

                checkGameState(newGame);

                return newGame;
            });
        };

        socket.on("timer_update", (data) => {
            if (data.whiteTime !== undefined) setWhiteTime(data.whiteTime);
            if (data.blackTime !== undefined) setBlackTime(data.blackTime);
            if (data.activeColor) setActiveColor(data.activeColor);
        });
        socket.on("opponent_move", handleOpponentMove);
        console.log("Move received");
        console.log("Turn before", new Chess(game.fen()).turn());
        return () => {
            socket.off("opponent_move", handleOpponentMove);
        };


    }, [socket]);

    // =============================
    // Remis & GameOver Listener
    // =============================
    useEffect(() => {
        if (!socket || !myName) return;

        const unsubDraw = onDrawOffer(
            () => {
                Alert.alert(
                    "Remis angeboten",
                    "Dein Gegner möchte Remis.",
                    [
                        { text: "Ablehnen", onPress: () => socket?.emit("answer_draw", { roomId, accept: false }), },
                        { text: "Annehmen", onPress: () => socket?.emit("answer_draw", { roomId, accept: true }), },
                    ]
                );
            },
            myName,
            myAvatar
        );

        const unsubGameOver = onGameOver((data) => {
            if (isLeaving.current) return;

            setGameEnded(true);

            setEndState({
                type:
                    data.type === "draw"
                        ? "draw"
                        : data.winner === socket?.id
                            ? "win"
                            : "loss",

                reason: data.type,
            });
            if (data.type === "draw") {
                setEndState({
                    type: "draw",
                    reason: "draw",
                });
            }

            if (data.type === "disconnect") {
                setEndState({
                    type: data.winner === socket?.id ? "win" : "loss",
                    reason: "disconnect",
                });
            }
        }, myName, myAvatar);

        return () => {
            unsubDraw();
            unsubGameOver();
        };
    }, [socket, roomId, router, myName, myAvatar]);

    let checkSquare = null;

    if (game.inCheck()) {
        const board = game.board();

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];

                if (
                    piece &&
                    piece.type === "k" &&
                    piece.color === game.turn()
                ) {
                    checkSquare = `${FILES[c]}${8 - r}`;
                }
            }
        }
    }

    // =============================
    // Scroll zu letztem Zug
    // =============================
    useEffect(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
    }, [moveHistory]);

    useEffect(() => {
        const history = game.history({ verbose: true });
        if (history.length === 0) return;

        const last = history[history.length - 1];

        setLastMove({
            from: last.from,
            to: last.to,
        });
    }, [game]);


    useEffect(() => {
        if (!gameEnded) return; // Spiel läuft, nichts tun
        // hier könnte man nach Spielende die Avatare wieder aktualisieren
    }, [myAvatar, opponentAvatar]);

    async function saveGameToHistory(
        mode: "online",
        result: "win" | "loss" | "draw" | "aborted",
        timestamp?: number
    ) {
        const key = "game_history";
        const stored = await AsyncStorage.getItem(key);
        const history = stored ? JSON.parse(stored) : [];

        history.unshift({
            id: Date.now().toString(),
            mode,
            result,
            timestamp: timestamp ?? Date.now(),
        });

        await AsyncStorage.setItem(key, JSON.stringify(history));



    }
    console.log(
        "Render:",
        "turn =", game.turn(),
        "myColor =", myColor,
        "white =", white,
        "black =", black
    );

    // =============================
    // UI
    // =============================
    return (
        <ImageBackground source={backgroundImage}
            style={{ flex: 1 }}
            resizeMode="cover" >

            <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
                <Modal visible={showLeaveModal} transparent animationType="fade">
                    <View style={styles.overlay}>
                        <View style={styles.card}>

                            <Text style={styles.title}>Partie verlassen?</Text>

                            <Text style={styles.text}>
                                Wenn du die Partie verlässt, wird sie als Niederlage gewertet.
                            </Text>
                            <View style={styles.buttons}>
                                <Pressable
                                    style={styles.cancelButton}
                                    onPress={() => setShowLeaveModal(false)}
                                >
                                    <Text style={styles.cancelButtonText}>
                                        Abbrechen
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={styles.leaveButton}
                                    onPress={() => exitGame("resign")

                                    }
                                >
                                    <Text style={styles.leaveButtonText}>
                                        Aufgeben
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>
                {!socket || !myColor ? (
                    <View style={styles.center}>
                        <Text>Warte auf Verbindung...   </Text>
                    </View>
                ) : (
                    <View style={styles.wrapper}>
                        <View
                            style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                marginBottom: 12,
                            }}
                        >
                            <Text style={{ color: "#fff", fontSize: 18 }}>
                                ⚪ {Math.floor(whiteTime / 60000)}:
                                {(Math.floor((whiteTime % 60000) / 1000))
                                    .toString()
                                    .padStart(2, "0")} </Text>

                            <Text style={{ color: "#fff", fontSize: 18 }}>
                                ⚫ {Math.floor(blackTime / 60000)}:
                                {(Math.floor((blackTime % 60000) / 1000))
                                    .toString()
                                    .padStart(2, "0")} </Text>
                        </View>
                        <View style={{ width: BOARD_SIZE, marginTop: 100 }}>
                            {/* Gegner */}
                            <Pressable
                                onPress={() =>
                                    router.push({
                                        pathname: "/profile",
                                        params: {
                                            userId: myColor === "w" ? black : white,
                                            name: opponentName,
                                            avatar: opponentAvatar,
                                        },
                                    })
                                }
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    marginBottom: 10,
                                }}
                            >
                                <Image
                                    source={getAvatar(opponentAvatar)}
                                    style={{
                                        width: 36, height: 36, backgroundColor: '#fff',
                                        borderRadius: 6,
                                        marginRight: 10,
                                        borderWidth: 2,
                                        borderColor: "#fff",
                                        overflow: 'hidden',
                                    }}
                                    resizeMode="contain"
                                />
                                <Text style={{ color: "#fff", fontSize: 16 }}>
                                    {opponentName || "Gegner "}
                                </Text>
                            </Pressable>

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

                            {endState && (
                                <View style={styles.endOverlay}>
                                    <View style={styles.endCard}>

                                        {endState.type === "win" && (
                                            <>
                                                <Text style={styles.winTitle}>Sieg!</Text>
                                                <Text style={styles.subText}>
                                                    {
                                                        endState.reason === "checkmate"
                                                            ? "Du hast deinen Gegner schachmatt gesetzt."
                                                            : endState.reason === "timeout"
                                                                ? "Die Zeit deines Gegners ist abgelaufen."
                                                                : endState.reason === "resign"
                                                                    ? "Dein Gegner hat aufgegeben.  "
                                                                    : endState.reason === "disconnect"
                                                                        ? "Dein Gegner hat die Verbindung verloren. " : ""} </Text>
                                            </>
                                        )}

                                        {endState.type === "loss" && (
                                            <>
                                                <Text style={styles.loseTitle}>Niederlage </Text>
                                                <Text style={styles.subText}>
                                                    {
                                                        endState.reason === "checkmate"
                                                            ? "Du wurdest schachmatt gesetzt."
                                                            : endState.reason === "timeout"
                                                                ? "Deine Zeit ist abgelaufen."
                                                                : endState.reason === "resign"
                                                                    ? "Du hast die Partie aufgegeben."
                                                                    : endState.reason === "disconnect"
                                                                        ? "Die Verbindung wurde getrennt."
                                                                        : ""
                                                    }
                                                </Text>
                                            </>
                                        )}

                                        {endState.type === "draw" && (
                                            <>
                                                <Text style={styles.drawTitle}>🤝 Remis</Text>
                                                <Text style={styles.subText}>
                                                    Die Partie endet im  Unentschieden. </Text>
                                            </>
                                        )}

                                        <View style={styles.endButtons}>
                                            <Pressable
                                                style={styles.primaryBtn}
                                                onPress={() => {
                                                    setEndState(null);
                                                    router.replace("/game/waiting"); // neue Partie
                                                }}
                                            >
                                                <Text style={styles.btnText}>Neue Partie</Text>
                                            </Pressable>

                                            <Pressable
                                                style={styles.secondaryBtn}
                                                onPress={() => {
                                                    setEndState(null);
                                                    router.replace("/");
                                                }}
                                            >
                                                <Text style={styles.btnText}>Home</Text>
                                            </Pressable>

                                            <Pressable
                                                style={styles.secondaryBtn}
                                                onPress={() => {
                                                    setEndState(null);
                                                    Alert.alert("Revanche kommt bald");
                                                }}
                                            >
                                                <Text style={styles.btnText}>Revanche</Text>
                                            </Pressable>

                                        </View>
                                    </View>
                                </View>
                            )}
                            <Modal visible={showPromotion} transparent animationType="fade">
                                <View style={styles.overlay}>
                                    <View style={styles.card}>
                                        <Text style={styles.title}>Wähle Umwandlung</Text>

                                        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                                            <Pressable onPress={() => handlePromotion("q")}>
                                                <Text style={styles.btnText}>Dame</Text>
                                            </Pressable>

                                            <Pressable onPress={() => handlePromotion("r")}>
                                                <Text style={styles.btnText}>Turm</Text>
                                            </Pressable>

                                            <Pressable onPress={() => handlePromotion("b")}>
                                                <Text style={styles.btnText}>Läufer</Text>
                                            </Pressable>

                                            <Pressable onPress={() => handlePromotion("n")}>
                                                <Text style={styles.btnText}>Springer</Text>
                                            </Pressable>
                                        </View>

                                        <Pressable onPress={() => setShowPromotion(false)}>
                                            <Text style={{ color: "red", marginTop: 10 }}>Abbrechen</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </Modal>
                            {/* Schachbrett */}
                            <BoardAny
                                board={displayBoard}
                                selectedSquare={input.selectedSquare}
                                legalMoves={input.legalMoves}
                                lastMove={lastMove}
                                checkSquare={checkSquare}
                                pieceToKey={pieceToKey}
                                pieces={pieces}
                                onPressSquare={input.onPressSquare}
                                myColor={myColor}
                                mode="online"
                            />
                            {/* Bottom */}
                            <View style={styles.bottomBar}>
                                <Pressable
                                    disabled={gameEnded}
                                    onPress={() => setShowLeaveModal(true)}


                                >
                                    <Text style={styles.bottomBtn}>Aufgeben </Text>
                                </Pressable>

                                <Pressable
                                    disabled={gameEnded}
                                    onPress={() => {
                                        socket?.emit("offer_draw", { roomId });
                                        Alert.alert("Remis angeboten");
                                    }}
                                >
                                    <Text style={styles.bottomBtn}>Remis </Text>
                                </Pressable>

                                <Pressable onPress={() => Alert.alert("Chat kommt später")}>
                                    <Text style={styles.bottomBtn}>Chat </Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                )}
            </SafeAreaView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 0.8, justifyContent: "center", alignItems: "center" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    board: {
        width: BOARD_SIZE,
        height: BOARD_SIZE,
        flexDirection: "row",
        flexWrap: "wrap",
        alignSelf: "center",
        borderRadius: 5,
        overflow: "hidden",
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
    moveBar: { height: 40, marginBottom: 12 },
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
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.65)",
        justifyContent: "center",
        alignItems: "center",
    },

    card: {
        width: "85%",
        maxWidth: 360,
        backgroundColor: "#1E1E1E",
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: "#D4AF37",
    },

    title: {
        color: "#FFFFFF",
        fontSize: 22,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 12,
    },

    text: {
        color: "#D0D0D0",
        fontSize: 15,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 24,
    },

    buttons: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
    },

    cancelButton: {
        flex: 1,
        backgroundColor: "#2C2C2C",
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
    },

    leaveButton: {
        flex: 1,
        backgroundColor: "#C62828",
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
    },

    cancelButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "600",
    },

    leaveButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },
    endOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
    },

    victoryText: {
        fontSize: 40,
        fontWeight: "bold",
        color: "#FFD700",
    },

    defeatText: {
        fontSize: 40,
        fontWeight: "bold",
        color: "#ff4444",
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

    loseTitle: {
        fontSize: 34,
        fontWeight: "900",
        color: "#ff3b3b",
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
    },

    endButtons: {
        width: "100%",
        gap: 10,
    },

    primaryBtn: {
        backgroundColor: "#D4AF37",
        padding: 12,
        borderRadius: 12,
        alignItems: "center",
    },

    secondaryBtn: {
        backgroundColor: "#222",
        padding: 12,
        borderRadius: 12,
        alignItems: "center",
    },

    btnText: {
        color: "#fff",
        fontWeight: "600",
    },
});