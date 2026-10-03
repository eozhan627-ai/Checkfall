// Daily limits for puzzles and lessons, counted on this device.
// (The analysis limit is counted by the game server, see lib/games.ts.)

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCurrentAccount } from "./account";
import {
    AD_BONUS,
    Allowance,
    allowanceFor,
    dayKey,
    DayUsage,
    LimitKind,
    Tier,
    usageForToday,
} from "./dailyLimitRules";

export type { Allowance, LimitKind } from "./dailyLimitRules";

const KEY: Record<LimitKind, string> = {
    puzzle: "daily_limit_puzzle_v1",
    lesson: "daily_limit_lesson_v1",
};

async function readUsage(kind: LimitKind): Promise<DayUsage> {
    try {
        const raw = await AsyncStorage.getItem(KEY[kind]);
        return usageForToday(raw ? JSON.parse(raw) : null, dayKey());
    } catch {
        return usageForToday(null, dayKey());
    }
}

async function writeUsage(kind: LimitKind, usage: DayUsage) {
    try {
        await AsyncStorage.setItem(KEY[kind], JSON.stringify(usage));
    } catch {
        // Without storage the limit simply does not apply.
    }
}

async function currentTier(): Promise<Tier> {
    const account = await getCurrentAccount();
    return (account?.vipTier as Tier | undefined) ?? "none";
}

/** How many puzzles / lessons are left today. */
export async function getAllowance(kind: LimitKind): Promise<Allowance> {
    const [tier, usage] = await Promise.all([currentTier(), readUsage(kind)]);
    return allowanceFor(kind, tier, usage);
}

/** Counts one use and returns what is left afterwards. */
export async function consume(kind: LimitKind): Promise<Allowance> {
    const [tier, usage] = await Promise.all([currentTier(), readUsage(kind)]);
    const next = { ...usage, used: usage.used + 1 };

    await writeUsage(kind, next);
    return allowanceFor(kind, tier, next);
}

/** After a watched ad: more uses for today. */
export async function grantAdBonus(kind: LimitKind): Promise<Allowance> {
    const [tier, usage] = await Promise.all([currentTier(), readUsage(kind)]);
    const next = { ...usage, bonus: usage.bonus + AD_BONUS[kind] };

    await writeUsage(kind, next);
    return allowanceFor(kind, tier, next);
}
