import AsyncStorage from '@react-native-async-storage/async-storage';
import { Chess } from "chess.js";
import { router, useLocalSearchParams } from 'expo-router';
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
import { SafeAreaView } from 'react-native-safe-area-context';

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

const toChessSquare = (row: number, col: number) => {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    return `${files[col]}${8 - row}`;
};

const pieceToKey = (piece: any) => {
    if (!piece) return null;
    return `${piece.color}${piece.type}`;
};



export default function Board() {
    const moveStack = useRef<any[]>([]);
    const [moveIndex, setMoveIndex] = useState(0);
    const params = useLocalSearchParams();
    const savedData = params.savedData
        ? JSON.parse(params.savedData as string)
        : null;
    const [game, setGame] = useState(() => new Chess());

    const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
    const [legalMoves, setLegalMoves] = useState<any[]>([]);
    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const [promotionMove, setPromotionMove] = useState<{ from: string; to: string } | null>(null);
    const [bottomColor, setBottomColor] = useState<'w' | 'b'>('w');

    const isBlackBottom = bottomColor === 'b';

    const board = game.board();
    const displayBoard = bottomColor === "w" ? board : [...board].reverse();
    const [rotateBoard, setRotateBoard] = useState(false);

    const scrollRef = useRef<ScrollView>(null);
    const [humanColor, setHumanColor] = useState<'w' | 'b'>('w');
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [undoneMoves, setUndoneMoves] = useState<any[]>([]);

    const undoMove = () => {
        if (moveIndex === 0) return; // nichts zum Rückgängigmachen

        const newIndex = moveIndex - 1;
        const newGame = new Chess();

        // alle Züge bis newIndex anwenden
        for (let i = 0; i < newIndex; i++) {
            newGame.move(moveStack.current[i]);
        }

        setGame(newGame);
        setMoveIndex(newIndex);

        // moveHistory sauber anpassen
        setMoveHistory(newGame.history({ verbose: false }));

        // lastMove aktualisieren
        const last = newIndex > 0 ? moveStack.current[newIndex - 1] : null;
        setLastMove(last ? { from: last.from, to: last.to } : null);

        setSelectedSquare(null);
        setLegalMoves([]);
        setBottomColor(newGame.turn());
    };

    const redoMove = () => {
        if (moveIndex >= moveStack.current.length) return; // nichts zum Vorwärtsgehen

        const newIndex = moveIndex + 1;
        const newGame = new Chess();

        // alle Züge bis newIndex anwenden
        for (let i = 0; i < newIndex; i++) {
            newGame.move(moveStack.current[i]);
        }

        setGame(newGame);
        setMoveIndex(newIndex);

        // moveHistory aktualisieren
        setMoveHistory(newGame.history({ verbose: false }));

        // lastMove auf den gerade wiederhergestellten Zug setzen
        const last = moveStack.current[newIndex - 1];
        setLastMove({ from: last.from, to: last.to });

        setSelectedSquare(null);
        setLegalMoves([]);
        setBottomColor(newGame.turn());
    };
    useEffect(() => {
        if (!savedData) return;

        const loaded = new Chess(savedData.fen);
        setGame(loaded);
        setMoveHistory(savedData.history.map((m: any) => m.san));
        setBottomColor(savedData.bottomColor);
    }, []);
    // scrollt immer zum letzten Zug
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollToEnd({ animated: true });
        }
    }, [moveHistory]);

    const resetGame = () => {
        const freshGame = new Chess();

        setGame(freshGame);
        setSelectedSquare(null);
        setLegalMoves([]);
        setPromotionMove(null);
        setMoveHistory([]);
        setLastMove(null);

        moveStack.current = [];
        setMoveIndex(0);

        setBottomColor("w");
    };
    const saveGame = async () => {
        try {
            const timestamp = Date.now();
            const key = `@saved_game_${timestamp}`;

            await AsyncStorage.setItem(
                key,
                JSON.stringify({
                    fen: game.fen(),
                    history: game.history({ verbose: true }),
                    bottomColor,
                    mode: "local",
                    timestamp,
                })
            );

            // 🔹 Eintrag in Spielverlauf hinzufügen
            await saveGameToHistory("local", "aborted", timestamp); // abgebrochenes Spiel, falls noch nicht fertig gespielt

            Alert.alert(
                "Spiel gespeichert",
                "Du kannst es unter „Gespeicherte Spiele“ fortsetzen."
            );
        } catch (e) {
            console.log("SaveGame Error", e);
            Alert.alert("Fehler", "Spiel konnte nicht gespeichert werden.");
        }
    };
    async function saveGameToHistory(mode: "bot" | "local", result: "win" | "loss" | "draw" | "aborted",
        timestamp?: number
    ) {
        try {
            const key = "game_history";
            const stored = await AsyncStorage.getItem(key);
            const history = stored ? JSON.parse(stored) : [];

            history.unshift({
                id: Date.now().toString(),
                mode,
                result,
                timestamp: timestamp ?? Date.now(),
                date: new Date(timestamp ?? Date.now()).toLocaleString(),
            });


            await AsyncStorage.setItem(key, JSON.stringify(history));
        } catch (e) {
            console.log("Fehler beim Speichern des Spielverlaufs", e);
        }
    }

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
        moveStack.current = newGame.history({ verbose: true });
        setMoveIndex(moveStack.current.length);
        setLastMove({ from: move.from, to: move.to });
        setSelectedSquare(null);
        setLegalMoves([]);
        setPromotionMove(null);
        setBottomColor(c => (c === "w" ? "b" : "w"));



        if (newGame.isCheckmate()) {
            const winnerColor = newGame.turn() === "w" ? "b" : "w";
            const result = winnerColor === bottomColor ? "win" : "loss";

            const now = Date.now();
            saveGameToHistory("local", result, now);

            Alert.alert("Schachmatt", `${winnerColor === "w" ? "Weiß" : "Schwarz"} hat gewonnen`);
        }
    };


    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top', 'left', 'right']}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
                <View style={{ width: BOARD_SIZE }}>

                    {/* Zugleiste oben */}
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

                    {/* Promotion-Bar */}
                    {promotionMove && (
                        <View style={styles.promotionBar}>
                            {[
                                { label: "Q", value: "q" },
                                { label: "R", value: "r" },
                                { label: "N", value: "n" },
                                { label: "B", value: "b" },
                            ].map(p => (
                                <Pressable
                                    key={p.value}
                                    style={styles.promotionBtn}
                                    onPress={() => handlePromotion(p.value)}
                                >
                                    <Text>{p.label}</Text>
                                </Pressable>
                            ))}
                        </View>
                    )}

                    <View style={styles.board}>
                        {displayBoard.map((row, displayRowIndex) => {
                            const actualRowIndex = bottomColor === "w" ? displayRowIndex : 7 - displayRowIndex;

                            return (
                                <React.Fragment key={displayRowIndex}>
                                    {row.map((piece, colIndex) => {
                                        const isBottomRank = bottomColor === "w" ? actualRowIndex === 7 : actualRowIndex === 0;
                                        const isLeftFile = bottomColor === "w" ? colIndex === 0 : colIndex === 7;

                                        const fileLabel = FILES[colIndex];
                                        const rankLabel = bottomColor === "w"
                                            ? RANKS[actualRowIndex]
                                            : (8 - actualRowIndex).toString();

                                        const square = toChessSquare(actualRowIndex, colIndex);
                                        const isDark = (actualRowIndex + colIndex) % 2 === 1;
                                        const isSelected = selectedSquare === square;
                                        const legalMove = legalMoves.find(m => m.to === square);
                                        const isLegalMove = !!legalMove;
                                        const isCapture = !!legalMove?.captured;
                                        const pieceKey = pieceToKey(piece);
                                        const isLastFrom = lastMove?.from === square;
                                        const isLastTo = lastMove?.to === square;

                                        return (
                                            <Pressable
                                                key={square}
                                                onPress={() => {
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
                                                        setLastMove({ from: move.from, to: move.to })
                                                        setSelectedSquare(null);
                                                        setLegalMoves([]);
                                                        setBottomColor(c => (c === "w" ? "b" : "w"));
                                                        // Alte undoneMoves löschen, falls man nach Undo einen neuen Zug macht
                                                        moveStack.current = moveStack.current.slice(0, moveIndex);

                                                        // Neuen Zug hinzufügen
                                                        moveStack.current.push(move);
                                                        setMoveIndex(moveStack.current.length);
                                                        if (newGame.isCheckmate()) {
                                                            const winner = newGame.turn() === "w" ? "Schwarz" : "Weiß";
                                                            Alert.alert("Schachmatt", `${winner} hat gewonnen`);
                                                        }
                                                    }
                                                }}
                                                style={[
                                                    styles.square,
                                                    {
                                                        backgroundColor: isLastTo
                                                            ? "#2d7ea4"       // Ziel-Feld (kräftig)
                                                            : isLastFrom
                                                                ? "#2d7ea4"      // Start-Feld (heller)
                                                                : isDark
                                                                    ? "#334155"
                                                                    : "#e5e7eb",
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

                                                            // schwarze Bauern extra vergrößern
                                                            pieceKey === "bp" && {
                                                                transform: [{ scale: 1.4 }, { translateY: 3.25 }, { translateX: -1 }]
                                                            },

                                                            // alle anderen schwarzen Figuren normal vergrößern
                                                            pieceKey?.startsWith("b") && pieceKey !== "bp" && {
                                                                transform: [{ scale: 1.12 }],
                                                            },

                                                            // weiße Läufer, Dame und König vergrößern
                                                            (pieceKey === "wb" || pieceKey === "wq" || pieceKey === "wk") && {
                                                                transform: [{ scale: 1.12 }],
                                                            },
                                                            pieceKey === "wp" && {
                                                                transform: [{ scale: 0.9 },]
                                                            },


                                                        ]}
                                                    />
                                                )}
                                                {isLegalMove && !isCapture && <View style={styles.moveDot} />}
                                                {isLegalMove && isCapture && <View style={styles.captureRing} />}

                                                {/* Zahlen links */}
                                                {colIndex === 0 && (
                                                    <Text style={[
                                                        styles.coord, {
                                                            left: 2,
                                                            top: bottomColor === 'w' ? undefined : 2, bottom: bottomColor === 'w' ? 2 : undefined
                                                        },
                                                        { color: isDark ? "#e5e7eb" : "#334155" }]}>
                                                        {rankLabel}
                                                    </Text>
                                                )}

                                                {/* Buchstaben unten */}
                                                {displayRowIndex === 7 && (
                                                    <Text style={[
                                                        styles.coord, { right: 2, bottom: 2 },
                                                        { color: isDark ? "#e5e7eb" : "#334155" }]}>
                                                        {fileLabel}
                                                    </Text>
                                                )}
                                            </Pressable>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </View>

                    {/* Bottom-Bar */}
                    <View style={styles.bottomBar}>
                        {/* Zurück zur Startseite */}
                        <Pressable
                            onPress={() =>
                                Alert.alert("Zurück zur Startseite?", "", [
                                    { text: "Nein", style: "cancel" },
                                    { text: "Ja", onPress: () => router.push('/') }, // zurück zur Startseite
                                ])
                            }
                        >
                            <Text style={[styles.bottomBtn, { color: "#f6f6f6" }]}>Zurück </Text>
                        </Pressable>

                        {/* Speichern */}
                        <Pressable
                            onPress={async () => {
                                try {
                                    await saveGame(); // bestehende Funktion verwenden
                                    Alert.alert("Spiel gespeichert", "Dein Spiel wurde gespeichert. Du kannst es in gespeicherte Spiele aufrufen.");
                                } catch (e) {
                                    console.log("Fehler beim Speichern:", e);
                                }
                            }}
                        >
                            <Text style={[styles.bottomBtn, { color: "#f6f6f6" }]}>Speichern </Text>
                        </Pressable>

                        {/* Neustarten */}
                        <Pressable
                            onPress={() =>
                                Alert.alert("Partie neustarten?", "Dein Fortschritt geht verloren.", [
                                    { text: "Nein", style: "cancel" },
                                    {
                                        text: "Ja",
                                        onPress: async () => {
                                            // Lokales Spiel als "abgebrochen" speichern
                                            await saveGameToHistory("local", "aborted");

                                            resetGame(); // Spiel zurücksetzen
                                            setBottomColor("w"); // Weiß immer unten
                                            setHumanColor("w"); // Mensch immer Weiß
                                            setLastMove(null);
                                        },
                                    },
                                ])
                            }
                        >
                            <Text style={[styles.bottomBtn, { color: "#f6f6f6" }]}>Neustarten </Text>
                        </Pressable>

                    </View>
                    {/* UNDO / REDO */}
                    <View
                        style={{
                            marginTop: 20,
                            flexDirection: "row",
                            justifyContent: "center",
                            gap: 32,
                        }}
                    >
                        <Pressable onPress={undoMove}>
                            <Text style={{ fontSize: 17, color: "#f6f6f6" }}>⬅️ Letzter Zug  </Text>
                        </Pressable>

                        <Pressable onPress={redoMove}>
                            <Text style={{ fontSize: 17, color: "#f6f6f6" }}> Vorwärts ➡️</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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
    moveBar: {
        maxHeight: 40,
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
        backgroundColor: '#f6f6f6',             
        color: "#111827",
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
        width: BOARD_SIZE,
    },
    bottomBtn: {
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
    coord: {
        position: "absolute",
        fontSize: 10,
        fontWeight: "600",
        color: '#334155',
    },
});
