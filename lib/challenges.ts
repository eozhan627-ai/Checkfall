// Challenges between friends and clan mates (friendly or rated).
//
// Any screen can start a challenge with startChallenge(); the pop-ups
// ("waiting for Bob", "Alice challenges you") are shown by ChallengeHost,
// which is mounted once for the whole app.

import type { Socket } from "socket.io-client";
import { emitWithAck } from "./socketAck";
import { tr } from "./i18n";

export type ChallengePlayer = {
    id: string;
    username: string;
    avatar?: string | null;
    rating?: number | null;
};

/** The colour the challenger wants to play. */
export type ChallengeColor = "w" | "b" | "random";

export type ChallengeSettings = {
    /** Id of a time control, e.g. "5+2" (see lib/timeControls.ts). */
    timeControl: string;
    color: ChallengeColor;
    /** Rated games change the rating; their colours are always drawn. */
    rated: boolean;
};

export function sendChallenge(socket: Socket, targetAuthId: string, settings: ChallengeSettings) {
    return emitWithAck<{ challengeId: string; expiresInMs: number }>(socket, "challenge_user", {
        targetAuthId,
        timeControl: settings.timeControl,
        // The server ignores a colour wish in rated games.
        color: settings.rated ? "random" : settings.color,
        rated: settings.rated,
    });
}

export function respondChallenge(socket: Socket, challengeId: string, accept: boolean) {
    return emitWithAck<{}>(socket, "challenge_response", { challengeId, accept });
}

export function cancelChallenge(socket: Socket, challengeId: string) {
    socket.emit("challenge_cancel", { challengeId });
}

export function challengeErrorText(code: string): string {
    const map: Record<string, string> = {
        NOT_AUTHENTICATED: "Sign in to challenge other players.",
        TARGET_OFFLINE: "This player is not online right now.",
        TARGET_BUSY: "This player is in a game right now.",
        ALREADY_IN_GAME: "Finish your current game first.",
        NOT_ALLOWED: "You can only challenge friends and members of your clan.",
        RATE_LIMITED: "Please wait a moment before the next challenge.",
        CHALLENGE_NOT_FOUND: "This challenge is no longer open.",
        TIMEOUT: "The server did not answer. Please check your connection.",
    };

    return tr(map[code] || "The challenge could not be sent.");
}

// =============================
// REQUESTS FROM SCREENS TO THE HOST
// =============================

type Listener = (target: ChallengePlayer) => void;

const listeners = new Set<Listener>();

/** Called by ChallengeHost. Returns an unsubscribe function. */
export function onChallengeRequested(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Opens the challenge settings (time, colour, rated) for this player. */
export function startChallenge(target: ChallengePlayer) {
    listeners.forEach((listener) => listener(target));
}

// =============================
// WHO OPENS THE BOARD
// =============================
// A challenge that is accepted arrives as a normal "game_start". Screens
// that already react to game starts themselves (matchmaking, the online
// board with its rematch) register here, so ChallengeHost does not open a
// second board on top of them.

let gameStartOwners = 0;

/** Call on mount; call the returned function on unmount. */
export function claimGameStart(): () => void {
    gameStartOwners += 1;
    let released = false;

    return () => {
        if (released) return;
        released = true;
        gameStartOwners = Math.max(0, gameStartOwners - 1);
    };
}

export function isGameStartClaimed(): boolean {
    return gameStartOwners > 0;
}
