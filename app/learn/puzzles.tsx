import { Chess } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import {
    ImageBackground,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import puzzles from "../../assets/puzzle.json";
import PuzzleBoard from "../components/PuzzleBoard";

type Puzzle = {
    id: string;
    fen: string;
    moves: string[];
    rating?: number;
};

export default function PuzzlesScreen() {
    const sortedPuzzles = useMemo(
        () =>
            [...(puzzles as Puzzle[])].sort(
                (a, b) => (a.rating ?? 0) - (b.rating ?? 0)
            ),
        []
    );

    const [puzzleIndex, setPuzzleIndex] = useState(0);

    const puzzle = sortedPuzzles[puzzleIndex];

    const [game, setGame] = useState(() => new Chess(puzzle.fen));
    const [selected, setSelected] = useState<string | null>(null);
    const [legalMoves, setLegalMoves] = useState<string[]>([]);
    const [moveIndex, setMoveIndex] = useState(0);
    const [feedback, setFeedback] = useState<string | null>(null);

    const playerColor = game.turn();

    useEffect(() => {
        setGame(new Chess(puzzle.fen));
        setSelected(null);
        setLegalMoves([]);
        setMoveIndex(0);
        setFeedback(null);
    }, [puzzle]);

    function nextPuzzle() {
        if (puzzleIndex >= sortedPuzzles.length - 1) {
            setFeedback("🏆 Alle Puzzles geschafft!");
            return;
        }

        setPuzzleIndex((i) => i + 1);
    }

    function onHint() {
        const move = puzzle.moves[moveIndex];

        if (!move) return;

        setFeedback(
            `💡 Tipp: ${move.slice(0, 2)} → ${move.slice(2, 4)}`
        );
    }

    function onSquarePress(square: string) {
        const piece = game.get(square as any);

        // Eigene Figur auswählen
        if (piece && piece.color === game.turn()) {
            setSelected(square);

            setLegalMoves(
                game
                    .moves({
                        square: square as any,
                        verbose: true,
                    })
                    .map((m) => m.to)
            );

            setFeedback(null);
            return;
        }

        // Kein ausgewähltes Feld
        if (!selected) return;

        // Prüfen, ob der Zielzug legal ist
        const legal = game
            .moves({
                square: selected as any,
                verbose: true,
            })
            .some((m) => m.to === square);

        if (!legal) return;

        const expectedMove = puzzle.moves[moveIndex];

        if (!expectedMove) return;

        const expectedFrom = expectedMove.slice(0, 2);
        const expectedTo = expectedMove.slice(2, 4);

        // Falscher Puzzle-Zug
        if (
            selected !== expectedFrom ||
            square !== expectedTo
        ) {
            setFeedback("❌ Falscher Zug");
            setSelected(null);
            setLegalMoves([]);
            return;
        }

        // Spielerzug ausführen
        const newGame = new Chess(game.fen());

        newGame.move({
            from: selected,
            to: square,
        });

        let nextMoveIndex = moveIndex + 1;

        // Gegnerzug automatisch ausführen
        if (nextMoveIndex < puzzle.moves.length) {
            const enemyMove = puzzle.moves[nextMoveIndex];

            newGame.move({
                from: enemyMove.slice(0, 2),
                to: enemyMove.slice(2, 4),
            });

            nextMoveIndex++;
        }

        setGame(newGame);
        setMoveIndex(nextMoveIndex);
        setSelected(null);
        setLegalMoves([]);

        // Puzzle fertig
        if (nextMoveIndex >= puzzle.moves.length) {
            setFeedback("🎉 Puzzle gelöst!");
            return;
        }

        setFeedback("✅ Richtig");
    }

    return (
        <ImageBackground
            source={require("../../assets/images/onlinebackground.png")}
            style={styles.container}
            resizeMode="cover"
        >
            <ScrollView contentContainerStyle={styles.scroll}>

                <Text style={styles.title}>
                    Puzzles
                </Text>

                <Text style={styles.subtitle}>
                    Puzzle {puzzleIndex + 1} / {sortedPuzzles.length}
                </Text>

                <Text style={styles.subtitle}>
                    Rating: {puzzle.rating}
                </Text>

                <PuzzleBoard
                    board={game.board()}
                    selectedSquare={selected}
                    legalSquares={legalMoves}
                    onSquarePress={onSquarePress}
                    playerColor={playerColor}
                />

                <Text style={styles.progress}>
                    Zug {moveIndex + 1} / {puzzle.moves.length}
                </Text>

                {feedback && (
                    <Text style={styles.feedback}>
                        {feedback}
                    </Text>
                )}

                <View style={styles.controls}>

                    <Pressable
                        style={styles.button}
                        onPress={onHint}
                    >
                        <Text style={styles.buttonText}>
                            💡 Tipp
                        </Text>
                    </Pressable>

                    <Pressable
                        style={styles.button}
                        onPress={nextPuzzle}
                    >
                        <Text style={styles.buttonText}>
                            ➜ Nächstes
                        </Text>
                    </Pressable>

                </View>

            </ScrollView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    scroll: {
        padding: 16,
    },

    title: {
        color: "#fff",
        fontSize: 28,
        fontWeight: "800",
        marginTop: 20,
        textAlign: "center",
    },

    subtitle: {
        color: "#ccc",
        textAlign: "center",
        marginTop: 4,
    },

    progress: {
        color: "#fff",
        textAlign: "center",
        marginTop: 15,
    },

    feedback: {
        color: "#fff",
        textAlign: "center",
        marginTop: 10,
        fontWeight: "700",
    },

    controls: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 12,
        marginTop: 20,
    },

    button: {
        backgroundColor: "#1f2937",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
    },

    buttonText: {
        color: "#fff",
        fontWeight: "700",
    },
});