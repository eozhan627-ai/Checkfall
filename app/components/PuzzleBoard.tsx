import { Image, Pressable, StyleSheet, Text, View } from "react-native";

const piecesImages = {
    wP: require("../../assets/images/pawn_white.png"),
    wR: require("../../assets/images/rook_white.png"),
    wN: require("../../assets/images/knight_white.png"),
    wB: require("../../assets/images/bishop_white.png"),
    wQ: require("../../assets/images/queen_white.png"),
    wK: require("../../assets/images/king_white.png"),
    bP: require("../../assets/images/pawn_black.png"),
    bR: require("../../assets/images/rook_black.png"),
    bN: require("../../assets/images/knight_black.png"),
    bB: require("../../assets/images/bishop_black.png"),
    bQ: require("../../assets/images/queen_black.png"),
    bK: require("../../assets/images/king_black.png"),
};

type Piece = { type: string; color: string } | null;

type Props = {
    board: Piece[][];
    selectedSquare: string | null;
    legalSquares: string[];
    onSquarePress: (square: string) => void;
    playerColor?: "w" | "b";
};

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];


function toSquare(row: number, col: number, rotate: boolean) {
    if (rotate) {
        return files[7 - col] + (row + 1);
    }
    return files[col] + (8 - row);
}

export default function PuzzleBoard({ board, selectedSquare, legalSquares, onSquarePress, playerColor }: Props) {
    return (
        <View style={styles.board}>
            {board.map((row, r) =>
                row.map((piece, c) => {
                    const square = toSquare(r, c, playerColor === "b");
                    const isDark = (r + c) % 2 === 1;
                    const showFile = r === 7;
                    const showRank = c === 0;
                    const isSelected = selectedSquare === square;
                    const isLegal = legalSquares.includes(square);

                    const key = piece ? (piece.color + piece.type.toUpperCase()) as keyof typeof piecesImages : null;

                    return (
                        <Pressable
                            key={square}
                            onPress={() => onSquarePress(square)}
                            style={[
                                styles.square,
                                { backgroundColor: isDark ? "#334155" : "#e5e7eb" },
                                isSelected && styles.selected,
                            ]}
                        >
                            {/* Rank (1–8) */}
                            {showRank && (
                                <Text
                                    style={[
                                        styles.coord,
                                        isDark ? styles.coordDark : styles.coordLight,
                                        { left: 2, top: 2 },
                                    ]}
                                >
                                    {ranks[r]}
                                </Text>
                            )}

                            {/* File (a–h) */}
                            {showFile && (
                                <Text
                                    style={[
                                        styles.coord,
                                        isDark ? styles.coordDark : styles.coordLight,
                                        { right: 2, bottom: 2 },

                                    ]}
                                >
                                    {files[c]}
                                </Text>
                            )}

                            {piece && key && (
                                <Image source={piecesImages[key]} style={styles.piece} />
                            )}

                            {isLegal && <View style={styles.dot} />}
                        </Pressable>

                    );
                })
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    board: {
        alignSelf: "center"
        , width: 336,
        height: 336,
        flexDirection: "row",
        flexWrap: "wrap",
    },
    square: {
        width: 42,
        height: 42,
        justifyContent: "center",
        alignItems: "center"
    },
    selected: {
        borderWidth: 2,
        borderColor: "#7c2525",
    },
    piece: {
        width: 36,
        height: 36,
        resizeMode: "contain",
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "rgba(0,0,0,0.4)",
        position: "absolute",
    },
    coord: {
        position: "absolute",
        fontSize: 10,
        fontWeight: "600",
    },
    coordDark: {
        color: "#e5e7eb",
    },
    coordLight: {
        color: "#334155",
    },
});