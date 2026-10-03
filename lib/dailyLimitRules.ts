// Daily limits for players without (or with a small) VIP plan.
// Pure rules without storage, so they can be tested (tests/dailyLimits.test.mjs).

export type LimitKind = "puzzle" | "lesson";
export type Tier = "none" | "silver" | "gold" | "diamond";

/** Free uses per day; null = unlimited. */
export const DAILY_LIMITS: Record<LimitKind, Record<Tier, number | null>> = {
    puzzle: { none: 4, silver: null, gold: null, diamond: null },
    lesson: { none: 1, silver: 3, gold: null, diamond: null },
};

/** What one watched ad adds for today. */
export const AD_BONUS: Record<LimitKind, number> = {
    puzzle: 4,
    lesson: 1,
};

export type DayUsage = {
    /** Local date, e.g. "2026-10-02". */
    date: string;
    used: number;
    /** Extra uses earned with ads today. */
    bonus: number;
};

export type Allowance = {
    unlimited: boolean;
    used: number;
    /** Uses allowed today including the ad bonus (0 when unlimited). */
    limit: number;
    left: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(now: Date = new Date()): string {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The stored counters, reset when a new day has started. */
export function usageForToday(stored: unknown, today: string): DayUsage {
    const value = (stored && typeof stored === "object" ? stored : {}) as Partial<DayUsage>;

    if (value.date !== today) return { date: today, used: 0, bonus: 0 };

    const number = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
    return { date: today, used: number(value.used), bonus: number(value.bonus) };
}

export function allowanceFor(kind: LimitKind, tier: Tier | string | null | undefined, usage: DayUsage): Allowance {
    // An unknown plan is treated like no plan.
    const known = (tier && tier in DAILY_LIMITS[kind] ? tier : "none") as Tier;
    const base = DAILY_LIMITS[kind][known];

    if (base === null) return { unlimited: true, used: usage.used, limit: 0, left: Infinity };

    const limit = base + usage.bonus;
    return { unlimited: false, used: usage.used, limit, left: Math.max(0, limit - usage.used) };
}
