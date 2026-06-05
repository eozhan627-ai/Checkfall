import { Chess } from "chess.js";
import { useState } from "react";

export function useChessInput({ game, setGame, socket, roomId, myColor }: any) {
    const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
    const [legalMoves, setLegalMoves] = useState<any[]>([]);

    const onPressSquare = (square: string) => {
        const turn = game.turn();

        // 🚫 HARD BLOCK WRONG TURN
        if (myColor && turn !== myColor) {
            return;
        }

        const piece = game.get(square as any);

        if (!selectedSquare) {
            if (!piece) return;

            // nur eigene Figuren
            if (piece.color !== myColor) return;

            setSelectedSquare(square);
            setLegalMoves(game.moves({ square: square as any, verbose: true }));
            return;
        }

        const newGame = new Chess(game.fen());

        let move = null;

        try {
            move = newGame.move({
                from: selectedSquare,
                to: square,
            });
        } catch {
            move = null;
        }

        if (!move) {
            if (piece && piece.color === myColor) {
                setSelectedSquare(square);

                setLegalMoves(
                    game.moves({
                        square: square as any,
                        verbose: true,
                    })
                );

                return;
            }

            setSelectedSquare(null);
            setLegalMoves([]);
            return;
        }

        setGame(newGame);

        socket?.emit("player_move", {
            roomId,
            move: { from: move.from, to: move.to },
        });

        setSelectedSquare(null);
        setLegalMoves([]);
    };

    return {
        selectedSquare,
        legalMoves,
        onPressSquare,
        checkSquare: null,
    };
}