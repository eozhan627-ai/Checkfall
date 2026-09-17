import { supabase } from "./supabase";
import type { Socket } from "socket.io-client";

type Ack<T> = { ok: true } & T | { ok: false; error: string };

function emitWithAck<T>(
    socket: Socket,
    event: string,
    payload: Record<string, unknown> = {}
): Promise<T> {
    return new Promise((resolve, reject) => {
        socket.emit(event, payload, (response: Ack<T>) => {
            if (response?.ok) {
                resolve(response as unknown as T);
            } else {
                reject(new Error(response?.error || "UNKNOWN_ERROR"));
            }
        });
    });
}

export function requestGameAnalysis(socket: Socket, gameId: string) {
    return emitWithAck<{ started: boolean; cached?: boolean }>(
        socket,
        "analyze_game",
        { gameId }
    );
}

export function onAnalysisProgress(
    socket: Socket,
    cb: (data: { gameId: string; progress: number; total: number }) => void
) {
    socket.on("analysis_progress", cb);
    return () => socket.off("analysis_progress", cb);
}

export function onAnalysisComplete(
    socket: Socket,
    cb: (data: { gameId: string; analysis: any }) => void
) {
    socket.on("analysis_complete", cb);
    return () => socket.off("analysis_complete", cb);
}

export function onAnalysisError(
    socket: Socket,
    cb: (data: { gameId: string; error: string }) => void
) {
    socket.on("analysis_error", cb);
    return () => socket.off("analysis_error", cb);
}

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
}): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from("games")
            .insert({
                user_id: userId,
                opponent_id: opponentId ?? null,
                mode,
                result,
                pgn,
            })
            .select("id")
            .single();

        if (error) {
            console.log("SAVE GAME RECORD ERROR:", error);
            return null;
        }

        return data?.id ?? null;
    } catch (error) {
        console.log("SAVE GAME RECORD ERROR:", error);
        return null;
    }
}