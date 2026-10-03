// Exercises taken from the user's own games (see the coach screen). They are
// kept in memory per lesson id, so the lesson screens can pick them up
// without passing long data through the route parameters.

import type { Lesson } from "./coachProfile";
import type { LessonExercise } from "./lessonContent";

const store = new Map<string, LessonExercise[]>();

/** Playable exercises of a personal lesson (positions from the user's games). */
export function exercisesFromLesson(lesson: Lesson): LessonExercise[] {
    return (lesson.example_fens || [])
        .filter(
            (example) =>
                example.source === "own" &&
                typeof example.fen === "string" &&
                Array.isArray(example.moves) &&
                example.moves.length > 0
        )
        .map((example) => ({
            fen: example.fen as string,
            moves: example.moves as string[],
            hint: example.hint || "Look at checks, captures and threats first.",
            why: example.why || "This was the engine's choice in your game.",
            intro: example.intro,
            fromOwnGame: true,
        }));
}

export function rememberLesson(lesson: Lesson) {
    store.set(lesson.id, exercisesFromLesson(lesson));
}

export function getPersonalExercises(lessonId?: string | null): LessonExercise[] {
    if (!lessonId) return [];
    return store.get(lessonId) ?? [];
}
