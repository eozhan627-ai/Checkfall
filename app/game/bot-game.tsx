import AsyncStorage from "@react-native-async-storage/async-storage";
import { Chess } from "chess.js";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
    BackHandler,
    Dimensions,
    Easing,
    Image,
    ImageBackground,
    Modal,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { io, Socket } from "socket.io-client";
import { getCurrentAccount } from "../../lib/account";
import { saveGameRecord } from "../../lib/games";

const BOARD_SIZE = Dimensions.get("window").width - 32;
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
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];


// Slider geht jetzt bis 3200 - ab da spielt der Bot mit voller Stockfish-Stärke
// (Kalibrierung passiert serverseitig über UCI_LimitStrength/UCI_Elo bzw.
// eine eigene Schwäche-Simulation unterhalb der nativen Engine-Untergrenze).
const BOT_ELO_MIN = 100;
const BOT_ELO_MAX = 3200;
const BOT_ELO_STEP = 50;
const BOT_ELO_DEFAULT = 300;

function getEloLabel(elo: number) {
    if (elo < 250) return "Beginner";
    if (elo < 600) return "Casual";
    if (elo < 1000) return "Club Player";
    if (elo < 1500) return "Strong";
    if (elo < 2000) return "Expert";
    if (elo < 2600) return "Master";
    if (elo < 3200) return "Grandmaster";
    return "Full Stockfish";

}
// Klont ein Chess-Objekt UNTER BEIBEHALTUNG der vollständigen Zughistorie.
// new Chess(fen) allein reicht nicht - das kennt nur die aktuelle Stellung,
// nicht die Züge davor, wodurch pgn() später nur den letzten Zug zeigen würde.
function cloneWithHistory(g: Chess): Chess {
    const clone = new Chess();
    g.history({ verbose: true }).forEach((m: any) => {
        clone.move({ from: m.from, to: m.to, promotion: m.promotion });
    });
    return clone;
}

// Reiner JS/RN-Slider ohne natives Modul. @react-native-community/slider
// braucht einen echten Native-Rebuild (funktioniert NICHT in Expo Go, daher
// der "Can't find view manager RNCSlider" Fehler) - das hier läuft überall.
function EloSlider({
    value,
    onValueChange,
    minimumValue,
    maximumValue,
    step,
}: {
    value: number;
    onValueChange: (v: number) => void;
    minimumValue: number;
    maximumValue: number;
    step: number;
}) {
    const trackWidthRef = useRef(0);

    const clampToStep = (v: number) => {
        const stepped = Math.round((v - minimumValue) / step) * step + minimumValue;
        return Math.min(maximumValue, Math.max(minimumValue, stepped));
    };

    const updateFromX = (x: number) => {
        if (trackWidthRef.current <= 0) return;
        const ratio = Math.min(1, Math.max(0, x / trackWidthRef.current));
        const raw = minimumValue + ratio * (maximumValue - minimumValue);
        onValueChange(clampToStep(raw));
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => updateFromX(evt.nativeEvent.locationX),
            onPanResponderMove: (evt) => updateFromX(evt.nativeEvent.locationX),
        })
    ).current;

    const ratio = Math.min(1, Math.max(0, (value - minimumValue) / (maximumValue - minimumValue)));

    return (
        <View
            onLayout={(e) => {
                trackWidthRef.current = e.nativeEvent.layout.width;
            }}
            {...panResponder.panHandlers}
            hitSlop={{ top: 12, bottom: 12 }}
            style={{ width: "100%", height: 40, justifyContent: "center" }}
        >
            <View
                style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "rgba(255,255,255,0.25)",
                    overflow: "hidden",
                }}
            >
                <View
                    style={{
                        height: "100%",
                        width: `${ratio * 100}%`,
                        backgroundColor: "#FFD700",
                    }}
                />
            </View>
            <View
                pointerEvents="none"
                style={{
                    position: "absolute",
                    top: 8,
                    left: `${ratio * 100}%`,
                    marginLeft: -11,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: "#FFD700",
                    borderWidth: 2,
                    borderColor: "#111827",
                }}
            />
        </View>
    );
}

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

type EndState = {
    type: "win" | "loss" | "draw";
    reason: "checkmate" | "stalemate" | "draw";
};

export default function Playbot() {
    const socket = useRef<Socket | null>(null);
    const [game, setGame] = useState(new Chess());
    const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
    const [legalMoves, setLegalMoves] = useState<any[]>([]);
    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const [promotionMove, setPromotionMove] = useState<{ from: string; to: string } | null>(null);
    const [botElo, setBotElo] = useState<number>(BOT_ELO_DEFAULT);
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
    const [kingInCheck, setKingInCheck] = useState<string | null>(null);
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

    const backgroundImage = require("../../assets/images/onlinebackground.png"); // Hintergrundbild

    const [roomId, setRoomId] = useState<string | null>(null);
    const params = useLocalSearchParams();
    type SavedData = {
        fen: string;
        history: any[];
        bottomColor: "w" | "b";
        humanColor: "w" | "b";
        botColor: "w" | "b";
        botElo: number;
    };
    const [gameOver, setGameOver] = useState(false);
    const [savedData, setSavedData] = useState<SavedData | null>(null);
    const [endState, setEndState] = useState<EndState | null>(null);

    // Custom Popups statt Alert.alert
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [showRestartModal, setShowRestartModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);

    const endAnimation = useRef(new Animated.Value(0)).current;
    const endPopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        const loadSavedGame = async () => {
            if (!params.key) return;

            try {
                const key = params.key as string;
                const stored = await AsyncStorage.getItem(key);

                if (!stored) {
                    return;
                }

                const data = JSON.parse(stored);

                setSavedData(data);

                // GEÄNDERT: Züge einzeln nachspielen statt nur FEN zu laden,
                // damit die volle Historie für spätere PGN-Analyse erhalten bleibt
                const replayedGame = new Chess();

                if (Array.isArray(data.history)) {
                    for (const move of data.history) {
                        replayedGame.move({
                            from: move.from,
                            to: move.to,
                            promotion: move.promotion,
                        });
                    }
                }

                setGame(replayedGame);

                setMoveHistory(
                    data.history?.map((move: any) => move.san) ?? []
                );

                setBottomColor(data.bottomColor);
                setHumanColor(data.humanColor);
                setBotColor(data.botColor);

                if (data.botElo) {
                    setBotElo(data.botElo);
                }

                setGameStarted(true);
                setSelectedSquare(null);
                setLegalMoves([]);
                setLastMove(null);
                setKingInCheck(null);
                setGameOver(false);
                setEndState(null);

            } catch (error) {
                console.log("Error loading saved bot game:", error);
            }
        };

        loadSavedGame();
    }, [params.key]);

    const displayBoard =
        bottomColor === "w" ? board : [...board].reverse().map(row => [...row].reverse());



    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollToEnd({ animated: true });
        }
    }, [moveHistory]);

    // End-Game-Karte animiert einblenden, genau wie im Online-Screen
    useEffect(() => {
        if (!endState) return;

        endAnimation.setValue(0);

        Animated.timing(endAnimation, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [endState]);

    useEffect(() => {
        return () => {
            if (endPopupTimer.current) {
                clearTimeout(endPopupTimer.current);
            }
        };
    }, []);
    useEffect(() => {
        const onBackPress = () => {
            // Wenn gerade ein Popup offen ist → Popup schließen
            if (showLeaveModal) {
                setShowLeaveModal(false);
                return true;
            }

            if (showRestartModal) {
                setShowRestartModal(false);
                return true;
            }

            if (showSaveModal) {
                setShowSaveModal(false);
                return true;
            }

            // Während einer Partie → Leave-Modal anzeigen
            if (gameStarted) {
                setShowLeaveModal(true);
                return true;
            }

            // Im Setup-Screen → normale Navigation
            return false;
        };

        const subscription = BackHandler.addEventListener(
            "hardwareBackPress",
            onBackPress
        );

        return () => subscription.remove();
    }, [gameStarted, showLeaveModal, showRestartModal, showSaveModal]);
    useEffect(() => {
        const s = io("https://checkfall-server-clean-1.onrender.com");
        socket.current = s;

        const onOpponentMove = (data: any) => {
            console.log("🔥 BOT MOVE RECEIVED:", data);

            const moveObj = {
                from: data.from,
                to: data.to,
                promotion: data.promotion
            };

       setGame(prev => {
    const newGame = cloneWithHistory(prev); // GEÄNDERT (vorher: new Chess(prev.fen()))
    const move = newGame.move(moveObj);
    

                if (!move) {
                    console.log("❌ INVALID BOT MOVE:", moveObj);
                    return prev;
                }

                setMoveHistory(h => [...h, move.san]);
                setLastMove({ from: move.from, to: move.to });

                checkGameEnd(newGame);
                return newGame;
            });
        };

        s.on("connect", async () => {
            console.log("✅ Connected:", s.id);

            // Gespeichertes Bot-Spiel fortsetzen
            if (params.key) {
                try {
                    const key = params.key as string;
                    const stored = await AsyncStorage.getItem(key);

                    if (!stored) return;

                    const data = JSON.parse(stored);

                    console.log("🔄 RESUMING SAVED BOT GAME");

                    s.emit("find_bot_match", {
                        name: "Player",
                        avatar: "",
                        level: data.botElo ?? BOT_ELO_DEFAULT,
                        playerColor: data.humanColor,
                        startFEN: data.fen,
                    });

                } catch (error) {
                    console.log("❌ Error resuming bot game:", error);
                }
            }
        });
        s.on("game_start", (data) => {
            console.log("🎮 GAME START:", data);

            setRoomId(data.roomId);

            const playerIsWhite = data.white !== "bot";

            const actualHumanColor: "w" | "b" =
                playerIsWhite ? "w" : "b";

            const actualBotColor: "w" | "b" =
                playerIsWhite ? "b" : "w";

            console.log("🎨 ACTUAL COLORS:", {
                human: actualHumanColor,
                bot: actualBotColor,
            });

            setHumanColor(actualHumanColor);
            setBotColor(actualBotColor);

            // ==========================================
            // NEUES SPIEL
            // ==========================================

            if (!params.key) {
                setBottomColor(actualHumanColor);

                setGame(new Chess());
                setMoveHistory([]);
                setLastMove(null);
                setSelectedSquare(null);
                setLegalMoves([]);
                setKingInCheck(null);
                setGameOver(false);
                setEndState(null);
                setGameStarted(true);

                return;
            }

            // ==========================================
            // SAVED GAME
            // ==========================================

            setBottomColor(actualHumanColor);
            setGameStarted(true);
        });

        s.on("opponent_move", onOpponentMove);

        return () => {
            s.off("opponent_move", onOpponentMove);
            s.disconnect();
        };
    }, []);
    const botMoveRef = useRef(false);
    // grobe lokale Einschätzung der Enginetiefe passend zur ELO (nur informativ,
    // die tatsächliche Tiefe/Skill wird serverseitig aus "level" berechnet)
    const eloToDepth = (elo: number) => {
        const clamped = Math.min(BOT_ELO_MAX, Math.max(BOT_ELO_MIN, elo));
        const skill = Math.round(clamped / 50);
        return Math.max(2, Math.round(2 + skill * 0.65));
    };
    const [isBotThinking, setIsBotThinking] = useState(false);


 const handlePromotion = (pieceType: string) => {
    if (!promotionMove) return;
    const newGame = cloneWithHistory(game); // GEÄNDERT (vorher: new Chess(game.fen()))
    const move = newGame.move({
        from: promotionMove.from,
        to: promotionMove.to,
        promotion: pieceType,
    });
    
        if (!move) return;
        setGame(newGame);
        setMoveHistory(prev => [...prev, move.san]);
        setLastMove({ from: move.from, to: move.to });
        socket.current?.emit("player_move", {
            roomId,
            move: {
                from: move.from,
                to: move.to,
                promotion: pieceType,
            },
            fen: newGame.fen(),
        });
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
                botElo,

            })
        );
    };

    const resetToSetupScreen = () => {
        setGame(new Chess());
        setSelectedSquare(null);
        setLegalMoves([]);
        setPromotionMove(null);
        setMoveHistory([]);
        setLastMove(null);
        setKingInCheck(null);
        setGameOver(false);
        setEndState(null);
        setRoomId(null);
        setGameStarted(false);
    };

    // currentGame: Chess
    const getKingSquare = (
        currentGame: Chess,
        color: "w" | "b"
    ) => {
        const board = currentGame.board(); // 2D Array mit Pieces oder null
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

    const showEndPopupAfterDelay = (state: EndState) => {
        setGameOver(true);

        if (endPopupTimer.current) {
            clearTimeout(endPopupTimer.current);
        }

        endPopupTimer.current = setTimeout(() => {
            setEndState(state);
        }, 700); // Verzögerung, damit der letzte Zug sichtbar ist
    };

    const checkGameEnd = (currentGame: Chess) => {
        if (currentGame.isCheck()) {
            const checkedKing = getKingSquare(
                currentGame,
                currentGame.turn()
            );
            setKingInCheck(checkedKing);
        } else {
            setKingInCheck(null);
        }

        if (currentGame.isCheckmate()) {
            const loser = currentGame.turn();
            const winner = loser === "w" ? "b" : "w";
            const result: "win" | "loss" | "draw" =
                winner === humanColor ? "win"
                    : winner === botColor ? "loss"
                        : "draw";

            // Königfeld ermitteln
            const kingSquare = getKingSquare(currentGame, loser); // chess.js liefert z.B. "e8"
            setKingInCheck(kingSquare);
            saveGameToHistory("bot", result, currentGame.pgn());       // Checkmate

            showEndPopupAfterDelay({ type: result, reason: "checkmate" });
            return true;
        }
        if (currentGame.isStalemate()) {
            saveGameToHistory("bot", "draw", currentGame.pgn());
            showEndPopupAfterDelay({ type: "draw", reason: "stalemate" });
            return true;
        }

        if (currentGame.isThreefoldRepetition()) {
            saveGameToHistory("bot", "draw", currentGame.pgn());
            showEndPopupAfterDelay({ type: "draw", reason: "draw" });
            return true;
        }

        if (currentGame.isInsufficientMaterial()) {
            saveGameToHistory("bot", "draw", currentGame.pgn());
            showEndPopupAfterDelay({ type: "draw", reason: "draw" });
            return true;
        }

        if (currentGame.isDraw()) {
            saveGameToHistory("bot", "draw", currentGame.pgn());
            showEndPopupAfterDelay({ type: "draw", reason: "draw" });
            return true;
        }

        return false;
    };
    async function saveGameToHistory(
        mode: "bot",
        result: "win" | "loss" | "draw" | "aborted",
        pgn: string,
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
    remoteId: null, // NEU, wird gleich befüllt falls Sync klappt
});

await AsyncStorage.setItem(key, JSON.stringify(history));

try {
    const acc = await getCurrentAccount();

    if (acc && !acc.guest && acc.authId) {
        const remoteId = await saveGameRecord({
            userId: acc.authId,
            opponentId: null, // bei bot-game.tsx einfach null lassen
            mode,
            result,
            pgn,
        });

        // NEU: remoteId nachträglich in denselben History-Eintrag schreiben
        if (remoteId) {
            const updatedHistory = history.map((item: any) =>
                item.timestamp === (timestamp ?? history[0].timestamp)
                    ? { ...item, remoteId }
                    : item
            );
            await AsyncStorage.setItem(key, JSON.stringify(updatedHistory));
        }
    }
} catch (error) {
    console.log("SAVE GAME RECORD ERROR:", error);
}
    }

    const animatedCardStyle = {
        opacity: endAnimation,
        transform: [
            {
                translateY: endAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                }),
            },
            {
                scale: endAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                }),
            },
        ],
    };

    return (
        <ImageBackground source={backgroundImage}
            style={{ flex: 1 }}
            resizeMode="cover" >
            {!gameStarted ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 20, marginBottom: 16 }}>Start bot game  </Text>
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "center",
                            marginBottom: 18,
                            gap: 10,
                        }}
                    >
                        {["w", "b", "random"].map((c) => (
                            <Pressable
                                key={c}
                                onPress={() => setPlayerColor(c as any)}
                                style={{
                                    paddingVertical: 12,
                                    paddingHorizontal: 18,
                                    borderRadius: 10,
                                    backgroundColor:
                                        playerColor === c
                                            ? "rgba(255,215,0,0.18)"
                                            : "rgba(255,255,255,0.08)",
                                    borderWidth: 1,
                                    borderColor:
                                        playerColor === c
                                            ? "#FFD700"
                                            : "rgba(255,255,255,0.15)",
                                }}
                            >
                                <Text
                                    style={{
                                        color: "#fff",
                                        fontSize: 15,
                                        fontWeight: "600",
                                    }}
                                >
                                    {c === "w"
                                        ? "white"
                                        : c === "b"
                                            ? "black"
                                            : "random"}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* ELO Slider statt fester Buttons */}
                    <View style={{ width: "80%", alignItems: "center", marginBottom: 20 }}>
                        <Text style={{ color: "#FFD700", fontSize: 16, fontWeight: "700", marginBottom: 6 }}>
                            {getEloLabel(botElo)} • ELO {botElo}
                        </Text>
                        <EloSlider
                            minimumValue={BOT_ELO_MIN}
                            maximumValue={BOT_ELO_MAX}
                            step={BOT_ELO_STEP}
                            value={botElo}
                            onValueChange={setBotElo}
                        />
                        <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
                            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{BOT_ELO_MIN}</Text>
                            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{BOT_ELO_MAX}</Text>
                        </View>
                    </View>

                    <Pressable
                        onPress={() => {
                            // Wenn savedData existiert, dann einfach Spiel starten
                            if (savedData) {
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

                            // 🔥 HIER HIN
                            socket.current?.emit("find_bot_match", {
                                name: "Player",
                                avatar: "",
                                level: botElo,
                                playerColor: playerColor === "random" ? null : playerColor,
                                startFEN: "startpos"
                            });


                        }}
                        style={{
                            marginTop: 12,
                            paddingVertical: 14,
                            paddingHorizontal: 28,
                            borderRadius: 10,
                            backgroundColor: "rgba(255,215,0,0.18)",
                            borderWidth: 1,
                            borderColor: "#FFD700",
                            shadowColor: "#000",
                            shadowOpacity: 0.25,
                            shadowRadius: 6,
                            shadowOffset: { width: 0, height: 3 },
                        }}
                    >
                        <Text style={{
                            color: "#fff",
                            fontSize: 16,
                            fontWeight: "700",
                        }}>
                            Start game
                        </Text>
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

                                                      const newGame = cloneWithHistory(game); // GEÄNDERT (vorher: new Chess(game.fen()))
const move = newGame.move({ from: selectedSquare as any, to: square as any });
                                                        if (!move) return;

                                                        setGame(newGame);
                                                        setMoveHistory(prev => [...prev, move.san]);
                                                        setLastMove({ from: move.from, to: move.to });
                                                        setSelectedSquare(null);
                                                        setLegalMoves([]);
                                                        checkGameEnd(newGame);

                                                        if (!roomId) return; // Sicherheitshalber
                                                        socket.current?.emit("player_move", {
                                                            roomId: roomId,
                                                            // WICHTIG: der Server erwartet ein Objekt {from, to, promotion?},
                                                            // kein UCI-String - sonst wird der Zug serverseitig verworfen
                                                            // und der Bot bekommt nie mit, dass er am Zug ist.
                                                            move: { from: move.from, to: move.to },
                                                            fen: newGame.fen(), // Optional, falls der Server die aktuelle Stellung braucht
                                                        });

                                                    }
                                                }}
                                                style={[
                                                    styles.square,
                                                    {
                                                        backgroundColor:
                                                            square === kingInCheck
                                                                ? "#ff4d4d"
                                                                : isLastTo
                                                                    ? "#6bb6ff"
                                                                    : isLastFrom
                                                                        ? "#4da3ff"
                                                                        : isSelected
                                                                            ? "#4da3ff"
                                                                            : isDark
                                                                                ? "#b58863"
                                                                                : "#e7d5b7",

                                                        borderWidth: 0,
                                                        borderColor: "transparent",
                                                    },
                                                ]}
                                            >
                                                {pieceKey && (
                                                    <Image
                                                        source={pieces[pieceKey]}
                                                        style={[
                                                            styles.piece,
                                                            {
                                                                transform: [
                                                                    {
                                                                        scale:
                                                                            pieceKey === "wp" ? 1.35 :
                                                                                pieceKey === "wn" ? 1.55 :
                                                                                    pieceKey === "wb" ? 1.7 :
                                                                                        pieceKey === "wr" ? 1.65 :
                                                                                            pieceKey === "wq" ? 1.55 :
                                                                                                pieceKey === "wk" ? 1.30 :

                                                                                                    pieceKey === "bp" ? 1.3 :
                                                                                                        pieceKey === "bn" ? 1.20 :
                                                                                                            pieceKey === "bb" ? 1.3 :
                                                                                                                pieceKey === "br" ? 1.15 :
                                                                                                                    pieceKey === "bq" ? 1.25 :
                                                                                                                        pieceKey === "bk" ? 1.15 :

                                                                                                                            1
                                                                    },
                                                                    {
                                                                        translateY:
                                                                            pieceKey === "wb" ? -1.1 :
                                                                                pieceKey === "wr" ? -2 :
                                                                                    pieceKey === "wq" ? -2 :
                                                                                        pieceKey === "wp" ? 1.2 :

                                                                                            pieceKey === "bp" ? 2 :
                                                                                                pieceKey === "bn" ? 2 :
                                                                                                    pieceKey === "br" ? 2 :
                                                                                                        pieceKey === "bq" ? 2 :
                                                                                                            pieceKey === "bb" ? 0.5 :

                                                                                                                0
                                                                    }
                                                                ]
                                                            }
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
                            <Pressable onPress={() => setShowLeaveModal(true)}>
                                <Text style={styles.bottomBtn}>Back</Text>
                            </Pressable>
                            <Pressable
                                onPress={async () => {
                                    await saveGame();
                                    setShowSaveModal(true);
                                }}
                            >
                                <Text style={styles.bottomBtn}>Save</Text>
                            </Pressable>

                            <Pressable onPress={() => setShowRestartModal(true)}>
                                <Text style={styles.bottomBtn}>Restart</Text>
                            </Pressable>
                        </View>

                        {/* =============================
                            LEAVE MODAL
                        ============================= */}
                        <Modal
                            visible={showLeaveModal}
                            transparent
                            animationType="fade"
                            onRequestClose={() => setShowLeaveModal(false)}
                        >
                            <View style={styles.overlay}>
                                <View style={styles.card}>
                                    <Text style={styles.title}>Partie verlassen?</Text>
                                    <Text style={styles.text}>
                                        Dein Fortschritt geht verloren, wenn du das Spiel nicht vorher speicherst.
                                    </Text>

                                    <View style={styles.buttons}>
                                        <Pressable
                                            style={styles.cancelButton}
                                            onPress={() => setShowLeaveModal(false)}
                                        >
                                            <Text style={styles.cancelButtonText}>Abbrechen</Text>
                                        </Pressable>

                                        <Pressable
                                            style={styles.leaveButton}
                                            onPress={async () => {
                                                const now = Date.now();
                                                await saveGameToHistory("bot", "aborted", game.pgn(), now);
                                                setShowLeaveModal(false);
                                                router.back();
                                            }}
                                        >
                                            <Text style={styles.leaveButtonText}>Verlassen</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>
                        </Modal>

                        {/* =============================
                            RESTART MODAL
                        ============================= */}
                        <Modal
                            visible={showRestartModal}
                            transparent
                            animationType="fade"
                            onRequestClose={() => setShowRestartModal(false)}
                        >
                            <View style={styles.overlay}>
                                <View style={styles.card}>
                                    <Text style={styles.title}>Spiel neu starten?</Text>
                                    <Text style={styles.text}>
                                        Dein aktueller Fortschritt geht verloren.
                                    </Text>

                                    <View style={styles.buttons}>
                                        <Pressable
                                            style={styles.cancelButton}
                                            onPress={() => setShowRestartModal(false)}
                                        >
                                            <Text style={styles.cancelButtonText}>Abbrechen</Text>
                                        </Pressable>

                                        <Pressable
                                            style={styles.leaveButton}
                                            onPress={() => {
                                                if (roomId) {
                                                    socket.current?.emit("resign_game", { roomId });
                                                }
                                                setShowRestartModal(false);
                                                resetToSetupScreen();
                                            }}
                                        >
                                            <Text style={styles.leaveButtonText}>Neustarten</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>
                        </Modal>

                        {/* =============================
                            SAVE CONFIRMATION MODAL
                        ============================= */}
                        <Modal
                            visible={showSaveModal}
                            transparent
                            animationType="fade"
                            onRequestClose={() => setShowSaveModal(false)}
                        >
                            <View style={styles.overlay}>
                                <View style={styles.card}>
                                    <Text style={styles.title}>Spiel gespeichert</Text>
                                    <Text style={styles.text}>
                                        Du kannst es unter „Gespeicherte Spiele“ fortsetzen.
                                    </Text>

                                    <Pressable
                                        style={styles.primaryBtn}
                                        onPress={() => setShowSaveModal(false)}
                                    >
                                        <Text style={styles.btnText}>OK</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </Modal>

                        {/* =============================
                            END GAME POPUP
                        ============================= */}
                        {endState && (
                            <View style={styles.endOverlay}>
                                <Animated.View style={[styles.endCard, animatedCardStyle]}>
                                    {endState.type === "win" && (
                                        <>
                                            <Text style={styles.winTitle}>Sieg!</Text>
                                            <Text style={styles.subText}>
                                                {endState.reason === "checkmate"
                                                    ? "Du hast den Bot schachmatt gesetzt."
                                                    : ""}
                                            </Text>
                                        </>
                                    )}

                                    {endState.type === "loss" && (
                                        <>
                                            <Text style={styles.loseTitle}>Niederlage</Text>
                                            <Text style={styles.subText}>
                                                {endState.reason === "checkmate"
                                                    ? "Du wurdest schachmatt gesetzt."
                                                    : ""}
                                            </Text>
                                        </>
                                    )}

                                    {endState.type === "draw" && (
                                        <>
                                            <Text style={styles.drawTitle}>🤝 Remis</Text>
                                            <Text style={styles.subText}>
                                                {endState.reason === "stalemate"
                                                    ? "Patt – keine legalen Züge mehr."
                                                    : "Remis durch Stellungswiederholung oder unzureichendes Material."}
                                            </Text>
                                        </>
                                    )}

                                    <View style={styles.endButtons}>
                                        <Pressable
                                            style={styles.primaryBtn}
                                            onPress={() => {
                                                const color = playerColor === "random" ? (Math.random() < 0.5 ? "w" : "b") : playerColor;

                                                setEndState(null);
                                                setGame(new Chess());
                                                setSelectedSquare(null);
                                                setLegalMoves([]);
                                                setPromotionMove(null);
                                                setMoveHistory([]);
                                                setLastMove(null);
                                                setKingInCheck(null);
                                                setGameOver(false);
                                                setRoomId(null);

                                                setHumanColor(color);
                                                setBottomColor(color);
                                                setBotColor(color === "w" ? "b" : "w");

                                                socket.current?.emit("find_bot_match", {
                                                    name: "Player",
                                                    avatar: "",
                                                    level: botElo,
                                                    playerColor: playerColor === "random" ? null : playerColor,
                                                    startFEN: "startpos",
                                                });
                                            }}
                                        >
                                            <Text style={styles.btnText}>Neue Partie</Text>
                                        </Pressable>

                                        <Pressable
                                            style={styles.secondaryBtn}
                                            onPress={() => {
                                                setEndState(null);
                                                router.back();
                                            }}
                                        >
                                            <Text style={styles.btnText}>Home</Text>
                                        </Pressable>
                                    </View>
                                </Animated.View>
                            </View>
                        )}
                    </View>
                </View>
            )
            }
        </ImageBackground>
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

    // Bottom-Bar im selben Style wie im Online-Screen
    bottomBar: {
        marginTop: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: "#fff",
    },
    bottomBtn: {
        color: "#f6f6f6",
        fontWeight: "600",
        fontSize: 14,
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

    // ==== Popup-Styles im Online-Screen-Design ====
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.72)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 20,
    },
    card: {
        width: "85%",
        maxWidth: 380,
        backgroundColor: "#1E1E1E",
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: "#D4AF37",
    },
    title: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 12,
    },
    text: {
        color: "#d0d0d0",
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
        backgroundColor: "#2c2c2c",
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
    },
    leaveButton: {
        flex: 1,
        backgroundColor: "#c62828",
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
    },
    cancelButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    leaveButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },

    primaryBtn: {
        backgroundColor: "#D4AF37",
        padding: 13,
        borderRadius: 12,
        alignItems: "center",
    },
    secondaryBtn: {
        backgroundColor: "#222",
        padding: 13,
        borderRadius: 12,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#333",
    },
    btnText: {
        color: "#fff",
        fontWeight: "700",
    },

    endOverlay: {
        position: "absolute",
        top: -BOARD_SIZE * 0.05,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
        backgroundColor: "rgba(0,0,0,0.18)",
        borderRadius: 18,
    },
    endCard: {
        width: "85%",
        maxWidth: 380,
        backgroundColor: "#111",
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: "#D4AF37",
        alignItems: "center",
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 12,
    },
    winTitle: {
        fontSize: 38,
        fontWeight: "900",
        color: "#FFD700",
        marginBottom: 8,
    },
    loseTitle: {
        fontSize: 38,
        fontWeight: "900",
        color: "#ff3b3b",
        marginBottom: 8,
    },
    drawTitle: {
        fontSize: 38,
        fontWeight: "900",
        color: "#aaa",
        marginBottom: 8,
    },
    subText: {
        color: "#ccc",
        textAlign: "center",
        lineHeight: 21,
        marginBottom: 16,
    },
    endButtons: {
        width: "100%",
        gap: 10,
    },
});