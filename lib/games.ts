import { supabase } from "./supabase";
import type { Socket } from "socket.io-client";
import { log } from "./log";

type Ack<T> = { ok: true } & T | { ok: false; error: string; quota?: AnalysisQuota };

/** Analyses left today for players without VIP. */
export type AnalysisQuota = {
    freePerDay: number;
    freeLeft: number;
    /** How many more analyses can be unlocked with an ad today. */
    adsLeft: number;
};

/** Error of an analysis request; `quota` is set for DAILY_LIMIT. */
export type AnalysisError = Error & { quota?: AnalysisQuota };

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
                const error: AnalysisError = new Error(response?.error || "UNKNOWN_ERROR");
                error.quota = response?.quota;
                reject(error);
            }
        });
    });
}

/**
 * Asks the server to analyse a game. Without VIP one analysis a day is
 * free; after that the request fails with "DAILY_LIMIT" (see AnalysisError).
 *
 * @param playerColor colour the user played - only needed for games saved
 *        before the colour was stored with the game
 * @param options.adUnlock the user is watching an ad for this analysis: the
 *        server starts right away and releases the result after
 *        confirmAnalysisAd()
 */
export function requestGameAnalysis(
    socket: Socket,
    gameId: string,
    playerColor?: "w" | "b" | null,
    options: { adUnlock?: boolean } = {}
) {
    return emitWithAck<{ started: boolean; cached?: boolean; joined?: boolean; adLocked?: boolean }>(
        socket,
        "analyze_game",
        {
            gameId,
            ...(playerColor ? { playerColor } : {}),
            ...(options.adUnlock ? { adUnlock: true } : {}),
        }
    );
}

/** The ad was watched to the end: the server releases the analysis. */
export function confirmAnalysisAd(socket: Socket, gameId: string) {
    return emitWithAck<{ ready: boolean }>(socket, "analysis_ad_done", { gameId });
}

export type AnalysisProgressMove = {
    /** -1 = start position */
    ply: number;
    moveNumber: number;
    color: "w" | "b";
    san: string;
};

export type AnalysisProgressEvent = {
    gameId: string;
    progress: number;
    total: number;
    /** Waiting for a free engine on the server. */
    queued?: boolean;
    queuePosition?: number;
    /** Moves the engines are checking right now. */
    active?: AnalysisProgressMove[];
    /** The evaluation that just came in (centipawns, White's view). */
    last?: AnalysisProgressMove & { evalCp: number; mate: boolean };
};

export function onAnalysisProgress(
    socket: Socket,
    cb: (data: AnalysisProgressEvent) => void
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
    playerColor,
    opponentName,
}: {
    userId: string;
    opponentId?: string | null;
    mode: GameMode;
    result: GameResult;
    pgn: string;
    /** Colour the user played - lets the review say "you" and "your opponent". */
    playerColor?: "w" | "b" | null;
    /** Shown in the review when the opponent has no account (bot, guest). */
    opponentName?: string | null;
}): Promise<string | null> {
    const base = {
        user_id: userId,
        opponent_id: opponentId ?? null,
        mode,
        result,
        pgn,
    };

    const insert = (row: Record<string, unknown>) =>
        supabase.from("games").insert(row).select("id").single();

    try {
        let { data, error } = await insert({
            ...base,
            player_color: playerColor ?? null,
            opponent_name: opponentName ?? null,
        });

        // Database not updated yet (columns missing): save without the
        // extra fields rather than losing the game.
        // Whatever went wrong with the extra fields, try once more with the
        // basic ones - a saved game matters more than its extras.
        if (error) {
            console.warn("SAVE GAME RECORD (with extras) failed:", error.code, error.message);
            ({ data, error } = await insert(base));
        }

        if (error) {
            // Always visible (also in release logs): without the saved game
            // there is no analysis button.
            console.warn("SAVE GAME RECORD ERROR:", error.code, error.message);
            return null;
        }

        return data?.id ?? null;
    } catch (error) {
        log("SAVE GAME RECORD ERROR:", error);
        return null;
    }
}
