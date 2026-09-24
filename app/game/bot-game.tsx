import AsyncStorage from "@react-native-async-storage/async-storage";
import { Chess } from "chess.js";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
    BackHandler,
    Dimensions,
    Easing,
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
import { cloneWithHistory } from "../../lib/chessUtils";
import { saveGameRecord } from "../../lib/games";
import Board from "./components/Board";
import { useChessInput } from "./hooks/useChessInput";

const BOARD_SIZE = Dimensions.get("window").width - 32; // nur noch für Popup-Positionierung gebraucht

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

// Slider geht jetzt bis 3200 - ab da spielt der Bot mit voller Stockfish-Stärke
// (Kalibrierung passiert serverseitig über UCI_LimitStrength/UCI_Elo bzw.
// eine eigene Schwäche-Simulation unterhalb der nativen Engine-Untergrenze).
const BOT_ELO_MIN = 100;
const BOT_ELO_MAX = 3200;
const BOT_ELO_STEP = 50;
const BOT_ELO_DEFAULT = 300;
const MAX_PREMOVES = 8; // so viele Züge kann man maximal hintereinander vormerken

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

type EndState = {
    type: "win" | "loss" | "draw";
    reason: "checkmate" | "stalemate" | "draw";
};

type Premove = { from: string; to: string };

export default function Playbot() {
    const socket = useRef<Socket | null>(null);
    const [game, setGame] = useState(new Chess());
    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const [promotionMove, setPromotionMove] = useState<{ from: string; to: string } | null>(null);
    const [botElo, setBotElo] = useState<number>(BOT_ELO_DEFAULT);
    const [gameStarted, setGameStarted] = useState(false);
    const [bottomColor, setBottomColor] = useState<"w" | "b">("w");
    const [botColor, setBotColor] = useState<"w" | "b">("b");
    const [playerColor, setPlayerColor] = useState<'w' | 'b' | 'random'>('random');
    const [humanColor, setHumanColor] = useState<'w' | 'b'>('w');
    const scrollRef = useRef<ScrollView>(null);
    const board = game.board();
    const [kingInCheck, setKingInCheck] = useState<string | null>(null);
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

    const backgroundImage = require("../../assets/images/onlinebackground.png");

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

    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [showRestartModal, setShowRestartModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);

    const endAnimation = useRef(new Animated.Value(0)).current;
    const endPopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // =============================
    // PREMOVE
    // State (fürs Highlighting im Board) + Ref (für den Socket-Handler, der
    // nur einmal registriert wird und sonst veraltete Werte sehen würde).
    // =============================
    const [premoves, setPremovesState] = useState<Premove[]>([]);
    const premovesRef = useRef<Premove[]>([]);
    const setPremoves = (v: Premove[]) => {
        premovesRef.current = v;
        setPremovesState(v);
    };
    const clearPremoves = () => setPremoves([]);

    // Immer der aktuelle Spielstand für den Socket-Handler
    const gameRef = useRef(game);
    gameRef.current = game;

    // Der Socket-Handler wird nur einmal registriert -> aktuelle Werte/Funktionen über ein Ref lesen
    const live = useRef<any>({});

    // Premove ist erlaubt, solange das Spiel läuft und der Bot am Zug ist
    const canPremove =
        gameStarted && !gameOver && !endState && game.turn() !== humanColor;

    // =============================
    // Board-Interaktion läuft über den geteilten Hook,
    // genau wie in online-game.tsx, statt über einen eigenen onPressSquare.
    // setShowPromotion ist hier ein No-Op, weil die Promotion-Leiste in
    // diesem Screen schon allein an promotionMove hängt (siehe JSX unten).
    // =============================
    const { selectedSquare, legalMoves, onPressSquare } = useChessInput({
        game,
        setGame,
        socket: socket.current,
        roomId,
        myColor: humanColor,
        setPromotionMove,
        setShowPromotion: () => { },
        setMoveHistory: (updater: any) =>
            setMoveHistory((prev) =>
                typeof updater === "function" ? updater(prev) : updater
            ),
        setLastMove,
        checkGameEnd: (g: Chess) => checkGameEnd(g),
    });

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

                // Züge einzeln nachspielen statt nur FEN zu laden, damit die
                // volle Historie für spätere PGN-Analyse erhalten bleibt.
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
                setMoveHistory(data.history?.map((move: any) => move.san) ?? []);
                setBottomColor(data.bottomColor);
                setHumanColor(data.humanColor);
                setBotColor(data.botColor);

                if (data.botElo) {
                    setBotElo(data.botElo);
                }

                setGameStarted(true);
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

    // Spiel vorbei oder zurück im Setup -> Premove verwerfen
    useEffect(() => {
        if (gameOver || !gameStarted) {
            clearPremoves();
        }
    }, [gameOver, gameStarted]);

    useEffect(() => {
        const onBackPress = () => {
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
            if (gameStarted) {
                setShowLeaveModal(true);
                return true;
            }
            return false;
        };

        const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
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
                promotion: data.promotion,
            };

            // Außerhalb von setGame arbeiten (keine Side-Effects im Updater)
            const newGame = cloneWithHistory(gameRef.current);
            let move: any = null;
            try {
                move = newGame.move(moveObj);
            } catch {
                move = null;
            }

            if (!move) {
                console.log("❌ INVALID BOT MOVE:", moveObj);
                return;
            }

            setMoveHistory((h) => [...h, move.san]);
            setLastMove({ from: move.from, to: move.to });

            // live.current.checkGameEnd ist immer die Version des letzten Renders
            // (mit aktuellem humanColor/botColor)
            const ended = live.current.checkGameEnd(newGame);

            let finalGame = newGame;

            // ---------- PREMOVE AUSFÜHREN (immer der erste der Kette) ----------
            const queue = premovesRef.current;
            if (queue.length > 0) {
                if (ended) {
                    setPremoves([]);
                } else {
                    const [pm, ...rest] = queue;
                    const pmGame = cloneWithHistory(newGame);
                    let pmMove: any = null;
                    try {
                        // promotion: "q" wird von chess.js bei Nicht-Umwandlungszügen ignoriert,
                        // Bauern-Premoves auf die letzte Reihe werden so automatisch zur Dame
                        pmMove = pmGame.move({ from: pm.from, to: pm.to, promotion: "q" });
                    } catch {
                        pmMove = null;
                    }

                    if (pmMove) {
                        // Rest der Kette bleibt stehen und wird nach dem nächsten Bot-Zug gespielt
                        setPremoves(rest);
                        finalGame = pmGame;
                        setMoveHistory((h) => [...h, pmMove.san]);
                        setLastMove({ from: pmMove.from, to: pmMove.to });

                        s.emit("player_move", {
                            roomId: live.current.roomId,
                            move: {
                                from: pmMove.from,
                                to: pmMove.to,
                                promotion: pmMove.promotion,
                            },
                            fen: pmGame.fen(),
                        });

                        live.current.checkGameEnd(pmGame);
                    } else {
                        // Ist ein Premove ungültig, sind auch die folgenden hinfällig
                        console.log("⚠️ PREMOVE INVALID, Kette verworfen:", pm);
                        setPremoves([]);
                    }
                }
            }

            gameRef.current = finalGame;
            setGame(finalGame);
        };

        s.on("connect", async () => {
            console.log("✅ Connected:", s.id);

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
            clearPremoves();

            const playerIsWhite = data.white !== "bot";
            const actualHumanColor: "w" | "b" = playerIsWhite ? "w" : "b";
            const actualBotColor: "w" | "b" = playerIsWhite ? "b" : "w";

            setHumanColor(actualHumanColor);
            setBotColor(actualBotColor);

            if (!params.key) {
                setBottomColor(actualHumanColor);
                setGame(new Chess());
                setMoveHistory([]);
                setLastMove(null);
                setKingInCheck(null);
                setGameOver(false);
                setEndState(null);
                setGameStarted(true);
                return;
            }

            setBottomColor(actualHumanColor);
            setGameStarted(true);
        });

        s.on("opponent_move", onOpponentMove);

        return () => {
            s.off("opponent_move", onOpponentMove);
            s.disconnect();
        };
    }, []);

    const handlePromotion = (pieceType: string) => {
        if (!promotionMove) return;
        const newGame = cloneWithHistory(game);
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
        setPromotionMove(null);
        setMoveHistory([]);
        setLastMove(null);
        setKingInCheck(null);
        setGameOver(false);
        setEndState(null);
        setRoomId(null);
        clearPremoves();
        setGameStarted(false);
    };

    const getKingSquare = (currentGame: Chess, color: "w" | "b") => {
        const board = currentGame.board();
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (piece && piece.type === "k" && piece.color === color) {
                    return String.fromCharCode(97 + file) + (8 - rank);
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
        }, 700);
    };

    const checkGameEnd = (currentGame: Chess) => {
        if (currentGame.isCheck()) {
            const checkedKing = getKingSquare(currentGame, currentGame.turn());
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

            const kingSquare = getKingSquare(currentGame, loser);
            setKingInCheck(kingSquare);
            saveGameToHistory("bot", result, currentGame.pgn());

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

    // Jeden Render die aktuellsten Werte/Funktionen für den Socket-Handler ablegen.
    // (Behebt nebenbei, dass checkGameEnd im Handler sonst mit dem veralteten
    // humanColor/botColor vom ersten Render gerechnet hätte.)
    live.current = { checkGameEnd, roomId };

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
            remoteId: null,
        });

        await AsyncStorage.setItem(key, JSON.stringify(history));

        try {
            const acc = await getCurrentAccount();

            if (acc && !acc.guest && acc.authId) {
                const remoteId = await saveGameRecord({
                    userId: acc.authId,
                    opponentId: null,
                    mode,
                    result,
                    pgn,
                });

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
        <ImageBackground source={backgroundImage} style={{ flex: 1 }} resizeMode="cover">
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
                                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
                                    {c === "w" ? "white" : c === "b" ? "black" : "random"}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

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
                            if (savedData) {
                                setHumanColor(savedData.humanColor);
                                setBottomColor(savedData.bottomColor);
                                setBotColor(savedData.botColor);
                                setGameStarted(true);
                                return;
                            }

                            const color = playerColor === "random" ? (Math.random() < 0.5 ? "w" : "b") : playerColor;

                            setHumanColor(color);
                            setBottomColor(color);
                            setBotColor(color === "w" ? "b" : "w");
                            setGameStarted(true);

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
                        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
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

                        {/* Geteilte Board-Komponente, jetzt mit Premove wie im Online-Spiel */}
                        <Board
                            board={displayBoard}
                            selectedSquare={selectedSquare}
                            legalMoves={legalMoves}
                            lastMove={lastMove}
                            checkSquare={kingInCheck}
                            onPressSquare={onPressSquare}
                            pieces={pieces}
                            pieceToKey={pieceToKey}
                            myColor={bottomColor}
                            mode="bot"
                            canPremove={canPremove}
                            premoves={premoves}
                            multiPremove
                            onPremove={(from: string, to: string) => {
                                if (premovesRef.current.length >= MAX_PREMOVES) return;
                                setPremoves([...premovesRef.current, { from, to }]);
                            }}
                            onClearPremove={clearPremoves}
                        />

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
                                        <Pressable style={styles.cancelButton} onPress={() => setShowLeaveModal(false)}>
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
                                        <Pressable style={styles.cancelButton} onPress={() => setShowRestartModal(false)}>
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
                                        Du kannst es unter „Gespeicherte Spiele" fortsetzen.
                                    </Text>

                                    <Pressable style={styles.primaryBtn} onPress={() => setShowSaveModal(false)}>
                                        <Text style={styles.btnText}>OK</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </Modal>

                        {endState && (
                            <View style={styles.endOverlay}>
                                <Animated.View style={[styles.endCard, animatedCardStyle]}>
                                    {endState.type === "win" && (
                                        <>
                                            <Text style={styles.winTitle}>Sieg!</Text>
                                            <Text style={styles.subText}>
                                                {endState.reason === "checkmate" ? "Du hast den Bot schachmatt gesetzt." : ""}
                                            </Text>
                                        </>
                                    )}
                                    {endState.type === "loss" && (
                                        <>
                                            <Text style={styles.loseTitle}>Niederlage</Text>
                                            <Text style={styles.subText}>
                                                {endState.reason === "checkmate" ? "Du wurdest schachmatt gesetzt." : ""}
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
                                                setPromotionMove(null);
                                                setMoveHistory([]);
                                                setLastMove(null);
                                                setKingInCheck(null);
                                                setGameOver(false);
                                                setRoomId(null);
                                                clearPremoves();

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
            )}
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
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
    winTitle: { fontSize: 38, fontWeight: "900", color: "#FFD700", marginBottom: 8 },
    loseTitle: { fontSize: 38, fontWeight: "900", color: "#ff3b3b", marginBottom: 8 },
    drawTitle: { fontSize: 38, fontWeight: "900", color: "#aaa", marginBottom: 8 },
    subText: { color: "#ccc", textAlign: "center", lineHeight: 21, marginBottom: 16 },
    endButtons: { width: "100%", gap: 10 },
});