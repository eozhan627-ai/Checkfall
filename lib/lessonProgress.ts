import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lessonProgress:v1";

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

export async function saveLessonResult(mistakeType: string, stars: number, maxStars: number) {
    try {
        const all = await getLessonProgress();
        const prev = all[mistakeType];
        all[mistakeType] = {
            bestStars: Math.max(prev?.bestStars ?? 0, stars),
            maxStars,
        };
        await AsyncStorage.setItem(KEY, JSON.stringify(all));
    } catch {
        // Fortschritt ist nice-to-have, darf die Lektion nie blockieren
    }
}