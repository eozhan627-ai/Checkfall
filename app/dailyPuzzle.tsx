import { Chess } from "chess.js";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import puzzlesJson from "../assets/puzzles_500.json";
import PuzzleBoard from "./components/PuzzleBoard";

type Puzzle = {
    id: string;
    fen: string;
    moves: string[];
    rating?: number;
};

const puzzles = puzzlesJson as Puzzle[];

export default function DailyPuzzle() {
    // 🔹 Puzzle EINMAL auswählen
    const [puzzle] = useState<Puzzle>(() => {
        const daily = puzzles.filter(p => p.moves.length >= 2 && p.moves.length <= 4);
        const preferred = daily.filter(p => p.moves.length === 3);
        const list = preferred.length > 0 ? preferred : daily;
        return list[Math.floor(Math.random() * list.length)];
    });

    // 🔹 Game initialisieren
    const [game, setGame] = useState(() => new Chess(puzzle.fen));
    const startColor = game.turn();

    // 🔹 Nur Spielerzüge extrahieren
    const solutionMoves = puzzle.moves.filter((_, i) =>
        startColor === "w" ? i % 2 === 0 : i % 2 === 1
    );

    // 🔹 State
    const [selected, setSelected] = useState<string | null>(null);
    const [legalMoves, setLegalMoves] = useState<string[]>([]);
    const [moveIndex, setMoveIndex] = useState(0);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [hintStep, setHintStep] = useState<0 | 1 | 2>(0);

    const board = game.board();

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

        // Hint Schritt 1: Figur auswählen
        if (hintStep === 0) {
            setSelected(from);
            setLegalMoves([]);
            setHintStep(1);
            setFeedback("💡 Wähle diese Figur");
            return;
        }

        // Hint Schritt 2: Ziel anzeigen
        if (hintStep === 1) {
            setSelected(from);
            setLegalMoves([to]);
            setHintStep(2);
            setFeedback("➡️ Ziehe sie hierhin");
            return;
        }
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
        if (!selected || !legalMoves.includes(square)) return;

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
        setMoveIndex(i => i + 1);
        setFeedback("✅ Guter Zug!");

        // Automatischer Gegnerzug, falls noch Züge übrig
        if (moveIndex + 1 < solutionMoves.length) {
            const nextMove = solutionMoves[moveIndex + 1];
            const autoGame = new Chess(newGame.fen());
            autoGame.move({
                from: nextMove.slice(0, 2),
                to: nextMove.slice(2, 4),
            });
            setGame(autoGame);
            setMoveIndex(i => i + 1); // nur Gegnerzug erhöhen
        }

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
        <ScrollView style={styles.container}>
            <Text style={styles.title}>Daily Puzzle</Text>
            <Text style={styles.subtitle}>Rating: {puzzle.rating}</Text>

            <PuzzleBoard
                board={board}
                selectedSquare={selected}
                legalSquares={legalMoves}
                onSquarePress={onSquarePress}
                playerColor="w"

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
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: "#f0f0f0" },
    title: { fontSize: 24, fontWeight: "bold" },
    subtitle: { fontSize: 14, marginBottom: 12 },
    progress: { marginTop: 10, textAlign: "center" },
    feedback: { marginTop: 8, textAlign: "center", color: "#334155" },
    controls: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 12,
        gap: 24,
    },
    iconBtn: {
        padding: 10,
        borderRadius: 8,
        backgroundColor: "#e5e7eb",
    },
    icon: { fontSize: 20 },
});