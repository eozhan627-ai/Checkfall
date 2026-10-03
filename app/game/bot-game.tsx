import AsyncStorage from "@react-native-async-storage/async-storage";
import { Chess } from "chess.js";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
    BackHandler,
    Easing,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import ImageBackground from "../../components/ui/ImageBackground";
import type { Socket } from "socket.io-client";
import { getCurrentAccount } from "../../lib/account";
import { cloneWithHistory } from "../../lib/chessUtils";
import { saveGameRecord } from "../../lib/games";
import { ensureSocketConnected, getSocket } from "../../lib/socket";
import Board from "../../components/game/Board";
import BotSetup, { BotColorChoice } from "../../components/play/BotSetup";
import { BOARD_SIZE, MAX_PREMOVES, pieces, pieceToKey } from "../../components/game/pieces";
import { useChessInput } from "../../components/game/useChessInput";
import { log } from "../../lib/log";
import { tr } from "../../lib/i18n";
import { playSound, useMoveSound } from "../../lib/sounds";
import { reportTaskEvent } from "../../lib/dailyTasks";
import { MIN_PLIES_FOR_GAME, countPlies } from "../../lib/dailyTaskRules";

// GEÄNDERT: vorher ungedeckelt (Fensterbreite - 32), dadurch wurde das Brett
// auf breiten Bildschirmen (Laptop/Web) riesig, weil <Board> ohne
// begrenzenden Wrapper einfach 92% des verfügbaren Platzes eingenommen hat.
// Jetzt genauso gedeckelt wie im Online-Spiel (online-game.tsx) und zusätzlich
// unten als feste Breite um <Board> gelegt (siehe boardWrapper).



// The bot's strength goes up to 3200 - from there it plays at full Stockfish
// strength (the calibration happens on the server).
const BOT_ELO_DEFAULT = 300;

type EndState = {
    type: "win" | "loss" | "draw";
    reason: "checkmate" | "stalemate" | "draw";
};

type Premove = { from: string; to: string };

export default function Playbot() {
    const socket = useRef<Socket | null>(null);
    const [game, setGame] = useState(new Chess());
    const [moveHistory, setMoveHistory] = useState<string[]>([]);

    // Sounds: every move that is added to the list (own, bot, premove).
    useMoveSound(moveHistory);
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

    const backgroundImage = require("../../assets/images/background.jpg");

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
    // NEU (wie im Online-Spiel): Ergebnis-Karte lässt sich wegtippen, um die
    // Endstellung anzuschauen, ohne dass endState verloren geht.
    const [endCardVisible, setEndCardVisible] = useState(true);
    // NEU: Supabase-ID der zuletzt gespeicherten Partie, damit der
    // "Analyse"-Button direkt zur Auswertung verlinken kann.
    // Bleibt null bei Gast-Accounts (dort wird nichts remote gespeichert).
    const [lastGameId, setLastGameId] = useState<string | null>(null);

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
                log("Error loading saved bot game:", error);
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

        setEndCardVisible(true); // NEU: Karte bei jedem neuen Ergebnis wieder einblenden
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
            // NEU: Zurück-Taste schließt zuerst nur die Ergebnis-Karte
            // (damit man die Stellung ansehen kann), wie im Online-Spiel.
            if (endState && endCardVisible) {
                setEndCardVisible(false);
                return true;
            }
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
    }, [gameStarted, showLeaveModal, showRestartModal, showSaveModal, endState, endCardVisible]);

    useEffect(() => {
        // Shared app connection (signed-in users with their token, guests
        // without) instead of a second, separate connection.
        const s = getSocket();
        socket.current = s;

        const onOpponentMove = (data: any) => {
            log("🔥 BOT MOVE RECEIVED:", data);

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
                log("❌ INVALID BOT MOVE:", moveObj);
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
                        log("⚠️ PREMOVE INVALID, Kette verworfen:", pm);
                        setPremoves([]);
                    }
                }
            }

            gameRef.current = finalGame;
            setGame(finalGame);
        };

        const onConnect = async () => {
            log("✅ Connected:", s.id);

            if (params.key) {
                try {
                    const key = params.key as string;
                    const stored = await AsyncStorage.getItem(key);

                    if (!stored) return;

                    const data = JSON.parse(stored);

                    log("🔄 RESUMING SAVED BOT GAME");

                    s.emit("find_bot_match", {
                        name: "Player",
                        avatar: "",
                        level: data.botElo ?? BOT_ELO_DEFAULT,
                        playerColor: data.humanColor,
                        startFEN: data.fen,
                    });
                } catch (error) {
                    log("❌ Error resuming bot game:", error);
                }
            }
        };

        const onGameStart = (data: any) => {
            // Only bot games belong to this screen (a resumed online game
            // would arrive on the same connection).
            if (data?.white !== "bot" && data?.black !== "bot") return;

            log("🎮 GAME START:", data);

            setRoomId(data.roomId);
            clearPremoves();
            setLastGameId(null); // NEU: Analyse-Button gehört zur vorherigen Partie

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
        };

        s.on("connect", onConnect);
        s.on("game_start", onGameStart);
        s.on("opponent_move", onOpponentMove);

        if (s.connected) {
            onConnect();
        } else {
            ensureSocketConnected();
        }

        return () => {
            s.off("connect", onConnect);
            s.off("game_start", onGameStart);
            s.off("opponent_move", onOpponentMove);

            // Tell the server to stop the engine for this game. The shared
            // connection itself stays open for the rest of the app.
            if (s.connected) {
                s.emit("leave_bot_game");
            }
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
        setLastGameId(null); // NEU
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

        // Checkmate already has its own sound (the mating move).
        if (state?.reason !== "checkmate") playSound("gameEnd");

        if (endPopupTimer.current) {
            clearTimeout(endPopupTimer.current);
        }

        endPopupTimer.current = setTimeout(() => {
            setEndState(state);
        }, 700);
    };

    // NEU: speichert die Partie und merkt sich die Remote-ID für den Analyse-Button
    const saveFinishedGame = (result: "win" | "loss" | "draw", pgn: string) => {
        // Daily tasks: a game counts once it was really played.
        if (countPlies(pgn) >= MIN_PLIES_FOR_GAME) {
            reportTaskEvent("game_played");
            if (result === "win") reportTaskEvent("game_won");
        }

        saveGameToHistory("bot", result, pgn)
            .then((remoteId) => setLastGameId(remoteId))
            .catch((error) => log("SAVE FINISHED GAME ERROR:", error));
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
            saveFinishedGame(result, currentGame.pgn());

            showEndPopupAfterDelay({ type: result, reason: "checkmate" });
            return true;
        }
        if (currentGame.isStalemate()) {
            saveFinishedGame("draw", currentGame.pgn());
            showEndPopupAfterDelay({ type: "draw", reason: "stalemate" });
            return true;
        }
        if (currentGame.isThreefoldRepetition()) {
            saveFinishedGame("draw", currentGame.pgn());
            showEndPopupAfterDelay({ type: "draw", reason: "draw" });
            return true;
        }
        if (currentGame.isInsufficientMaterial()) {
            saveFinishedGame("draw", currentGame.pgn());
            showEndPopupAfterDelay({ type: "draw", reason: "draw" });
            return true;
        }
        if (currentGame.isDraw()) {
            saveFinishedGame("draw", currentGame.pgn());
            showEndPopupAfterDelay({ type: "draw", reason: "draw" });
            return true;
        }

        return false;
    };

    // Jeden Render die aktuellsten Werte/Funktionen für den Socket-Handler ablegen.
    // (Behebt nebenbei, dass checkGameEnd im Handler sonst mit dem veralteten
    // humanColor/botColor vom ersten Render gerechnet hätte.)
    live.current = { checkGameEnd, roomId };

    // GEÄNDERT: gibt jetzt die remoteId (Supabase-Spiel-ID) zurück oder null,
    // damit der "Analyse"-Button weiß, wohin er verlinken soll.
    async function saveGameToHistory(
        mode: "bot",
        result: "win" | "loss" | "draw" | "aborted",
        pgn: string,
        timestamp?: number
    ): Promise<string | null> {
        const key = "game_history";
        const stored = await AsyncStorage.getItem(key);
        const history = stored ? JSON.parse(stored) : [];

        history.unshift({
            id: Date.now().toString(),
            mode,
            result,
            timestamp: timestamp ?? Date.now(),
            remoteId: null,
            color: humanColor, // the review shows "you" for this side
        });

        await AsyncStorage.setItem(key, JSON.stringify(history));

        let remoteId: string | null = null;

        try {
            const acc = await getCurrentAccount();

            if (acc && !acc.guest && acc.authId) {
                remoteId = await saveGameRecord({
                    userId: acc.authId,
                    opponentId: null,
                    mode,
                    result,
                    pgn,
                    playerColor: humanColor,
                    opponentName: `Stockfish (${botElo >= 3200 ? tr("full strength") : botElo})`,
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
            log("SAVE GAME RECORD ERROR:", error);
        }

        return remoteId ?? null;
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
                <BotSetup
                    elo={botElo}
                    onEloChange={setBotElo}
                    color={playerColor as BotColorChoice}
                    onColorChange={(c) => setPlayerColor(c as any)}
                    hasSavedGame={!!savedData}
                    onBack={() => router.back()}
                    onStart={() => {
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
                            // The colour drawn here is the one that is played.
                            playerColor: color,
                            startFEN: "startpos",
                        });
                    }}
                />
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

                        {/* GEÄNDERT: Wrapper mit fester Breite (wie im Online-Spiel), damit
                            das Brett auf breiten Bildschirmen (Laptop/Web) nicht auf 92%
                            der vollen Fensterbreite aufgeblasen wird. */}
                        <View style={styles.boardWrapper}>
                            {/* Geteilte Board-Komponente, jetzt mit Premove wie im Online-Spiel */}
                            <Board
                                board={displayBoard}
                                selectedSquare={selectedSquare}
                                legalMoves={legalMoves}
                                lastMove={lastMove}
                                checkSquare={kingInCheck}
                                onPressSquare={(square: string) => {
                                    // NEU: nach Spielende keine Züge mehr (auch nicht,
                                    // wenn die Ergebnis-Karte weggetippt wurde).
                                    if (gameOver || endState) return;
                                    onPressSquare(square);
                                }}
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
                                    playSound("premove");
                                }}
                                onClearPremove={clearPremoves}
                            />
                        </View>

                        <View style={styles.bottomBar}>
                            <Pressable onPress={() => setShowLeaveModal(true)}>
                                <Text style={styles.bottomBtn}>{tr("Back")}</Text>
                            </Pressable>
                            <Pressable
                                onPress={async () => {
                                    await saveGame();
                                    setShowSaveModal(true);
                                }}
                            >
                                <Text style={styles.bottomBtn}>{tr("Save")}</Text>
                            </Pressable>

                            <Pressable onPress={() => setShowRestartModal(true)}>
                                <Text style={styles.bottomBtn}>{tr("Restart")}</Text>
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
                                    <Text style={styles.title}>{tr("Leave game?")}</Text>
                                    <Text style={styles.text}>
                                        {tr("Your progress will be lost if you do not save the game first.")}
                                    </Text>

                                    <View style={styles.buttons}>
                                        <Pressable style={styles.cancelButton} onPress={() => setShowLeaveModal(false)}>
                                            <Text style={styles.cancelButtonText}>{tr("Cancel")}</Text>
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
                                            <Text style={styles.leaveButtonText}>{tr("Leave")}</Text>
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
                                    <Text style={styles.title}>{tr("Restart game?")}</Text>
                                    <Text style={styles.text}>
                                        {tr("Your current progress will be lost.")}
                                    </Text>

                                    <View style={styles.buttons}>
                                        <Pressable style={styles.cancelButton} onPress={() => setShowRestartModal(false)}>
                                            <Text style={styles.cancelButtonText}>{tr("Cancel")}</Text>
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
                                            <Text style={styles.leaveButtonText}>{tr("Restart")}</Text>
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
                                    <Text style={styles.title}>{tr("Game saved")}</Text>
                                    <Text style={styles.text}>
                                        {tr("You can continue it under \"Saved Games\".")}
                                    </Text>

                                    <Pressable style={styles.primaryBtn} onPress={() => setShowSaveModal(false)}>
                                        <Text style={styles.btnText}>{tr("OK")}</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </Modal>

                        {/* =============================
                            END GAME POPUP (Stil wie im Online-Spiel)
                        ============================= */}
                        {endState && endCardVisible && (
                            <View style={styles.endOverlay}>
                                <Animated.View style={[styles.endCard, animatedCardStyle]}>
                                    <View
                                        style={[
                                            styles.endCardAccent,
                                            {
                                                backgroundColor:
                                                    endState.type === "win"
                                                        ? "#4ADE80"
                                                        : endState.type === "loss"
                                                            ? "#F87171"
                                                            : "#64748B",
                                            },
                                        ]}
                                    />

                                    <Pressable
                                        style={styles.endCardClose}
                                        onPress={() => setEndCardVisible(false)}
                                        hitSlop={12}
                                    >
                                        <Text style={styles.endCardCloseText}>×</Text>
                                    </Pressable>

                                    {endState.type === "win" && (
                                        <>
                                            <Text style={styles.winTitle}>{tr("Victory!")}</Text>
                                            <Text style={styles.subText}>
                                                {endState.reason === "checkmate" ? tr("You checkmated the bot.") : ""}
                                            </Text>
                                        </>
                                    )}
                                    {endState.type === "loss" && (
                                        <>
                                            <Text style={styles.loseTitle}>{tr("Defeat")}</Text>
                                            <Text style={styles.subText}>
                                                {endState.reason === "checkmate" ? tr("You were checkmated.") : ""}
                                            </Text>
                                        </>
                                    )}
                                    {endState.type === "draw" && (
                                        <>
                                            <Text style={styles.drawTitle}>{tr("Draw")}</Text>
                                            <Text style={styles.subText}>
                                                {endState.reason === "stalemate"
                                                    ? tr("Stalemate – no legal moves left.")
                                                    : tr("Draw by repetition or insufficient material.")}
                                            </Text>
                                        </>
                                    )}

                                    <Pressable
                                        style={styles.endPrimaryBtn}
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
                                            setLastGameId(null);
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
                                        <Text style={styles.btnText}>{tr("New game")}</Text>
                                    </Pressable>

                                    <View style={styles.secondaryRow}>
                                        {/* Nur sichtbar, wenn die Partie remote gespeichert wurde
                                            (nicht bei Gast-Accounts).
                                            HINWEIS: Route "/game/review" ist wie im Online-Spiel
                                            eine Annahme - bei Bedarf auf den echten Pfad anpassen. */}
                                        {lastGameId && (
                                            <Pressable
                                                style={styles.endSecondaryBtn}
                                                onPress={() => {
                                                    router.push({
                                                        pathname: "/game/review",
                                                        params: { gameId: lastGameId, color: humanColor },
                                                    } as any);
                                                }}
                                            >
                                                <Text style={styles.endSecondaryBtnText}>{tr("Analysis")}</Text>
                                            </Pressable>
                                        )}

                                        <Pressable
                                            style={styles.endSecondaryBtn}
                                            onPress={() => {
                                                setEndState(null);
                                                router.back();
                                            }}
                                        >
                                            <Text style={styles.endSecondaryBtnText}>{tr("Home")}</Text>
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
    // NEU: begrenzt & zentriert das Brett (gleicher Ansatz wie online-game.tsx)
    boardWrapper: {
        width: BOARD_SIZE,
        alignSelf: "center",
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
    // Wird weiterhin vom "Game saved"-Modal benutzt (Gold) - bewusst
    // unverändert. Der End-Popup nutzt eigene Styles (endPrimaryBtn usw.).
    primaryBtn: {
        backgroundColor: "#D4AF37",
        padding: 13,
        borderRadius: 12,
        alignItems: "center",
    },
    btnText: {
        color: "#fff",
        fontWeight: "700",
    },

    // =============================
    // END POPUP (übernommen aus online-game.tsx)
    // =============================
    endOverlay: {
        position: "absolute",
        top: -BOARD_SIZE * 0.05,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
        backgroundColor: "rgba(0,0,0,0.55)",
        borderRadius: 18,
    },
    endCard: {
        width: "88%",
        maxWidth: 380,
        backgroundColor: "#141821",
        borderRadius: 28,
        paddingTop: 36,
        paddingBottom: 20,
        paddingHorizontal: 24,
        alignItems: "center",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 14,
    },
    endCardAccent: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 5,
    },
    endCardClose: {
        position: "absolute",
        top: 14,
        right: 14,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: "rgba(255,255,255,0.08)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
    },
    endCardCloseText: {
        color: "#aaa",
        fontSize: 18,
        lineHeight: 20,
    },
    winTitle: { fontSize: 26, fontWeight: "800", color: "#4ADE80", marginBottom: 4 },
    loseTitle: { fontSize: 26, fontWeight: "800", color: "#F87171", marginBottom: 4 },
    drawTitle: { fontSize: 26, fontWeight: "800", color: "#94A3B8", marginBottom: 4 },
    subText: {
        color: "#94A3B8",
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
        marginBottom: 18,
        paddingHorizontal: 8,
    },
    endPrimaryBtn: {
        width: "100%",
        backgroundColor: "#7C9473",
        paddingVertical: 15,
        borderRadius: 16,
        alignItems: "center",
        marginBottom: 12,
    },
    secondaryRow: {
        flexDirection: "row",
        width: "100%",
        gap: 10,
    },
    endSecondaryBtn: {
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.05)",
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    endSecondaryBtnText: {
        color: "#CBD5E1",
        fontSize: 12,
        fontWeight: "600",
    },
});