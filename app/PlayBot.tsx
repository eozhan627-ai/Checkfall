import AsyncStorage from "@react-native-async-storage/async-storage";
import { Chess } from "chess.js";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { io, Socket } from "socket.io-client";

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
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const toChessSquare = (
    row: number,
    col: number,
    bottomColor: 'w' | 'b'
) => {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

    const realRow = bottomColor === "w" ? row : 7 - row;
    const realCol = bottomColor === "w" ? col : 7 - col;

    return `${files[realCol]}${8 - realRow}`;
};

const pieceToKey = (piece: any) => {
    if (!piece) return null;
    return `${piece.color}${piece.type}`;
};

export default function Playbot() {
    const socket = useRef<Socket | null>(null);
    const [game, setGame] = useState(new Chess());
    const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
    const [legalMoves, setLegalMoves] = useState<any[]>([]);
    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const [promotionMove, setPromotionMove] = useState<{ from: string; to: string } | null>(null);
    const [botElo, setBotElo] = useState<100 | 300 | 500 | 1000>(100);
    const botLevels = [100, 300, 500, 1000] as const;
    const [gameStarted, setGameStarted] = useState(false);
    const [bottomColor, setBottomColor] = useState<"w" | "b">("w");
    const [botColor, setBotColor] = useState<"w" | "b">("b");
    const [botStrength, setBotStrength] = useState(100);
    const [botSide, setBotSide] = useState<'w' | 'b'>('b');
    const [playerColor, setPlayerColor] = useState<'w' | 'b' | 'random'>('random');
    const [humanColor, setHumanColor] = useState<'w' | 'b'>('w');
    const rotateBoard = bottomColor === "b";
    const scrollRef = useRef<ScrollView>(null);
    const board = game.board();
    const [checkmate, setCheckmate] = useState<string | null>(null);
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const params = useLocalSearchParams();
    type SavedData = {
        fen: string;
        history: any[];
        bottomColor: "w" | "b";
        humanColor: "w" | "b";
        botColor: "w" | "b";
    };

    const [savedData, setSavedData] = useState<SavedData | null>(null);
    const displayBoard =
        bottomColor === "w" ? board : [...board].reverse().map(row => [...row].reverse());


    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollToEnd({ animated: true });
        }
    }, [moveHistory]);
    useEffect(() => {
        socket.current = io("https://checkfall-server-clean-1.onrender.com");

        socket.current.on("connect", () => {
            console.log("✅ Connected:", socket.current?.id);
        });

        socket.current.on("opponent_move", (move) => {
            console.log("🤖 BOT MOVE:", move);

            const newGame = new Chess(game.fen());
            newGame.move(move);

            setGame(newGame);
            setMoveHistory(prev => [...prev, move]);
        });

        return () => {
            socket.current?.disconnect();
        };
    }, []);

    const botMoveRef = useRef(false);
    const eloToDepth = (elo: number) => {
        switch (elo) {
            case 100: return 5;
            case 300: return 8;
            case 500: return 12;
            case 1000: return 15;
            default: return 10;
        }
    }
    const [isBotThinking, setIsBotThinking] = useState(false);

    useEffect(() => {
        const makeBotMoveIfNeeded = async () => {
            if (game.turn() === botColor && !isBotThinking && game.isGameOver() === false) {
                setIsBotThinking(true);
                await new Promise(res => setTimeout(res, 800)); // Warte, Animation/Zeit

                setIsBotThinking(false);
            }
        };
        makeBotMoveIfNeeded();
    }, [game, botColor]);

    const handlePromotion = (pieceType: string) => {
        if (!promotionMove) return;
        const newGame = new Chess(game.fen());
        const move = newGame.move({
            from: promotionMove.from,
            to: promotionMove.to,
            promotion: pieceType,
        });
        if (!move) return;
        setGame(newGame);
        setMoveHistory(prev => [...prev, move.san]);
        setLastMove({ from: move.from, to: move.to });
        setSelectedSquare(null);
        setLegalMoves([]);
        setPromotionMove(null);

        checkGameEnd(newGame);
    };
    const saveGame = async () => {
        const timestamp = Date.now();
        const key = `@saved_game_${timestamp}`;

        await AsyncStorage.setItem(
            key,
            JSON.stringify({
                fen: game.fen(),
                history: game.history({ verbose: true }),
                bottomColor,
                mode: "bot",
                timestamp,
                humanColor,
                botColor,

            })
        );
    };

    const resetGame = () => {
        setGame(new Chess());
        setSelectedSquare(null);
        setLegalMoves([]);
        setPromotionMove(null);
        setMoveHistory([]);
        setLastMove(null);
    };
    // currentGame: Chess
    const getKingSquare = (color: "w" | "b") => {
        const board = game.board(); // 2D Array mit Pieces oder null
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (piece && piece.type === "k" && piece.color === color) {
                    // Umrechnen in algebraische Notation: a1-h8
                    const square = String.fromCharCode(97 + file) + (8 - rank);
                    return square;
                }
            }
        }
        return null;
    };
    const checkGameEnd = (currentGame: Chess) => {
        const showAlert = (title: string, message: string) => {
            setTimeout(() => {
                Alert.alert(title, message);
            }, 800); // 0,8 Sekunden warten, damit der letzte Zug sichtbar ist
        };


        if (currentGame.isCheckmate()) {
            const loser = currentGame.turn();
            const winner = loser === "w" ? "b" : "w";
            const result = winner === humanColor ? "win" : "loss";

            // Königfeld ermitteln
            const kingSquare = getKingSquare(loser); // chess.js liefert z.B. "e8"
            setCheckmate(kingSquare);
            saveGameToHistory("bot", result);

            showAlert(
                "Schachmatt",
                `${winner === "w" ? "Weiß" : "Schwarz"} hat gewonnen`
            );
            return true;
        }
        if (currentGame.isStalemate()) {
            saveGameToHistory("bot", "draw");
            showAlert("Patt", "Keine legalen Züge mehr – Unentschieden");
            return true;
        }

        if (currentGame.isThreefoldRepetition()) {
            saveGameToHistory("bot", "draw");
            showAlert("Remis", "Dreifache Stellungswiederholung");
            return true;
        }

        if (currentGame.isInsufficientMaterial()) {
            saveGameToHistory("bot", "draw");
            showAlert("Remis", "Zu wenig Material für ein Matt");
            return true;
        }

        if (currentGame.isDraw()) {
            saveGameToHistory("bot", "draw");
            showAlert("Remis", "50-Züge-Regel oder allgemeines Remis");
            return true;
        }

        return false;
    };
    async function saveGameToHistory(
        mode: "bot",
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



    return (
        <View style={{ flex: 1, backgroundColor: '#111827' }} >
            {!gameStarted ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
                    <Text style={{ color: "#fff", fontSize: 20, marginBottom: 16 }}>Spiel starten gegen Bot  </Text>
                    <View style={{ flexDirection: "row", marginBottom: 16 }}>
                        {["w", "b", "random"].map((c) => (
                            <Pressable
                                key={c}
                                onPress={() => setPlayerColor(c as any)}
                                style={{
                                    marginHorizontal: 6,
                                    padding: 10,
                                    borderRadius: 6,
                                    backgroundColor: playerColor === c ? "#f6f6f6" : "#555",
                                }}
                            >
                                <Text>{c === "w" ? "Weiß " : c === "b" ? "Schwarz " : "Zufällig "}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginBottom: 16 }}>
                        {botLevels.map((level) => (
                            <Pressable
                                key={level}
                                onPress={() => setBotElo(level)}
                                style={{
                                    margin: 4,
                                    padding: 8,
                                    borderRadius: 6,
                                    backgroundColor: botElo === level ? "#f6f6f6" : "#555",
                                }}
                            >
                                <Text style={{ fontSize: 12 }}>{level}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <Pressable
                        onPress={() => {
                            // Wenn savedData existiert, dann einfach Spiel starten
                            if (savedData) {
                                const color = savedData.bottomColor;
                                setHumanColor(savedData.humanColor);
                                setBottomColor(savedData.bottomColor);
                                setBotColor(savedData.botColor);
                                setGameStarted(true);


                                return;
                            }

                            // sonst normale Startlogik
                            const color = playerColor === "random" ? (Math.random() < 0.5 ? "w" : "b") : playerColor;

                            setHumanColor(color);
                            setBottomColor(color);
                            setBotColor(color === "w" ? "b" : "w");
                            setGameStarted(true);


                        }}
                        style={{ padding: 12, backgroundColor: "#f6f6f6", borderRadius: 8 }}
                    >
                        <Text>Spiel starten </Text>
                    </Pressable>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    {promotionMove && (
                        <View style={styles.promotionBar}>
                            {[
                                { label: "Q", value: "q" },
                                { label: "R", value: "r" },
                                { label: "N", value: "n" },
                                { label: "B", value: "b" },
                            ].map((p) => (
                                <Pressable key={p.value} style={styles.promotionBtn} onPress={() => handlePromotion(p.value)}>
                                    <Text>{p.label}</Text>
                                </Pressable>
                            ))}
                        </View>
                    )}

                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.moveBar}
                            contentContainerStyle={styles.moveBarContent}
                            ref={scrollRef}
                        >
                            {moveHistory
                                .reduce((rows: any[], move, index) => {
                                    if (index % 2 === 0) {
                                        rows.push({ moveNumber: index / 2 + 1, white: move, black: "" });
                                    } else {
                                        rows[rows.length - 1].black = move;
                                    }
                                    return rows;
                                }, [])
                                .map((row, index) => (
                                    <Text key={index} style={styles.moveChip}>
                                        {row.moveNumber}. {row.white} {row.black}
                                    </Text>
                                ))}
                        </ScrollView>
                        <View style={{ transform: rotateBoard ? [{ rotate: "0deg" }] : [] }}>
                            <View style={styles.board}>
                                {displayBoard.map((row, rowIndex) =>
                                    row.map((piece, colIndex) => {
                                        const square = toChessSquare(rowIndex, colIndex, bottomColor);
                                        const isDark = (rowIndex + colIndex) % 2 === 1;
                                        const isSelected = selectedSquare === square;
                                        const legalMove = legalMoves.find((m) => m.to === square);
                                        const isLegalMove = !!legalMove;
                                        const isCapture = !!legalMove?.captured;
                                        const pieceKey = pieceToKey(piece);

                                        const rankLabel = bottomColor === "w" ? RANKS[rowIndex] : RANKS[7 - rowIndex];
                                        const fileLabel = bottomColor === "w" ? FILES[colIndex] : FILES[7 - colIndex];

                                        const isLastFrom = lastMove?.from === square;
                                        const isLastTo = lastMove?.to === square;

                                        return (
                                            <Pressable
                                                key={square}
                                                onPress={() => {
                                                    if (game.turn() !== humanColor) return;
                                                    if (!selectedSquare && piece && piece.color !== humanColor) return;

                                                    if (piece && !isLegalMove) {
                                                        setSelectedSquare(square);
                                                        setLegalMoves(game.moves({ square: square as any, verbose: true }));
                                                        return;
                                                    }

                                                    if (selectedSquare && isLegalMove) {
                                                        if (legalMove.piece === "p" && (square[1] === "8" || square[1] === "1")) {
                                                            setPromotionMove({ from: selectedSquare, to: square });
                                                            return;
                                                        }

                                                        const newGame = new Chess(game.fen());
                                                        const move = newGame.move({ from: selectedSquare as any, to: square as any });
                                                        if (!move) return;

                                                        setGame(newGame);
                                                        setMoveHistory(prev => [...prev, move.san]);
                                                        setLastMove({ from: move.from, to: move.to });
                                                        setSelectedSquare(null);
                                                        setLegalMoves([]);
                                                        checkGameEnd(newGame);
                                                        socket.current?.emit("player_move", {
                                                            roomId: `bot_${socket.current.id}`,
                                                            move: move.san,
                                                            fen: newGame.fen(),
                                                        });

                                                    }
                                                }}
                                                style={[
                                                    styles.square,
                                                    {
                                                        backgroundColor:
                                                            square === checkmate
                                                                ? "#ff3b30"
                                                                : isLastTo
                                                                    ? "#facc15"       // Ziel-Feld (kräftig)
                                                                    : isLastFrom
                                                                        ? "#fde68a"      // Start-Feld (heller)
                                                                        : isDark
                                                                            ? "#769656"
                                                                            : "#eeeed2",
                                                        borderWidth: isSelected ? 2 : 0,
                                                        borderColor: isSelected ? "#ac442c" : "transparent",
                                                    },
                                                ]}
                                            >
                                                {pieceKey && (
                                                    <Image
                                                        source={pieces[pieceKey]}
                                                        style={[
                                                            styles.piece,
                                                            {
                                                                shadowColor: "#000",
                                                                shadowOpacity: 0.6,
                                                                shadowRadius: 4,
                                                                shadowOffset: { width: 0, height: 2 },
                                                            },
                                                            // Rotation des Boards (falls nötig)
                                                            rotateBoard ? { transform: [{ rotate: "0deg" }] } : {},

                                                            // schwarze Bauern extra vergrößern und verschieben
                                                            pieceKey === "bp" && {
                                                                transform: [
                                                                    { scale: 1.55 },
                                                                    { translateY: 3.25 },
                                                                    { translateX: -0.5 },
                                                                ],
                                                            },

                                                            // alle anderen schwarzen Figuren leicht vergrößern
                                                            pieceKey?.startsWith("b") && pieceKey !== "bp" && {
                                                                transform: [{ scale: 1.12 }],
                                                            },

                                                            // weiße Läufer, Dame und König leicht vergrößern
                                                            (pieceKey === "wb" || pieceKey === "wq" || pieceKey === "wk") && {
                                                                transform: [{ scale: 1.12 }],
                                                            },
                                                        ]}
                                                    />
                                                )}
                                                {isLegalMove && !isCapture && <View style={styles.moveDot} />}
                                                {isLegalMove && isCapture && <View style={styles.captureRing} />}

                                                {colIndex === 0 && (
                                                    <Text style={{
                                                        position: "absolute",
                                                        left: 2,
                                                        top: 2,
                                                        fontSize: 10,
                                                        fontWeight: "600",
                                                        color: isDark ? "#e5e7eb" : "#334155",
                                                    }}>
                                                        {bottomColor === "w" ? RANKS[rowIndex] : RANKS[7 - rowIndex]}
                                                    </Text>
                                                )}
                                                {rowIndex === 7 && (
                                                    <Text style={{
                                                        position: "absolute",
                                                        left: 2,
                                                        bottom: 2,
                                                        fontSize: 10,
                                                        fontWeight: "600",
                                                        color: isDark ? "#e5e7eb" : "#334155",
                                                    }}>
                                                        {bottomColor === "w" ? FILES[colIndex] : FILES[7 - colIndex]}
                                                    </Text>
                                                )}
                                            </Pressable>
                                        );
                                    })
                                )}
                            </View>
                        </View>
                        <View style={styles.bottomBar}>
                            <Pressable
                                onPress={() =>
                                    Alert.alert("Partie verlassen?", "Dein aktueller Fortschritt geht verloren.", [
                                        { text: "Abbrechen", style: "cancel" },
                                        {
                                            text: "Ja",
                                            onPress: async () => {
                                                const now = Date.now();
                                                await saveGameToHistory("bot", "aborted", now);
                                                router.back();
                                            },
                                        },
                                    ])
                                }
                            >
                                <Text style={[styles.bottomBtn, { color: "#f6f6f6" }]}>Zurück </Text>
                            </Pressable>
                            <Pressable
                                onPress={async () => {
                                    await saveGame();
                                    Alert.alert(
                                        "Spiel gespeichert",
                                        "Du kannst es unter „Gespeicherte Spiele“ fortsetzen."
                                    );
                                }}
                            >
                                <Text style={[styles.bottomBtn, { color: "#f6f6f6" }]}>Speichern </Text>
                            </Pressable>

                            <Pressable
                                onPress={() =>
                                    Alert.alert(
                                        "Partie neustarten?",
                                        "Dein aktueller Fortschritt geht verloren.",
                                        [
                                            { text: "Nein", style: "cancel" },
                                            { text: "Ja", onPress: resetGame },
                                        ]
                                    )
                                }
                            >
                                <Text style={[styles.bottomBtn, { color: "#f6f6f6" }]}>Neustarten </Text>
                            </Pressable>

                        </View>
                    </View>
                </View>
            )
            }
        </View >
    );
}
const styles = StyleSheet.create({
    board: {
        width: BOARD_SIZE,
        height: BOARD_SIZE,
        flexDirection: "row",
        flexWrap: "wrap",
        alignSelf: "center",
        marginTop: 0,
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
        width: SQUARE_SIZE * 0.8,
        height: SQUARE_SIZE * 0.8,
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
    moveBar: {
        maxHeight: 40,
        marginBottom: 12,
        marginTop: 10,

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
        backgroundColor: "#e5e7eb",
        fontSize: 13,
    },
    bottomBar: {
        marginTop: 16,
        flexDirection: "row",
        justifyContent: "space-around",
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: "#e5e7eb",
    },
    bottomBtn: {
        fontSize: 14
    },
    promotionBar: {
        position: "absolute",
        bottom: BOARD_SIZE + 120,
        alignSelf: "center",
        flexDirection: "row",
        backgroundColor: "#111827",
        borderRadius: 12,
        padding: 10,
        zIndex: 100,
        elevation: 10,
    },
    promotionBtn: {
        marginHorizontal: 6,
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: "#e5e7eb",
        justifyContent: "center",
        alignItems: "center",
    },
}); 