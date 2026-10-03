import AsyncStorage from "@react-native-async-storage/async-storage";
import { LESSON_PROGRESS_KEY, schedulePushProgress } from "./progressSync";

const KEY = LESSON_PROGRESS_KEY;

export type LessonProgress = {
    /** Beste Sternesumme (max. 3 pro Übung) */
    bestStars: number;
    maxStars: number;
};

export type LessonProgressMap = Record<string, LessonProgress>;

export async function getLessonProgress(): Promise<LessonProgressMap> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        return raw ? (JSON.parse(raw) as LessonProgressMap) : {};
    } catch {
        return {};
    }
}

/**
 * Key under which a result is stored. Lessons that include positions from the
 * user's own games are counted separately from the standard tutorial, because
 * they have a different number of exercises.
 */
export function lessonProgressKey(mistakeType: string | null | undefined, personal = false): string {
    const type = mistakeType || "unknown";
    return personal ? `own:${type}` : type;
}

/** The better of two results - by share of stars, then by number of stars. */
export function betterLessonResult(a: LessonProgress | undefined | null, b: LessonProgress): LessonProgress {
    if (!a || a.maxStars <= 0) return b;
    if (b.maxStars <= 0) return a;

    const shareA = a.bestStars / a.maxStars;
    const shareB = b.bestStars / b.maxStars;

    if (shareA === shareB) return a.maxStars >= b.maxStars ? a : b;
    return shareA > shareB ? a : b;
}

export type LessonResultEntry = { key: string; stars: number; maxStars: number };

/** Stores one or more results in a single write (so they cannot overwrite each other). */
export async function saveLessonResults(entries: LessonResultEntry[]) {
    const valid = entries.filter((entry) => entry.maxStars > 0);
    if (valid.length === 0) return;

    try {
        const all = await getLessonProgress();

        for (const entry of valid) {
            all[entry.key] = betterLessonResult(all[entry.key], {
                bestStars: Math.max(0, Math.min(entry.stars, entry.maxStars)),
                maxStars: entry.maxStars,
            });
        }

        await AsyncStorage.setItem(KEY, JSON.stringify(all));
        schedulePushProgress();
    } catch {
        // Progress is nice to have - it must never block the lesson.
    }
}

export function saveLessonResult(key: string, stars: number, maxStars: number) {
    return saveLessonResults([{ key, stars, maxStars }]);
}
