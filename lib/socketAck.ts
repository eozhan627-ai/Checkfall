import type { Socket } from "socket.io-client";

type Ack<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Sends an event and waits for the server's answer.
 *
 * Rejects with an Error whose message is the server's error code, or
 * "TIMEOUT" when no answer arrives (server asleep, connection lost) - so a
 * screen never waits forever.
 */
export function emitWithAck<T>(
    socket: Socket,
    event: string,
    payload: Record<string, unknown> = {},
    timeoutMs = 12000
): Promise<T> {
    return new Promise((resolve, reject) => {
        let settled = false;

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error("TIMEOUT"));
        }, timeoutMs);

        socket.emit(event, payload, (response: Ack<T>) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);

            if (response?.ok) resolve(response as unknown as T);
            else reject(new Error(response?.error || "UNKNOWN_ERROR"));
        });
    });
}
