// Pure merge logic for learning progress (no storage, no network), so it can
// be unit-tested. Used by progressSync.ts.
//
// This file imports nothing, so the tests can load it directly. The shop part
// therefore only knows the stored shape; which designs exist and what they
// cost is in boardThemes.ts.

const num = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

export type RewardsData = {
    xp: number;
    streak: number;
    bestStreak: number;
    totalSolved: number;
    lastSolvedDate: string | null; // "YYYY-MM-DD"
};

export type LessonProgressData = Record<
    string,
    { bestStars: number; maxStars: number }
>;

export type ProgressSnapshot = {
    rewards: RewardsData;
    solvedPuzzles: string[];
    lessons: LessonProgressData;
    /** Coins and bought board designs (see boardThemes.ts). */
    shop: ShopData;
};

export type ShopData = {
    /** All coins ever earned; what was spent follows from `owned`. */
    coinsEarned: number;
    owned: string[];
    boardTheme: string;
};

const DEFAULT_THEME = "classic";

export const EMPTY_SHOP: ShopData = { coinsEarned: 0, owned: [], boardTheme: DEFAULT_THEME };

function normalizeShop(raw: unknown): ShopData {
    const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const owned = Array.isArray(source.owned)
        ? Array.from(new Set(source.owned.filter((id): id is string => typeof id === "string" && id.length < 40)))
        : [];

    return {
        coinsEarned: Math.floor(num(source.coinsEarned)),
        owned: owned.sort(),
        boardTheme: typeof source.boardTheme === "string" && source.boardTheme ? source.boardTheme : DEFAULT_THEME,
    };
}

// The higher number of earned coins and every bought design from both sides:
// nothing bought is lost and no coins appear from nowhere. `mine` decides
// which design is in use.
function mergeShop(mine: ShopData, other: ShopData): ShopData {
    return {
        coinsEarned: Math.max(mine.coinsEarned, other.coinsEarned),
        owned: Array.from(new Set([...mine.owned, ...other.owned])).sort(),
        boardTheme: mine.boardTheme !== DEFAULT_THEME ? mine.boardTheme : other.boardTheme,
    };
}

export const EMPTY_REWARDS: RewardsData = {
    xp: 0,
    streak: 0,
    bestStreak: 0,
    totalSolved: 0,
    lastSolvedDate: null,
};

export const EMPTY_PROGRESS: ProgressSnapshot = {
    rewards: EMPTY_REWARDS,
    solvedPuzzles: [],
    lessons: {},
    shop: EMPTY_SHOP,
};

// Accepts anything (e.g. JSON from the database) and returns a valid snapshot.
export function normalizeProgress(raw: unknown): ProgressSnapshot {
    const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
    const rewards = (source.rewards && typeof source.rewards === "object"
        ? source.rewards
        : {}) as Record<string, unknown>;

    const lessons: LessonProgressData = {};

    if (source.lessons && typeof source.lessons === "object") {
        for (const [key, value] of Object.entries(source.lessons as Record<string, any>)) {
            if (!value || typeof value !== "object") continue;
            lessons[key] = {
                bestStars: num(value.bestStars),
                maxStars: num(value.maxStars),
            };
        }
    }

    return {
        rewards: {
            xp: num(rewards.xp),
            streak: num(rewards.streak),
            bestStreak: num(rewards.bestStreak),
            totalSolved: num(rewards.totalSolved),
            lastSolvedDate:
                typeof rewards.lastSolvedDate === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(rewards.lastSolvedDate)
                    ? rewards.lastSolvedDate
                    : null,
        },
        solvedPuzzles: Array.isArray(source.solvedPuzzles)
            ? Array.from(
                  new Set(
                      source.solvedPuzzles.filter(
                          (id: unknown): id is string => typeof id === "string"
                      )
                  )
              )
            : [],
        lessons,
        shop: normalizeShop(source.shop),
    };
}

// Combines two snapshots so that nothing already earned is lost:
// the higher XP / totals win, solved puzzles are united, and the streak is
// taken from whichever side solved a puzzle most recently.
type LessonResult = { bestStars: number; maxStars: number };

/**
 * The better of two lesson results. Compared by the share of stars, so the
 * pair (stars, maximum) always belongs together - a lesson can have a
 * different number of exercises on another device.
 */
function betterLesson(a: LessonResult, b: LessonResult): LessonResult {
    if (a.maxStars <= 0) return b;
    if (b.maxStars <= 0) return a;

    const shareA = a.bestStars / a.maxStars;
    const shareB = b.bestStars / b.maxStars;

    if (shareA === shareB) return a.maxStars >= b.maxStars ? a : b;
    return shareA > shareB ? a : b;
}

export function mergeProgress(
    a: ProgressSnapshot,
    b: ProgressSnapshot
): ProgressSnapshot {
    const dateA = a.rewards.lastSolvedDate ?? "";
    const dateB = b.rewards.lastSolvedDate ?? "";

    let streak: number;
    let lastSolvedDate: string | null;

    if (dateA === dateB) {
        streak = Math.max(a.rewards.streak, b.rewards.streak);
        lastSolvedDate = a.rewards.lastSolvedDate;
    } else if (dateA > dateB) {
        streak = a.rewards.streak;
        lastSolvedDate = a.rewards.lastSolvedDate;
    } else {
        streak = b.rewards.streak;
        lastSolvedDate = b.rewards.lastSolvedDate;
    }

    const lessons: LessonProgressData = { ...a.lessons };

    for (const [key, value] of Object.entries(b.lessons)) {
        const existing = lessons[key];
        lessons[key] = existing ? betterLesson(existing, value) : value;
    }

    return {
        rewards: {
            xp: Math.max(a.rewards.xp, b.rewards.xp),
            streak,
            bestStreak: Math.max(a.rewards.bestStreak, b.rewards.bestStreak, streak),
            totalSolved: Math.max(a.rewards.totalSolved, b.rewards.totalSolved),
            lastSolvedDate,
        },
        solvedPuzzles: Array.from(new Set([...a.solvedPuzzles, ...b.solvedPuzzles])),
        lessons,
        // `a` is this device: its choice of design wins.
        shop: mergeShop(a.shop, b.shop),
    };
}

export function progressEquals(a: ProgressSnapshot, b: ProgressSnapshot): boolean {
    const sortKeys = (snapshot: ProgressSnapshot) =>
        JSON.stringify({
            rewards: [
                snapshot.rewards.xp,
                snapshot.rewards.streak,
                snapshot.rewards.bestStreak,
                snapshot.rewards.totalSolved,
                snapshot.rewards.lastSolvedDate,
            ],
            solvedPuzzles: [...snapshot.solvedPuzzles].sort(),
            lessons: Object.keys(snapshot.lessons)
                .sort()
                .map((key) => [
                    key,
                    snapshot.lessons[key].bestStars,
                    snapshot.lessons[key].maxStars,
                ]),
            shop: [snapshot.shop.coinsEarned, [...snapshot.shop.owned].sort(), snapshot.shop.boardTheme],
        });

    return sortKeys(a) === sortKeys(b);
}
