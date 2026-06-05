import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

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
}: any) {

    return (
        <View style={styles.container}>
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

                        const key = pieceToKey(piece);

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

                                            return (r + c) % 2 === 0 ? "#2e3b2f" : "#1f2621";
                                        })(),
                                    }
                                ]}
                            >
                                {key && (
                                    <Image
                                        source={pieces[key]}
                                        style={styles.piece}
                                    />
                                )}

                                {isLegal && <View style={styles.dot} />}
                            </Pressable>
                        );
                    })
                )}
            </View>
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