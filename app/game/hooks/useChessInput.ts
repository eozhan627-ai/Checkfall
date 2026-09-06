import { Chess } from "chess.js";
import { useState } from "react";

export function useChessInput({
     game,
    setGame,
    socket,
    roomId,
    myColor,
    setPromotionMove,
    setShowPromotion,
    setMoveHistory,
    setLastMove,
    checkGameEnd: checkGameState,

}: any) {
    const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
    const [legalMoves, setLegalMoves] = useState<any[]>([]);

    const onPressSquare = (square: string) => {
        const turn = game.turn();

        if (myColor && turn !== myColor) {
            return;
        }

        const piece = game.get(square as any);

        if (!selectedSquare) {
            if (!piece) return;

            if (piece.color !== myColor) return;

            setSelectedSquare(square);

            setLegalMoves(
                game.moves({
                    square: square as any,
                    verbose: true,
                })
            );

            return;
        }

        const selectedPiece = game.get(selectedSquare as any);

        const isPromotion =
            selectedPiece?.type === "p" &&
            (
                (selectedPiece.color === "w" && square[1] === "8") ||
                (selectedPiece.color === "b" && square[1] === "1")
            );

        if (isPromotion) {
            const promotionLegal = legalMoves.some(
                (m) => m.to === square
            );

            if (promotionLegal) {
                setPromotionMove({
                    from: selectedSquare,
                    to: square,
                });

                setShowPromotion(true);

                return;
            }
        }

        const newGame = new Chess(game.fen());

        let move = null;

        try {
            const isPromotionMove =
                selectedPiece?.type === "p" &&
                ((selectedPiece.color === "w" && square[1] === "8") ||
                    (selectedPiece.color === "b" && square[1] === "1"));

            move = newGame.move({
                from: selectedSquare,
                to: square,
                promotion: isPromotionMove ? "q" : undefined,
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

        setMoveHistory((prev: string[]) => [...prev, move.san]);

        setLastMove({
            from: move.from,
            to: move.to,
        });

        checkGameState(newGame);

        socket?.emit("player_move", {
            roomId,
            move: {
                from: move.from,
                to: move.to,
                promotion: move.promotion,
            },
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