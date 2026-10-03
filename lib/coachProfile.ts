import type { Socket } from "socket.io-client";
import { emitWithAck } from "./socketAck";

export type Weakness = { mistake_type: string; count: number };

/** An example in a personal lesson: from the user's own game or a generic one. */
export type LessonExample = {
    source: "own" | "generic";
    fen?: string;
    gameId?: string;
    moveIndex?: number;
    motif?: string | null;
    /** Solution as coordinate moves ("e2e4"); present for playable examples. */
    moves?: string[];
    played?: string;
    bestSan?: string;
    intro?: string;
    hint?: string;
    why?: string;
};

export type Lesson = {
    id: string;
    mistake_type: string;
    title: string;
    explanation: string;
    example_fens: LessonExample[];
    completed_at: string | null;
    created_at?: string;
};

export function getWeaknesses(socket: Socket) {
    return emitWithAck<{ weaknesses: Weakness[] }>(socket, "get_weaknesses");
}

export function generateLesson(socket: Socket, mistakeType: string) {
    return emitWithAck<{ lesson: Lesson }>(socket, "generate_lesson", { mistakeType }, 20000);
}

export function getLessons(socket: Socket) {
    return emitWithAck<{ lessons: Lesson[] }>(socket, "get_lessons");
}
