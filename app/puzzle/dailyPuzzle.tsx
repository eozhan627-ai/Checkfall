import { Chess } from "chess.js";
import { useState } from "react";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { getDailyPuzzle } from "../../lib/dailyPuzzle";
import PuzzleBoard from "../components/PuzzleBoard";



type Puzzle = {
    id: string;
    fen: string;
    moves: string[];
    rating?: number;
};


export default function DailyPuzzle() {

    const [puzzle] = useState<Puzzle>(() => getDailyPuzzle());
    // 🔹 Game initialisieren
    const [game, setGame] = useState(() => new Chess(puzzle.fen));

    // 🔹 Nur Spielerzüge extrahieren
    const solutionMoves = puzzle.moves;
    // 🔹 State
    const [selected, setSelected] = useState<string | null>(null);
    const [legalMoves, setLegalMoves] = useState<string[]>([]);
    const [moveIndex, setMoveIndex] = useState(0);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [hintStep, setHintStep] = useState<0 | 1 | 2>(0);

    const board = game.board();
    const backgroundImage = require("../../assets/images/onlinebackground.png"); // Hintergrundbild
    function selectPiece(square: string) {
        const piece = game.get(square as any);
        if (!piece || piece.color !== game.turn()) return;

        setSelected(square);
        setLegalMoves(
            game.moves({ square: square as any, verbose: true }).map(m => m.to)
        );
    }
    function goBack() {
        if (moveIndex === 0) return;

        const newGame = new Chess(puzzle.fen);


        for (let i = 0; i < moveIndex - 1; i++) {
            newGame.move({
                from: solutionMoves[i].slice(0, 2) as any,
                to: solutionMoves[i].slice(2, 4) as any,
            });
        }

        setGame(newGame);
        setMoveIndex(i => i - 1);
        setFeedback(null);
    }
    function onHint() {
        if (moveIndex >= solutionMoves.length) return;

        const move = solutionMoves[moveIndex];
        const from = move.slice(0, 2);
        const to = move.slice(2, 4);

        setFeedback(`💡 Zug: ${from} → ${to}`);
    }
    function onSquarePress(square: string) {
        const piece = game.get(square as any);

        // Spieler eine eigene Figur auswählen
        if (piece && piece.color === game.turn()) {
            setSelected(square);
            setLegalMoves(
                game.moves({ square: square as any, verbose: true }).map(m => m.to)
            );
            setFeedback(null);
            return;
        }

        // Kein ausgewähltes Feld oder Ziel nicht legal
        const moves = game.moves({ square: selected as any, verbose: true });
        const isLegal = moves.some(m => m.to === square);

        if (!selected || !isLegal) return;

        const expected = solutionMoves[moveIndex];
        const expectedFrom = expected.slice(0, 2);
        const expectedTo = expected.slice(2, 4);

        if (selected !== expectedFrom || square !== expectedTo) {
            setFeedback("❌ Falscher Zug – versuch’s nochmal.");
            setSelected(null);
            setLegalMoves([]);
            return;
        }

        // Spielerzug ausführen
        const newGame = new Chess(game.fen());
        newGame.move({ from: selected, to: square });
        setGame(newGame);
        setSelected(null);
        setLegalMoves([]);

        setFeedback("✅ Guter Zug!");
        let nextIndex = moveIndex + 1;
        let updatedGame = new Chess(newGame.fen());

        // Gegnerzug automatisch
        if (nextIndex < solutionMoves.length) {
            const enemyMove = solutionMoves[nextIndex];

            updatedGame.move({
                from: enemyMove.slice(0, 2),
                to: enemyMove.slice(2, 4),
            });

            nextIndex++;
        }

        setGame(updatedGame);
        setMoveIndex(nextIndex);

        // Puzzle fertig?
        if (moveIndex + 2 >= solutionMoves.length) {
            setFeedback("🎉 Puzzle gelöst!");
        }
    }
    // 🔹 Vor
    function goForward() {
        if (moveIndex >= solutionMoves.length) return;

        const move = solutionMoves[moveIndex];
        const newGame = new Chess(game.fen());
        newGame.move({
            from: move.slice(0, 2) as any,
            to: move.slice(2, 4) as any,
        });

        setGame(newGame);
        setMoveIndex(i => i + 1);
        setFeedback(null);
    }
    return (
        <ImageBackground
            source={backgroundImage}
            style={styles.container}
            resizeMode="cover"
        >
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.title}>Daily Puzzle</Text>
                <Text style={styles.subtitle}>Rating: {puzzle.rating}</Text>

                <PuzzleBoard
                    board={board}
                    selectedSquare={selected}
                    legalSquares={legalMoves}
                    onSquarePress={onSquarePress}
                    playerColor={game.turn()}

                />

                <Text style={styles.progress}>
                    Zug {moveIndex + 1} von {solutionMoves.length}
                </Text>

                {feedback && <Text style={styles.feedback}>{feedback}</Text>}

                <View style={styles.controls}>
                    <Pressable onPress={goBack} style={styles.iconBtn}>
                        <Text style={styles.icon}>⏮</Text>
                    </Pressable>

                    <Pressable onPress={onHint} style={styles.iconBtn}>
                        <Text style={styles.icon}>💡</Text>
                    </Pressable>

                    <Pressable onPress={goForward} style={styles.iconBtn}>
                        <Text style={styles.icon}>⏭</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </ImageBackground>

    );

}
const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { padding: 16 },
    title: { fontSize: 24, fontWeight: "bold", marginTop: 20, color: "#fff" },
    subtitle: { fontSize: 14, marginBottom: 120, color: "#fff" },
    progress: { marginTop: 10, textAlign: "center", color: "#fff" },
    feedback: { marginTop: 8, textAlign: "center", color: "#fff" },
    controls: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 12,
        gap: 24,
    },
    iconBtn: {
        padding: 10,
        borderRadius: 8,
        backgroundColor: "transparent",
    },
    icon: { fontSize: 20, color: "#fff" },
});