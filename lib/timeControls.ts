// Time controls for online games. The game server has the same list
// (index.js, TIME_CONTROLS) - an id it does not know is played as 5+2.

import AsyncStorage from "@react-native-async-storage/async-storage";

export type TimeCategory = "Bullet" | "Blitz" | "Rapid" | "Classical";

export type TimeControl = {
    /** "minutes+increment", e.g. "5+2". This is what the server receives. */
    id: string;
    minutes: number;
    increment: number;
    category: TimeCategory;
};

export const TIME_CONTROLS: TimeControl[] = [
    { id: "1+0", minutes: 1, increment: 0, category: "Bullet" },
    { id: "2+1", minutes: 2, increment: 1, category: "Bullet" },
    { id: "3+0", minutes: 3, increment: 0, category: "Blitz" },
    { id: "3+2", minutes: 3, increment: 2, category: "Blitz" },
    { id: "5+0", minutes: 5, increment: 0, category: "Blitz" },
    { id: "5+2", minutes: 5, increment: 2, category: "Blitz" },
    { id: "10+0", minutes: 10, increment: 0, category: "Rapid" },
    { id: "10+5", minutes: 10, increment: 5, category: "Rapid" },
    { id: "15+10", minutes: 15, increment: 10, category: "Rapid" },
    { id: "30+0", minutes: 30, increment: 0, category: "Classical" },
];

export const TIME_CATEGORIES: TimeCategory[] = ["Bullet", "Blitz", "Rapid", "Classical"];

export const DEFAULT_TIME_CONTROL = "5+2";

export function getTimeControl(id?: string | null): TimeControl {
    return (
        TIME_CONTROLS.find((control) => control.id === id) ??
        (TIME_CONTROLS.find((control) => control.id === DEFAULT_TIME_CONTROL) as TimeControl)
    );
}

/** "5 min" or "5 min + 2 s". */
export function describeTimeControl(id?: string | null): string {
    const control = getTimeControl(id);
    return control.increment > 0
        ? `${control.minutes} min + ${control.increment} s`
        : `${control.minutes} min`;
}

// =============================
// LAST CHOICE
// =============================

const KEY = "time_control_v1";

export async function loadTimeControl(): Promise<string> {
    try {
        const stored = await AsyncStorage.getItem(KEY);
        return getTimeControl(stored).id;
    } catch {
        return DEFAULT_TIME_CONTROL;
    }
}

export async function saveTimeControl(id: string) {
    try {
        await AsyncStorage.setItem(KEY, getTimeControl(id).id);
    } catch {
        // Only a convenience - the game works without it.
    }
}
