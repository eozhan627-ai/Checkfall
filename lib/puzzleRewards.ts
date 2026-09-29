// Belohnungssystem für das Daily Puzzle: XP, Level und Tages-Streak.
// Benötigt: npx expo install @react-native-async-storage/async-storage
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "puzzle_rewards_v1";

export type Rewards = {
    xp: number;
    streak: number;
    bestStreak: number;
    totalSolved: number;
    lastSolvedDate: string | null; // lokales Datum, z. B. "2026-09-29"
};

const EMPTY: Rewards = { xp: 0, streak: 0, bestStreak: 0, totalSolved: 0, lastSolvedDate: null };

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function todayKey() {
    return dateKey(new Date());
}
function yesterdayKey() {
    const d = new Date();
    return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
}

export function levelFromXp(xp: number) {
    return { level: Math.floor(xp / 100) + 1, progress: (xp % 100) / 100 };
}

export async function getRewards(): Promise<Rewards> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
    } catch {
        return EMPTY;
    }
}

// Streak, der gerade wirklich läuft (gestern oder heute gelöst)
export function activeStreak(r: Rewards): number {
    if (r.lastSolvedDate === todayKey() || r.lastSolvedDate === yesterdayKey()) return r.streak;
    return 0;
}

// Wurde das Daily Puzzle heute schon gelöst?
export function solvedToday(r: Rewards): boolean {
    return r.lastSolvedDate === todayKey();
}

export type AwardResult = {
    rewards: Rewards;
    xpGain: number;
    alreadySolvedToday: boolean;
    leveledUp: boolean;
};

// Belohnung für das gelöste Daily Puzzle. XP gibt es nur beim ersten Lösen pro Tag.
export async function awardDailyPuzzle(stars: number, rating: number): Promise<AwardResult> {
    const current = await getRewards();

    if (current.lastSolvedDate === todayKey()) {
        return { rewards: current, xpGain: 0, alreadySolvedToday: true, leveledUp: false };
    }

    const streak = current.lastSolvedDate === yesterdayKey() ? current.streak + 1 : 1;
    const xpGain = 20 + Math.round(rating / 100) + stars * 10 + Math.min(streak, 7) * 5;

    const next: Rewards = {
        xp: current.xp + xpGain,
        streak,
        bestStreak: Math.max(current.bestStreak, streak),
        totalSolved: current.totalSolved + 1,
        lastSolvedDate: todayKey(),
    };

    try {
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        /* Belohnung wird dann nur nicht gespeichert */
    }

    return {
        rewards: next,
        xpGain,
        alreadySolvedToday: false,
        leveledUp: levelFromXp(next.xp).level > levelFromXp(current.xp).level,
    };
}