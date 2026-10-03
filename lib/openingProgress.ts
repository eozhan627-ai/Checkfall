// Best result per opening in the opening trainer, stored on this device.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "opening_progress_v1";

/** Opening id -> best number of stars (1-3) in practice mode. */
export type OpeningProgress = Record<string, number>;

export async function getOpeningProgress(): Promise<OpeningProgress> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const value = raw ? JSON.parse(raw) : {};
        return value && typeof value === "object" ? value : {};
    } catch {
        return {};
    }
}

export async function saveOpeningResult(id: string, stars: number) {
    try {
        const all = await getOpeningProgress();
        all[id] = Math.max(all[id] ?? 0, stars);
        await AsyncStorage.setItem(KEY, JSON.stringify(all));
    } catch {
        // Progress is nice to have - it must never block the trainer.
    }
}
