import { supabase } from "./supabase";

export type GameMode = "bot" | "local" | "online";
export type GameResult = "win" | "loss" | "draw" | "aborted";

export async function saveGameRecord({
    userId,
    opponentId,
    mode,
    result,
    pgn,
}: {
    userId: string;
    opponentId?: string | null;
    mode: GameMode;
    result: GameResult;
    pgn: string;
}) {
    try {
        const { error } = await supabase.from("games").insert({
            user_id: userId,
            opponent_id: opponentId ?? null,
            mode,
            result,
            pgn,
        });

        if (error) {
            console.log("SAVE GAME RECORD ERROR:", error);
        }
    } catch (error) {
        console.log("SAVE GAME RECORD ERROR:", error);
    }
}