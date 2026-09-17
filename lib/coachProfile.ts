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

export type Weakness = { mistake_type: string; count: number };
export type Lesson = {
    id: string;
    mistake_type: string;
    title: string;
    explanation: string;
    example_fens: { source: "own" | "generic"; fen?: string; gameId?: string; moveIndex?: number }[];
    completed_at: string | null;
};

export function getWeaknesses(socket: Socket) {
    return emitWithAck<{ weaknesses: Weakness[] }>(socket, "get_weaknesses");
}

export function generateLesson(socket: Socket, mistakeType: string) {
    return emitWithAck<{ lesson: Lesson }>(socket, "generate_lesson", { mistakeType });
}

export function getLessons(socket: Socket) {
    return emitWithAck<{ lessons: Lesson[] }>(socket, "get_lessons");
}