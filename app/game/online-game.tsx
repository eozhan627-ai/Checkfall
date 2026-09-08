import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Chess } from "chess.js";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
    Image,
    ImageBackground,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    calculateElo,
    getCurrentAccount,
    updateAccount,
} from "../../lib/account";
import { getFriendshipStatusWith, sendFriendRequest } from "../../lib/friends";
import { getSocket } from "../../lib/socket";
import Board from "./components/Board";
import { useChessInput } from "./hooks/useChessInput";

// Board.tsx currently exports a component without declared props types.
const BoardAny: any = Board;

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const BOARD_SIZE = Math.min(Dimensions.get("window").width * 0.9, 520);
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

type EndState = {
    type: "win" | "loss" | "draw";
    reason:
        | "checkmate"
        | "timeout"
        | "resign"
        | "disconnect"
        | "draw";
};

type ChatMessage = {
    id: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    message: string;
    timestamp: number;
};

type FriendStatus = "none" | "pending_sent" | "pending_received" | "friends";

export default function GameScreen() {
    const router = useRouter();
    const navigation = useNavigation();

    const rawParams = useLocalSearchParams();

    const getParam = (key: string) =>
        Array.isArray(rawParams[key])
            ? rawParams[key][0]
            : rawParams[key];

    const initialRoomId = getParam("roomId");
    const initialWhite = getParam("white");
    const initialBlack = getParam("black");

    const [socket, setSocket] =
        useState<ReturnType<typeof getSocket> | null>(null);

    const [roomId, setRoomId] = useState<string | undefined>(initialRoomId);
    const [white, setWhite] = useState<string | undefined>(initialWhite);
    const [black, setBlack] = useState<string | undefined>(initialBlack);

    const [whiteName, setWhiteName] = useState(getParam("whiteName") || "");
    const [blackName, setBlackName] = useState(getParam("blackName") || "");
    const [whiteAvatar, setWhiteAvatar] = useState(getParam("whiteAvatar") || "");
    const [blackAvatar, setBlackAvatar] = useState(getParam("blackAvatar") || "");

    const [whiteRating, setWhiteRating] = useState(
        Number(getParam("whiteRating")) || 1000
    );
    const [blackRating, setBlackRating] = useState(
        Number(getParam("blackRating")) || 1000
    );

    const userId = getParam("userId");

    const [game, setGame] = useState(new Chess());
    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const [lastMove, setLastMove] =
        useState<{ from: string; to: string } | null>(null);

    const [gameEnded, setGameEnded] = useState(false);
    const [myColor, setMyColor] =
        useState<"w" | "b" | null>(null);

    const [myName, setMyName] = useState("");
    const [myAvatar, setMyAvatar] = useState("");
    const [opponentName, setOpponentName] = useState("");
    const [opponentAvatar, setOpponentAvatar] = useState("");

    // NEU: authId des Gegners (bleibt über Sessions/Geräte hinweg gleich,
    // im Gegensatz zur Socket-id) + Freundschaftsstatus dazu.
    const [opponentAuthId, setOpponentAuthId] = useState<string | null>(
        getParam("opponentAuthId") || null
    );
    const [friendStatus, setFriendStatus] = useState<FriendStatus>("none");

    const [whiteTime, setWhiteTime] = useState(300000);
    const [blackTime, setBlackTime] = useState(300000);
    const [activeColor, setActiveColor] =
        useState<"w" | "b">("w");

    const [promotionMove, setPromotionMove] = useState<{
        from: string;
        to: string;
    } | null>(null);
    const [showPromotion, setShowPromotion] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);

    const [endState, setEndState] =
        useState<EndState | null>(null);

    const [showChat, setShowChat] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [chatMessages, setChatMessages] =
        useState<ChatMessage[]>([]);

    const [rematchWaiting, setRematchWaiting] = useState(false);
    const [showRematchOffer, setShowRematchOffer] = useState(false);

    const isLeaving = useRef(false);
    const eloProcessed = useRef(false);
    const endPopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollRef = useRef<ScrollView>(null);
    const chatScrollRef = useRef<ScrollView>(null);

    // The server is authoritative. This ref stores the last exact server clock.
    // The UI interpolates locally between server packets for a smooth timer.
    const clockSync = useRef({
        whiteTime: 300000,
        blackTime: 300000,
        activeColor: "w" as "w" | "b",
        receivedAt: Date.now(),
    });

    const endAnimation = useRef(new Animated.Value(0)).current;

    const backgroundImage =
        require("../../assets/images/onlinebackground.png");

    const myRating =
        myColor === "w" ? whiteRating : blackRating;

    const opponentRating =
        myColor === "w" ? blackRating : whiteRating;

    const getAvatar = (
        avatar?: string,
        forceRefresh = false
    ) => {
        if (avatar && avatar.length > 0) {
            return {
                uri: forceRefresh
                    ? `${avatar}?t=${Date.now()}`
                    : avatar,
            };
        }

        return require("../../assets/images/platzhalter2.png");
    };

    // =============================
    // LOCAL CLOCK INTERPOLATION
    // =============================

    useEffect(() => {
        const interval = setInterval(() => {
            const sync = clockSync.current;
            const elapsed = Math.max(
                0,
                Date.now() - sync.receivedAt
            );

            const nextWhite =
                sync.activeColor === "w"
                    ? Math.max(0, sync.whiteTime - elapsed)
                    : sync.whiteTime;

            const nextBlack =
                sync.activeColor === "b"
                    ? Math.max(0, sync.blackTime - elapsed)
                    : sync.blackTime;

            setWhiteTime(nextWhite);
            setBlackTime(nextBlack);
        }, 100);

        return () => clearInterval(interval);
    }, []);

    const applyTimerSync = (data: any) => {
        const nextWhite = Number(data?.whiteTime);
        const nextBlack = Number(data?.blackTime);
        const nextActive =
            data?.activeColor === "b" ? "b" : "w";

        if (
            !Number.isFinite(nextWhite) ||
            !Number.isFinite(nextBlack)
        ) {
            return;
        }

        clockSync.current = {
            whiteTime: Math.max(0, nextWhite),
            blackTime: Math.max(0, nextBlack),
            activeColor: nextActive,
            receivedAt: Date.now(),
        };

        setWhiteTime(Math.max(0, nextWhite));
        setBlackTime(Math.max(0, nextBlack));
        setActiveColor(nextActive);
    };

    const formatTime = (milliseconds: number) => {
        const totalSeconds = Math.ceil(
            Math.max(0, milliseconds) / 1000
        );

        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return `${minutes}:${seconds
            .toString()
            .padStart(2, "0")}`;
    };

    const clockStyle = (
        color: "w" | "b"
    ) => {
        const time =
            color === "w"
                ? whiteTime
                : blackTime;

        return [
            styles.clock,
            activeColor === color && styles.activeClock,
            time <= 10000 && styles.dangerClock,
        ];
    };

    // =============================
    // END GAME
    // =============================

    const showEndPopupAfterDelay = (
        state: EndState
    ) => {
        if (endPopupTimer.current) {
            clearTimeout(endPopupTimer.current);
        }

        endPopupTimer.current = setTimeout(() => {
            setEndState(state);
        }, 400);
    };

    const finishOnlineGame = async (
        result: "win" | "loss" | "draw",
        reason:
            | "checkmate"
            | "timeout"
            | "resign"
            | "disconnect"
            | "draw"
    ) => {
        if (eloProcessed.current) return;
        if (!myColor) return;

        eloProcessed.current = true;
        setGameEnded(true);

        try {
            const acc = await getCurrentAccount();

            if (!acc) {
                console.log("Keine aktuelle Account gefunden.");

                showEndPopupAfterDelay({
                    type: result,
                    reason,
                });

                return;
            }

            const currentRating = acc.rating ?? 1000;

            const newRating = calculateElo(
                currentRating,
                opponentRating,
                result
            );

            await updateAccount(acc.id, {
                rating: newRating,
            });

            await saveGameToHistory("online", result);

            showEndPopupAfterDelay({
                type: result,
                reason,
            });
        } catch (error) {
            console.log("ELO UPDATE ERROR:", error);

            // The game result should still be visible even if local
            // rating/history persistence fails.
            showEndPopupAfterDelay({
                type: result,
                reason,
            });
        }
    };

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
            finishOnlineGame("draw", "draw");
        }
    };

    // =============================
    // CHESS INPUT
    // =============================

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

    // =============================
    // SOCKET INITIALIZATION
    // =============================

    useEffect(() => {
        const s = getSocket();
        setSocket(s);

        const onConnect = async () => {
            const acc = await getCurrentAccount();

            if (!acc) return;

            console.log("Socket ID:", s.id);

            // If this screen was opened from matchmaking,
            // determine color immediately from the route params.
            const color =
                s.id === white
                    ? "w"
                    : s.id === black
                        ? "b"
                        : null;

            if (!color) return;

            setMyColor(color);

            if (color === "w") {
                setMyName(whiteName);
                setMyAvatar(whiteAvatar || "");
                setOpponentName(blackName);
                setOpponentAvatar(blackAvatar || "");
                setOpponentAuthId(getParam("blackAuthId") || null); // NEU
            } else {
                setMyName(blackName);
                setMyAvatar(blackAvatar || "");
                setOpponentName(whiteName);
                setOpponentAvatar(whiteAvatar || "");
                setOpponentAuthId(getParam("whiteAuthId") || null); // NEU
            }
        };

        const handleGameStart = (data: any) => {
            if (!data?.roomId) return;

            // This also handles Revanche without navigating away.
            setRoomId(data.roomId);

            const nextWhite =
                data.white !== undefined
                    ? String(data.white)
                    : white;

            const nextBlack =
                data.black !== undefined
                    ? String(data.black)
                    : black;

            setWhite(nextWhite);
            setBlack(nextBlack);

            const color =
                s.id === nextWhite
                    ? "w"
                    : s.id === nextBlack
                        ? "b"
                        : null;

            if (!color) return;

            setMyColor(color);

            setWhiteName(
                String(data.whiteName || "Weiß")
            );
            setBlackName(
                String(data.blackName || "Schwarz")
            );
            setWhiteAvatar(
                String(data.whiteAvatar || "")
            );
            setBlackAvatar(
                String(data.blackAvatar || "")
            );

            setWhiteRating(
                Number(data.whiteRating) || 1000
            );
            setBlackRating(
                Number(data.blackRating) || 1000
            );

            setMyName(
                color === "w"
                    ? String(data.whiteName || "Player")
                    : String(data.blackName || "Player")
            );

            setMyAvatar(
                color === "w"
                    ? String(data.whiteAvatar || "")
                    : String(data.blackAvatar || "")
            );

            setOpponentName(
                color === "w"
                    ? String(data.blackName || "Gegner")
                    : String(data.whiteName || "Gegner")
            );

            setOpponentAvatar(
                color === "w"
                    ? String(data.blackAvatar || "")
                    : String(data.whiteAvatar || "")
            );

            // NEU: authId des Gegners für dauerhaftes "Freund hinzufügen"
            setOpponentAuthId(
                color === "w"
                    ? (data.blackAuthId || null)
                    : (data.whiteAuthId || null)
            );

            const nextGame = new Chess(
                data.fen || "startpos"
            );

            setGame(nextGame);
            setMoveHistory([]);
            setLastMove(null);
            setGameEnded(false);
            setEndState(null);
            setShowLeaveModal(false);
            setShowPromotion(false);
            setPromotionMove(null);
            setRematchWaiting(false);
            setShowRematchOffer(false);
            setChatMessages([]);

            eloProcessed.current = false;
            isLeaving.current = false;

            if (
                data.whiteTime !== undefined &&
                data.blackTime !== undefined
            ) {
                applyTimerSync({
                    whiteTime: data.whiteTime,
                    blackTime: data.blackTime,
                    activeColor:
                        data.activeColor || "w",
                });
            }
        };

        if (s.connected) {
            onConnect();
        } else {
            s.on("connect", onConnect);
        }

        s.on("game_start", handleGameStart);

        return () => {
            s.off("connect", onConnect);
            s.off("game_start", handleGameStart);
        };
    }, []);

    // =============================
    // FRIENDS: STATUS LADEN
    // =============================

    useEffect(() => {
        if (!opponentAuthId) {
            setFriendStatus("none");
            return;
        }

        let cancelled = false;

        getFriendshipStatusWith(opponentAuthId).then((status) => {
            if (!cancelled) setFriendStatus(status);
        });

        return () => {
            cancelled = true;
        };
    }, [opponentAuthId]);

    const handleAddFriend = async () => {
        if (!opponentAuthId) return;

        try {
            await sendFriendRequest(opponentAuthId);
            setFriendStatus("pending_sent");
        } catch (error: any) {
            Alert.alert(
                "Nicht möglich",
                error?.message || "Anfrage konnte nicht gesendet werden."
            );
        }
    };

    // =============================
    // TIMER / GAME EVENTS
    // =============================

    useEffect(() => {
        if (!socket) return;

        const handleTimerUpdate = (data: any) => {
            applyTimerSync(data);
        };

        const handleGameOver = (data: any) => {
            if (isLeaving.current) return;
            if (eloProcessed.current) return;

            const result =
                data?.type === "draw"
                    ? "draw"
                    : data?.winner === socket.id
                        ? "win"
                        : "loss";

            const reason =
                data?.type === "timeout" ||
                data?.type === "resign" ||
                data?.type === "disconnect" ||
                data?.type === "checkmate" ||
                data?.type === "draw"
                    ? data.type
                    : "draw";

            finishOnlineGame(
                result,
                reason
            );
        };

        socket.on(
            "timer_update",
            handleTimerUpdate
        );
        socket.on(
            "game_over",
            handleGameOver
        );

        return () => {
            socket.off(
                "timer_update",
                handleTimerUpdate
            );
            socket.off(
                "game_over",
                handleGameOver
            );
        };
    }, [socket, myColor, opponentRating]);

    // =============================
    // OPPONENT MOVES
    // =============================

    useEffect(() => {
        if (!socket) return;

        const handleOpponentMove = (data: any) => {
            const from =
                data?.from ??
                (typeof data === "string"
                    ? data.slice(0, 2)
                    : null);

            const to =
                data?.to ??
                (typeof data === "string"
                    ? data.slice(2, 4)
                    : null);

            const promotion =
                data?.promotion ?? null;

            if (!from || !to) return;

            setGame((prev) => {
                const newGame =
                    new Chess(prev.fen());

                const result =
                    newGame.move({
                        from,
                        to,
                        promotion,
                    });

                if (!result) {
                    console.log(
                        "IGNORED INVALID MOVE:",
                        {
                            from,
                            to,
                            promotion,
                        }
                    );

                    return prev;
                }

                setMoveHistory((history) => [
                    ...history,
                    result.san,
                ]);

                setLastMove({
                    from: result.from,
                    to: result.to,
                });

                return newGame;
            });
        };

        socket.on(
            "opponent_move",
            handleOpponentMove
        );

        return () => {
            socket.off(
                "opponent_move",
                handleOpponentMove
            );
        };
    }, [socket]);

    // =============================
    // DRAW
    // =============================

    useEffect(() => {
        if (!socket) return;

        const handleDrawOffer = (data: any) => {
            Alert.alert(
                "Remis angeboten",
                `${
                    data?.name || "Dein Gegner"
                } möchte Remis.`,
                [
                    {
                        text: "Ablehnen",
                        style: "cancel",
                        onPress: () =>
                            socket.emit(
                                "answer_draw",
                                {
                                    roomId,
                                    accept: false,
                                }
                            ),
                    },
                    {
                        text: "Annehmen",
                        onPress: () =>
                            socket.emit(
                                "answer_draw",
                                {
                                    roomId,
                                    accept: true,
                                }
                            ),
                    },
                ]
            );
        };

        const handleDrawDeclined = () => {
            Alert.alert(
                "Remis abgelehnt",
                "Dein Gegner möchte weiterspielen."
            );
        };

        socket.on(
            "draw_offer",
            handleDrawOffer
        );
        socket.on(
            "draw_declined",
            handleDrawDeclined
        );

        return () => {
            socket.off(
                "draw_offer",
                handleDrawOffer
            );
            socket.off(
                "draw_declined",
                handleDrawDeclined
            );
        };
    }, [socket, roomId]);

    // =============================
    // CHAT
    // =============================

    useEffect(() => {
        if (!socket) return;

        const handleChatMessage = (
            message: ChatMessage
        ) => {
            setChatMessages((current) => [
                ...current,
                message,
            ]);

            setTimeout(() => {
                chatScrollRef.current?.scrollToEnd({
                    animated: true,
                });
            }, 50);
        };

        socket.on(
            "chat_message",
            handleChatMessage
        );

        return () => {
            socket.off(
                "chat_message",
                handleChatMessage
            );
        };
    }, [socket]);

    const sendChatMessage = () => {
        const message =
            chatInput.replace(/\s+/g, " ").trim();

        if (!message || !socket || !roomId) {
            return;
        }

        socket.emit(
            "send_chat_message",
            {
                roomId,
                message: message.slice(0, 300),
            }
        );

        setChatInput("");
    };

    // =============================
    // REMATCH
    // =============================

    useEffect(() => {
        if (!socket) return;

        const handleRematchRequested = () => {
            setRematchWaiting(true);
        };

        const handleRematchOffer = () => {
            setShowRematchOffer(true);
        };

        const handleRematchDeclined = () => {
            setRematchWaiting(false);

            Alert.alert(
                "Revanche abgelehnt",
                "Dein Gegner möchte keine Revanche."
            );
        };

        const handleRematchError = (
            data: any
        ) => {
            setRematchWaiting(false);

            Alert.alert(
                "Revanche nicht möglich",
                data?.message ||
                    "Dein Gegner ist nicht mehr online."
            );
        };

        socket.on(
            "rematch_requested",
            handleRematchRequested
        );
        socket.on(
            "rematch_offer",
            handleRematchOffer
        );
        socket.on(
            "rematch_declined",
            handleRematchDeclined
        );
        socket.on(
            "rematch_error",
            handleRematchError
        );

        return () => {
            socket.off(
                "rematch_requested",
                handleRematchRequested
            );
            socket.off(
                "rematch_offer",
                handleRematchOffer
            );
            socket.off(
                "rematch_declined",
                handleRematchDeclined
            );
            socket.off(
                "rematch_error",
                handleRematchError
            );
        };
    }, [socket]);

    const requestRematch = () => {
        if (!socket || !roomId) return;

        setRematchWaiting(true);

        socket.emit(
            "rematch_request",
            { roomId }
        );
    };

    const answerRematch = (
        accept: boolean
    ) => {
        setShowRematchOffer(false);

        if (!socket || !roomId) return;

        if (accept) {
            setRematchWaiting(true);
        }

        socket.emit(
            "rematch_answer",
            {
                roomId,
                accept,
            }
        );
    };

    // =============================
    // NAVIGATION / LEAVE
    // =============================

    const exitGame = (reason: string) => {
        if (
            gameEnded ||
            isLeaving.current
        ) {
            return;
        }

        isLeaving.current = true;
        setShowLeaveModal(false);

        socket?.emit(
            "resign_game",
            { roomId }
        );

        finishOnlineGame(
            "loss",
            "resign"
        );
    };

    const endGame = (
        reason:
            | "resign"
            | "back"
            | "draw"
            | "disconnect"
            | "checkmate"
    ) => {
        if (
            gameEnded ||
            isLeaving.current
        ) {
            return;
        }

        setGameEnded(true);
        setShowLeaveModal(false);
    };

    useEffect(() => {
        const unsubscribe =
            navigation.addListener(
                "beforeRemove",
                (e) => {
                    if (
                        gameEnded ||
                        isLeaving.current
                    ) {
                        return;
                    }

                    e.preventDefault();
                    setShowLeaveModal(true);
                }
            );

        return unsubscribe;
    }, [
        navigation,
        gameEnded,
    ]);

    // =============================
    // PROMOTION
    // =============================

    const handlePromotion = (
        piece:
            | "q"
            | "r"
            | "b"
            | "n"
    ) => {
        if (!promotionMove) return;

        const newGame =
            new Chess(game.fen());

        const move =
            newGame.move({
                from: promotionMove.from,
                to: promotionMove.to,
                promotion: piece,
            });

        if (!move) {
            setPromotionMove(null);
            setShowPromotion(false);
            return;
        }

        setGame(newGame);

        setMoveHistory((prev) => [
            ...prev,
            move.san,
        ]);

        setLastMove({
            from: move.from,
            to: move.to,
        });

        socket?.emit(
            "player_move",
            {
                roomId,
                move: {
                    from: move.from,
                    to: move.to,
                    promotion: piece,
                },
            }
        );

        setPromotionMove(null);
        setShowPromotion(false);

        checkGameState(newGame);
    };

    // =============================
    // CHECK SQUARE
    // =============================

    let checkSquare = null;

    if (game.inCheck()) {
        const board = game.board();

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];

                if (
                    piece &&
                    piece.type === "k" &&
                    piece.color ===
                        game.turn()
                ) {
                    checkSquare =
                        `${FILES[c]}${8 - r}`;
                }
            }
        }
    }

    // =============================
    // MOVE / CHAT SCROLL
    // =============================

    useEffect(() => {
        scrollRef.current?.scrollToEnd({
            animated: true,
        });
    }, [moveHistory]);

    useEffect(() => {
        const history =
            game.history({
                verbose: true,
            });

        if (history.length === 0) return;

        const last =
            history[history.length - 1];

        setLastMove({
            from: last.from,
            to: last.to,
        });
    }, [game]);

    useEffect(() => {
        if (!endState) return;

        endAnimation.setValue(0);

        Animated.timing(
            endAnimation,
            {
                toValue: 1,
                duration: 280,
                easing: Easing.out(
                    Easing.cubic
                ),
                useNativeDriver: true,
            }
        ).start();
    }, [endState]);

    useEffect(() => {
        return () => {
            if (endPopupTimer.current) {
                clearTimeout(
                    endPopupTimer.current
                );
            }
        };
    }, []);

    // =============================
    // HISTORY
    // =============================

    async function saveGameToHistory(
        mode: "online",
        result:
            | "win"
            | "loss"
            | "draw"
            | "aborted",
        timestamp?: number
    ) {
        const key = "game_history";
        const stored =
            await AsyncStorage.getItem(key);

        const history = stored
            ? JSON.parse(stored)
            : [];

        history.unshift({
            id: Date.now().toString(),
            mode,
            result,
            timestamp:
                timestamp ?? Date.now(),
        });

        await AsyncStorage.setItem(
            key,
            JSON.stringify(history)
        );
    }

    // =============================
    // UI
    // =============================

    const displayBoard =
        myColor === "w"
            ? game.board()
            : [
                  ...game.board(),
              ]
                  .reverse()
                  .map((row) =>
                      [...row].reverse()
                  );

    const animatedCardStyle = {
        opacity: endAnimation,
        transform: [
            {
                translateY:
                    endAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                    }),
            },
            {
                scale:
                    endAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [
                            0.92,
                            1,
                        ],
                    }),
            },
        ],
    };

    return (
        <ImageBackground
            source={backgroundImage}
            style={{ flex: 1 }}
            resizeMode="cover"
        >
            <SafeAreaView
                style={{
                    flex: 1,
                    backgroundColor:
                        "transparent",
                }}
            >
                {/* =============================
                    LEAVE MODAL
                ============================= */}
                <Modal
                    visible={showLeaveModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() =>
                        setShowLeaveModal(false)
                    }
                >
                    <View
                        style={
                            styles.overlay
                        }
                    >
                        <View
                            style={
                                styles.card
                            }
                        >
                            <Text
                                style={
                                    styles.title
                                }
                            >
                                Partie verlassen?
                            </Text>

                            <Text
                                style={
                                    styles.text
                                }
                            >
                                Wenn du die Partie
                                verlässt, wird sie
                                als Niederlage
                                gewertet.
                            </Text>

                            <View
                                style={
                                    styles.buttons
                                }
                            >
                                <Pressable
                                    style={
                                        styles.cancelButton
                                    }
                                    onPress={() =>
                                        setShowLeaveModal(
                                            false
                                        )
                                    }
                                >
                                    <Text
                                        style={
                                            styles.cancelButtonText
                                        }
                                    >
                                        Abbrechen
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={
                                        styles.leaveButton
                                    }
                                    onPress={() =>
                                        exitGame(
                                            "resign"
                                        )
                                    }
                                >
                                    <Text
                                        style={
                                            styles.leaveButtonText
                                        }
                                    >
                                        Aufgeben
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* =============================
                    REMATCH OFFER
                ============================= */}
                <Modal
                    visible={
                        showRematchOffer
                    }
                    transparent
                    animationType="fade"
                    onRequestClose={() =>
                        answerRematch(false)
                    }
                >
                    <View
                        style={
                            styles.overlay
                        }
                    >
                        <View
                            style={
                                styles.card
                            }
                        >
                            <Text
                                style={
                                    styles.title
                                }
                            >
                                Revanche?
                            </Text>

                            <Text
                                style={
                                    styles.text
                                }
                            >
                                Dein Gegner möchte
                                eine neue Partie
                                gegen dich spielen.
                            </Text>

                            <View
                                style={
                                    styles.buttons
                                }
                            >
                                <Pressable
                                    style={
                                        styles.cancelButton
                                    }
                                    onPress={() =>
                                        answerRematch(
                                            false
                                        )
                                    }
                                >
                                    <Text
                                        style={
                                            styles.cancelButtonText
                                        }
                                    >
                                        Nein
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={
                                        styles.primaryBtn
                                    }
                                    onPress={() =>
                                        answerRematch(
                                            true
                                        )
                                    }
                                >
                                    <Text
                                        style={
                                            styles.btnText
                                        }
                                    >
                                        Spielen
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* =============================
                    CHAT
                ============================= */}
                <Modal
                    visible={showChat}
                    transparent
                    animationType="slide"
                    onRequestClose={() =>
                        setShowChat(false)
                    }
                >
                    <KeyboardAvoidingView
                        style={
                            styles.chatOverlay
                        }
                        behavior={
                            Platform.OS ===
                            "ios"
                                ? "padding"
                                : undefined
                        }
                    >
                        <View
                            style={
                                styles.chatPanel
                            }
                        >
                            <View
                                style={
                                    styles.chatHeader
                                }
                            >
                                <View>
                                    <Text
                                        style={
                                            styles.chatTitle
                                        }
                                    >
                                        Chat
                                    </Text>
                                    <Text
                                        style={
                                            styles.chatSubtitle
                                        }
                                    >
                                        {
                                            opponentName ||
                                            "Gegner"
                                        }
                                    </Text>
                                </View>

                                <Pressable
                                    onPress={() =>
                                        setShowChat(
                                            false
                                        )
                                    }
                                    style={
                                        styles.chatClose
                                    }
                                >
                                    <Text
                                        style={
                                            styles.chatCloseText
                                        }
                                    >
                                        ×
                                    </Text>
                                </Pressable>
                            </View>

                            <ScrollView
                                ref={
                                    chatScrollRef
                                }
                                style={
                                    styles.chatMessages
                                }
                                contentContainerStyle={
                                    styles.chatMessagesContent
                                }
                                keyboardShouldPersistTaps="handled"
                            >
                                {chatMessages.length ===
                                0 ? (
                                    <Text
                                        style={
                                            styles.emptyChat
                                        }
                                    >
                                        Noch keine
                                        Nachrichten.
                                    </Text>
                                ) : (
                                    chatMessages.map(
                                        (
                                            message
                                        ) => {
                                            const own =
                                                message.senderId ===
                                                socket?.id;

                                            return (
                                                <View
                                                    key={
                                                        message.id
                                                    }
                                                    style={[
                                                        styles.chatBubble,
                                                        own
                                                            ? styles.myChatBubble
                                                            : styles.opponentChatBubble,
                                                    ]}
                                                >
                                                    {!own && (
                                                        <Text
                                                            style={
                                                                styles.chatSender
                                                            }
                                                        >
                                                            {
                                                                message.senderName
                                                            }
                                                        </Text>
                                                    )}

                                                    <Text
                                                        style={
                                                            styles.chatMessageText
                                                        }
                                                    >
                                                        {
                                                            message.message
                                                        }
                                                    </Text>
                                                </View>
                                            );
                                        }
                                    )
                                )}
                            </ScrollView>

                            <View
                                style={
                                    styles.chatInputRow
                                }
                            >
                                <TextInput
                                    value={
                                        chatInput
                                    }
                                    onChangeText={
                                        setChatInput
                                    }
                                    placeholder="Nachricht..."
                                    placeholderTextColor="#888"
                                    maxLength={
                                        300
                                    }
                                    multiline
                                    style={
                                        styles.chatInput
                                    }
                                    onSubmitEditing={
                                        sendChatMessage
                                    }
                                />

                                <Pressable
                                    style={
                                        styles.chatSend
                                    }
                                    onPress={
                                        sendChatMessage
                                    }
                                >
                                    <Text
                                        style={
                                            styles.chatSendText
                                        }
                                    >
                                        Senden
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                {/* =============================
                    PROMOTION
                ============================= */}
                <Modal
                    visible={
                        showPromotion
                    }
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
                                styles.card
                            }
                        >
                            <Text
                                style={
                                    styles.title
                                }
                            >
                                Wähle Umwandlung
                            </Text>

                            <View
                                style={{
                                    flexDirection:
                                        "row",
                                    justifyContent:
                                        "space-around",
                                }}
                            >
                                {(
                                    [
                                        [
                                            "q",
                                            "Dame",
                                        ],
                                        [
                                            "r",
                                            "Turm",
                                        ],
                                        [
                                            "b",
                                            "Läufer",
                                        ],
                                        [
                                            "n",
                                            "Springer",
                                        ],
                                    ] as const
                                ).map(
                                    ([
                                        piece,
                                        label,
                                    ]) => (
                                        <Pressable
                                            key={
                                                piece
                                            }
                                            onPress={() =>
                                                handlePromotion(
                                                    piece
                                                )
                                            }
                                            style={
                                                styles.promotionButton
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.btnText
                                                }
                                            >
                                                {
                                                    label
                                                }
                                            </Text>
                                        </Pressable>
                                    )
                                )}
                            </View>

                            <Pressable
                                onPress={() =>
                                    setShowPromotion(
                                        false
                                    )
                                }
                            >
                                <Text
                                    style={{
                                        color: "red",
                                        marginTop: 18,
                                        textAlign:
                                            "center",
                                    }}
                                >
                                    Abbrechen
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>

                {!socket || !myColor ? (
                    <View
                        style={
                            styles.center
                        }
                    >
                        <Text
                            style={
                                styles.waitText
                            }
                        >
                            Warte auf Verbindung...
                        </Text>
                    </View>
                ) : (
                    <View
                        style={
                            styles.wrapper
                        }
                    >
                        {/* CLOCKS */}
                        <View
                            style={
                                styles.clockRow
                            }
                        >
                            <View
                                style={
                                    clockStyle(
                                        "w"
                                    )
                                }
                            >
                                <Text
                                    style={
                                        styles.clockLabel
                                    }
                                >
                                    ⚪ {whiteName || "Weiß"}
                                </Text>
                                <Text
                                    style={
                                        styles.clockText
                                    }
                                >
                                    {formatTime(
                                        whiteTime
                                    )}
                                </Text>
                            </View>

                            <View
                                style={
                                    clockStyle(
                                        "b"
                                    )
                                }
                            >
                                <Text
                                    style={
                                        styles.clockLabel
                                    }
                                >
                                    ⚫ {blackName || "Schwarz"}
                                </Text>
                                <Text
                                    style={
                                        styles.clockText
                                    }
                                >
                                    {formatTime(
                                        blackTime
                                    )}
                                </Text>
                            </View>
                        </View>

                        <View
                            style={{
                                width: BOARD_SIZE,
                                marginTop: 30,
                            }}
                        >
                            {/* OPPONENT */}
                            <Pressable
                                onPress={() =>
                                    router.push(
                                        {
                                            pathname:
                                                "/profile",
                                            params: {
                                                userId:
                                                    myColor ===
                                                    "w"
                                                        ? black
                                                        : white,
                                                name: opponentName,
                                                avatar: opponentAvatar,
                                            },
                                        }
                                    )
                                }
                                style={
                                    styles.playerRow
                                }
                            >
                                <Image
                                    source={getAvatar(
                                        opponentAvatar
                                    )}
                                    style={
                                        styles.avatar
                                    }
                                    resizeMode="contain"
                                />

                                <View>
                                    <Text
                                        style={
                                            styles.playerName
                                        }
                                    >
                                        {
                                            opponentName
                                        }
                                    </Text>

                                    <Text
                                        style={
                                            styles.playerRating
                                        }
                                    >
                                        {opponentRating}
                                    </Text>

                                    {/* NEU: Freund-hinzufügen-Button */}
                                    {opponentAuthId &&
                                        friendStatus === "none" && (
                                            <Pressable
                                                style={
                                                    styles.addFriendBtn
                                                }
                                                onPress={handleAddFriend}
                                            >
                                                <Text
                                                    style={
                                                        styles.addFriendBtnText
                                                    }
                                                >
                                                    + Freund
                                                </Text>
                                            </Pressable>
                                        )}

                                    {opponentAuthId &&
                                        friendStatus === "pending_sent" && (
                                            <Text style={styles.friendPending}>
                                                Anfrage gesendet
                                            </Text>
                                        )}

                                    {opponentAuthId &&
                                        friendStatus === "pending_received" && (
                                            <Text style={styles.friendPending}>
                                                Hat dich angefragt
                                            </Text>
                                        )}

                                    {opponentAuthId &&
                                        friendStatus === "friends" && (
                                            <Text style={styles.friendPending}>
                                                ✓ Befreundet
                                            </Text>
                                        )}
                                </View>
                            </Pressable>

                            {/* MOVE LIST */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={
                                    false
                                }
                                style={
                                    styles.moveBar
                                }
                                contentContainerStyle={
                                    styles.moveBarContent
                                }
                                ref={
                                    scrollRef
                                }
                            >
                                {moveHistory
                                    .reduce(
                                        (
                                            rows: any[],
                                            move,
                                            index
                                        ) => {
                                            if (
                                                index %
                                                    2 ===
                                                0
                                            ) {
                                                rows.push(
                                                    {
                                                        moveNumber:
                                                            index /
                                                                2 +
                                                            1,
                                                        white:
                                                            move,
                                                        black:
                                                            "",
                                                    }
                                                );
                                            } else {
                                                rows[
                                                    rows.length -
                                                        1
                                                ].black =
                                                    move;
                                            }

                                            return rows;
                                        },
                                        []
                                    )
                                    .map(
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

                            {/* BOARD */}
                            <BoardAny
                                board={
                                    displayBoard
                                }
                                selectedSquare={
                                    input.selectedSquare
                                }
                                legalMoves={
                                    input.legalMoves
                                }
                                lastMove={
                                    lastMove
                                }
                                checkSquare={
                                    checkSquare
                                }
                                pieceToKey={
                                    pieceToKey
                                }
                                pieces={
                                    pieces
                                }
                                onPressSquare={
                                    input.onPressSquare
                                }
                                myColor={
                                    myColor
                                }
                                mode="online"
                            />

                            {/* BOTTOM BAR */}
                            <View
                                style={
                                    styles.bottomBar
                                }
                            >
                                <Pressable
                                    disabled={
                                        gameEnded
                                    }
                                    onPress={() =>
                                        setShowLeaveModal(
                                            true
                                        )
                                    }
                                >
                                    <Text
                                        style={
                                            styles.bottomBtn
                                        }
                                    >
                                        Aufgeben
                                    </Text>
                                </Pressable>

                                <Pressable
                                    disabled={
                                        gameEnded
                                    }
                                    onPress={() => {
                                        socket.emit(
                                            "offer_draw",
                                            {
                                                roomId,
                                            }
                                        );

                                        Alert.alert(
                                            "Remis angeboten",
                                            "Dein Gegner erhält die Remis-Anfrage."
                                        );
                                    }}
                                >
                                    <Text
                                        style={
                                            styles.bottomBtn
                                        }
                                    >
                                        Remis
                                    </Text>
                                </Pressable>

                                <Pressable
                                    onPress={() =>
                                        setShowChat(
                                            true
                                        )
                                    }
                                >
                                    <Text
                                        style={
                                            styles.bottomBtn
                                        }
                                    >
                                        Chat
                                    </Text>
                                </Pressable>
                            </View>

                            {/* =============================
                                END GAME POPUP
                            ============================= */}
                            {endState && (
                                <View
                                    style={
                                        styles.endOverlay
                                    }
                                >
                                    <Animated.View
                                        style={[
                                            styles.endCard,
                                            animatedCardStyle,
                                        ]}
                                    >
                                        {endState.type ===
                                            "win" && (
                                            <>
                                                <Text
                                                    style={
                                                        styles.winTitle
                                                    }
                                                >
                                                    Sieg!
                                                </Text>

                                                <Text
                                                    style={
                                                        styles.subText
                                                    }
                                                >
                                                    {endState.reason ===
                                                    "checkmate"
                                                        ? "Du hast deinen Gegner schachmatt gesetzt."
                                                        : endState.reason ===
                                                          "timeout"
                                                            ? "Die Zeit deines Gegners ist abgelaufen."
                                                            : endState.reason ===
                                                              "resign"
                                                                ? "Dein Gegner hat aufgegeben."
                                                                : endState.reason ===
                                                                  "disconnect"
                                                                    ? "Dein Gegner hat die Verbindung verloren."
                                                                    : ""}
                                                </Text>
                                            </>
                                        )}

                                        {endState.type ===
                                            "loss" && (
                                            <>
                                                <Text
                                                    style={
                                                        styles.loseTitle
                                                    }
                                                >
                                                    Niederlage
                                                </Text>

                                                <Text
                                                    style={
                                                        styles.subText
                                                    }
                                                >
                                                    {endState.reason ===
                                                    "checkmate"
                                                        ? "Du wurdest schachmatt gesetzt."
                                                        : endState.reason ===
                                                          "timeout"
                                                            ? "Deine Zeit ist abgelaufen."
                                                            : endState.reason ===
                                                              "resign"
                                                                ? "Du hast die Partie aufgegeben."
                                                                : endState.reason ===
                                                                  "disconnect"
                                                                    ? "Die Verbindung wurde getrennt."
                                                                    : ""}
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
                                                    Die Partie endet
                                                    im
                                                    Unentschieden.
                                                </Text>
                                            </>
                                        )}

                                        <View
                                            style={
                                                styles.resultRating
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.ratingText
                                                }
                                            >
                                                Deine Elo:{" "}
                                                {
                                                    myRating
                                                }
                                            </Text>
                                        </View>

                                        <View
                                            style={
                                                styles.endButtons
                                            }
                                        >
                                            <Pressable
                                                style={
                                                    styles.primaryBtn
                                                }
                                                onPress={() => {
                                                    setEndState(
                                                        null
                                                    );

                                                    router.replace(
                                                        "/game/waiting"
                                                    );
                                                }}
                                            >
                                                <Text
                                                    style={
                                                        styles.btnText
                                                    }
                                                >
                                                    Neue Partie
                                                </Text>
                                            </Pressable>

                                            <Pressable
                                                style={[
                                                    styles.secondaryBtn,
                                                    rematchWaiting &&
                                                        styles.disabledBtn,
                                                ]}
                                                disabled={
                                                    rematchWaiting
                                                }
                                                onPress={
                                                    requestRematch
                                                }
                                            >
                                                <Text
                                                    style={
                                                        styles.btnText
                                                    }
                                                >
                                                    {rematchWaiting
                                                        ? "Warte auf Gegner..."
                                                        : "Revanche"}
                                                </Text>
                                            </Pressable>

                                            <Pressable
                                                style={
                                                    styles.secondaryBtn
                                                }
                                                onPress={() => {
                                                    setEndState(
                                                        null
                                                    );
                                                    router.replace(
                                                        "/"
                                                    );
                                                }}
                                            >
                                                <Text
                                                    style={
                                                        styles.btnText
                                                    }
                                                >
                                                    Home
                                                </Text>
                                            </Pressable>
                                        </View>
                                    </Animated.View>
                                </View>
                            )}
                        </View>
                    </View>
                )}
            </SafeAreaView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },

    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },

    waitText: {
        color: "#fff",
        fontSize: 16,
    },

    clockRow: {
        width: BOARD_SIZE,
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 4,
    },

    clock: {
        flex: 1,
        minHeight: 68,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: "rgba(15,15,15,0.82)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        justifyContent: "center",
    },

    activeClock: {
        borderColor: "#D4AF37",
        borderWidth: 2,
    },

    dangerClock: {
        borderColor: "#E53935",
    },

    clockLabel: {
        color: "#bbb",
        fontSize: 12,
        marginBottom: 2,
    },

    clockText: {
        color: "#fff",
        fontSize: 25,
        fontWeight: "800",
        fontVariant: ["tabular-nums"],
    },

    playerRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
    },

    avatar: {
        width: 36,
        height: 36,
        backgroundColor: "#fff",
        borderRadius: 6,
        marginRight: 10,
        borderWidth: 2,
        borderColor: "#fff",
        overflow: "hidden",
    },

    playerName: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },

    playerRating: {
        color: "#aaa",
        fontSize: 12,
        marginTop: 1,
    },

    // NEU: Freund-hinzufügen-Button beim Gegner
    addFriendBtn: {
        marginTop: 6,
        alignSelf: "flex-start",
        backgroundColor: "#D4AF37",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },

    addFriendBtnText: {
        color: "#111",
        fontSize: 12,
        fontWeight: "700",
    },

    friendPending: {
        marginTop: 6,
        color: "#aaa",
        fontSize: 12,
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

    resultRating: {
        width: "100%",
        paddingVertical: 10,
        marginBottom: 8,
        borderRadius: 12,
        backgroundColor: "#1d1d1d",
        alignItems: "center",
    },

    ratingText: {
        color: "#aaa",
        fontSize: 13,
    },

    endButtons: {
        width: "100%",
        gap: 10,
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

    disabledBtn: {
        opacity: 0.55,
    },

    btnText: {
        color: "#fff",
        fontWeight: "700",
    },

    promotionButton: {
        paddingHorizontal: 8,
    },

    chatOverlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.45)",
    },

    chatPanel: {
        height: "72%",
        backgroundColor: "#111",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        borderColor: "#D4AF37",
        overflow: "hidden",
    },

    chatHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: "#292929",
    },

    chatTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "800",
    },

    chatSubtitle: {
        color: "#888",
        fontSize: 12,
        marginTop: 2,
    },

    chatClose: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "#222",
        alignItems: "center",
        justifyContent: "center",
    },

    chatCloseText: {
        color: "#fff",
        fontSize: 27,
        lineHeight: 30,
    },

    chatMessages: {
        flex: 1,
    },

    chatMessagesContent: {
        padding: 16,
        gap: 9,
    },

    emptyChat: {
        color: "#777",
        textAlign: "center",
        marginTop: 40,
    },

    chatBubble: {
        maxWidth: "82%",
        paddingHorizontal: 13,
        paddingVertical: 9,
        borderRadius: 16,
    },

    myChatBubble: {
        alignSelf: "flex-end",
        backgroundColor: "#D4AF37",
        borderBottomRightRadius: 4,
    },

    opponentChatBubble: {
        alignSelf: "flex-start",
        backgroundColor: "#252525",
        borderBottomLeftRadius: 4,
    },

    chatSender: {
        color: "#aaa",
        fontSize: 11,
        marginBottom: 3,
        fontWeight: "600",
    },

    chatMessageText: {
        color: "#fff",
        fontSize: 14,
        lineHeight: 19,
    },

    chatInputRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        padding: 12,
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: "#292929",
    },

    chatInput: {
        flex: 1,
        maxHeight: 100,
        minHeight: 44,
        backgroundColor: "#202020",
        color: "#fff",
        borderRadius: 14,
        paddingHorizontal: 13,
        paddingVertical: 11,
        fontSize: 14,
    },

    chatSend: {
        minHeight: 44,
        paddingHorizontal: 15,
        borderRadius: 14,
        backgroundColor: "#D4AF37",
        justifyContent: "center",
    },

    chatSendText: {
        color: "#111",
        fontWeight: "800",
    },
});