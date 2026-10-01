import AsyncStorage from "@react-native-async-storage/async-storage";
import { Chess } from "chess.js";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    BackHandler,
    Dimensions,
    Easing,
    ImageBackground,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Board from "./components/Board";

// Gleiche Deckelung wie in bot-game.tsx / online-game.tsx
const BOARD_SIZE = Math.min(Dimensions.get("window").width * 0.9, 520);

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

// NEU: Ergebnis fürs Endpopup
type EndState = {
    type: "white" | "black" | "draw";
    reason: "checkmate" | "stalemate" | "threefold" | "material" | "rule";
};

const END_TEXTS: Record<EndState["reason"], string> = {
    checkmate: "Schachmatt.",
    stalemate: "Patt – keine legalen Züge mehr.",
    threefold: "Remis durch dreifache Stellungswiederholung.",
    material: "Remis durch unzureichendes Material.",
    rule: "Remis nach 50-Züge-Regel oder allgemeinem Remis.",
};

export default function LocalGame() {
    const params = useLocalSearchParams();
    const insets = useSafeAreaInsets();

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

    const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
    const [legalMoves, setLegalMoves] = useState<any[]>([]);
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [checkmateSquare, setCheckmateSquare] = useState<string | null>(null);

    // =========================================================
    // MOVE HISTORY
    // =========================================================

    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const moveStack = useRef<MoveData[]>([]);
    const [moveIndex, setMoveIndex] = useState(0);

    // =========================================================
    // GAME FINISHED
    // =========================================================

    const gameFinished = useRef(false);

    // =========================================================
    // NEU: POPUPS (statt Alert.alert)
    // =========================================================

    const [endState, setEndState] = useState<EndState | null>(null);
    const [endCardVisible, setEndCardVisible] = useState(true);
    const [promotionMove, setPromotionMove] = useState<{ from: string; to: string } | null>(null);
    const [showRestartModal, setShowRestartModal] = useState(false);
    const [infoModal, setInfoModal] = useState<{ title: string; text: string } | null>(null);

    const endAnimation = useRef(new Animated.Value(0)).current;
    const endPopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // =========================================================
    // MOVE BAR
    // =========================================================

    const scrollRef = useRef<ScrollView>(null);

    // =========================================================
    // BACKGROUND
    // =========================================================

    const backgroundImage = require("../../assets/images/onlinebackground.png");

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

    const currentColor: "w" | "b" = game.turn();
    const myColor: "w" | "b" = currentColor;

    const rawBoard = game.board();

    const board =
        myColor === "w"
            ? rawBoard
            : [...rawBoard].reverse().map((row) => [...row].reverse());

    // =========================================================
    // KING SQUARE
    // =========================================================

    const getKingSquare = (currentGame: Chess, color: "w" | "b") => {
        const currentBoard = currentGame.board();

        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = currentBoard[rank][file];

                if (piece && piece.type === "k" && piece.color === color) {
                    return String.fromCharCode(97 + file) + (8 - rank);
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
        result: "win" | "loss" | "draw" | "aborted",
        timestamp?: number
    ) => {
        try {
            const key = "game_history";

            const stored = await AsyncStorage.getItem(key);
            const history = stored ? JSON.parse(stored) : [];

            const time = timestamp ?? Date.now();

            history.unshift({
                id: Date.now().toString(),
                mode,
                result,
                timestamp: time,
                date: new Date(time).toLocaleString(),
            });

            await AsyncStorage.setItem(key, JSON.stringify(history));
        } catch (error) {
            console.log("Fehler beim Speichern des Spielverlaufs:", error);
        }
    };

    // =========================================================
    // END POPUP
    // =========================================================

    const showEndPopupAfterDelay = (state: EndState) => {
        if (endPopupTimer.current) {
            clearTimeout(endPopupTimer.current);
        }

        endPopupTimer.current = setTimeout(() => {
            setEndState(state);
        }, 700);
    };

    // =========================================================
    // CHECK GAME END
    // =========================================================

    const checkGameEndLocal = (currentGame: Chess) => {
        if (gameFinished.current) {
            return true;
        }

        // -------------------------
        // CHECKMATE
        // -------------------------

        if (currentGame.isCheckmate()) {
            gameFinished.current = true;

            const loser = currentGame.turn();
            const winner = loser === "w" ? "b" : "w";

            const kingSquare = getKingSquare(currentGame, loser);
            setCheckmateSquare(kingSquare);

            /*
             * Local ist kein "Human vs Bot".
             * Für die lokale Statistik bleibt Weiß
             * weiterhin die Referenz für win/loss.
             */

            const result = winner === "w" ? "win" : "loss";

            saveGameToHistory("local", result);

            showEndPopupAfterDelay({
                type: winner === "w" ? "white" : "black",
                reason: "checkmate",
            });

            return true;
        }

        // -------------------------
        // STALEMATE
        // -------------------------

        if (currentGame.isStalemate()) {
            gameFinished.current = true;
            saveGameToHistory("local", "draw");
            showEndPopupAfterDelay({ type: "draw", reason: "stalemate" });
            return true;
        }

        // -------------------------
        // THREEFOLD
        // -------------------------

        if (currentGame.isThreefoldRepetition()) {
            gameFinished.current = true;
            saveGameToHistory("local", "draw");
            showEndPopupAfterDelay({ type: "draw", reason: "threefold" });
            return true;
        }

        // -------------------------
        // INSUFFICIENT MATERIAL
        // -------------------------

        if (currentGame.isInsufficientMaterial()) {
            gameFinished.current = true;
            saveGameToHistory("local", "draw");
            showEndPopupAfterDelay({ type: "draw", reason: "material" });
            return true;
        }

        // -------------------------
        // GENERAL DRAW
        // -------------------------

        if (currentGame.isDraw()) {
            gameFinished.current = true;
            saveGameToHistory("local", "draw");
            showEndPopupAfterDelay({ type: "draw", reason: "rule" });
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
            const loadedGame = new Chess(savedData.fen);

            const history = savedData.history ?? [];

            setGame(loadedGame);
            setMoveHistory(loadedGame.history());

            moveStack.current = history.map((move: any) => ({
                from: move.from,
                to: move.to,
                promotion: move.promotion,
            }));

            setMoveIndex(moveStack.current.length);

            const verboseHistory = loadedGame.history({ verbose: true });

            if (verboseHistory.length > 0) {
                const last = verboseHistory[verboseHistory.length - 1];
                setLastMove({ from: last.from, to: last.to });
            } else {
                setLastMove(null);
            }

            setSelectedSquare(null);
            setLegalMoves([]);
            setCheckmateSquare(null);

            gameFinished.current = false;
        } catch (error) {
            console.log("Fehler beim Laden des Spiels:", error);
        }
    }, []);

    // =========================================================
    // AUTO SCROLL MOVE HISTORY
    // =========================================================

    useEffect(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
    }, [moveHistory]);

    // =========================================================
    // END POPUP ANIMATION
    // =========================================================

    useEffect(() => {
        if (!endState) return;

        setEndCardVisible(true);
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

    // =========================================================
    // ANDROID BACK: erst Popups schließen, sonst normal zurück
    // =========================================================

    useEffect(() => {
        const onBackPress = () => {
            if (promotionMove) {
                setPromotionMove(null);
                return true;
            }
            if (showRestartModal) {
                setShowRestartModal(false);
                return true;
            }
            if (infoModal) {
                setInfoModal(null);
                return true;
            }
            if (endState && endCardVisible) {
                setEndCardVisible(false);
                return true;
            }
            return false;
        };

        const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
        return () => subscription.remove();
    }, [promotionMove, showRestartModal, infoModal, endState, endCardVisible]);

    // =========================================================
    // RESET
    // =========================================================

    const resetGame = () => {
        const freshGame = new Chess();

        if (endPopupTimer.current) {
            clearTimeout(endPopupTimer.current);
        }

        setGame(freshGame);

        setSelectedSquare(null);
        setLegalMoves([]);
        setMoveHistory([]);
        setLastMove(null);
        setCheckmateSquare(null);
        setEndState(null);
        setPromotionMove(null);

        moveStack.current = [];

        setMoveIndex(0);

        gameFinished.current = false;
    };

    // =========================================================
    // RESTART (Bestätigung per Modal statt Alert)
    // =========================================================

    const restartGame = () => {
        setShowRestartModal(true);
    };

    const confirmRestart = async () => {
        setShowRestartModal(false);

        // Eine bereits beendete Partie steht schon in der History
        if (moveHistory.length > 0 && !gameFinished.current) {
            await saveGameToHistory("local", "aborted");
        }

        resetGame();
    };

    // =========================================================
    // SAVE
    // =========================================================

    const saveGame = async () => {
        try {
            const timestamp = Date.now();

            const key = `@saved_game_${timestamp}`;

            await AsyncStorage.setItem(
                key,
                JSON.stringify({
                    fen: game.fen(),

                    history: game.history({ verbose: true }),

                    bottomColor: currentColor,

                    mode: "local",

                    timestamp,
                })
            );

            await saveGameToHistory("local", "aborted", timestamp);

            setInfoModal({
                title: "Spiel gespeichert",
                text: "Du kannst es unter „Gespeicherte Spiele“ fortsetzen.",
            });
        } catch (error) {
            console.log("SaveGame Error:", error);

            setInfoModal({
                title: "Fehler",
                text: "Das Spiel konnte nicht gespeichert werden.",
            });
        }
    };

    // =========================================================
    // UNDO
    // =========================================================

    const undoMove = () => {
        if (moveIndex <= 0) {
            return;
        }

        const newIndex = moveIndex - 1;

        const newGame = new Chess();

        try {
            for (let i = 0; i < newIndex; i++) {
                newGame.move(moveStack.current[i]);
            }
        } catch (error) {
            console.log("Undo Error:", error);

            return;
        }

        if (endPopupTimer.current) {
            clearTimeout(endPopupTimer.current);
        }

        setGame(newGame);
        setMoveIndex(newIndex);
        setMoveHistory(newGame.history());

        if (newIndex > 0) {
            const last = moveStack.current[newIndex - 1];

            setLastMove({ from: last.from, to: last.to });
        } else {
            setLastMove(null);
        }

        setSelectedSquare(null);
        setLegalMoves([]);
        setCheckmateSquare(null);
        setEndState(null);

        gameFinished.current = false;
    };

    // =========================================================
    // REDO
    // =========================================================

    const redoMove = () => {
        if (moveIndex >= moveStack.current.length) {
            return;
        }

        const newIndex = moveIndex + 1;

        const newGame = new Chess();

        try {
            for (let i = 0; i < newIndex; i++) {
                newGame.move(moveStack.current[i]);
            }
        } catch (error) {
            console.log("Redo Error:", error);

            return;
        }

        setGame(newGame);
        setMoveIndex(newIndex);
        setMoveHistory(newGame.history());

        const last = moveStack.current[newIndex - 1];

        setLastMove({ from: last.from, to: last.to });

        setSelectedSquare(null);
        setLegalMoves([]);
        setCheckmateSquare(null);

        gameFinished.current = false;

        checkGameEndLocal(newGame);
    };

    // =========================================================
    // MAKE MOVE
    // =========================================================

    const makeMove = (
        from: string,
        to: string,
        promotion?: "q" | "r" | "b" | "n"
    ) => {
        if (gameFinished.current) {
            return;
        }

        const newGame = new Chess(game.fen());

        let move;

        try {
            move = newGame.move({
                from: from as any,
                to: to as any,

                ...(promotion ? { promotion } : {}),
            });
        } catch (error) {
            console.log("Move Error:", error);

            return;
        }

        if (!move) {
            return;
        }

        // =====================================================
        // NACH UNDO/REDO ZUKUNFT ABSCHNEIDEN
        // =====================================================

        const newStack = moveStack.current.slice(0, moveIndex);

        newStack.push({
            from: move.from,
            to: move.to,
            promotion: move.promotion,
        });

        moveStack.current = newStack;

        setMoveIndex(newStack.length);

        setGame(newGame);

        setMoveHistory(newGame.history());

        setLastMove({
            from: move.from,
            to: move.to,
        });

        setSelectedSquare(null);
        setLegalMoves([]);

        checkGameEndLocal(newGame);
    };

    // =========================================================
    // PROMOTION (Modal statt Alert)
    // =========================================================

    const showPromotion = (from: string, to: string) => {
        setPromotionMove({ from, to });
    };

    const handlePromotion = (piece: "q" | "r" | "b" | "n") => {
        if (!promotionMove) return;

        const { from, to } = promotionMove;
        setPromotionMove(null);
        makeMove(from, to, piece);
    };

    // =========================================================
    // SQUARE PRESS
    // =========================================================

    const onPressSquare = (square: string) => {
        if (gameFinished.current) {
            return;
        }

        // Während die Umwandlungs-Auswahl offen ist, keine Brett-Eingabe
        if (promotionMove) {
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

        const piece = game.get(square as any);

        // =====================================================
        // KEINE FIGUR AUSGEWÄHLT
        // =====================================================

        if (!selectedSquare) {
            if (!piece) {
                return;
            }

            // Nur die Farbe, die gerade am Zug ist.
            if (piece.color !== game.turn()) {
                return;
            }

            const moves = game.moves({
                square: square as any,
                verbose: true,
            });

            if (moves.length === 0) {
                return;
            }

            setSelectedSquare(square);
            setLegalMoves(moves);

            return;
        }

        // =====================================================
        // EIGENE FIGUR ANKLICKEN
        // =====================================================

        if (piece && piece.color === game.turn()) {
            const moves = game.moves({
                square: square as any,
                verbose: true,
            });

            if (moves.length === 0) {
                setSelectedSquare(null);
                setLegalMoves([]);

                return;
            }

            setSelectedSquare(square);
            setLegalMoves(moves);

            return;
        }

        // =====================================================
        // LEGAL MOVE
        // =====================================================

        const legalMove = legalMoves.find((move) => move.to === square);

        if (!legalMove) {
            setSelectedSquare(null);
            setLegalMoves([]);

            return;
        }

        // =====================================================
        // PROMOTION
        // =====================================================

        if (
            legalMove.piece === "p" &&
            (square[1] === "8" || square[1] === "1")
        ) {
            showPromotion(selectedSquare, square);

            return;
        }

        // =====================================================
        // NORMAL MOVE
        // =====================================================

        makeMove(selectedSquare, square);
    };

    // =========================================================
    // CHECK STATUS
    // =========================================================

    const isCheck = game.isCheck();
    const isCheckmate = game.isCheckmate();
    const isStalemate = game.isStalemate();
    const isDraw = game.isDraw();

    let checkSquare: string | null = null;

    if (isCheck) {
        checkSquare = getKingSquare(game, game.turn());
    }

    const canUndo = moveIndex > 0;
    const canRedo = moveIndex < moveStack.current.length;

    // =========================================================
    // MOVE ROWS
    // =========================================================

    const moveRows = moveHistory.reduce((rows: any[], move, index) => {
        if (index % 2 === 0) {
            rows.push({
                moveNumber: index / 2 + 1,
                white: move,
                black: "",
            });
        } else {
            rows[rows.length - 1].black = move;
        }

        return rows;
    }, []);

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

    // =========================================================
    // UI
    // =========================================================

    return (
        <ImageBackground
            source={backgroundImage}
            style={styles.background}
            resizeMode="cover"
        >
            <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
                <View style={styles.container}>

                    {/* ========================================= */}
                    {/* HEADER */}
                    {/* ========================================= */}

                    <View style={styles.header}>
                        <Pressable onPress={() => router.back()} style={styles.backButton}>
                            <Text style={styles.backText}>‹</Text>
                        </Pressable>

                        <Text style={styles.headerTitle}>LOCAL GAME</Text>

                        {/* Symmetrie rechts */}
                        <View style={styles.headerSpacer} />
                    </View>

                    {/* ========================================= */}
                    {/* MOVE HISTORY */}
                    {/* ========================================= */}

                    <View style={styles.moveHistoryWrapper}>
                        <ScrollView
                            ref={scrollRef}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.moveHistoryContent}
                        >
                            {moveRows.map((row, index) => (
                                <Text key={index} style={styles.moveChip}>
                                    {row.moveNumber}. {row.white} {row.black}
                                </Text>
                            ))}
                        </ScrollView>
                    </View>

                    {/* ========================================= */}
                    {/* MITTE: STATUS + BRETT + BUTTONS */}
                    {/* ========================================= */}

                    <View style={styles.centerArea}>
                        <View style={styles.boardColumn}>

                            {/* TURN / STATUS */}
                            <View style={styles.turnPill}>
                                <View
                                    style={[
                                        styles.turnDot,
                                        currentColor === "w" ? styles.turnDotWhite : styles.turnDotBlack,
                                    ]}
                                />
                                <Text style={styles.turnText}>
                                    {currentColor === "w" ? "WEISS" : "SCHWARZ"} AM ZUG
                                </Text>
                                {isCheck && !isCheckmate && (
                                    <Text style={styles.checkBadge}>SCHACH</Text>
                                )}
                            </View>

                            {/* ===================================== */}
                            {/* COMMON BOARD COMPONENT */}
                            {/* ===================================== */}

                            <Board
                                board={board}
                                selectedSquare={selectedSquare}
                                legalMoves={legalMoves}
                                lastMove={lastMove}
                                checkSquare={checkSquare}
                                onPressSquare={onPressSquare}
                                pieces={pieces}
                                pieceToKey={pieceToKey}
                                myColor={myColor}
                                mode="local"
                                isCheck={isCheck}
                                isCheckmate={isCheckmate}
                                isStalemate={isStalemate}
                                isDraw={isDraw}
                                onUndo={undoMove}
                                onRedo={redoMove}
                                onSave={saveGame}
                                onRestart={restartGame}
                            />

                            {/* ===================================== */}
                            {/* ACTION BUTTONS */}
                            {/* ===================================== */}

                            <View
                                style={[
                                    styles.actionsRow,
                                    { marginBottom: Math.max(insets.bottom, 12) },
                                ]}
                            >
                                <Pressable
                                    onPress={undoMove}
                                    disabled={!canUndo}
                                    style={[styles.actionButton, !canUndo && styles.actionDisabled]}
                                >
                                    <Text style={styles.actionIcon}>↶</Text>
                                    <Text style={styles.actionText}>Undo</Text>
                                </Pressable>

                                <Pressable
                                    onPress={redoMove}
                                    disabled={!canRedo}
                                    style={[styles.actionButton, !canRedo && styles.actionDisabled]}
                                >
                                    <Text style={styles.actionIcon}>↷</Text>
                                    <Text style={styles.actionText}>Redo</Text>
                                </Pressable>

                                <Pressable onPress={saveGame} style={styles.actionButton}>
                                    <Text style={styles.actionIcon}>⬇</Text>
                                    <Text style={styles.actionText}>Save</Text>
                                </Pressable>

                                <Pressable onPress={restartGame} style={styles.actionButton}>
                                    <Text style={styles.actionIcon}>⟳</Text>
                                    <Text style={styles.actionText}>Restart</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </View>
            </SafeAreaView>

            {/* ============================================= */}
            {/* PROMOTION MODAL */}
            {/* ============================================= */}

            <Modal
                visible={!!promotionMove}
                transparent
                animationType="fade"
                onRequestClose={() => setPromotionMove(null)}
            >
                <View style={styles.overlay}>
                    <View style={styles.card}>
                        <Text style={styles.title}>Bauernumwandlung</Text>
                        <Text style={styles.text}>Wähle eine Figur:</Text>

                        <View style={styles.promoRow}>
                            {(
                                [
                                    ["q", "Dame"],
                                    ["r", "Turm"],
                                    ["b", "Läufer"],
                                    ["n", "Springer"],
                                ] as const
                            ).map(([piece, label]) => (
                                <Pressable
                                    key={piece}
                                    style={styles.promoBtn}
                                    onPress={() => handlePromotion(piece)}
                                >
                                    <Text style={styles.promoBtnText}>{label}</Text>
                                </Pressable>
                            ))}
                        </View>

                        <Pressable onPress={() => setPromotionMove(null)}>
                            <Text style={styles.promoCancel}>Abbrechen</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* ============================================= */}
            {/* RESTART MODAL */}
            {/* ============================================= */}

            <Modal
                visible={showRestartModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowRestartModal(false)}
            >
                <View style={styles.overlay}>
                    <View style={styles.card}>
                        <Text style={styles.title}>Spiel neu starten?</Text>
                        <Text style={styles.text}>Dein aktueller Fortschritt geht verloren.</Text>

                        <View style={styles.buttons}>
                            <Pressable
                                style={styles.cancelButton}
                                onPress={() => setShowRestartModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>Abbrechen</Text>
                            </Pressable>

                            <Pressable style={styles.leaveButton} onPress={confirmRestart}>
                                <Text style={styles.leaveButtonText}>Neustarten</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ============================================= */}
            {/* INFO MODAL (Gespeichert / Fehler) */}
            {/* ============================================= */}

            <Modal
                visible={!!infoModal}
                transparent
                animationType="fade"
                onRequestClose={() => setInfoModal(null)}
            >
                <View style={styles.overlay}>
                    <View style={styles.card}>
                        <Text style={styles.title}>{infoModal?.title}</Text>
                        <Text style={styles.text}>{infoModal?.text}</Text>

                        <Pressable style={styles.okBtn} onPress={() => setInfoModal(null)}>
                            <Text style={styles.btnText}>OK</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* ============================================= */}
            {/* END GAME POPUP (Stil wie Bot-/Online-Spiel) */}
            {/* ============================================= */}

            {endState && endCardVisible && (
                <View style={styles.endOverlay}>
                    <Animated.View style={[styles.endCard, animatedCardStyle]}>
                        <View
                            style={[
                                styles.endCardAccent,
                                {
                                    backgroundColor:
                                        endState.type === "draw" ? "#64748B" : "#D4AF37",
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

                        {endState.type === "draw" ? (
                            <Text style={styles.drawTitle}>Remis</Text>
                        ) : (
                            <Text style={styles.winTitle}>
                                {endState.type === "white" ? "Weiß gewinnt!" : "Schwarz gewinnt!"}
                            </Text>
                        )}

                        <Text style={styles.subText}>{END_TEXTS[endState.reason]}</Text>

                        <Pressable style={styles.endPrimaryBtn} onPress={resetGame}>
                            <Text style={styles.btnText}>Neue Partie</Text>
                        </Pressable>

                        <View style={styles.secondaryRow}>
                            <Pressable
                                style={styles.endSecondaryBtn}
                                onPress={() => {
                                    setEndCardVisible(false);
                                    undoMove();
                                }}
                            >
                                <Text style={styles.endSecondaryBtnText}>Zug zurück</Text>
                            </Pressable>

                            <Pressable
                                style={styles.endSecondaryBtn}
                                onPress={() => {
                                    setEndState(null);
                                    router.back();
                                }}
                            >
                                <Text style={styles.endSecondaryBtnText}>Home</Text>
                            </Pressable>
                        </View>
                    </Animated.View>
                </View>
            )}
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
        backgroundColor: "transparent",
    },

    container: {
        flex: 1,
        width: "100%",
        alignItems: "center",
    },

    // =========================================================
    // HEADER
    // =========================================================

    header: {
        width: "100%",
        height: 64,
        paddingHorizontal: 18,

        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    backButton: {
        width: 42,
        height: 42,
        borderRadius: 14,

        backgroundColor: "rgba(255,255,255,0.07)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",

        justifyContent: "center",
        alignItems: "center",
    },

    backText: {
        color: "#fff",
        fontSize: 30,
        lineHeight: 32,
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
        width: BOARD_SIZE,
        height: 40,
    },

    moveHistoryContent: {
        alignItems: "center",
        paddingHorizontal: 2,
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

    // =========================================================
    // CENTER: Brett + Status + Buttons, vertikal mittig
    // =========================================================

    centerArea: {
        flex: 1,
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
    },

    boardColumn: {
        width: BOARD_SIZE,
        alignItems: "stretch",
    },

    // =========================================================
    // TURN
    // =========================================================

    turnPill: {
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginBottom: 12,
        borderRadius: 999,
        backgroundColor: "rgba(15,15,15,0.82)",
        borderWidth: 1,
        borderColor: "rgba(212,175,55,0.45)",
    },

    turnDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 1,
    },

    turnDotWhite: {
        backgroundColor: "#fff",
        borderColor: "#fff",
    },

    turnDotBlack: {
        backgroundColor: "#111",
        borderColor: "#888",
    },

    turnText: {
        color: "#D4AF37",
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 2,
    },

    checkBadge: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 1,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        backgroundColor: "#E53935",
        overflow: "hidden",
    },

    // =========================================================
    // ACTIONS
    // =========================================================

    actionsRow: {
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 8,
        marginTop: 16,
    },

    actionButton: {
        flex: 1,
        height: 54,
        borderRadius: 14,

        backgroundColor: "rgba(15,15,15,0.82)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",

        justifyContent: "center",
        alignItems: "center",
    },

    actionDisabled: {
        opacity: 0.4,
    },

    actionIcon: {
        color: "#D4AF37",
        fontSize: 18,
        lineHeight: 20,
    },

    actionText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "600",
        marginTop: 1,
    },

    // =========================================================
    // MODALS
    // =========================================================

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

    okBtn: {
        backgroundColor: "#D4AF37",
        padding: 13,
        borderRadius: 12,
        alignItems: "center",
    },

    btnText: {
        color: "#fff",
        fontWeight: "700",
    },

    promoRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 10,
    },

    promoBtn: {
        minWidth: 78,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        alignItems: "center",
        backgroundColor: "rgba(212,175,55,0.15)",
        borderWidth: 1,
        borderColor: "#D4AF37",
    },

    promoBtnText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 14,
    },

    promoCancel: {
        color: "#999",
        marginTop: 18,
        textAlign: "center",
        fontSize: 14,
        fontWeight: "600",
    },

    // =========================================================
    // END POPUP (gleicher Stil wie bot-game.tsx / online-game.tsx)
    // =========================================================

    endOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
        backgroundColor: "rgba(0,0,0,0.55)",
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

    winTitle: { fontSize: 26, fontWeight: "800", color: "#D4AF37", marginBottom: 4 },
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