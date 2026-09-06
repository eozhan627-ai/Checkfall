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

type Piece = {
    type: string;
    color: string;
} | null;

type Props = {
    board: Piece[][];
    selectedSquare: string | null;
    legalSquares: string[];
    onSquarePress: (square: string) => void;
    playerColor?: "w" | "b";
};

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

export default function PuzzleBoard({
    board,
    selectedSquare,
    legalSquares,
    onSquarePress,
    playerColor = "w",
}: Props) {

    const rotate = playerColor === "b";

    // Größe jeder Figur
    const getPieceScale = (
        pieceKey: keyof typeof piecesImages
    ): number => {

        switch (pieceKey) {
            // Weiß
            case "wP":
                return 1.35;

            case "wN":
                return 1.55;

            case "wB":
                return 1.7;

            case "wR":
                return 1.65;

            case "wQ":
                return 1.55;

            case "wK":
                return 1.30;

            // Schwarz
            case "bP":
                return 1.3;

            case "bN":
                return 1.20;

            case "bB":
                return 1.3;

            case "bR":
                return 1.15;

            case "bQ":
                return 1.25;

            case "bK":
                return 1.15;

            default:
                return 1;
        }
    };

    // Vertikale Position jeder Figur
    const getPieceTranslateY = (
        pieceKey: keyof typeof piecesImages
    ): number => {

        switch (pieceKey) {
            // Weiß
            case "wB":
                return -1.1;

            case "wR":
                return -2;

            case "wQ":
                return -2;

            case "wP":
                return 1.2;

            // Schwarz
            case "bP":
                return 2;

            case "bN":
                return 2;

            case "bR":
                return 2;

            case "bQ":
                return 2;

            case "bB":
                return 0.5;

            default:
                return 0;
        }
    };

    return (
        <View style={styles.board}>

            {Array.from({ length: 8 }, (_, r) =>
                Array.from({ length: 8 }, (_, c) => {

                    const sourceRow = rotate
                        ? 7 - r
                        : r;

                    const sourceCol = rotate
                        ? 7 - c
                        : c;

                    const piece = board[sourceRow][sourceCol];

                    const square =
                        files[sourceCol] + ranks[sourceRow];

                    const isDark =
                        (r + c) % 2 === 1;

                    const isSelected =
                        selectedSquare === square;

                    const isLegal =
                        legalSquares.includes(square);

                    const pieceKey = piece
                        ? (
                            piece.color +
                            piece.type.toUpperCase()
                        ) as keyof typeof piecesImages
                        : null;

                    return (
                        <Pressable
                            key={square}
                            onPress={() => onSquarePress(square)}
                            style={[
                                styles.square,
                                {
                                    backgroundColor: isDark
                                        ? "#334155"
                                        : "#e5e7eb",
                                },
                                isSelected
                                    ? styles.selected
                                    : null,
                            ]}
                        >

                            {/* Rang */}
                            {c === 0 && (
                                <Text
                                    style={[
                                        styles.coord,
                                        isDark
                                            ? styles.coordDark
                                            : styles.coordLight,
                                        {
                                            left: 2,
                                            top: 2,
                                        },
                                    ]}
                                >
                                    {ranks[sourceRow]}
                                </Text>
                            )}

                            {/* Linie */}
                            {r === 7 && (
                                <Text
                                    style={[
                                        styles.coord,
                                        isDark
                                            ? styles.coordDark
                                            : styles.coordLight,
                                        {
                                            right: 2,
                                            bottom: 2,
                                        },
                                    ]}
                                >
                                    {files[sourceCol]}
                                </Text>
                            )}

                            {/* Figur */}
                            {piece && pieceKey && (
                                <Image
                                    source={piecesImages[pieceKey]}
                                    style={[
                                        styles.piece,
                                        {
                                            transform: [
                                                {
                                                    scale: getPieceScale(
                                                        pieceKey
                                                    ),
                                                },
                                                {
                                                    translateY:
                                                        getPieceTranslateY(
                                                            pieceKey
                                                        ),
                                                },
                                            ],
                                        },
                                    ]}
                                />
                            )}

                            {/* Legal Move Punkt */}
                            {isLegal && (
                                <View style={styles.dot} />
                            )}

                        </Pressable>
                    );
                })
            )}

        </View>
    );
}

const styles = StyleSheet.create({

    board: {
        alignSelf: "center",
        width: 336,
        height: 336,
        flexDirection: "row",
        flexWrap: "wrap",
    },

    square: {
        width: 42,
        height: 42,
        justifyContent: "center",
        alignItems: "center",
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