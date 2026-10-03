import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Chess } from "chess.js";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    BackHandler,
    Easing,
    Image,
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
import ImageBackground from "../../components/ui/ImageBackground";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
    getCurrentAccount,
    setLocalRating,
} from "../../lib/account";
import { claimGameStart } from "../../lib/challenges";
import { cloneWithHistory } from "../../lib/chessUtils";
import { getFriendshipStatusWith, sendFriendRequest } from "../../lib/friends";
import { saveGameRecord } from "../../lib/games";
import { getSocket } from "../../lib/socket";
import Board from "../../components/game/Board";
import { BOARD_SIZE, MAX_PREMOVES, pieces, pieceToKey } from "../../components/game/pieces";
import { useChessInput } from "../../components/game/useChessInput";
import { log } from "../../lib/log";
import { tr } from "../../lib/i18n";
import { playSound, useMoveSound } from "../../lib/sounds";
import { reportTaskEvent } from "../../lib/dailyTasks";
import ReportSheet from "../../components/ReportSheet";
import { MIN_PLIES_FOR_GAME } from "../../lib/dailyTaskRules";

// Board.tsx currently exports a component without declared props types.
const BoardAny: any = Board;

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const SQUARE_SIZE = BOARD_SIZE / 8;

// Same as in the bot game: this many premoves can be queued in a row at most.


const toSquare = (row: number, col: number) => `${FILES[col]}${8 - row}`;

// =============================
// MATERIAL / CAPTURED PIECES
// =============================
// Shows who has captured how many pieces of which type and who is
// ahead on material (e.g. "+1" after a pawn has been captured).
const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const CAPTURED_SYMBOL: Record<string, string> = {
    p: "♟",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
};
const STARTING_COUNTS: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };

type CapturedInfo = {
    // pieces captured by White (i.e. missing Black pieces)
    byWhite: { type: string; count: number }[];
    byBlack: { type: string; count: number }[];
    advantage: number; // positive = White ahead, negative = Black ahead
};

const getMaterialInfo = (g: Chess): CapturedInfo => {
    const counts: Record<string, number> = {};
    for (const row of g.board()) {
        for (const square of row) {
            if (!square) continue;
            const key = `${square.color}${square.type}`;
            counts[key] = (counts[key] || 0) + 1;
        }
    }

    const byWhite: { type: string; count: number }[] = [];
    const byBlack: { type: string; count: number }[] = [];
    let whiteValue = 0;
    let blackValue = 0;

    (Object.keys(STARTING_COUNTS) as (keyof typeof STARTING_COUNTS)[]).forEach(
        (type) => {
            const missingBlack = STARTING_COUNTS[type] - (counts[`b${type}`] || 0);
            const missingWhite = STARTING_COUNTS[type] - (counts[`w${type}`] || 0);

            if (missingBlack > 0) {
                byWhite.push({ type, count: missingBlack });
                whiteValue += missingBlack * PIECE_VALUES[type];
            }
            if (missingWhite > 0) {
                byBlack.push({ type, count: missingWhite });
                blackValue += missingWhite * PIECE_VALUES[type];
            }
        }
    );

    return { byWhite, byBlack, advantage: whiteValue - blackValue };
};

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
    const insets = useSafeAreaInsets();

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

    // Rating after the game as sent by the server (null until it arrives).
    const [ratingAfter, setRatingAfter] = useState<number | null>(null);

    const userId = getParam("userId");

    const [game, setGame] = useState(new Chess());
    const [moveHistory, setMoveHistory] = useState<string[]>([]);

    // Sounds: every move that is added to the list (own, opponent, premove).
    useMoveSound(moveHistory);

    useEffect(() => {
        playSound("gameStart");
    }, []);
    const [lastMove, setLastMove] =
        useState<{ from: string; to: string } | null>(null);

    const [gameEnded, setGameEnded] = useState(false);
    const [myColor, setMyColor] =
        useState<"w" | "b" | null>(null);

    const [myName, setMyName] = useState("");
    const [myAvatar, setMyAvatar] = useState("");
    const [opponentName, setOpponentName] = useState("");
    const [opponentAvatar, setOpponentAvatar] = useState("");

    // NEW: opponent's authId (stays the same across sessions/devices,
    // unlike the socket id) + the friendship status for it.
    const [opponentAuthId, setOpponentAuthId] = useState<string | null>(
        getParam("opponentAuthId") || null
    );
    const [friendStatus, setFriendStatus] = useState<FriendStatus>("none");

    // The clocks start with the time control of this game (sent with the
    // game start); the server keeps them in sync afterwards.
    const initialWhiteTime = Number(getParam("whiteTime")) || 300000;
    const initialBlackTime = Number(getParam("blackTime")) || 300000;

    const [whiteTime, setWhiteTime] = useState(initialWhiteTime);
    const [blackTime, setBlackTime] = useState(initialBlackTime);
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
    // NEW: lets the user swipe away the result card to view the final
    // position (e.g. how checkmate was delivered) without losing endState.
    const [endCardVisible, setEndCardVisible] = useState(true);

    const [showChat, setShowChat] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [chatMessages, setChatMessages] =
        useState<ChatMessage[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const [rematchWaiting, setRematchWaiting] = useState(false);
    const [showRematchOffer, setShowRematchOffer] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);

    // NEW: Supabase game ID of the most recently saved game, so the
    // "Analysis" button can link directly to the game review view.
    // Stays null for guest accounts, since nothing is saved remotely there.
    const [lastGameId, setLastGameId] = useState<string | null>(null);

    const isLeaving = useRef(false);
    const showChatRef = useRef(false);
    const eloProcessed = useRef(false);
    // NEW: so the timer interval (registered only once) knows whether the
    // game has ended in the meantime, without letting the clock keep running.
    const gameEndedRef = useRef(false);
    const endPopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollRef = useRef<ScrollView>(null);
    const chatScrollRef = useRef<ScrollView>(null);

    // =============================
    // PREMOVE (State + Refs)
    // =============================
    // Refs, because the socket handlers are only registered once and would
    // otherwise see stale values (myColor, roomId, checkGameState).
    // Same as in the bot game: a chain of multiple premoves instead of just
    // a single queued move.
    const [premoves, setPremovesState] = useState<{ from: string; to: string }[]>([]);
    const premovesRef = useRef<{ from: string; to: string }[]>([]);
    const gameRef = useRef(game);
    const roomIdRef = useRef(roomId);
    const checkGameStateRef = useRef<(g: Chess) => void>(() => { });

    gameRef.current = game;
    roomIdRef.current = roomId;

    const setPremoves = (v: { from: string; to: string }[]) => {
        premovesRef.current = v;
        setPremovesState(v);
    };

    const clearPremoves = () => setPremoves([]);

    useEffect(() => {
        gameEndedRef.current = gameEnded;
    }, [gameEnded]);

    useEffect(() => {
        showChatRef.current = showChat;
        if (showChat) setUnreadCount(0);
    }, [showChat]);

    // The server is authoritative. This ref stores the last exact server clock.
    // The UI interpolates locally between server packets for a smooth timer.
    const clockSync = useRef({
        whiteTime: initialWhiteTime,
        blackTime: initialBlackTime,
        activeColor: "w" as "w" | "b",
        receivedAt: Date.now(),
    });

    const endAnimation = useRef(new Animated.Value(0)).current;

    const backgroundImage =
        require("../../assets/images/background.jpg");

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
            // NEW: stop counting once the game has ended (win/loss/draw)
            if (gameEndedRef.current) return;

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
        const clamped = Math.max(0, milliseconds);

        // Under 20 seconds: one decimal place for extra precision.
        if (clamped < 20000) {
            return (clamped / 1000).toFixed(1);
        }

        const totalSeconds = Math.ceil(clamped / 1000);

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
        reason: "checkmate" | "timeout" | "resign" | "disconnect" | "draw",
        pgnOverride?: string
    ) => {
        if (eloProcessed.current) return;
        if (!myColor) return;

        eloProcessed.current = true;
        clearPremoves(); // NEW: discard the premove chain once the game ends
        setGameEnded(true);

        // Checkmate already has its own sound (the mating move).
        if (reason !== "checkmate") playSound("gameEnd");

        // Daily tasks: a game counts once it was really played.
        if (gameRef.current.history().length >= MIN_PLIES_FOR_GAME) {
            reportTaskEvent("game_played");
            if (result === "win") reportTaskEvent("game_won");
        }

        try {
            const acc = await getCurrentAccount();

            if (!acc) {
                showEndPopupAfterDelay({ type: result, reason });
                return;
            }

            // The new rating is calculated by the server and arrives via
            // "rating_update" (see the effect below) - nothing to compute here.

            // CHANGED: also pass pgn + opponentAuthId, remember the remoteId
            // for the "Analysis" button (stays null for guest accounts).
            const remoteId = await saveGameToHistory(
                "online",
                result,
                pgnOverride ?? gameRef.current.pgn(),
                opponentAuthId,
                undefined,
                myColor,
                opponentName
            );
            setLastGameId(remoteId);

            showEndPopupAfterDelay({ type: result, reason });
        } catch (error) {
            log("GAME FINISH ERROR:", error);
            showEndPopupAfterDelay({ type: result, reason });
        }
    };

    const checkGameState = (g: Chess) => {
        if (g.isCheckmate()) {
            const result = g.turn() === myColor ? "loss" : "win";
            finishOnlineGame(result, "checkmate", g.pgn());
            return;
        }

        if (g.isStalemate() || g.isDraw()) {
            finishOnlineGame("draw", "draw", g.pgn());
        }
    };

    checkGameStateRef.current = checkGameState;

    // =============================
    // PREMOVE (execution)
    // =============================

    // Stop our own clock immediately and start the opponent's
    // (the server sends the exact times right after and corrects it).
    const switchClockLocally = () => {
        const s = clockSync.current;
        const elapsed = Math.max(0, Date.now() - s.receivedAt);
        const next: "w" | "b" = s.activeColor === "w" ? "b" : "w";

        clockSync.current = {
            whiteTime:
                s.activeColor === "w"
                    ? Math.max(0, s.whiteTime - elapsed)
                    : s.whiteTime,
            blackTime:
                s.activeColor === "b"
                    ? Math.max(0, s.blackTime - elapsed)
                    : s.blackTime,
            activeColor: next,
            receivedAt: Date.now(),
        };

        setActiveColor(next);
    };

    // CHANGED: only plays the FIRST premove of the chain now. The rest
    // stay queued and get processed one after another following each
    // subsequent opponent move — exactly like in the bot game.
    const playPremove = (base: Chess) => {
        const queue = premovesRef.current;
        if (queue.length === 0) return;
        if (eloProcessed.current) return;

        const [pm, ...rest] = queue;
        const next = cloneWithHistory(base);
        let move: any = null;

        try {
            // Promotion: automatically queen
            move = next.move({ from: pm.from, to: pm.to, promotion: "q" });
        } catch {
            move = null;
        }

        if (!move) {
            // If a premove is invalid, the following ones are void too
            log("⚠️ PREMOVE INVALID, chain discarded:", pm);
            setPremoves([]);
            return;
        }

        // The rest of the chain stays queued and is played after the next opponent move
        setPremoves(rest);
        gameRef.current = next;
        setGame(next);
        setMoveHistory((h) => [...h, move.san]);
        setLastMove({ from: move.from, to: move.to });
        switchClockLocally();

        socket?.emit("player_move", {
            roomId: roomIdRef.current,
            move: {
                from: move.from,
                to: move.to,
                promotion: move.promotion,
            },
        });

        checkGameStateRef.current(next);
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

            log("Socket ID:", s.id);

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
                setOpponentAuthId(getParam("blackAuthId") || null); // NEW
            } else {
                setMyName(blackName);
                setMyAvatar(blackAvatar || "");
                setOpponentName(whiteName);
                setOpponentAvatar(whiteAvatar || "");
                setOpponentAuthId(getParam("whiteAuthId") || null); // NEW
            }
        };

        const handleGameStart = (data: any) => {
            if (!data?.roomId) return;

            // This also handles a rematch without navigating away.
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
                String(data.whiteName || "White")
            );
            setBlackName(
                String(data.blackName || "Black")
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
                    ? String(data.blackName || "Opponent")
                    : String(data.whiteName || "Opponent")
            );

            setOpponentAvatar(
                color === "w"
                    ? String(data.blackAvatar || "")
                    : String(data.whiteAvatar || "")
            );

            // NEW: opponent's authId for persistent "add friend"
            setOpponentAuthId(
                color === "w"
                    ? (data.blackAuthId || null)
                    : (data.whiteAuthId || null)
            );

            const nextGame = new Chess(
                data.fen || "startpos"
            );

            gameRef.current = nextGame; // NEW
            clearPremoves(); // NEW

            setGame(nextGame);
            setMoveHistory([]);
            setLastMove(null);
            setGameEnded(false);
            setEndState(null);
            if (!data.resumed) playSound("gameStart");
            setShowLeaveModal(false);
            setShowPromotion(false);
            setPromotionMove(null);
            setRematchWaiting(false);
            setShowRematchOffer(false);
            setChatMessages([]);
            setUnreadCount(0);
            setLastGameId(null); // NEW: the Analysis button belongs to the previous game
            setRatingAfter(null);

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

        // This screen handles new games (rematch, accepted challenge) itself.
        const releaseGameStart = claimGameStart();

        return () => {
            releaseGameStart();
            s.off("connect", onConnect);
            s.off("game_start", handleGameStart);
        };
    }, []);

    // =============================
    // FRIENDS: LOAD STATUS
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
                tr("Not possible"),
                error?.message || tr("The request could not be sent.")
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
    // RATING (decided by the server)
    // =============================

    useEffect(() => {
        if (!socket) return;

        const handleRatingUpdate = async (data: any) => {
            const rating = Number(data?.rating);

            if (!Number.isFinite(rating)) return;

            setRatingAfter(rating);

            try {
                const acc = await getCurrentAccount();

                // Signed-in players read their rating from the server anyway;
                // this keeps the local copy (and guests) up to date.
                if (acc) {
                    await setLocalRating(acc.id, rating);
                }
            } catch (error) {
                log("RATING UPDATE ERROR:", error);
            }
        };

        socket.on("rating_update", handleRatingUpdate);

        return () => {
            socket.off("rating_update", handleRatingUpdate);
        };
    }, [socket]);

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

            // CHANGED: compute the position synchronously via gameRef (instead
            // of the setGame updater), so the premove can be played immediately
            // with the new position.
            const newGame = cloneWithHistory(gameRef.current);
            let result: any = null;

            try {
                result = newGame.move({
                    from,
                    to,
                    promotion: promotion ?? undefined,
                });
            } catch {
                result = null;
            }

            if (!result) {
                log(
                    "IGNORED INVALID MOVE:",
                    {
                        from,
                        to,
                        promotion,
                    }
                );

                return;
            }

            gameRef.current = newGame;
            setGame(newGame);
            setMoveHistory((history) => [
                ...history,
                result.san,
            ]);
            setLastMove({
                from: result.from,
                to: result.to,
            });

            // NEW: fire off the (next) premove of the chain immediately
            playPremove(newGame);
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
                tr("Draw offered"),
                tr("{0} wants a draw.", data?.name || "Your opponent"),
                [
                    {
                        text: tr("Decline"),
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
                        text: tr("Accept"),
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
                tr("Draw declined"),
                tr("Your opponent wants to keep playing.")
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

            // NEW: count unread messages while the chat is not open.
            if (!showChatRef.current) {
                setUnreadCount((c) => c + 1);
            }

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
                tr("Rematch declined"),
                tr("Your opponent doesn't want a rematch.")
            );
        };

        const handleRematchError = (
            data: any
        ) => {
            setRematchWaiting(false);

            Alert.alert(
                tr("Rematch not possible"),
                data?.message ||
                tr("Your opponent is no longer online.")
            );
        };

        // The actual start of the new game happens server-side via a regular
        // "game_start" event (see handleGameStart above) - so no separate
        // "rematch_accepted" handler is needed here.

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
    const handlePromotion = (piece: "q" | "r" | "b" | "n") => {
        if (!promotionMove) return;
        const newGame = cloneWithHistory(game); // CHANGED (previously: new Chess(game.fen()))
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

        setEndCardVisible(true);
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

    // NEW: Android back button first only closes the result card (to view
    // the position), instead of doing nothing or leaving the screen.
    useEffect(() => {
        const onBackPress = () => {
            if (endState && endCardVisible) {
                setEndCardVisible(false);
                return true;
            }
            return false;
        };

        const subscription = BackHandler.addEventListener(
            "hardwareBackPress",
            onBackPress
        );
        return () => subscription.remove();
    }, [endState, endCardVisible]);

    useEffect(() => {
        return () => {
            if (endPopupTimer.current) {
                clearTimeout(
                    endPopupTimer.current
                );
            }
        };
    }, []);

    // Game over -> discard premove chain (same as bot game)
    useEffect(() => {
        if (gameEnded || !!endState) {
            clearPremoves();
        }
    }, [gameEnded, endState]);

    // =============================
    // HISTORY
    // =============================

    // CHANGED: now returns the remoteId (Supabase game ID), or null, so the
    // "Analysis" button knows where to link to.
    async function saveGameToHistory(
        mode: "online",
        result: "win" | "loss" | "draw" | "aborted",
        pgn: string,
        opponentId: string | null,
        timestamp?: number,
        color?: "w" | "b" | null,
        opponent?: string | null
    ): Promise<string | null> {
        const key = "game_history";
        const stored = await AsyncStorage.getItem(key);
        const history = stored ? JSON.parse(stored) : [];

        history.unshift({
            id: Date.now().toString(),
            mode,
            result,
            timestamp: timestamp ?? Date.now(),
            remoteId: null, // NEW, filled in shortly if the sync succeeds
            color: color ?? null, // the review shows "you" for this side
        });

        await AsyncStorage.setItem(key, JSON.stringify(history));

        let remoteId: string | null = null;

        try {
            const acc = await getCurrentAccount();

            if (acc && !acc.guest && acc.authId) {
                remoteId = await saveGameRecord({
                    userId: acc.authId,
                    opponentId: opponentId ?? null, // just leave null in bot-game.tsx
                    mode,
                    result,
                    pgn,
                    playerColor: color ?? null,
                    opponentName: opponent || null,
                });

                // NEW: write the remoteId into the same history entry afterwards
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

        return remoteId;
    }

    // =============================
    // UI
    // =============================

    const material = getMaterialInfo(game);

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
                                {tr("Leave game?")}
                            </Text>

                            <Text
                                style={
                                    styles.text
                                }
                            >
                                {tr("If you leave the game, it will be counted as a loss.")}
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
                                        {tr("Cancel")}
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
                                        {tr("Resign")}
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
                                {tr("Rematch?")}
                            </Text>

                            <Text
                                style={
                                    styles.text
                                }
                            >
                                {tr("Your opponent wants to play a new game against you.")}
                            </Text>

                            <View style={styles.rematchButtons}>
                                <Pressable
                                    style={styles.primaryBtn}
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
                                        {tr("Play")}
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={styles.declineLink}
                                    onPress={() =>
                                        answerRematch(
                                            false
                                        )
                                    }
                                >
                                    <Text
                                        style={
                                            styles.declineLinkText
                                        }
                                    >
                                        {tr("No, thanks")}
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
                                        {tr("Chat")}
                                    </Text>
                                    <Text
                                        style={
                                            styles.chatSubtitle
                                        }
                                    >
                                        {
                                            opponentName ||
                                            tr("Opponent")
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
                                        {tr("No messages yet.")}
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
                                style={[
                                    styles.chatInputRow,
                                    { paddingBottom: 12 + insets.bottom },
                                ]}
                            >
                                <TextInput
                                    value={
                                        chatInput
                                    }
                                    onChangeText={
                                        setChatInput
                                    }
                                    placeholder={tr("Message...")}
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
                                        {tr("Send")}
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
                                {tr("Choose promotion")}
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
                                            "Queen",
                                        ],
                                        [
                                            "r",
                                            "Rook",
                                        ],
                                        [
                                            "b",
                                            "Bishop",
                                        ],
                                        [
                                            "n",
                                            "Knight",
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
                                    {tr("Cancel")}
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
                            {tr("Waiting for connection...")}  </Text>
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
                                    ⚪ {whiteName || tr("White")}
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
                                {(material.byWhite.length > 0 || material.advantage > 0) && (
                                    <View style={styles.capturedRow}>
                                        {material.byWhite.map((c) => (
                                            <Text key={c.type} style={styles.capturedPiece}>
                                                {CAPTURED_SYMBOL[c.type]}
                                                {c.count > 1 ? `×${c.count}` : ""}
                                            </Text>
                                        ))}
                                        {material.advantage > 0 && (
                                            <Text style={styles.capturedAdvantage}>
                                                +{material.advantage}
                                            </Text>
                                        )}
                                    </View>
                                )}
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
                                    ⚫ {blackName || tr("Black")}
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
                                {(material.byBlack.length > 0 || material.advantage < 0) && (
                                    <View style={styles.capturedRow}>
                                        {material.byBlack.map((c) => (
                                            <Text key={c.type} style={styles.capturedPiece}>
                                                {CAPTURED_SYMBOL[c.type]}
                                                {c.count > 1 ? `×${c.count}` : ""}
                                            </Text>
                                        ))}
                                        {material.advantage < 0 && (
                                            <Text style={styles.capturedAdvantage}>
                                                +{Math.abs(material.advantage)}
                                            </Text>
                                        )}
                                    </View>
                                )}
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

                                    {/* NEW: add-friend button */}
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
                                                    {tr("+ Friend")}
                                                </Text>
                                            </Pressable>
                                        )}

                                    {opponentAuthId &&
                                        friendStatus === "pending_sent" && (
                                            <Text style={styles.friendPending}>
                                                {tr("Request sent")}
                                            </Text>
                                        )}

                                    {opponentAuthId &&
                                        friendStatus === "pending_received" && (
                                            <Text style={styles.friendPending}>
                                                {tr("Sent you a request")}
                                            </Text>
                                        )}

                                    {opponentAuthId &&
                                        friendStatus === "friends" && (
                                            <Text style={styles.friendPending}>
                                                {tr("✓ Friends")}
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
                                onPressSquare={(square: string) => {
                                    // FIX: no more moves allowed once the game
                                    // has ended (even after closing the popup).
                                    if (gameEnded || endState) return;
                                    input.onPressSquare(square);
                                }}
                                myColor={
                                    myColor
                                }
                                mode="online"
                                canPremove={
                                    !!myColor &&
                                    !gameEnded &&
                                    !endState &&
                                    !showPromotion &&
                                    game.turn() !== myColor
                                }
                                premoves={premoves}
                                multiPremove
                                onPremove={(from: string, to: string) => {
                                    if (gameEnded || endState) return;
                                    if (premovesRef.current.length >= MAX_PREMOVES) return;
                                    setPremoves([...premovesRef.current, { from, to }]);
                                    playSound("premove");
                                }}
                                onClearPremove={clearPremoves}
                            />

                            {/* BOTTOM BAR */}
                            <View
                                style={[
                                    styles.bottomBar,
                                    { paddingBottom: 12 + insets.bottom },
                                ]}
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
                                        {tr("Resign")}
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
                                            tr("Draw offered"),
                                            tr("Your opponent will receive the draw request.")
                                        );
                                    }}
                                >
                                    <Text
                                        style={
                                            styles.bottomBtn
                                        }
                                    >
                                        {tr("Draw")}
                                    </Text>
                                </Pressable>

                                <Pressable
                                    onPress={() =>
                                        setShowChat(
                                            true
                                        )
                                    }
                                    style={styles.chatBtnRow}
                                >
                                    <Text
                                        style={
                                            styles.bottomBtn
                                        }
                                    >
                                        {tr("Chat")}
                                    </Text>
                                    {unreadCount > 0 && (
                                        <View style={styles.chatBadge}>
                                            <Text style={styles.chatBadgeText}>
                                                {unreadCount > 9 ? "9+" : unreadCount}
                                            </Text>
                                        </View>
                                    )}
                                </Pressable>
                            </View>

                            {/* =============================
                                END GAME POPUP
                            ============================= */}
                            {endState && endCardVisible && (
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

                                        {endState.type ===
                                            "win" && (
                                                <>
                                                    <Text
                                                        style={
                                                            styles.winTitle
                                                        }
                                                    >
                                                        {tr("Victory!")}
                                                    </Text>

                                                    <Text
                                                        style={
                                                            styles.subText
                                                        }
                                                    >
                                                        {endState.reason ===
                                                            "checkmate"
                                                            ? tr("You checkmated your opponent.")
                                                            : endState.reason ===
                                                                "timeout"
                                                                ? tr("Your opponent's time ran out.")
                                                                : endState.reason ===
                                                                    "resign"
                                                                    ? tr("Your opponent resigned.")
                                                                    : endState.reason ===
                                                                        "disconnect"
                                                                        ? tr("Your opponent lost connection. ") : ""}
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
                                                        {tr("Defeat")}
                                                    </Text>

                                                    <Text
                                                        style={
                                                            styles.subText
                                                        }
                                                    >
                                                        {endState.reason ===
                                                            "checkmate"
                                                            ? tr("You were checkmated.")
                                                            : endState.reason ===
                                                                "timeout"
                                                                ? tr("Your time ran out.")
                                                                : endState.reason ===
                                                                    "resign"
                                                                    ? tr("You resigned the game.")
                                                                    : endState.reason ===
                                                                        "disconnect"
                                                                        ? tr("The connection was lost.")
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
                                                        {tr("Draw")}
                                                    </Text>

                                                    <Text
                                                        style={
                                                            styles.subText
                                                        }
                                                    >
                                                        {tr("The game ends in a draw.")}
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
                                                {tr("Your Elo:")}{" "}
                                                {ratingAfter ?? myRating}
                                                {ratingAfter !== null &&
                                                    ratingAfter !== myRating
                                                    ? ` (${ratingAfter > myRating ? "+" : ""}${ratingAfter - myRating})`
                                                    : ""}
                                            </Text>
                                        </View>

                                        <Pressable
                                            style={
                                                styles.primaryBtn
                                            }
                                            onPress={async () => {
                                                setEndState(
                                                    null
                                                );

                                                // FIX: waiting.tsx braucht name/avatar/rating
                                                // als Params, sonst wird find_match nie gesendet.
                                                // Rating frisch aus dem Account holen, weil es
                                                // nach der Partie neu berechnet wurde.
                                                const acc = await getCurrentAccount();

                                                router.replace({
                                                    pathname: "/game/waiting",
                                                    params: {
                                                        name: myName,
                                                        avatar: myAvatar,
                                                        rating: String(acc?.rating ?? ratingAfter ?? myRating),
                                                    },
                                                } as any);
                                            }}
                                        >
                                            <Text
                                                style={
                                                    styles.btnText
                                                }
                                            >
                                                {tr("New Game")}
                                            </Text>
                                        </Pressable>

                                        <View
                                            style={
                                                styles.secondaryRow
                                            }
                                        >
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
                                                        styles.secondaryBtnText
                                                    }
                                                >
                                                    {rematchWaiting
                                                        ? tr("Waiting...")
                                                        : tr("Rematch")}
                                                </Text>
                                            </Pressable>

                                            {/* NEW: Analysis button - only visible if the
                                                game was saved remotely (not a guest account).
                                                NOTE: route "/game/review" is an assumption -
                                                adjust to the actual path of your
                                                game review file if needed. */}
                                            {lastGameId && (
                                                <Pressable
                                                    style={
                                                        styles.secondaryBtn
                                                    }
                                                    onPress={() => {
                                                        setEndState(
                                                            null
                                                        );
                                                        router.push({
                                                            pathname: "/game/review",
                                                            params: { gameId: lastGameId, color: myColor ?? "" },
                                                        } as any);
                                                    }}
                                                >
                                                    <Text
                                                        style={
                                                            styles.secondaryBtnText
                                                        }
                                                    >
                                                        {tr("Analysis")}
                                                    </Text>
                                                </Pressable>
                                            )}

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
                                                        styles.secondaryBtnText
                                                    }
                                                >
                                                    {tr("Home")}
                                                </Text>
                                            </Pressable>
                                        </View>

                                        {/* Report the opponent of this game */}
                                        <Pressable
                                            onPress={() => setReportOpen(true)}
                                            hitSlop={8}
                                            style={({ pressed }) => [
                                                styles.reportLink,
                                                pressed && { opacity: 0.6 },
                                            ]}
                                        >
                                            <Text style={styles.reportLinkText}>
                                                ⚑ {tr("Report opponent")}
                                            </Text>
                                        </Pressable>
                                    </Animated.View>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                <ReportSheet
                    visible={reportOpen}
                    onClose={() => setReportOpen(false)}
                    socket={socket}
                    roomId={roomId}
                    opponentName={opponentName}
                />
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

    capturedRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
        flexWrap: "wrap",
    },

    capturedPiece: {
        color: "#ddd",
        fontSize: 13,
        marginRight: 4,
    },

    capturedAdvantage: {
        color: "#FFD700",
        fontSize: 12,
        fontWeight: "800",
        marginLeft: 2,
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

    // NEW: add-friend button next to the opponent
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

    chatBtnRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },

    chatBadge: {
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: "#E53935",
        alignItems: "center",
        justifyContent: "center",
    },

    chatBadgeText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "800",
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

    rematchButtons: {
        width: "100%",
        gap: 10,
    },

    declineLink: {
        alignItems: "center",
        paddingVertical: 10,
    },

    declineLinkText: {
        color: "#999",
        fontSize: 14,
        fontWeight: "600",
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

    winTitle: {
        fontSize: 26,
        fontWeight: "800",
        color: "#4ADE80",
        marginBottom: 4,
    },

    loseTitle: {
        fontSize: 26,
        fontWeight: "800",
        color: "#F87171",
        marginBottom: 4,
    },

    drawTitle: {
        fontSize: 26,
        fontWeight: "800",
        color: "#94A3B8",
        marginBottom: 4,
    },

    subText: {
        color: "#94A3B8",
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
        marginBottom: 18,
        paddingHorizontal: 8,
    },

    resultRating: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginBottom: 22,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.06)",
    },

    ratingText: {
        color: "#CBD5E1",
        fontSize: 13,
        fontWeight: "600",
    },

    endButtons: {
        width: "100%",
        gap: 10,
    },

    primaryBtn: {
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

    reportLink: { alignSelf: "center", marginTop: 14, paddingVertical: 4 },
    reportLinkText: { color: "rgba(255,255,255,0.45)", fontSize: 12.5, fontWeight: "600" },

    secondaryBtn: {
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.05)",
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },

    secondaryBtnText: {
        color: "#CBD5E1",
        fontSize: 12,
        fontWeight: "600",
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