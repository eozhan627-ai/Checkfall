import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const toSquare = (r: number, c: number) =>
    `${FILES[c]}${8 - r}`;

export default function Board({
    board,
    selectedSquare,
    legalMoves,
    lastMove,
    checkSquare,
    onPressSquare,
    pieces,
    pieceToKey,
    myColor,

    mode,
    isCheck,
    isCheckmate,
    isStalemate,
    isDraw,

    onUndo,
    onRedo,
    onSave,
    onRestart,
}: any) {

    return (

        <View style={styles.container}>

            {/* 🔥 GAME STATUS OVERLAY HIER */}
            {isCheck && (
                <Text style={{ color: "red", position: "absolute", top: 10 }}>
                    CHECK
                </Text>
            )}

            {isCheckmate && (
                <Text style={{ color: "red", position: "absolute", top: 30 }}>
                    CHECKMATE
                </Text>
            )}

            {isStalemate && (
                <Text style={{ color: "gray", position: "absolute", top: 30 }}>
                    STALEMATE
                </Text>
            )}

            {isDraw && (
                <Text style={{ color: "gray", position: "absolute", top: 30 }}>
                    DRAW
                </Text>
            )}


            <View style={styles.board}>
                {board.map((row: any[], r: number) =>
                    row.map((piece, c) => {
                        const square =
                            myColor === "w"
                                ? toSquare(r, c)
                                : toSquare(7 - r, 7 - c);

                        const isSelected = selectedSquare === square;
                        const isLegal = legalMoves?.some((m: any) => m.to === square);

                        const isLastFrom = lastMove?.from === square;
                        const isLastTo = lastMove?.to === square;

                        const isCheck = checkSquare === square;

                        const pieceKey = pieceToKey(piece);
                        const isLocal = mode === "local";
                        return (
                            <Pressable
                                key={square}
                                onPress={() => onPressSquare(square)}
                                style={[
                                    styles.square,
                                    {
                                        backgroundColor: (() => {
                                            if (isCheck) return "#ff4d4d";        // klar rot (nicht neon)
                                            if (isLastTo) return "#6bb6ff";         // soft gold
                                            if (isLastFrom) return "#4da3ff";         // soft gold
                                            if (isSelected) return "#4da3ff";     // selection blau

                                            return (r + c) % 2 === 0 ? "#e7d5b7" : "#b58863";
                                        })(),
                                    }
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

                                {isLegal && <View style={styles.dot} />}
                            </Pressable>

                        );
                    })
                )}
            </View>
            {mode === "local" && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
                    <Pressable onPress={onUndo}>
                        <Text style={{ color: "white" }}>Undo </Text>
                    </Pressable>

                    <Pressable onPress={onRedo}>
                        <Text style={{ color: "white" }}>Redo </Text>
                    </Pressable>

                    <Pressable onPress={onSave}>
                        <Text style={{ color: "white" }}>Save </Text>
                    </Pressable>

                    <Pressable onPress={onRestart}>
                        <Text style={{ color: "white" }}>Restart </Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        alignItems: "center", // 🔥 FIX CENTER
        justifyContent: "center",
    },
    board: {
        width: "92%",
        aspectRatio: 1,
        flexDirection: "row",
        flexWrap: "wrap",
        borderWidth: 1,
        borderColor: "#d4af37",
        borderRadius: 8,
        overflow: "hidden",

    },
    square: {
        width: "12.5%",
        height: "12.5%",
        justifyContent: "center",
        alignItems: "center",
    },
    piece: {
        width: "90%",
        height: "90%",
        resizeMode: "contain",
    },
    dot: {
        position: "absolute",
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "rgba(0,0,0,0.3)",
    }
});