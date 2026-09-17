import type { Socket } from "socket.io-client";

type Ack<T> = { ok: true } & T | { ok: false; error: string };

function emitWithAck<T>(socket: Socket, event: string, payload: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
        socket.emit(event, payload, (response: Ack<T>) => {
            if (response?.ok) resolve(response as unknown as T);
            else reject(new Error(response?.error || "UNKNOWN_ERROR"));
        });
    });
}

export function askCoach(
    socket: Socket,
    params: { gameId: string; moveIndex?: number; question: string }
) {
    return emitWithAck<{ answer: string; remaining: number }>(socket, "coach_message", params);
}